"""Testovi za validate_data: pravi podaci prolaze, pokvareni daju grešku."""
import json
import shutil
from pathlib import Path

import validate_data as vd

DATA = Path(__file__).resolve().parents[2] / "public" / "data"
FIXTURES = Path(__file__).parent / "fixtures" / "nastava_docx"


def _copy_real(tmp_path):
    """Zimski 2026/27 iz golden fixture-a (ne zavisi od trenutnog public/data)."""
    for y in (1, 2, 3, 4):
        g = json.loads((FIXTURES / f"{y}god_zimski_2026.expected.json").read_text(encoding="utf-8"))
        d = {"semester": "Zimski 2026/27", "year": y, **g}
        (tmp_path / f"{y}god.json").write_text(json.dumps(d, ensure_ascii=False), encoding="utf-8")
    for f in ("plan.json", "subjects-meta.json"):
        if (DATA / f).exists():
            shutil.copy(DATA / f, tmp_path / f)
    return tmp_path


def _edit(tmp_path, y, fn):
    p = tmp_path / f"{y}god.json"
    d = json.loads(p.read_text(encoding="utf-8"))
    fn(d)
    p.write_text(json.dumps(d, ensure_ascii=False), encoding="utf-8")


def test_pravi_podaci_bez_gresaka(tmp_path):
    errors, _, info = vd.validate(_copy_real(tmp_path))
    assert errors == []
    assert len(info) == 4


def test_preklapanje_opsega_je_upozorenje(tmp_path):
    # D2 "A- - N-" i D3 "M- - Š-" su u pravom FON fajlu za zimski 2026/27.
    errors, warnings, _ = vd.validate(_copy_real(tmp_path))
    assert errors == []
    assert any("D2" in w and "D3" in w and "preklapaju" in w for w in warnings)


def test_nepostojeca_grupa_iste_godine(tmp_path):
    _copy_real(tmp_path)
    _edit(tmp_path, 1, lambda d: d["entries"][0]["groups"].append("A99"))
    errors, _, _ = vd.validate(tmp_path)
    assert any("A99" in e for e in errors)


def test_grupa_druge_godine_je_u_redu(tmp_path):
    # FON uz termin navodi i grupe drugih godina koje slušaju isti predmet.
    _copy_real(tmp_path)
    _edit(tmp_path, 3, lambda d: d["entries"][0]["groups"].append("D6"))
    errors, _, _ = vd.validate(tmp_path)
    assert errors == []


def test_grupa_bez_termina(tmp_path):
    _copy_real(tmp_path)
    _edit(tmp_path, 2, lambda d: d["groups"].update({"B99": {"program": "ISiT", "range": "Svi"}}))
    errors, _, _ = vd.validate(tmp_path)
    assert any("B99" in e and "nema nijedan termin" in e for e in errors)


def test_lose_vreme(tmp_path):
    _copy_real(tmp_path)
    _edit(tmp_path, 4, lambda d: d["entries"][0].update({"start": "8:15"}))
    errors, _, _ = vd.validate(tmp_path)
    assert any("loše vreme" in e for e in errors)


def test_razliciti_semestri(tmp_path):
    _copy_real(tmp_path)
    _edit(tmp_path, 4, lambda d: d.update({"semester": "Letnji 2025/26"}))
    errors, _, _ = vd.validate(tmp_path)
    assert any("isti semestar" in e for e in errors)


def test_prazan_raspored(tmp_path):
    _copy_real(tmp_path)
    _edit(tmp_path, 1, lambda d: d.update({"entries": []}))
    errors, _, _ = vd.validate(tmp_path)
    assert any("nema nijednog termina" in e for e in errors)


def test_redosled_prezimena_kao_aplikacija():
    # Ž je u azbuci rano (posle E), "X-" kao kraj obuhvata sva prezimena na X.
    assert vd.name_key("Žarić") < vd.name_key("Lekić")
    assert vd._bound("Ilić", False) < vd._bound("I-", True)
    assert vd._bound("J-", False) > vd._bound("I-", True)
