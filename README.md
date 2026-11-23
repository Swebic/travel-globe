# Travel Globe

A phone app (installable web app) that shows the countries and cities you've visited on a 3D globe.

- Add trips: one or more cities, dates, photos and notes.
- Visited countries light up; each city gets a dot you can tap.
- Stats: how many of the 195 countries you've seen (193 UN members + Vatican City + Palestine), per continent.
- Works offline. Trips and photos are stored only on your phone (IndexedDB). Use **Stats → Export backup** to save a copy.

City search uses the free [Open-Meteo geocoding API](https://open-meteo.com/en/docs/geocoding-api) and needs internet.

## Install on iPhone

1. Open the site in **Safari**.
2. Tap **Share → Add to Home Screen**.
3. Open it from the home screen and add trips there (the home-screen app keeps its own storage, separate from Safari).

## Develop

```bash
npm install
npm run dev
```

`npm run build` writes the site to `dist/`. Pushing to `main` deploys it to GitHub Pages.
`npm run icons` redraws the app icons; `npm run check` checks the country list.
