"""Offline checks: .venv/bin/python tests/dashboard-jobs.test.py"""
import importlib.util
from pathlib import Path
import unittest
import os
import tempfile
import time
from unittest.mock import Mock, patch

spec = importlib.util.spec_from_file_location("dashboard_jobs", Path(__file__).resolve().parents[1] / "pipeline/refresh_dashboard_jobs.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class RepetitiveTaskTests(unittest.TestCase):
    def test_skill_requirements_are_not_task_evidence(self):
        for text in ("Excel skills are an advantage.", "Arvostamme manuaalisia taitoja.", "Excellent communication skills."):
            self.assertEqual(module.repetitive_quote(text), "")

    def test_explicit_tasks_have_short_verbatim_evidence(self):
        for text in ("You will maintain Excel spreadsheets and prepare reports.", "Tehtävään kuuluu tietojen syöttäminen järjestelmiin.", "Vastaat laskujen kirjaamisesta ja täsmäytyksistä.", "You will perform manual data entry between systems."):
            quote = module.repetitive_quote(text)
            self.assertTrue(quote)
            self.assertIn(quote, text)
            self.assertLessEqual(len(quote.split()), 25)

    def test_long_sentences_keep_the_actual_matching_task(self):
        text = "Join our team " * 20 + "and maintain Excel spreadsheets each day to track incoming orders"
        quote = module.repetitive_quote(text)
        self.assertIn("maintain Excel spreadsheets", quote)
        self.assertIn(quote, text)
        self.assertLessEqual(len(quote.split()), 25)


class FetchCacheTests(unittest.TestCase):
    def fetcher(self, directory):
        fetcher = module.FreshFetcher.__new__(module.FreshFetcher)
        fetcher.cache_dir = Path(directory)
        fetcher.page_fetched_at = {}
        fetcher._request = Mock(return_value="fresh page")
        return fetcher

    def test_recent_ad_reuses_cache_and_original_source_timestamp(self):
        with tempfile.TemporaryDirectory() as directory:
            fetcher = self.fetcher(directory)
            url = "https://www.jobly.fi/tyopaikka/example-123"
            cache = fetcher._cache_path(url)
            cache.write_text("saved ad")
            timestamp = time.time() - 60
            os.utime(cache, (timestamp, timestamp))
            self.assertEqual(fetcher._get_raw(url), "saved ad")
            fetcher._request.assert_not_called()
            self.assertAlmostEqual(fetcher.page_fetched_at[url], timestamp, places=3)

    def test_stale_ad_and_listing_are_fetched_again(self):
        for url, age in (("https://www.jobly.fi/tyopaikka/example-123", 901), ("https://www.jobly.fi/tyopaikat/talous-ja-rahoitus", 121)):
            with tempfile.TemporaryDirectory() as directory:
                fetcher = self.fetcher(directory)
                cache = fetcher._cache_path(url)
                cache.write_text("stale page")
                os.utime(cache, (time.time() - age, time.time() - age))
                self.assertEqual(fetcher._get_raw(url), "fresh page")
                fetcher._request.assert_called_once_with(url)
                self.assertEqual(cache.read_text(), "fresh page")

    def test_recent_robots_rules_are_reused(self):
        with tempfile.TemporaryDirectory() as directory:
            fetcher = self.fetcher(directory)
            url = "https://www.jobly.fi/robots.txt"
            cache = fetcher._cache_path(url)
            cache.write_text("User-agent: *\nCrawl-delay: 10")
            self.assertIn("Crawl-delay: 10", fetcher._get_raw(url))
            fetcher._request.assert_not_called()


class RequestTimingTests(unittest.TestCase):
    def test_successful_dashboard_requests_have_no_sleep(self):
        with tempfile.TemporaryDirectory() as directory, patch("scraper.fetch.RAW_DIR", Path(directory)):
            fetcher = module.FreshFetcher("test")
            fetcher.client.close()
            response = Mock(status_code=200, text="Job description")
            fetcher.client = Mock()
            fetcher.client.get.return_value = response
            with patch.object(module.time, "sleep") as sleep:
                fetcher._request("https://www.jobly.fi/tyopaikka/one")
                fetcher._request("https://www.jobly.fi/tyopaikka/two")
                sleep.assert_not_called()
            self.assertEqual(fetcher.network_calls, 2)

    def test_rate_limit_errors_still_back_off(self):
        with tempfile.TemporaryDirectory() as directory, patch("scraper.fetch.RAW_DIR", Path(directory)):
            fetcher = module.FreshFetcher("test")
            fetcher.client.close()
            fetcher.client = Mock()
            fetcher.client.get.side_effect = [Mock(status_code=429), Mock(status_code=200, text="Job description")]
            with patch.object(module.time, "sleep") as sleep:
                self.assertEqual(fetcher._request("https://www.jobly.fi/tyopaikka/one"), "Job description")
                sleep.assert_called_once_with(15)


if __name__ == "__main__":
    unittest.main()
