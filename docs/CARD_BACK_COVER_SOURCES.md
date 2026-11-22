# Originale Kartenrückseiten als Cover

Startseite, Seitenauswahl und Deckkacheln verwenden die originalen Star-Wars-CCG-Kartenrückseiten: Rebellensymbol für Light Side, Imperiumssymbol für Dark Side. Sie ersetzen die zuvor verwendeten Special-Edition-Starterverpackungen.

Quellen, abgerufen am 19.11.2026:

- [Light Side – Original-PNG des Players Committee](https://res.starwarsccg.org/cards/lightcardback.png)
- [Dark Side – Original-PNG des Players Committee](https://res.starwarsccg.org/cards/darkcardback.png)

Beide Originale messen 298 × 413 Pixel. Die lokale Datei `assets/faction-card-backs.svg` bettet sie verlustfrei als WebP ein und bietet die Ansichten `#light` und `#dark`. Die dekodierten RGBA-Pixel wurden mit den ursprünglichen PNG-Dateien verglichen und stimmen vollständig überein. Es gibt keine Neuzeichnung, Umfärbung, Schärfung oder Beschneidung.

Die gemeinsame lokale Datei wird auf der Startseite direkt und in der Deckauswahl über den vorhandenen Sichtbarkeitsbeobachter geladen. Ihr separates Bildbudget beträgt 320 KiB gzip; die bisherigen Grenzen für Spielcode und Kataloge bleiben bestehen. Zusätzliche Editionskataloge oder Regelmodule werden durch die Cover nicht angefordert.

Originalmotive: Lucasfilm / Decipher. Bildbereitstellung: Star Wars CCG Players Committee. Diese Quellenangabe beansprucht keine eigenen Rechte an den Originalmotiven.
