"""Offline checks: .venv/bin/python tests/dashboard-sync.test.py"""
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "pipeline"))
from sync_dashboard_jobs import Supabase, sync


class ScheduledSyncTests(unittest.TestCase):
    def test_rotating_batch_is_saved_with_claimed_lease(self):
        store = Mock()
        store.rpc.side_effect = [{"token": "lease", "offset": 17}, None]
        ads = [{"url": "https://www.jobly.fi/tyopaikka/example", "quote": "data entry"}]
        scrape = Mock(return_value={"ads": ads})
        sync(store, scrape)
        scrape.assert_called_once_with(17)
        self.assertEqual(store.rpc.call_args_list[1].args,
                         ("finish_dashboard_job_refresh", {"p_token": "lease", "p_ads": ads}))

    def test_overlapping_run_skips_scraping(self):
        store = Mock()
        store.rpc.return_value = None
        scrape = Mock()
        sync(store, scrape)
        scrape.assert_not_called()
        store.rpc.assert_called_once_with("claim_dashboard_job_refresh", {})

    def test_source_failure_and_empty_batch_preserve_saved_data(self):
        for scrape in (Mock(side_effect=RuntimeError("source blocked")), Mock(return_value={"ads": []})):
            with self.subTest(scrape=scrape):
                store = Mock()
                store.rpc.side_effect = [{"token": "lease", "offset": 0}, None]
                with self.assertRaises(RuntimeError):
                    sync(store, scrape)
                self.assertEqual([call.args[0] for call in store.rpc.call_args_list],
                                 ["claim_dashboard_job_refresh", "fail_dashboard_job_refresh"])

    def test_database_failure_is_reported_and_releases_lease(self):
        store = Mock()
        store.rpc.side_effect = [{"token": "lease", "offset": 0}, RuntimeError("database error"), None]
        with self.assertRaisesRegex(RuntimeError, "database error"):
            sync(store, Mock(return_value={"ads": [{"quote": ""}]}))
        self.assertEqual(store.rpc.call_args_list[-1].args,
                         ("fail_dashboard_job_refresh", {"p_token": "lease"}))

    def test_missing_or_unsafe_configuration_fails_before_network_access(self):
        for url, key in (("", ""), ("https://example.supabase.co", ""),
                         ("http://example.supabase.co", "secret"),
                         ("https://example.supabase.co/rest/v1", "secret")):
            with patch.dict(os.environ, {"SUPABASE_URL": url, "SUPABASE_SECRET_KEY": key}):
                with self.assertRaises(RuntimeError):
                    Supabase()

    def test_secret_key_is_only_sent_to_project_in_apikey_header(self):
        with patch.dict(os.environ, {"SUPABASE_URL": "https://example.supabase.co", "SUPABASE_SECRET_KEY": "sb_secret_test"}):
            with patch("sync_dashboard_jobs.urlopen") as request:
                request.return_value.__enter__.return_value.read.return_value = b'null'
                self.assertIsNone(Supabase().rpc("claim_dashboard_job_refresh", {}))
                sent = request.call_args.args[0]
                self.assertEqual(sent.full_url, "https://example.supabase.co/rest/v1/rpc/claim_dashboard_job_refresh")
                self.assertEqual(sent.get_header("Apikey"), "sb_secret_test")
                self.assertIsNone(sent.get_header("Authorization"))

    def test_pasted_newlines_are_removed_before_sending_headers(self):
        with patch.dict(os.environ, {"SUPABASE_URL": " https://example.supabase.co/\n", "SUPABASE_SECRET_KEY": "\n sb_secret_\ntest\r\n"}):
            with patch("sync_dashboard_jobs.urlopen") as request:
                request.return_value.__enter__.return_value.read.return_value = b'null'
                Supabase().rpc("claim_dashboard_job_refresh", {})
                sent = request.call_args.args[0]
                self.assertEqual(sent.full_url, "https://example.supabase.co/rest/v1/rpc/claim_dashboard_job_refresh")
                self.assertEqual(sent.get_header("Apikey"), "sb_secret_test")

    def test_invalid_secret_error_never_echoes_the_secret(self):
        for key in ('"sb_secret_private"', "SUPABASE_SECRET_KEY=sb_secret_private", "sb_secret_private\x01"):
            with patch.dict(os.environ, {"SUPABASE_URL": "https://example.supabase.co", "SUPABASE_SECRET_KEY": key}):
                with self.assertRaises(RuntimeError) as error:
                    Supabase()
                self.assertNotIn(key, str(error.exception))
                self.assertNotIn("private", str(error.exception))

    def test_transport_header_error_does_not_leak_the_key(self):
        with patch.dict(os.environ, {"SUPABASE_URL": "https://example.supabase.co", "SUPABASE_SECRET_KEY": "sb_secret_private"}):
            with patch("sync_dashboard_jobs.urlopen", side_effect=ValueError("Invalid header value b'sb_secret_private'")):
                with self.assertRaises(RuntimeError) as error:
                    Supabase().rpc("claim_dashboard_job_refresh", {})
                self.assertNotIn("sb_secret_private", str(error.exception))


if __name__ == "__main__":
    unittest.main()
