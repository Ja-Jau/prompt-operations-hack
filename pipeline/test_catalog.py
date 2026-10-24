"""Offline tests: discovery and refresh scheduling never contact real sources here."""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import company_catalog as catalog
from refresh_catalog import select_batch
from fetch_job_samples import SourceClient
from urllib.error import HTTPError

LEI = '1234567890ABCDEFGHIJ'


def filing(identifier='1', **attributes):
    return {'id': identifier, 'type': 'filing',
            'attributes': {'country': 'FI', 'period_end': '2025-12-31',
                'report_url': f'/{LEI}/2025/report-en.xhtml', 'processed': '2026-03-01',
                'error_count': 0, **attributes},
            'relationships': {'entity': {'data': {'id': 'entity'}}}}


def document(rows=None):
    return {'data': rows if rows is not None else [filing()],
            'included': [{'type': 'entity', 'id': 'entity',
                          'attributes': {'identifier': LEI, 'name': 'New Company Oyj'}}]}


class CatalogTests(unittest.TestCase):
    def test_filing_index_filters_and_prefers_valid_english(self):
        data = document([filing('1', report_url='/report-fi.xhtml'),
                         filing('2', report_url='/report-en.xhtml'),
                         filing('3', report_url='/newer-en.xhtml', processed='2026-05-01', error_count=10),
                         filing('4', country='SE'), filing('5', period_end='2025-06-30')])
        reports = catalog.index_reports(data, 2025)
        self.assertEqual(len(reports), 1)
        self.assertEqual(reports[0]['reportUrl'], 'https://filings.xbrl.org/report-en.xhtml')
        self.assertEqual(reports[0]['lei'], LEI)
        self.assertEqual(catalog.index_reports(document([filing(report_url='https://unrelated.example/a')]), 2025), [])

    def test_identity_is_stable_and_does_not_merge_subsidiaries(self):
        companies = []
        a = catalog.upsert(companies, 'Example Oyj', 'https://source.test', '2026-01-01')
        self.assertIs(catalog.upsert(companies, 'Example', 'https://source.test', '2026-01-02'), a)
        catalog.upsert(companies, 'Example Services Oy', 'https://source.test', '2026-01-02')
        self.assertEqual(len(companies), 2)
        self.assertNotIn('revenueEurM', a)
        self.assertNotIn('employees', a)
        self.assertEqual(catalog.company_id('Example Oy'), catalog.company_id('Example'))

    def test_same_lei_survives_a_rename(self):
        companies = []
        a = catalog.upsert(companies, 'Old Name Oy', 'https://source.test', '2026-01-01', lei=LEI)
        self.assertIs(catalog.upsert(companies, 'New Name Oy', 'https://source.test', '2026-01-02', lei=LEI), a)
        self.assertEqual(len(companies), 1)

    def test_failed_attempts_rotate_instead_of_starving_other_companies(self):
        companies = [{'id': 'a'}, {'id': 'b'}, {'id': 'new'}]
        jobs = {'a': {'sampledAt': '2026-01-01'}, 'b': {'sampledAt': '2026-01-02'}}
        attempts = {'a': {'lastAttemptAt': '2026-02-01'}}
        self.assertEqual([c['id'] for c in select_batch(companies, jobs, attempts, 2)], ['new', 'b'])

    def test_scheduled_discovery_persists_new_companies_and_advances_cursors(self):
        listing = b'<div class="job__content"><a class="recruiter-job-link" href="/tyopaikka/test">Job</a><span class="recruiter-company-profile-job-organization">Discovered Employer Oy</span></div>'
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with patch.object(catalog, 'CATALOG_PATH', root / 'catalog.json'), \
                 patch.object(catalog, 'SOURCES_PATH', root / 'reports.json'), \
                 patch.object(catalog, 'STATE_PATH', root / 'state.json'), \
                 patch.object(catalog, 'CATEGORIES', ['']), \
                 patch.object(catalog, 'load_catalog', return_value=[]), \
                 patch.object(catalog, 'fetch', return_value=(json.dumps(document()).encode(), '2026-01-01')), \
                 patch.object(SourceClient, 'get', return_value=(listing, '2026-01-01')) as get:
                result = catalog.discover_companies(2025)
                saved = json.loads((root / 'catalog.json').read_text())
                self.assertEqual(len(saved), 2)
                self.assertEqual(result['cursors'][''], 2)
                self.assertEqual(result['errors'], [])
                self.assertEqual(get.call_count, 2)
                self.assertTrue((root / 'reports.json').exists())

    def test_job_source_stops_network_requests_after_access_limit(self):
        client = SourceClient(0)
        with patch('fetch_job_samples.fetch', side_effect=HTTPError('https://www.jobly.fi', 429, 'limit', {}, None)) as get:
            with self.assertRaises(HTTPError):
                client.get('https://www.jobly.fi/tyopaikat')
            with self.assertRaises(ValueError):
                client.get('https://www.jobly.fi/tyopaikat?page=1')
            self.assertEqual(get.call_count, 1)


if __name__ == '__main__':
    unittest.main()
