"""Testovi za update_nastava --check-new: da li FON nudi semestar noviji od
objavljenog u 1god.json.

Sintetički HTML umesto snimka stranice. Struktura prati pravu stranicu
(naslov „Школска година …“, pa liste linkova po semestru); u septembru 2026.
stranica je već imala naslov 2026/27, a umesto PDF-ova samo `#` linkove.
"""
import update_nastava as un

ROMAN = ["I", "II", "III", "IV"]


def page(year_heading, links=""):
    return f"""
    <div class="entry-content">
      <h2 class="elementor-heading-title">Школска година {year_heading}</h2>
      <h2 class="elementor-heading-title">Распоред наставе <br/>зимски семестар</h2>
      <ul>{links}</ul>
    </div>
    """


def pdf_links(semester, uploads="2026/09", years=(1, 2, 3, 4)):
    out = []
    for y in years:
        r = ROMAN[y - 1]
        base = f"https://oas.fon.bg.ac.rs/wp-content/uploads/{uploads}"
        out.append(
            f'<li><a href="{base}/Raspored-{semester}-{r}-godina.pdf">'
            f"Распоред наставе за {r} годину (ажурирано 20.9.)</a></li>"
            f'<li><a href="{base}/Grupe-{semester}-{r}-godina.pdf">'
            f"Групе за слушање наставе за {r} годину</a></li>"
        )
    return "".join(out)


PLACEHOLDERS = "".join(
    f'<li><a href="#">Распоред наставе за {r} годину</a></li>' for r in ROMAN
)
YEARS = [1, 2, 3, 4]


def test_next_semester():
    assert un.next_semester("Letnji 2025/26") == ("zimski", "2026/27")
    assert un.next_semester("Zimski 2026/27") == ("letnji", "2026/27")
    assert un.next_semester("Letnji 2099/00") == ("zimski", "2100/01")
    assert un.next_semester("") is None


def test_stara_godina_nije_novo():
    # Naslov i dalje kaže prošlu godinu, a zimski PDF-ovi su prošlogodišnji.
    html = page("2025/26", pdf_links("zimski", uploads="2025/09"))
    assert un.check_new(html, "Letnji 2025/26", YEARS) is None


def test_nova_godina_bez_pdfova_nije_novo():
    # Stanje sa prave stranice krajem septembra 2026.
    html = page("2026/27", PLACEHOLDERS)
    assert un.check_new(html, "Letnji 2025/26", YEARS) is None


def test_nova_godina_sa_pdfovima_je_zimski():
    html = page("2026/27", pdf_links("zimski"))
    assert un.check_new(html, "Letnji 2025/26", YEARS) == "zimski"


def test_nova_godina_ali_stari_pdfovi_nije_novo():
    # Naslov je promenjen, ali linkovi vode na prošlogodišnje uploade.
    html = page("2026/27", pdf_links("zimski", uploads="2025/09"))
    assert un.check_new(html, "Letnji 2025/26", YEARS) is None


def test_deo_godina_nije_novo():
    html = page("2026/27", pdf_links("zimski", years=(1, 2)))
    assert un.check_new(html, "Letnji 2025/26", YEARS) is None
    assert un.check_new(html, "Letnji 2025/26", [1, 2]) == "zimski"


def test_zimski_objavljen_ne_trazi_ponovo():
    html = page("2026/27", pdf_links("zimski"))
    assert un.check_new(html, "Zimski 2026/27", YEARS) is None


def test_letnji_iste_skolske_godine():
    html = page("2026/27", pdf_links("letnji", uploads="2027/02"))
    assert un.check_new(html, "Zimski 2026/27", YEARS) == "letnji"


def test_letnji_prosle_godine_nije_novo():
    # Prošlogodišnji letnji koji je ostao na stranici.
    html = page("2026/27", pdf_links("letnji", uploads="2026/02"))
    assert un.check_new(html, "Zimski 2026/27", YEARS) is None
