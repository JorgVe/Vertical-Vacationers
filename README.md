# Vertical Vacationers — Karwendel Höhenweg 2026

Statische site met alle praktische info voor onze hüttentocht door het Karwendelgebergte (18–21 augustus 2026).

## Bekijken

Open `index.html` in je browser, of publiceer via GitHub Pages:

1. Push deze bestanden naar de root van de `main`-branch van deze repo.
2. Ga naar **Settings → Pages**.
3. Kies bij **Source**: `Deploy from a branch`, branch `main`, map `/ (root)`.
4. Na een minuut is de site live op `https://jorgve.github.io/Vertical-Vacationers/`.

## Structuur

```
index.html         Home — 5 klikbare pieken op de bergkam naar de onderwerpen
drive.html          De rit
hotels.html          De hotels
hike.html             De wandeling
packinglist.html      De paklijst
todos.html             De to do's
styles.css            Gedeelde Tirol-stijl
script.js             Bezocht-status (wandelaar op de kam), checklists, voortgang
favicon.svg           Favicon (bergmarkering)
og-image.png          Deelafbeelding (link preview)
```

## Hoe het werkt

- Elke onderwerp-pagina zet bij het laden een vlaggetje in `localStorage` van de browser.
- De homepage leest die vlaggetjes uit en toont een bezochte tegel grijs met een vinkje.
- Dit is **per browser/apparaat** — iedereen ziet zijn eigen voortgang. Onderaan de homepage staat een "Voortgang resetten"-link.
- De paklijst en to do's zijn aanklikbare checklists, ook lokaal opgeslagen per apparaat.

## Nog aan te vullen

- `drive.html` — vertrekpunt, tijd, chauffeurs en route zijn nog placeholders.
- Foto's staan lokaal in `pictures/` als WebP (geoptimaliseerd). Wil je een foto vervangen, zet de nieuwe versie erin en werk de `<img>`-`width`/`height` bij.
