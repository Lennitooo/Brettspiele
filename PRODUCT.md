# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Öffentlich für alle: Fremde finden die Seite, sollen sofort verstehen, was sie ist, und ohne Anmeldung losspielen können. Laptop/PC und Handy sind gleich wichtig.

## Product Purpose

Eine Sammlung klassischer Brettspiele direkt im Browser. Jedes Spiel läuft zu zweit am selben Gerät, gegen eine KI in vier Stufen oder online gegen einen Freund per geteiltem Link. Erfolg: Ein Besucher sitzt innerhalb weniger Sekunden vor einem Brett und spielt.

## Positioning

Vier Klassiker an einem Ort, ohne Installation, ohne Werbung, ohne Kontozwang. Ein Konto braucht nur, wer online spielt und in der Rangliste stehen will.

## Operating Context

- Startseite wählt das Spiel, jede Spielseite zeigt Brett plus Bedienfeld (Status, Modus, KI-Stärke, Neues Spiel, Zurück, Regeln).
- Online-Partie: Partie erstellen, Link teilen, Freund öffnet den Link, Züge kommen live.
- Rangliste pro Spiel aus den Online-Partien (Sieg 1 Punkt, Remis 0,5).

## Capabilities and Constraints

- Spiele: Schach, Dame (deutsche Regeln), Mühle, Vier gewinnt. Weitere kommen über `games-registry.js` dazu.
- Freunde-System: Freunde per Namenssuche hinzufügen, Anfragen bestätigen und Freunde zu einer Online-Partie herausfordern (erfordert Login). Seite `freunde.html`, Logik `freunde.js`, Tabellen `freunde`/`herausforderungen`.
- Technik: Vanilla HTML/CSS/JS ohne Framework und ohne Build-Schritt, Supabase per CDN für Login, Partien und Rangliste.
- Sprache der Oberfläche: Deutsch.
- Die Spiel-Skripte hängen an festen IDs und Klassennamen im HTML (`#board`, `.sq`, `.stein`, `.vcol`, `.mpunkt`, `#status`, `#zuege` usw.). Ein Redesign ändert das Aussehen, nicht diese Schnittstelle.
- Hosting ist noch offen (geplant: Cloudflare Pages oder Netlify).

## Brand Commitments

- Die Schachfiguren bleiben die cburnett-SVGs in `pieces/` (Lizenz in `pieces/LIZENZ.txt`).
- Die Seite darf nicht nüchtern wirken wie eine Büro-Software; sie soll Charakter haben (Lennart, 10.11.2026).
- Der Name „Brettspiele-Sammlung“ ist nicht festgeschrieben.

## Evidence on Hand

- Vier fertige, getestete Spiele mit KI und Online-Modus.
- Keine Nutzerzahlen, Bewertungen oder Pressestimmen vorhanden; nichts davon erfinden.

## Product Principles

1. Das Brett ist die Hauptsache; alles andere dient dem Spiel.
2. Sofort spielbar: kein Konto, keine Erklärung nötig, bevor der erste Zug möglich ist.
3. Handy und großer Bildschirm sind gleichwertig.
4. Charakter statt Büro-Optik.
