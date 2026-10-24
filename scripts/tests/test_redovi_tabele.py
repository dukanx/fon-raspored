"""Čitanje redova tabele roka (fon_exam_parser._entries_from_rows), isto za PDF
i Word, na oblicima koje FON pravi: udvojena slova, prelomljene sale i nazivi,
preklopljen tekst koji ne može da se pročita."""
import fon_exam_parser as fep
import merge_rok as mr

ZAGLAVLJE = ["Predmet", "P/ U", "Datum", "Od", "Do", "Sale", "Napomena"]


def _citaj(*redovi):
    neprocitani = []
    return fep._entries_from_rows([ZAGLAVLJE, *redovi], True, neprocitani), neprocitani


def test_udvojena_slova():
    (e,), _ = _citaj(["MMeennaaddžžmmeenntt", "PP", "2244//0022//22002266", "1100::0000", "1122::0000", "4400", ""])
    assert (e["subject"], e["type"], e["date"], e["start"], e["end"], e["rooms"]) == \
        ("Menadžment", "P", "2026-02-24", "10:00", "12:00", ["40"])


def test_vreme_bez_nule():
    (e,), _ = _citaj(["Analiza podataka", "U", "17/09/2026", "8:00", "20:0", "06", ""])
    assert (e["start"], e["end"]) == ("08:00", "20:00")


def test_prelomljene_sale_i_naziv():
    entries, neprocitani = _citaj(
        ["Osnovi organizacije", "P", "18/02/2026", "10:00", "12:00", "Amfiteatar 1", ""],
        ["", "", "", "", "", "Čitaonica", ""],
        ["Preduzetničko upravljanje malim i srednjim", "U", "26/06/2026", "12:00", "15:00", "20", ""],
        ZAGLAVLJE,  # ponovljeno zaglavlje na novoj strani
        ["preduzećima", "", "", "", "", "", ""],
    )
    assert [e["rooms"] for e in entries] == [["Amfiteatar 1", "Čitaonica"], ["20"]]
    assert entries[1]["subject"] == "Preduzetničko upravljanje malim i srednjim preduzećima"
    assert neprocitani == []


def test_preklopljen_tekst_ne_ispada_tiho():
    entries, neprocitani = _citaj(["Osnovi organizacije", "PU", "1285//0022//22002266", "1101::0000", "1240::0000", "15", ""])
    assert entries == [] and len(neprocitani) == 1


def test_zaglavlje_sa_zalepljenom_salom_i_cirilicom():
    assert fep._table_columns(["Predmet", "P/ U", "Datum", "Od", "Do", "Sale Čitaonica", "Napomena"])
    assert fep._table_columns(["Предмет", "Датум", "Од", "До", "Сале"])


def test_rok_se_spaja_samo_sa_istim_nazivom():
    data = [{"rok": "Prvi zimski kolokvijum 2026/27", "tip": "kolokvijum"}]
    assert mr.find_matching_rok(data, "kolokvijum", "Prvi letnji kolokvijum 2026/27") is None
    assert mr.find_matching_rok(data, "kolokvijum", "Prvi zimski kolokvijum 2027/28") == 0
