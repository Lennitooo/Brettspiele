# Setup: Online-Funktion (Supabase + Hosting)

Diese Anleitung machst du einmalig im Browser. Danach funktionieren Login, Online-Schach und Rangliste.
Du brauchst keinen eigenen Server und schreibst keinen Code – nur Werte kopieren und einfügen.

---

## 1. Supabase-Konto & Projekt anlegen (ca. 5 Min)

1. Gehe auf **https://supabase.com** → **Start your project** → mit E-Mail oder GitHub anmelden.
2. **New project** anlegen:
   - Name: z.B. `brettspiele`
   - Datenbank-Passwort: ein sicheres Passwort wählen und **notieren** (brauchst du selten, aber aufheben).
   - Region: **Frankfurt (eu-central)** wählen (schnell für Deutschland).
3. Warte, bis das Projekt fertig eingerichtet ist (1–2 Min).

## 2. Zugangsdaten in `config.js` eintragen

1. Im Supabase-Dashboard links auf **Project Settings** (Zahnrad) → **API**.
2. Du siehst dort:
   - **Project URL** (z.B. `https://abcde12345.supabase.co`)
   - **anon public** Key (ein langer Text)
3. Öffne im Projektordner die Datei **`config.js`** und trage beide Werte ein (die Platzhalter ersetzen).
   Der anon-Key ist **öffentlich** und darf im Code stehen – der Schutz läuft über die Regeln aus Schritt 3.

## 3. Datenbank-Tabellen anlegen

1. Im Dashboard links auf **SQL Editor** → **New query**.
2. Den **kompletten** folgenden Block hineinkopieren und auf **Run** klicken:

```sql
-- PROFILE (Anzeigename je Konto)
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  anzeigename text not null,
  erstellt timestamptz default now()
);
alter table profiles enable row level security;
create policy "profil lesbar"       on profiles for select using (true);
create policy "eigenes profil neu"  on profiles for insert with check (auth.uid() = id);
create policy "eigenes profil edit" on profiles for update using (auth.uid() = id);

-- PARTIEN (eine laufende/beendete Online-Partie)
create table partien (
  id uuid primary key default gen_random_uuid(),
  spiel text not null default 'schach',
  weiss_id uuid references auth.users,
  schwarz_id uuid references auth.users,
  fen text not null,
  zuege jsonb not null default '[]',
  am_zug text not null default 'w',       -- 'w' oder 'b'
  status text not null default 'offen',   -- offen | laeuft | beendet
  ergebnis text,                          -- '1-0' | '0-1' | '1/2-1/2' | null
  erstellt timestamptz default now(),
  geaendert timestamptz default now()
);
alter table partien enable row level security;
-- Jeder angemeldete Nutzer darf offene Partien sehen/beitreten, Beteiligte dürfen schreiben.
create policy "partie lesbar"  on partien for select using (true);
create policy "partie neu"     on partien for insert with check (auth.uid() = weiss_id or auth.uid() = schwarz_id);
-- 'schwarz_id is null' erlaubt das Beitreten zu einer offenen Partie; with check sichert, dass danach nur Beteiligte schreiben.
create policy "partie update"  on partien for update
  using (auth.uid() = weiss_id or auth.uid() = schwarz_id or schwarz_id is null)
  with check (auth.uid() = weiss_id or auth.uid() = schwarz_id);

-- STATISTIK (Siege/Niederlagen/Remis je Konto und Spiel)
create table statistik (
  nutzer_id uuid references auth.users,
  spiel text not null default 'schach',
  siege int not null default 0,
  niederlagen int not null default 0,
  remis int not null default 0,
  primary key (nutzer_id, spiel)
);
alter table statistik enable row level security;
create policy "statistik lesbar" on statistik for select using (true);

-- Bei Spielende automatisch die Statistik beider Spieler fortschreiben.
create or replace function partie_beendet() returns trigger
language plpgsql security definer as $$
begin
  if NEW.status = 'beendet' and NEW.status is distinct from OLD.status
     and NEW.ergebnis is not null and NEW.weiss_id is not null and NEW.schwarz_id is not null then
    insert into statistik (nutzer_id, spiel, siege, niederlagen, remis) values
      (NEW.weiss_id, NEW.spiel,
        (NEW.ergebnis = '1-0')::int, (NEW.ergebnis = '0-1')::int, (NEW.ergebnis = '1/2-1/2')::int)
      on conflict (nutzer_id, spiel) do update set
        siege = statistik.siege + excluded.siege,
        niederlagen = statistik.niederlagen + excluded.niederlagen,
        remis = statistik.remis + excluded.remis;
    insert into statistik (nutzer_id, spiel, siege, niederlagen, remis) values
      (NEW.schwarz_id, NEW.spiel,
        (NEW.ergebnis = '0-1')::int, (NEW.ergebnis = '1-0')::int, (NEW.ergebnis = '1/2-1/2')::int)
      on conflict (nutzer_id, spiel) do update set
        siege = statistik.siege + excluded.siege,
        niederlagen = statistik.niederlagen + excluded.niederlagen,
        remis = statistik.remis + excluded.remis;
  end if;
  return NEW;
end;
$$;
create trigger trg_partie_beendet after update on partien
  for each row execute function partie_beendet();

-- Partien-Updates in Echtzeit an die Spieler senden
alter publication supabase_realtime add table partien;
```

3. Erwartete Ausgabe: „Success. No rows returned." → alles angelegt.

## 4. E-Mail-Bestätigung ausschalten (für einfaches Testen)

Damit du dich beim Testen sofort anmelden kannst, ohne jede Mail zu bestätigen:

1. Dashboard → **Authentication** → **Sign In / Providers** (oder **Settings**) → **Email**.
2. Option **Confirm email** / „Enable email confirmations" **ausschalten** (für den Start).
   > Später für den echten Betrieb kannst du das wieder einschalten.

## 5. Lokal testen

- Online-Funktionen (Login, Multiplayer) brauchen einen echten Webserver – ein Doppelklick auf `index.html`
  (`file://`) reicht dafür **nicht**. Starte lokal einen kleinen Server im Projektordner, z.B.:
  - Mit Python: `python -m http.server 8000` → dann **http://localhost:8000** öffnen.
  - Oder die VS-Code-Erweiterung **Live Server**.
- Das reine Offline-Schach (gegen KI / zu zweit) läuft weiterhin auch per Doppelklick.

## 6. Online stellen (Hosting, später)

Wenn alles lokal läuft, die Sammlung kostenlos ins Web stellen – z.B. **Cloudflare Pages** oder **Netlify**:
Ordner hochladen bzw. mit GitHub verbinden, fertig. (Eigene Anleitung liefere ich, wenn es soweit ist.)

---

**Kurz-Checkliste:** ☐ Projekt angelegt ☐ URL+Key in `config.js` ☐ SQL ausgeführt ☐ E-Mail-Bestätigung aus ☐ lokal per `localhost` geöffnet.

---

## Weitere Spiele (Vier gewinnt, Dame, Mühle)

Für die neuen Spiele ist **kein zusätzliches SQL** nötig: Die Tabellen `partien` und `statistik` unterscheiden die Spiele über die Spalte `spiel` (`schach`, `vier`, `dame`, `muehle`), der Statistik-Trigger zählt pro Spiel getrennt.

---

## Freunde & Herausforderungen

Für das Freunde-System (Freunde hinzufügen und zu einer Partie herausfordern) **einmalig** diesen
zweiten SQL-Block im **SQL Editor** ausführen (Login, Partien und Rangliste laufen auch ohne ihn):

```sql
-- FREUNDE (gerichtete Anfrage, wird bei Annahme zur Freundschaft)
create table freunde (
  id uuid primary key default gen_random_uuid(),
  von_id uuid not null references auth.users on delete cascade,   -- hat die Anfrage gestellt
  an_id  uuid not null references auth.users on delete cascade,   -- soll bestätigen
  status text not null default 'offen',        -- offen | angenommen | abgelehnt
  erstellt timestamptz default now(),
  unique (von_id, an_id)
);
alter table freunde enable row level security;
-- Nur die beiden Beteiligten sehen und ändern eine Zeile.
create policy "freunde lesbar"   on freunde for select using (auth.uid() in (von_id, an_id));
create policy "freunde neu"      on freunde for insert with check (auth.uid() = von_id);
create policy "freunde update"   on freunde for update using (auth.uid() in (von_id, an_id));
create policy "freunde loeschen" on freunde for delete using (auth.uid() in (von_id, an_id));

-- HERAUSFORDERUNGEN (Einladung zu einer konkreten Partie)
create table herausforderungen (
  id uuid primary key default gen_random_uuid(),
  von_id uuid not null references auth.users on delete cascade,   -- fordert heraus
  an_id  uuid not null references auth.users on delete cascade,   -- wird herausgefordert
  spiel text not null,                         -- schach | vier | dame | muehle
  von_farbe text not null default 'w',         -- vom Herausforderer gewählte eigene Seite: 'w' | 'b'
  status text not null default 'offen',        -- offen | angenommen | abgelehnt | storniert
  partie_id uuid references partien,           -- beim Annehmen gesetzt
  erstellt timestamptz default now()
);
alter table herausforderungen enable row level security;
create policy "hf lesbar" on herausforderungen for select using (auth.uid() in (von_id, an_id));
create policy "hf neu"    on herausforderungen for insert with check (auth.uid() = von_id);
create policy "hf update" on herausforderungen for update using (auth.uid() in (von_id, an_id));

-- Anfragen und Herausforderungen in Echtzeit an die Beteiligten senden
alter publication supabase_realtime add table freunde;
alter publication supabase_realtime add table herausforderungen;
```

Erwartete Ausgabe wieder „Success. No rows returned." Danach erscheint im Kopf jeder Seite
(nach Anmeldung) der Link **Freunde**.

## Tests

- `http://localhost:8000/test.html` prüft die Spielregeln und die KI aller Spiele.
- `http://localhost:8000/test-ui.html` klickt auf allen Seiten echte Züge durch (auch Schach).
- `http://localhost:8000/test-online.html` lässt zwei angemeldete Test-Spieler in allen vier Spielen online gegeneinander spielen. Jeder Lauf legt Test-Konten (`test-…@example.com`) und Ranglisten-Einträge an; danach mit dem SQL unten aufräumen.
- `http://localhost:8000/test-freunde.html` prüft das Freunde-System Ende zu Ende: A sucht B, Freundschaftsanfrage, Annahme, Herausforderung, Annahme, automatische Weiterleitung beider in dieselbe Partie, je ein Zug. Zum Zusehen direkt im Browser öffnen. Für einen automatisierten Edge-headless-Lauf stattdessen `test-freunde-spieler.html?rolle=a|b&lauf=…` als zwei eigene Prozesse (je einer unter `localhost` und `127.0.0.1`, gleicher `lauf`-Wert) parallel starten – der eingebettete Fremd-Ursprung-iframe bekommt unter `--virtual-time-budget` sonst keine Rechenzeit.

Beide Seiten zeigen oben „ERGEBNIS: … bestanden, … fehlgeschlagen".

### Testdaten löschen (SQL Editor → Run)

```sql
delete from herausforderungen where von_id in (select id from auth.users where email like 'test-%@example.com')
                                 or an_id  in (select id from auth.users where email like 'test-%@example.com');
delete from freunde   where von_id in (select id from auth.users where email like 'test-%@example.com')
                        or an_id  in (select id from auth.users where email like 'test-%@example.com');
delete from statistik where nutzer_id in (select id from auth.users where email like 'test-%@example.com');
delete from partien   where weiss_id  in (select id from auth.users where email like 'test-%@example.com')
                        or schwarz_id in (select id from auth.users where email like 'test-%@example.com');
delete from auth.users where email like 'test-%@example.com';
```
