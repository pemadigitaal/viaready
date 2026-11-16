# ViaReady

Leerlingen-app voor rijscholen (PWA, Nederlands). De leerling bereidt elke rijles voor, volgt zijn voortgang per CBR-onderdeel en leest de feedback van de instructeur.

## Functies (prototype)

- **Vandaag**: volgende les, voortgang van de voorbereiding, examengereedheid, laatste feedback
- **Lesvoorbereiding** in 4 stappen: zelfbeoordeling, uitlegvideo, snelle quiz, lastige punten op de route
- **Voortgang** per onderdeel van het CBR-praktijkexamen
- **Feedback na de les**: beoordeling per vaardigheid, opmerking, "hier ga je aan werken"

Zonder Supabase-configuratie draait de app in **demo-modus** met voorbeeldgegevens. Met Supabase logt de leerling in met een e-mailcode en komen les, quiz, voortgang en feedback uit de database. De voorbereiding wordt opgeslagen, zodat de instructeur die kan zien.

## Supabase koppelen

1. Maak een gratis project op https://supabase.com (regio: Europe, bijv. Frankfurt).
2. **SQL Editor** → nieuwe query → plak `supabase/schema.sql` → **Run**.
3. **Authentication → Email Templates → Magic Link**: zet `{{ .Token }}` in de e-mail, zodat de leerling een code van 6 cijfers krijgt. Bijvoorbeeld:
   ```html
   <h2>Je inlogcode voor ViaReady</h2>
   <p>Vul deze code in de app in: <strong>{{ .Token }}</strong></p>
   ```
4. **Authentication → URL Configuration**: Site URL = `https://pemadigitaal.github.io/viaready/`.
5. **Project Settings → API**: kopieer *Project URL* en *anon public key* naar `js/config.js`.
6. Log één keer in via de app, zet je e-mailadres in `supabase/demo-data.sql` en voer dat script uit. Daarna zie je een volgende les, voortgang en feedback.

De anon key is bedoeld om publiek te zijn; Row Level Security in `schema.sql` zorgt dat een leerling alleen zijn eigen gegevens ziet en een instructeur alleen die van zijn rijschool.

Let op: de ingebouwde e-mail van Supabase verstuurt maar een paar mails per uur. Koppel voor echte leerlingen een eigen SMTP-dienst (bijv. Resend of Brevo) onder **Authentication → SMTP Settings**.

## Lokaal draaien

Geen build nodig. Start een statische server in deze map:

```bash
npx serve .
# of
python3 -m http.server 8080
```

Open daarna http://localhost:8080. Een service worker werkt alleen via `localhost` of HTTPS.

## Publiceren

Werkt op elke statische host met HTTPS: GitHub Pages, Netlify, Vercel of Cloudflare Pages.

## Structuur

```
index.html            app-shell met de 4 schermen
css/app.css           stijl, licht en donker thema
js/app.js             login, data (Supabase of demo), routing, quiz, voortgang
js/config.js          Supabase URL + anon key (leeg = demo-modus)
supabase/schema.sql   tabellen, Row Level Security, onderwerpen + quizvragen
supabase/demo-data.sql  testgegevens voor één leerling
manifest.webmanifest  PWA-manifest
sw.js                 service worker (offline + push)
icons/                app-iconen
```

## Volgende stappen

1. ~~Backend + login~~ (klaar: Supabase, e-mailcode)
2. Instructeurs-app: les plannen, onderwerp kiezen, beoordelen na de les
3. Lastige punten per stad, beheerd door instructeurs
4. Pushmelding een dag voor de les
5. Koppeling met de bestaande rijschoolsoftware (agenda)
