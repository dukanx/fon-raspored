"""Prepoznavanje vrste i naziva roka iz uvodnog teksta PDF-a (parse_rok)."""
import parse_rok as pr


def test_ispitni_rok():
    meta = pr.detect_and_parse("Распоред испита у СЕПТЕМБАРСКОМ испитном року 2025/26")
    assert (meta["tip"], meta["rok"]) == ("ispit", "Septembarski")


def test_ispitni_rok_sa_greskom_u_kucanju():
    # Pravi naslov septembarskog PDF-a 2025/26: "иситном" umesto "испитном".
    meta = pr.detect_and_parse("Распоред испита у СЕПТЕМБАРСКОМ иситном року 2025/26")
    assert (meta["tip"], meta["rok"]) == ("ispit", "Septembarski")
