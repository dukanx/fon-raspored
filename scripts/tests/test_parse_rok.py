"""Prepoznavanje vrste i naziva roka iz uvodnog teksta PDF-a (parse_rok)."""
import parse_rok as pr


def test_ispitni_rok():
    meta = pr.detect_and_parse("Распоред испита у СЕПТЕМБАРСКОМ испитном року 2025/26")
    assert (meta["tip"], meta["rok"]) == ("ispit", "Septembarski")


def test_ispitni_rok_sa_greskom_u_kucanju():
    # Pravi naslov septembarskog PDF-a 2025/26: "иситном" umesto "испитном".
    meta = pr.detect_and_parse("Распоред испита у СЕПТЕМБАРСКОМ иситном року 2025/26")
    assert (meta["tip"], meta["rok"]) == ("ispit", "Septembarski")


# Stvarne rečenice iz FON-ovih fajlova 2025/26 i 2026/27: svaki oblik zaglavlja
# koji je FON koristio (latinica, ćirilica, dodatni rokovi, Word).
def _meta(tekst):
    m = pr.detect_and_parse(tekst)
    return m["tip"], m["rok"], m["prijava_datumi"], m["reklamacija_datum"]


def test_latinica_januarski():
    assert _meta(
        "Januarski ispitni rok 2025/2026. godine (Akreditacija 2022) Prijava za polaganje ispita u "
        "januarskom ispitnom roku biće omogućena putem sistema e-student u periodu od 07.02.2026.do "
        "11.02.2026.godine. Reklamacije na prijavu ispita studenti mogu podneti 12.02.2026.godine"
    ) == ("ispit", "Januarski", ["07.02.2026.", "11.02.2026."], "12.02.2026.")


def test_u_roku_sa_danom_u_zagradi():
    assert _meta(
        "Raspored ispita u JUNSKOM isitnom roku 2025/26 Prijava ... putem sistema e-student u periodu "
        "od 05.06. 2026.(petak) do 08.06.2026. do 23.59 časova (ponedeljak). Reklamacije na prijavu "
        "ispita studenti mogu podneti 09.06.2026. godine (utorak)"
    ) == ("ispit", "Junski", ["05.06.2026.", "08.06.2026."], "09.06.2026.")


def test_dodatni_rok_sa_mesecom_recima():
    assert _meta(
        "RASPORED ISPITA Prvi dodatni (novembarsko-decembarski, apsolventski) ispitni rok 2025. god. "
        "Prijava za polaganje ispita biće omogućena putem sistema e- student u periodu od 08-10. "
        "decembra 2025. godine. Reklamacije na prijavu ispita studenti mogu podneti u četvrtak, 11 "
        "decembra 2025. godine"
    ) == ("ispit", "Novembarsko-decembarski", ["08.12.2025.", "10.12.2025."], "11.12.2025.")


def test_dodatni_rok_prijava_dalje_u_tekstu():
    # Prvo pominjanje e-studenta nema datume; prijava je u "Rok za prijavu".
    assert _meta(
        "Martovsko-aprilski apsolventski i dodatni ispitni rok 2026. god. Za navedene kategorije važi "
        "uobičajen način prijave ispita (putem e-studenta, maksimalno 3 ispita, uz naknadu prema "
        "Cenovniku). Šta je moguće prijaviti U dodatnom (vanrednom) roku student može prijaviti "
        "najviše jedan ispit isključivo iz predmeta koji ponovo sluša u školskoj 2025/2026. godini "
        "Način prijave Prijava ispita, samo u ovom roku, vrši se isključivo putem mejla: "
        "sluzba.oas@fon.bg.ac.rs Rok za prijavu: od petka 17.4.2026. do ponedeljka 20.4.2026. godine. "
        "Reklamacije na prijavu ispita studenti mogu podneti 21.04.2026. godine"
    ) == ("ispit", "Martovsko-aprilski", ["17.04.2026.", "20.04.2026."], "21.04.2026.")


def test_kolokvijum_cirilica_word():
    assert _meta(
        "РАСПОРЕД ПОЛАГАЊА ПРЕДИСПИТНИХ ОБАВЕЗА У ПРВОЈ КОЛОКВИЈУМСКОЈ НЕДЕЉИ\nУ ЗИМСКОМ СЕМЕСТРУ 2026/27\n"
        "Пријава за полагање предиспитних обавеза биће омогућена путем система е-студент од 05.11.2026. "
        "(четвртак) до 8.11.2026.године (недеља) до 23.59 часова.\nРекламације на пријаву студенти могу "
        "поднети 09.11.2026. године (понедељак)"
    ) == ("kolokvijum", "Prvi zimski kolokvijum 2026/27", ["05.11.2026.", "08.11.2026."], "09.11.2026.")


def test_kolokvijum_latinica_skolska_godina():
    assert _meta(
        "Raspored kolokvijuma u DRUGOJ kolokvijumskoj nedelji u zimskom semestru školske 2025/2026 godine. "
        "Prijava ... putem sistema e- student u periodu od 28.01.2026. (sreda) do 01.02.2026.godine"
    )[:3] == ("kolokvijum", "Drugi zimski kolokvijum 2025/26", ["28.01.2026.", "01.02.2026."])


def test_nepoznat_tekst():
    assert _meta("Obaveštenje o upisu")[0] == "nepoznat"
