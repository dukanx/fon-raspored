"""Testovi za scrape_plan na snimku prave tabele (Informaciono inženjerstvo, 4. godina)."""
from pathlib import Path

import scrape_plan as sp

HTML = (Path(__file__).parent / "fixtures" / "plan_ii_4_godina.html").read_text(encoding="utf-8")


def _year():
    # Snimak ima samo tabelu 4. godine, pa je ona prva (ključ "1").
    return sp.parse_module(HTML)["1"]


def test_colspan_preko_vii_sem_je_letnji():
    year = _year()
    ds2 = ["Neuronske mreže", "Zaštita računarskih sistema"]
    assert ds2 in year["letnji"]["blokovi"]
    assert ds2 not in year["zimski"]["blokovi"]
    assert "Neuronske mreže" in year["letnji"]["izborni"]
    assert "Neuronske mreže" not in year["zimski"]["izborni"]


def test_po_tri_izborna_bloka_u_semestru():
    year = _year()
    assert len(year["zimski"]["blokovi"]) == 3  # ИСиТ–МиО5, ДС1, ИСиТ1
    assert len(year["letnji"]["blokovi"]) == 3  # ИСиТ2, ДС2, ДС3
    assert year["zimski"]["obavezni"] == ["Internet tehnologije", "Modelovanje poslovnih procesa"]
    assert year["letnji"]["obavezni"] == ["Mašinsko učenje", "Poslovna inteligencija"]


def test_praksa_i_zavrsni_rad_se_preskacu():
    year = _year()
    names = [n for sem in year.values() for k in ("obavezni", "izborni") for n in sem[k]]
    assert not any("praksa" in n.lower() or "završni" in n.lower() for n in names)
