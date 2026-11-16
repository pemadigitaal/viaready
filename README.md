# ViaReady

Leerlingen-app voor rijscholen (PWA, Nederlands). De leerling bereidt elke rijles voor, volgt zijn voortgang per CBR-onderdeel en leest de feedback van de instructeur.

## Functies (prototype)

- **Vandaag**: volgende les, voortgang van de voorbereiding, examengereedheid, laatste feedback
- **Lesvoorbereiding** in 4 stappen: zelfbeoordeling, uitlegvideo, snelle quiz, lastige punten op de route
- **Voortgang** per onderdeel van het CBR-praktijkexamen
- **Feedback na de les**: beoordeling per vaardigheid, opmerking, "hier ga je aan werken"

Alle gegevens zijn nu nog voorbeeldgegevens. De voortgang van de voorbereiding wordt lokaal (localStorage) bewaard.

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
js/app.js             routing (#vandaag, #voorbereiding, #voortgang, #feedback), quiz, voortgang
manifest.webmanifest  PWA-manifest
sw.js                 service worker (offline + push)
icons/                app-iconen
```

## Volgende stappen

1. Backend + login (leerling, instructeur, rijschool), bijvoorbeeld Supabase
2. Instructeurs-app: les plannen, onderwerp kiezen, beoordelen na de les
3. Lastige punten per stad, beheerd door instructeurs
4. Pushmelding een dag voor de les
5. Koppeling met de bestaande rijschoolsoftware (agenda)
