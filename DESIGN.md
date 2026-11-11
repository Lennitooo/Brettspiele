---
name: Spielesammlung-Karton
description: Die Seite als Spielesammlung-Karton der 1970er. Startseite = Deckel, Spielseiten = geöffneter Kasten.
colors:
  karton: "#d2451e"
  karton-tief: "#b53a17"
  marine: "#1d3f72"
  marine-tief: "#14294d"
  marine-hell: "#2b5ca8"
  gelb: "#f7d046"
  gelb-tief: "#e6bb2c"
  papier: "#ffffff"
  papier-getoent: "#eef2f8"
  tinte: "#14294d"
  tinte-leise: "#4a5f85"
  feld-hell: "#f6ecc9"
  feld-dunkel: "#4d78b0"
typography:
  familie: "Archivo (variabel, lokal in fonts/archivo.woff2)"
  display: "Gewicht 900, Breite 100–108 %, Laufweite -0.02 bis -0.035em"
  text: "Gewicht 400–600, 1rem, Zeilenhöhe 1.45"
rounded:
  flaeche: "6px"
  klein: "4px"
---

# Design: Spielesammlung-Karton

Gewählt am 10.11.2026 über Impeccable. Alle Werte stehen als CSS-Variablen oben in `style.css`.

## Die Welt

- **Deckel (Startseite):** vollflächig Orangerot. Links der Titel in zwei Zeilen, rechts die Spiele als weiße Fenster mit marineblauem Rand, darüber ein runder gelber Störer. Unten die marineblaue Leiste mit den Fakten, danach der Kartonboden „So wird gespielt“.
- **Kasten (Spielseiten, Login, Rangliste):** Marineblau als Grund. Oben ein orangeroter Streifen (der Deckelrand) mit Rücklink, Seitentitel und Anmeldung.
- **Papier:** Bedienfeld, Login und Rangliste sind weiße Blätter mit dunkelblauer Schrift.
- **Bretter:** flach bedruckt in Creme und Blau, mit weißem Rand. Steine haben konzentrische Ringe. Keine Holzmaserung, keine Verläufe.

## Regeln

1. Farbe trägt ganze Flächen. Orangerot gehört dem Deckel und dem Kopfstreifen, Marineblau dem Kasten, Gelb nur dem Störer, dem Hauptknopf und Markierungen auf dem Brett.
2. Eine Schriftfamilie. Überschriften in Gewicht 900, Fließtext 400 bis 600. Keine zweite Schrift, keine Serifen.
3. Schatten sind neutral schwarz, versetzt und weich. Keine farbigen Leuchtschatten, keine Verläufe als Dekoration.
4. Ecken bleiben knapp (4 bis 6 Pixel), wie gestanzter Karton. Nur Störer und Steine sind rund.
5. Symbole werden gezeichnet (CSS oder SVG). Keine Emoji und keine Unicode-Zeichen als Icons.
6. Knöpfe: 2 Pixel marineblauer Rand, weiß; der wichtigste Knopf eines Blatts ist gelb. Mindesthöhe 44 Pixel.
7. Fokus: 3 Pixel Umriss, gelb auf Farbe, marineblau auf Papier.
8. Bewegung: Störer stempelt sich beim Laden ein, Fenster heben sich beim Überfahren, Seitenwechsel blendet über, Scheiben fallen bei Vier gewinnt, Steine rutschen beim Ziehen zu ihrem Ziel (Schach, Dame, Mühle; neu gesetzte Mühle-Steine poppen auf). Die Zug-Animationen stecken in `anim.js` (`window.Anim`). Alles aus bei „Bewegung reduzieren“.

## Freunde-Seite & Einladungen

- `freunde.html` ist ein weißes Blatt im Kasten (wie die Rangliste): Suchfeld, Trefferliste, Anfragen und Freundesliste als `.zeile`-Reihen, kleine Knöpfe `button.klein`, primärer Knopf gelb.
- Herausfordern-Dialog `#hfBox` wie der Umwandeln-Dialog `#promo` (dunkler Schleier, weißes Blatt).
- Herausforderungs-Einblendungen (`#toasts` / `.einladung`) oben rechts auf jeder Seite: weißes Blatt mit Marine-Rand, gelber „Annehmen"-Knopf; blenden sanft ein, aus bei „Bewegung reduzieren".

## Neues Spiel hinzufügen

- Eintrag in `games-registry.js`. Die Startseite zeigt es automatisch als Fenster; der Störer zählt mit.
- Für das Fensterbild in `index.html` unter `BILD` eine kleine SVG-Zeichnung (100×100) mit den Brettfarben ergänzen. Ohne Zeichnung erscheint das Icon aus der Registry.
- Die Spielseite übernimmt Kopfstreifen, `.layout`, `.board-wrap` und `.panel` von den vorhandenen Seiten.

## Nicht tun

- Kein Holz, kein Gold, keine Serifenschrift (das war das alte Design).
- Kein dunkles Portal mit gleich großen grauen Karten.
- Kein kleines Etikett über einer Überschrift.
