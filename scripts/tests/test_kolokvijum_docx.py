"""Kolokvijumi iz Word (.docx) fajla: FON je prvu i drugu kolokvijumsku nedelju
za zimski 2026/27 objavio samo kao Word. Isti tok kao PDF: parse_rok čita
zaglavlje (tip, rok, prijava), fon_exam_parser tabelu termina."""
from pathlib import Path

import fon_exam_parser as fep
import parse_rok as pr

DOCX = str(Path(__file__).parent / "fixtures" / "kolokvijum_prvi_zimski_2026.docx")


def test_zaglavlje():
    meta = pr.detect_and_parse(pr.extract_text(DOCX))
    assert meta["tip"] == "kolokvijum"
    assert meta["rok"] == "Prvi zimski kolokvijum 2026/27"
    assert meta["prijava_datumi"] == ["05.11.2026.", "08.11.2026."]
    assert meta["reklamacija_datum"] == "09.11.2026."


def test_termini():
    entries = fep.parse_kolokvijum(DOCX)
    # Tabela ima 66 redova sa terminima (bez zaglavlja), svaki postaje unos.
    assert len(entries) == 66
    assert entries[0] == {
        "subject": "Arhitektura računara i operativni sistemi",
        "date": "2026-11-16",
        "start": "14:20",
        "end": "15:20",
        "rooms": ["Amfiteatar 1", "Amfiteatar 2", "Amfiteatar 3", "Amfiteatar 4", "Amfiteatar 5"],
        "note": "",
    }
    assert all(e["date"].startswith("2026-11-") and e["start"] and e["end"] and e["rooms"] for e in entries)
