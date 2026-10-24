"""Scheduled discovery + rotating refresh. No API keys or manual company list.

python3 pipeline/refresh_catalog.py --batch-size 40
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import fcntl
import signal
import subprocess
import sys
import time

from company_catalog import discover_companies, load_catalog, timestamp
from fetch_efficiency import ROOT, read_json, write_json

STATUS = ROOT / 'pipeline/data/refresh_status.json'


def select_batch(companies, jobs, coverage, size):
    # Oldest attempt first, including failures: a broken source cannot monopolize the queue.
    return sorted(companies, key=lambda c: (max(jobs.get(c['id'], {}).get('sampledAt') or '',
        coverage.get(c['id'], {}).get('lastAttemptAt') or ''), c['id']))[:size]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--batch-size', type=int, default=40)
    parser.add_argument('--listing-pages', type=int, default=2)
    parser.add_argument('--year', type=int, default=datetime.now(timezone.utc).year - 1)
    args = parser.parse_args()
    if args.batch_size < 1 or args.listing_pages < 1:
        parser.error('batch-size and listing-pages must be positive')
    lock_path = ROOT / 'pipeline/.cache/refresh.lock'
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    with lock_path.open('w') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise SystemExit('Another catalog refresh is running')
        started = timestamp()
        before = time.monotonic()
        discovery = discover_companies(args.year, args.listing_pages)
        companies = load_catalog()
        status = read_json(STATUS, {})
        attempts = status.get('attempts', {})
        batch = select_batch(companies, read_json(ROOT / 'pipeline/data/job_samples.json', {}),
                             {cid: {'lastAttemptAt': at} for cid, at in attempts.items()}, args.batch_size)
        command = [sys.executable, str(ROOT / 'pipeline/fetch_efficiency.py'), '--refresh-jobs', '--year', str(args.year)]
        for company in batch:
            command.extend(['--company', company['id']])
        def interrupted(_signum, _frame):
            raise SystemExit('Refresh interrupted')
        signal.signal(signal.SIGTERM, interrupted)
        with subprocess.Popen(command, cwd=ROOT) as child:
            try:
                exit_code = child.wait()
            except BaseException:
                child.terminate()
                try:
                    child.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    child.kill()
                    child.wait()
                raise
        # The exporter checkpoints facts and samples; only mark complete attempts after it returns.
        for company in batch:
            attempts[company['id']] = started
        coverage = read_json(ROOT / 'pipeline/data/efficiency_coverage.json', {})
        write_json(STATUS, {'startedAt': started, 'completedAt': timestamp(),
            'durationSeconds': round(time.monotonic() - before), 'exitCode': exit_code,
            'companies': len(companies), 'batch': [c['id'] for c in batch], 'attempts': attempts,
            'discoveryErrors': discovery['errors'],
            'coverage': {metric: sum(metric in row['available'] for row in coverage.values())
                         for metric in ('growthGap', 'manualAds', 'adminRatio', 'inventoryDays')}})
        raise SystemExit(exit_code)


if __name__ == '__main__':
    main()
