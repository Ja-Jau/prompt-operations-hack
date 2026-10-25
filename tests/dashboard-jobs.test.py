"""Offline checks: .venv/bin/python tests/dashboard-jobs.test.py"""
import importlib.util
from pathlib import Path
import unittest

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


if __name__ == "__main__":
    unittest.main()
