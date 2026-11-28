# V3: nachvollziehbare Force Drains

Seit `3.0.0-preview.2` lässt sich jeder angebotene Drain über **„Drain-Berechnung“** direkt am Standort prüfen. V2.19.3 behält ihre bisherigen Dateien und Berechnungen.

## Anzeige

- **Grundwert:** tatsächlich verwendete gegnerische Force-Icons. Die aufklappbare Icon-Erklärung nennt den gedruckten Wert und wirksame Icon-Änderungen mit ihren Quellen.
- **Boni und Abzüge:** einzelne Beiträge mit Quellkarte und Wirkungsort. Quellen an einem anderen Standort und globale Effekte werden gekennzeichnet. Kartenknöpfe öffnen die bekannte Kartenansicht.
- **Freiwillige Boni:** Lichtschwerter und Proficiency werden einzeln geführt. Die Vorschau beginnt ohne freiwilligen Bonus; die Ansage bietet die legalen Bonusmengen an.
- **Aufhebungen und Grenzen:** aufgehobene Beiträge bleiben erkennbar; Great Warrior und Imperial Decree werden als Quellen genannt. Die Untergrenze von null erscheint als eigene Regelzeile.
- **Ausführungskosten:** Musiker-Taxen und globale Kosten stehen getrennt vom Drain-Wert. Beim Auflösen bleiben die bereits bezahlten Kosten erhalten.
- **Force-Verlust:** Resistance / Wise Advice, We’re Doomed und die Grenze durch vorhandene Karten werden anschließend gesondert ausgewiesen. Änderungen durch Verlust-Interrupts und bereits verlorene Karten bleiben nachvollziehbar. Eine vorgeschriebene Verlustzone nennt ihre Quellkarte.

Während eines Antwortfensters zeigt die Erklärung die angesagte Menge und den aktuellen Regelstand. Nach Abschluss führt **„Drain-Ergebnis ansehen“** am Standort zum tatsächlichen Ergebnis; beim Bezahlen eigener Verluste steht die Erklärung auch direkt im eigenen Spielbereich. Aufgehobene Drains verursachen keinen Force-Verlust; bereits verwendete Ausführungskosten werden weiterhin angezeigt.

Die kompakte Ergebnisliste gehört zum Spielzustand und hält höchstens zwölf Drains. Angezeigt werden die Ergebnisse des aktuellen Zuges. Normales Autosave, Fortsetzen und Szenario-Import rekonstruieren sie durch dieselben Spielbefehle. Es werden weder zusätzliche Kartenobjekte noch verdeckte Bluff-Identitäten gespeichert.

## Umsetzung und Prüfungen

`v3/engine/drain-explanation.js` definiert skalare Quellenverweise und Rechenschritte. Die Beiträge entstehen in den tatsächlich verwendeten Premiere-/Erweiterungs-Regelpfaden; `v3/assets/drain-explanation.js` stellt diese Schritte dar. Die Oberfläche wertet keine Kartentexte erneut aus. Regeln und Speicherformat bleiben bei V3-Regelstand 35 beziehungsweise Format 3.

`tests/v3-force-drain.test.mjs` prüft unter anderem:

- Zahlenvergleich mit V2 bei Standort-, Waffen-, globalen, negativen und aufgehobenen Beiträgen;
- Expand The Empire mit tatsächlichem Nachbarstandort und aktivierendem Effect;
- Great Warrior / Imperial Decree, freiwillige Boni, Kosten, Icon-Quellen und Verlustgrenzen;
- verdeckte Bluff-Karten, korrekte Kartenzahl, deterministische Replays und Fortsetzen einzelner Antworten und Verlustzahlungen;
- beide Spielseiten in allen sechs V3-Formaten.

`scripts/v3-force-drain-browser-check.mjs` verwendet das gebaute Veröffentlichungspaket: Quellkarten öffnen, freiwillige Boni ansagen, Antworten fortsetzen, tatsächliche Ergebnisse wieder öffnen sowie Breiten von 1440, 390 und 320 Pixeln. `tests/v3-isolation.test.mjs` schützt weiterhin sämtliche eingefrorenen V2-Quellen und 84 veröffentlichte V2-Spieldateien.

Die 308 privaten Premiere-Drucktexte wurden weder gelesen noch übernommen. Beide öffentlichen Kataloge enthalten weiterhin dieselben 16 freigegebenen Transkriptionen.
