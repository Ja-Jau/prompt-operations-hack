"""Small, conservative reader for numeric facts in official ESEF/iXBRL reports.

Only unsegmented consolidated facts are accepted. Unknown concepts, unsupported
transforms, conflicting duplicates and missing values are never guessed.
"""
from __future__ import annotations

from datetime import date
from decimal import Decimal, InvalidOperation
from io import BytesIO
import re
from xml.etree import ElementTree as ET
from zipfile import ZipFile, is_zipfile


def local(name: str) -> str:
    return name.rsplit("}", 1)[-1].split(":")[-1]


def number(text: str, transform: str = "", scale: str = "0", sign: str = "") -> float:
    transform = local(transform).lower()
    text = re.sub(r"\s+", "", text).replace("−", "-")
    if transform in ("zerodash", "numdash") and text in ("-", "–", "—"):
        return 0.0
    comma = transform in ("numcommadecimal", "num-comma-decimal", "numspacecomma")
    dot = transform in ("", "numdotdecimal", "num-dot-decimal", "numspacedot", "numcommadot")
    if not comma and not dot:
        raise ValueError(f"unsupported numeric transform: {transform}")
    text = text.replace(".", "").replace(",", ".") if comma else text.replace(",", "")
    if text.startswith("(") and text.endswith(")"):
        text = "-" + text[1:-1]
    try:
        value = Decimal(text) * (Decimal(10) ** int(scale))
    except (InvalidOperation, ValueError) as exc:
        raise ValueError("not a number") from exc
    if sign == "-":
        value = -value
    if not value.is_finite():
        raise ValueError("non-finite value")
    return float(value)


def parse_document(content: bytes) -> list[dict]:
    # ElementTree does not retrieve external entities. Limit input at download/unzip.
    root = ET.fromstring(content)
    contexts, units = {}, {}
    for node in root.iter():
        if local(node.tag) == "context":
            members = [n for n in node.iter() if local(n.tag) in ("explicitMember", "typedMember")]
            if any(local(n.tag) == "typedMember" or local(n.attrib.get("dimension", "")) != "ConsolidatedAndSeparateFinancialStatementsAxis"
                   or local((n.text or "").strip()) != "ConsolidatedMember" for n in members):
                continue
            dates = {local(n.tag): (n.text or "").strip() for n in node.iter()
                     if local(n.tag) in ("startDate", "endDate", "instant")}
            identifiers = [(n.text or "").strip() for n in node.iter() if local(n.tag) == "identifier"]
            contexts[node.attrib["id"]] = {**dates, "entity": identifiers[0] if identifiers else ""}
        if local(node.tag) == "unit":
            measures = [(n.text or "").strip() for n in node.iter() if local(n.tag) == "measure"]
            # Ratios/compound units must not be treated as currency or employee counts.
            if len(measures) == 1:
                units[node.attrib["id"]] = local(measures[0])

    facts = []
    for node in root.iter():
        tag = local(node.tag)
        if tag not in ("nonFraction", "fraction") and "contextRef" not in node.attrib:
            continue
        context = contexts.get(node.attrib.get("contextRef", ""))
        if not context or tag == "fraction" or any(local(k) == "nil" and v in ("true", "1") for k, v in node.attrib.items()):
            continue
        concept = node.attrib.get("name", tag)
        try:
            # ix:exclude is presentation text, not part of the fact's numeric value.
            def numeric_text(n: ET.Element) -> str:
                return (n.text or "") + "".join(("" if local(c.tag) == "exclude" else numeric_text(c)) + (c.tail or "") for c in n)
            value = number(numeric_text(node), node.attrib.get("format", ""), node.attrib.get("scale", "0"), node.attrib.get("sign", ""))
        except ValueError:
            continue
        facts.append({"concept": concept, "value": value, "unit": units.get(node.attrib.get("unitRef", ""), ""),
                      "contextId": node.attrib["contextRef"], "factId": node.attrib.get("id"), **context})
    return facts


def parse_report(content: bytes) -> list[dict]:
    if not is_zipfile(BytesIO(content)):
        return parse_document(content)
    with ZipFile(BytesIO(content)) as archive:
        candidates = [f for f in archive.infolist() if f.filename.lower().endswith((".xhtml", ".html", ".xbrl"))]
        # Prefer tagged XHTML over an untagged viewer or a parallel XBRL export.
        candidates.sort(key=lambda f: (not f.filename.lower().endswith(".xhtml"), -f.file_size))
        for item in candidates:
            if item.file_size > 100_000_000:
                continue
            try:
                facts = parse_document(archive.read(item))
            except ET.ParseError:
                continue
            if facts:
                return facts
    raise ValueError("No supported numeric ESEF facts in this report")


def employee_table_facts(content: bytes, mapping: dict, year: int, entity: str) -> dict:
    """Read an explicitly reviewed row, aligned to year headers in the SAME table.

    A row label and optional table text are configured per issuer, rather than
    accepting the first number near 'employees' (which could be a subsidiary).
    Conflicting matches fail closed.
    """
    documents = [content]
    if is_zipfile(BytesIO(content)):
        with ZipFile(BytesIO(content)) as archive:
            documents = [archive.read(f) for f in archive.infolist()
                         if f.filename.lower().endswith(".xhtml") and f.file_size <= 100_000_000]
    found = []
    for document in documents:
        root = ET.fromstring(document)
        for table in root.iter():
            if local(table.tag) != "table":
                continue
            rows = [[re.sub(r"\s+", " ", "".join(cell.itertext())).strip()
                     for cell in row if local(cell.tag) in ("td", "th")]
                    for row in table.iter() if local(row.tag) == "tr"]
            table_text = " ".join(" ".join(row) for row in rows)
            if mapping.get("tableContains") and mapping["tableContains"] not in table_text:
                continue
            header_years = None
            for row in rows:
                years = []
                for cell in row:
                    match = re.fullmatch(r"(?:1\s*[–-]\s*12/)?((?:19|20)\d{2})", cell)
                    if match:
                        years.append(int(match[1]))
                if year in years and year - 1 in years and len(years) == len(set(years)):
                    header_years = years
                    break
            if header_years is None:
                continue
            for row in rows:
                nonempty = [cell for cell in row if cell]
                if not nonempty or nonempty[0] != mapping["rowLabel"]:
                    continue
                try:
                    counts = [number(cell) for cell in nonempty[1:]]
                except ValueError:
                    continue
                if len(counts) != len(header_years) or any(v <= 0 or v != int(v) for v in counts):
                    continue
                current, previous = counts[header_years.index(year)], counts[header_years.index(year - 1)]
                found.append((current, previous, " | ".join(nonempty), header_years))
    if len({(x[0], x[1]) for x in found}) != 1:
        return {}
    current, previous, evidence, header = found[0]
    return {key: {"concept": "table:" + mapping["rowLabel"], "contextId": f"FY{period}", "unit": "pure",
                  "value": value, "entity": entity, "evidence": f"Year columns {header}: {evidence}"}
            for key, value, period in (("employees", current, year), ("previousEmployees", previous, year - 1))}


def pick_fact(facts: list[dict], aliases: list[str], end: str, *, start: str | None = None, unit: str = "EUR") -> dict | None:
    for alias in aliases:
        matches = [f for f in facts if f["concept"] == alias or (":" not in alias and local(f["concept"]) == alias)]
        matches = [f for f in matches if f["unit"] == unit and
                   (f.get("startDate") == start and f.get("endDate") == end if start else f.get("instant") == end)]
        if not matches:
            continue
        values = {f["value"] for f in matches}
        entities = {f["entity"] for f in matches}
        if len(values) != 1 or len(entities) != 1:
            # Ambiguous accounting contexts require a reviewed concept mapping.
            return None
        return matches[0]
    return None


DEFAULT_CONCEPTS = {
    "revenue": ["ifrs-full:Revenue", "ifrs-full:RevenueFromContractsWithCustomers"],
    "administrativeExpenses": ["ifrs-full:AdministrativeExpense"],
    "costOfSales": ["ifrs-full:CostOfSales"],
    "inventory": ["ifrs-full:Inventories"],
}


def financial_record(facts: list[dict], config: dict, year: int, source_url: str, fetched_at: str) -> dict:
    start, end = f"{year}-01-01", f"{year}-12-31"
    previous_start, previous_end = f"{year - 1}-01-01", f"{year - 1}-12-31"
    concepts = {**DEFAULT_CONCEPTS, **config.get("concepts", {})}
    values = {}
    for key in ("revenue", "administrativeExpenses", "costOfSales"):
        values[key] = pick_fact(facts, concepts[key], end, start=start)
    values["previousRevenue"] = pick_fact(facts, concepts["revenue"], previous_end, start=previous_start)
    values["inventory"] = pick_fact(facts, concepts["inventory"], end)
    values["previousInventory"] = pick_fact(facts, concepts["inventory"], previous_end)
    # Employee definitions are mapped explicitly; never infer headcount from payroll.
    employee_config = config.get("employees", {})
    aliases = employee_config.get("concepts", [])
    instant = employee_config.get("basis", "").startswith("closing")
    values["employees"] = pick_fact(facts, aliases, end, start=None if instant else start, unit=employee_config.get("unit", "pure"))
    values["previousEmployees"] = pick_fact(facts, aliases, previous_end, start=None if instant else previous_start, unit=employee_config.get("unit", "pure"))
    return {"year": year, "start": start, "end": end, "days": (date.fromisoformat(end) - date.fromisoformat(start)).days + 1,
            "scope": "consolidated", "currency": "EUR", "employeeBasis": employee_config.get("basis"),
            "sourceUrl": source_url, "fetchedAt": fetched_at, "facts": values}
