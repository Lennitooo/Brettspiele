# Brettspiele-Sammlung

Browser-Brettspiele in Vanilla HTML/CSS/JS, keine Frameworks. Aktuell: Schach (`schach.html`, `schach.js`, `engine.js`), Startseite `index.html`, Styles `style.css`.

## Arbeitsweise (Lennart)
- Antworte kurz und direkt, ohne lange Einleitungen.
- Lennart ist Ideengeber und schreibt selbst keinen Code: du setzt um und bearbeitest die Dateien direkt im Projektordner.
- Bei offenen Design-Entscheidungen erst kurz fragen, dann umsetzen.
- Antworten und Notizen auf Deutsch.

## Skills (immer nutzen)
- Impeccable liegt im Vault unter `../../Werkzeuge/impeccable/` (Schreiben nach `.claude` ist per Fernzugriff gesperrt). Für automatisches Laden in Claude Code einmal im Projektordner `npx impeccable install` ausführen.
- Bei jeder Aufgabe zuerst `../../Werkzeuge/agent-skills/skills/using-agent-skills/SKILL.md` lesen und den passenden Skill aus `../../Werkzeuge/agent-skills/skills/<name>/SKILL.md` befolgen.
- **Jedes neue Design (neue Seite, neues Spiel, neue Oberfläche, Redesign) wird mit dem Skill `impeccable` erstellt:** `../../Werkzeuge/impeccable/SKILL.md` lesen und befolgen. Bei neuen Oberflächen `reference/new-work.md` laden, vor jeder UI-Änderung `reference/craft-floor.md` (relativ zu diesem Ordner). Das Start-Skript `scripts/impeccable context` darf fehlschlagen: dann nach SKILL.md „Launcher unavailable“ vorgehen. Fehlt `PRODUCT.md` im Projektordner, zuerst `/impeccable init` vorschlagen. Aufräumen und Prüfen mit `polish`, `critique`, `audit`.
- Offene Design-Entscheidungen (Stil, Farben, Look) trotzdem erst kurz bei Lennart erfragen, dann mit Impeccable umsetzen. Ein ausdrücklich gewünschter Look von Lennart hat Vorrang.
- Zusätzlich als Referenz bei UI/Layout: `../../Werkzeuge/apple-design-skill/SKILL.md` (Apple HIG, sinngemäß fürs Web).

## Vault
- Wissensbasis: zwei Ordner höher (`Start.md`, `Claude-Anleitung.md`, `Über mich.md`). Projektfortschritt in `../Brettspiele.md` festhalten.
