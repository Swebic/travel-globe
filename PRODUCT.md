# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Installable web app (PWA) used from the iPhone home screen in standalone mode. Portrait phone is the primary viewport.

## Users

One traveler (the owner) on their own iPhone. Two situations:

- Alone, looking back: reliving trips, adding cities, dates and photos, checking progress.
- With friends: handing the phone over or showing the globe off, so the first screen has to read and impress at a glance.

## Product Purpose

Shows which countries and cities the owner has visited, on a 3D globe they can spin, alongside how much of the world that adds up to. Each trip keeps its cities, dates, photos and notes so places can be remembered, not just counted. Success: opening the app gives an instant, proud picture of "where I've been", and logging a new trip takes under a minute.

## Positioning

A personal, private travel globe: visited countries light up and every city is a tappable dot that opens its photos. The globe and the numbers share the spotlight equally. Nothing is uploaded; there is no account or social feed.

## Operating Context

- Opened from the iPhone home screen; often used one-handed, sometimes passed to someone else.
- Works offline once installed. City search needs internet (Open-Meteo geocoding API).
- Data lives only on the phone (IndexedDB). Backup is a manual JSON export/import through the iOS share sheet / Files.
- Hosted on GitHub Pages at https://swebic.github.io/travel-globe/ from the public repo Swebic/travel-globe.

## Capabilities and Constraints

- Three tabs: Globe, Trips, Stats. A "+" button adds a trip.
- A trip = one or more cities (searched), optional start/end dates, optional name, photos (downscaled on device), notes.
- Repeat visits to a country are separate trips ("Add another visit"); a city visited twice counts once.
- Country count is out of 195 = 193 UN members + Vatican City + Palestine. Territories (Hong Kong, Macau, Puerto Rico, Kosovo, Taiwan, etc.) show on the globe and in lists but do not count toward the 195.
- Continents: Africa, Asia, Europe, North America, South America, Oceania (Antarctica excluded).
- Stack: Vite + vanilla JS, globe.gl (three.js), world-atlas 50m country shapes, idb-keyval. No framework.
- Undecided: sharing a picture of the globe/stats with friends (not built).

## Evidence on Hand

- The owner's real travel list exists as a local import file (`my-trips.json`, gitignored). Its contents are private and never go in the repo or this file.
- No other users, testimonials or metrics exist; do not invent any.

## Product Principles

1. The globe is the first impression: it should be legible and striking within a second of opening, in front of someone else.
2. Numbers are earned, never padded: counts follow the stated 195 rule exactly, and territories are labeled honestly.
3. Memories over data entry: photos and places come forward; forms stay short and forgiving (dates optional).
4. Private by default: nothing leaves the phone except city searches.
5. Native-feeling on iPhone: safe areas, thumb reach, system font, no web-page feel.
