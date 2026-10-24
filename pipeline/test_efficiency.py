import copy
from datetime import date
import json
from pathlib import Path
import unittest

from efficiency_data import classify_task, employer_key, financial_metrics, job_metric
from esef import employee_table_facts, financial_record, number, parse_document, pick_fact
from fetch_job_samples import Listing, parse_posting


class ReportTests(unittest.TestCase):
    def test_inline_units_scales_and_exclusion_of_segments(self):
        document = b'''<html xmlns:ix="http://www.xbrl.org/2013/inlineXBRL"
            xmlns:x="http://www.xbrl.org/2003/instance" xmlns:d="http://xbrl.org/2006/xbrldi">
          <x:context id="group"><x:entity><x:identifier>GROUP-LEI</x:identifier></x:entity>
            <x:period><x:startDate>2025-01-01</x:startDate><x:endDate>2025-12-31</x:endDate></x:period></x:context>
          <x:context id="segment"><x:entity><x:identifier>GROUP-LEI</x:identifier>
            <x:segment><d:explicitMember dimension="SegmentAxis">RetailMember</d:explicitMember></x:segment></x:entity>
            <x:period><x:startDate>2025-01-01</x:startDate><x:endDate>2025-12-31</x:endDate></x:period></x:context>
          <x:unit id="eur"><x:measure>iso4217:EUR</x:measure></x:unit>
          <ix:nonFraction name="ifrs-full:Revenue" contextRef="group" unitRef="eur" scale="6" format="ixt:num-comma-decimal">1.234,5</ix:nonFraction>
          <ix:nonFraction name="ifrs-full:Revenue" contextRef="segment" unitRef="eur">999</ix:nonFraction>
          <ix:nonFraction name="ifrs-full:AdministrativeExpense" contextRef="group" unitRef="eur" scale="6" sign="-">12<ix:exclude> footnote 9 </ix:exclude></ix:nonFraction>
        </html>'''
        facts = parse_document(document)
        self.assertEqual(len(facts), 2)
        self.assertEqual(facts[0]["value"], 1_234_500_000)
        self.assertEqual(facts[1]["value"], -12_000_000)
        self.assertIsNone(pick_fact(facts, ["ifrs-full:Revenue"], "2025-12-31", start="2025-01-01", unit="USD"))
        self.assertIsNone(pick_fact([*facts, {**facts[0], "value": 3}], ["ifrs-full:Revenue"], "2025-12-31", start="2025-01-01"))

    def test_unsupported_transforms_and_nonfinite_numbers_fail(self):
        for text, transform in [("NaN", ""), ("infinity", ""), ("1,2", "unknown")]:
            with self.assertRaises(ValueError):
                number(text, transform)

    def test_employee_row_is_aligned_by_year_and_conflicts_are_rejected(self):
        document = b'''<html><table><tr><td></td><td>2023</td><td>2024</td><td>2025</td></tr>
          <tr><td>Average personnel</td><td>90</td><td>100</td><td>120</td></tr></table></html>'''
        facts = employee_table_facts(document, {"rowLabel": "Average personnel"}, 2025, "LEI")
        self.assertEqual(facts["employees"]["value"], 120)
        self.assertEqual(facts["previousEmployees"]["value"], 100)
        conflicting = document.replace(b"</html>", b"<table><tr><td>2025</td><td>2024</td></tr><tr><td>Average personnel</td><td>5</td><td>4</td></tr></table></html>")
        self.assertEqual(employee_table_facts(conflicting, {"rowLabel": "Average personnel"}, 2025, "LEI"), {})


class CalculationTests(unittest.TestCase):
    def record(self):
        values = {"revenue": 120, "previousRevenue": 100, "employees": 110, "previousEmployees": 100,
                  "administrativeExpenses": -12, "costOfSales": -60, "inventory": 12, "previousInventory": 8}
        return {"year": 2025, "scope": "consolidated", "days": 365, "employeeBasis": "averageHeadcount",
                "sourceUrl": "https://example.com/report.zip", "fetchedAt": "2026-10-24T00:00:00+00:00",
                "facts": {key: {"value": value, "concept": key, "entity": "LEI", "contextId": "group"} for key, value in values.items()}}

    def test_formulas_and_missing_inputs(self):
        metrics, missing = financial_metrics(self.record())
        self.assertAlmostEqual(metrics["growthGap"]["value"], 10)
        self.assertAlmostEqual(metrics["adminRatio"]["value"], 10)
        self.assertAlmostEqual(metrics["inventoryDays"]["value"], 365 / 6, places=5)
        self.assertFalse(missing)
        record = self.record()
        record["facts"]["administrativeExpenses"] = None
        record["facts"]["costOfSales"] = None
        metrics, missing = financial_metrics(record)
        self.assertNotIn("adminRatio", metrics)
        self.assertNotIn("inventoryDays", metrics)
        self.assertIn("adminRatio", missing)

    def test_different_legal_entities_cannot_be_combined(self):
        record = self.record()
        record["facts"]["employees"]["entity"] = "PARENT-ONLY"
        metrics, missing = financial_metrics(record)
        self.assertNotIn("growthGap", metrics)
        self.assertIn("growthGap", missing)

    def test_no_employee_estimate_or_sga_fallback(self):
        record = self.record()
        record["employeeBasis"] = None
        record["facts"]["administrativeExpenses"] = None
        record["facts"]["sellingGeneralAndAdministrativeExpense"] = {"value": 20}
        metrics, _ = financial_metrics(record)
        self.assertNotIn("growthGap", metrics)
        self.assertNotIn("adminRatio", metrics)


class JobTests(unittest.TestCase):
    def test_legal_suffixes_do_not_cause_fuzzy_subsidiary_matches(self):
        self.assertEqual(employer_key("KONE Oyj"), employer_key("KONE"))
        self.assertEqual(employer_key("Wärtsilä Oyj Abp"), employer_key("Wärtsilä"))
        self.assertNotEqual(employer_key("Konecranes Oyj"), employer_key("KONE"))

    def test_listing_keeps_employer_attached_to_its_ad(self):
        listing = Listing()
        listing.feed('<div class="job__content" class="node__content"><a class="recruiter-job-link" href="/tyopaikka/a">A</a><div><span class="recruiter-company-profile-job-organization">Example Oy</span></div></div><div class="job__content"><a class="recruiter-job-link" href="/tyopaikka/b">B</a><span class="recruiter-company-profile-job-organization">Other Oy</span></div>')
        self.assertEqual(listing.items, [("https://www.jobly.fi/tyopaikka/a", "Example Oy"), ("https://www.jobly.fi/tyopaikka/b", "Other Oy")])

    def job(self, url="https://example.com/job/1", text="Updating weekly Excel spreadsheets is part of the role."):
        return {"url": url, "description_raw": text, "scraped_at": "2026-10-24T12:00:00+00:00", "job_title": "Coordinator"}

    def test_explicit_tasks_only(self):
        for text in ["Updating weekly Excel spreadsheets is part of the role.", "Your work includes processing supplier invoices.", "Vastaat ostolaskujen käsittelystä."]:
            self.assertIsNotNone(classify_task(text), text)
        for text in ["Experience with Excel and SAP required.", "You will automate manual data entry.", "We no longer do manual data entry."]:
            self.assertIsNone(classify_task(text), text)

    def test_every_unique_ad_is_classified_not_just_curated_positives(self):
        jobs = [self.job(), self.job("https://example.com/job/2", "Experience with Excel."), self.job("https://example.com/job/3", "Design great products."), self.job()]
        metric, _ = job_metric(jobs, date(2026, 10, 24))
        self.assertEqual(metric["inputs"], {"checked": 3, "manual": 1})
        self.assertAlmostEqual(metric["value"], 100 / 3, places=5)
        self.assertEqual(len(metric["sources"]), 3)
        self.assertIsNone(job_metric(jobs, date(2027, 5, 1))[0])
        self.assertIsNone(job_metric(jobs[:1], date(2026, 10, 24))[0])

    def test_expired_ads_leave_the_sample_even_without_another_fetch(self):
        jobs = [self.job(f"https://example.com/job/{i}") for i in range(3)]
        jobs[0]["valid_through"] = "2026-10-23"
        self.assertIsNone(job_metric(jobs, date(2026, 10, 24))[0])

    def test_zero_is_a_reviewed_sample_not_a_failed_fetch(self):
        jobs = [self.job(f"https://example.com/job/{i}", "Develop software.") for i in range(3)]
        metric, _ = job_metric(jobs, date(2026, 10, 24))
        self.assertEqual(metric["value"], 0)
        self.assertIsNone(job_metric([], date(2026, 10, 24))[0])

    def test_jsonld_employer_matching_and_task_text(self):
        content = b'''<script type="application/ld+json">{"@graph":[{"@type":"JobPosting","title":"Admin", "hiringOrganization":{"name":"Example Oy"},"description":"<p>Updating Excel reports.</p>"}]}</script>'''
        job = parse_posting(content, "https://example.com/job", {"example"}, "2026-10-24")
        self.assertEqual(job["description_raw"].strip(), "Updating Excel reports.")
        self.assertIsNone(parse_posting(content, "https://example.com/job", {"unrelated oy"}, "2026-10-24"))


if __name__ == "__main__":
    unittest.main()
