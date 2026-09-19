# Tourkarte 2008–2025

Interaktive Europakarte mit allen Jahrestouren von 2008 bis 2025.

- `europa-tourkarte.html` — die fertige Seite, eine einzelne Datei ohne Abhängigkeiten
  (Kartengeometrie, Pins und Logik sind eingebettet). Einfach im Browser öffnen.
- `build.mjs` — erzeugt `mapdata.json` aus Natural Earth 1:50 Mio.
  (`npm i world-atlas@2.0.2 topojson-client@3.1.0 && node build.mjs`).
  Beschneidet die Länder auf den Kartenausschnitt, projiziert sie in eine
  Lambert-Kegelprojektion (Standardparallelen 40°/56° N, Bezugsmeridian 10° O),
  vereinfacht die Umrisse per Douglas-Peucker und gibt Ländergrenzen,
  Gradnetz und Pin-Koordinaten als SVG-Pfade aus.

Die Reisedaten selbst stehen als `TRIPS`-Array direkt im `<script>`-Block der HTML-Datei.
Ein neues Jahr ergänzt man dort; neue Orte brauchen zusätzlich einen Eintrag in
`CITIES` in `build.mjs` und einen erneuten Build.
