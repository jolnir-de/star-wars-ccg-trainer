# Jabba’s Palace – Integrationsstand

V2.19.0 verwendet Regelstand 34 für neue Partien. Der Katalog enthält genau 180 reguläre Karten (90 je Seite). Das Format umfasst die sechs regulären Editionen von Premiere bis Jabba’s Palace; spätere Premiumprodukte gehören nicht dazu.

## Regelquellen

- [Originale Erweiterungsregeln](https://res.starwarsccg.org/rules/jabbaspalacerules.pdf)
- [Advanced Rulebook 2023](https://res.starwarsccg.org/rules/SWCCG_2023_AdvancedRulebook.pdf): aktuelle Präzisierungen zu Starting Interrupts, Gefangenen, Gebietswirkung und Bewegung.
- Öffentlicher Kartenkatalog: swccgpc/swccg-card-json, Revision 65cd150d20634447a5499d763ac324436158c7a8.

Die 308 privaten Premiere-Drucktexte werden weder gelesen noch übernommen. Genau 16 bereits öffentliche Transkriptionen bleiben öffentlich.

## Abnahme vor Freigabe

- [x] Starting Interrupts und generische Starting Locations.
- [x] Palast-Anordnung, Wüsten, mobile Sites und Gefängnis.
- [x] Alle 94 Charaktere einschließlich optionaler Aktionen und Reaktionen.
- [x] Effekte, Interrupts, Geräte, Waffen, Fahrzeuge und Kreaturen.
- [x] Zwei neue Sabacc-Varianten, Gefangenen- und frühere Kartenkombinationen.
- [x] Je acht 60-Karten-Themendecks mit vollständiger Editionsabdeckung.
- [x] Lazy Loading, beide Spielerseiten und fortsetzbare Aktionen.
- [x] Gesamte Katalog-, Node- und Browserabnahme sowie PR und Veröffentlichung abschließen.

## Umsetzung und Prüfzuordnung

| Bereich | Regeln und gezielte Prüfungen |
| --- | --- |
| Katalog und Decks | Genau 180 Karten, 90 je Seite, 16 Decks zu je 60 Karten; alle neuen Karten erreichbar; historische Freigabegrenze 33/34: jabbas-palace-data.test.mjs. |
| Start und Orte | Starting Interrupts vor beiden Starthänden, generische Desert-Starts, Palast-Anordnung und Landspeed: foundation und rules. |
| Charaktere und Kombinationen | Spezies ohne falsche Lore-Treffer, Ambassador-Boni, Deploy-Kosten, Reacts, Immunität, Persona-Wechsel und Mindscan: combinations und regressions. |
| Waffen und Kreaturen | Mos Eisley Blaster, Vibro-Ax, Riot Gun, Detonator mit Gefangenen, Skiff-Passagieren und mehrfacher Destiny, Rancor und Amanin: rules und regressions. |
| Effekte und Antworten | Scum And Villainy, All Wrapped Up, Bo Shuda, Information Exchange, Wounded Wookiee und Skull: rules, combinations und regressions. |
| Sabacc | Dune Sea und Palace mit eigenem Teilnehmerkreis, Wild-/Clone-Werten und Einsätzen; Kiffex und Devaronian werden mit früheren Varianten verbunden. Projection Of A Skywalker erhöht die Verlustkosten von Dagobahs Shot In The Dark vor dessen Kartenziehung. |
| Spielstand | Fünf mehrstufige Fälle mit Neuladen nach jeder Aktion, identischer Fortsetzung, JSON-Import und abgewiesenem ungültigem Folgezug: autosave. |
| Vollständige Partien | Acht unterschiedliche Deckpaarungen beider Spielerseiten erreichen ein Spielende; alle 120 eindeutigen Karteninstanzen bleiben erhalten: matches. |
| Browser und Paket | Alle Decks vorab sichtbar; Katalog und Regeln erst bei Bedarf; Deckvorschau, Karten-Popup und Fortsetzen beider Seiten: jabbas-palace-browser-check und web-release. |

Die genannten Node-Prüfungen stehen unter tests/ mit dem Präfix jabbas-palace-. Die gemeinsame Engine bietet die legalen Aktionen auch dem Bot an. Das öffentliche Paket bündelt die 29 Jabba’s-Palace-Module in einen optionalen Request. Katalog, Regelpaket und Decks benötigen zusammen rund 94 KiB gzip; die leichte Übersicht aller späten Decks rund 2,9 KiB. Beim normalen Premiere-Start werden die JP-Spielkataloge und Regeln nicht angefordert.

## Verbindliche Kartenpool-Grenzen

Einzelne gedruckte Absätze beziehen sich ausdrücklich auf Karten späterer Editionen: Sarlacc (Great Pit Of Carkoon), Walker Garrison (Ortolan) und Ewoks (Yuzzum). Diese Voraussetzungen sind im Pool Premiere bis Jabba’s Palace nicht vorhanden. Dafür werden keine Ersatz-Ziele erzeugt; die übrigen Regeln dieser Karten sind verfügbar. Eine vollständige Freigabe ist kein formaler Beweis aller denkbaren Kartenkombinationen. Gefundene Wechselwirkungen erhalten gezielte Regressionstests.

## Veröffentlichung

Alle sechs Katalog-/Deckprüfungen, die Sammlerprüfung und der Deckübersichtsabgleich sind bestanden. Der vollständige Node-Lauf besteht mit **953/953 Tests**, ohne Fehler, Auslassungen oder offene Testfälle. Die bisherigen Änderungen aus V2.18.2/V2.18.3 sind in Commit be19996 erhalten. Alle **sechs Chrome-Browserprüfungen** sind bestanden. Das geprüfte Release V2.19.0 trägt die Kennung **9039a119bd009002**. Die Veröffentlichung auf **https://www.starwarsccg.de/** ist geprüft: alle 128 Manifest-Dateien sind per SHA-256 identisch, alle zwölf öffentlichen Seiten erreichbar und alle sechs Formate mit beiden Spielseiten gestartet und nach Reload identisch fortgesetzt. HTTPS-Weiterleitungen, gzip und Hash-Caches funktionieren; private Drucktext- und Git-Pfade sind gesperrt. In dieser Verbindung war V2 nach 688–1.032 ms startbereit (externe Kartenbilder für den Funktionstest gesperrt; kein allgemeines Ladezeitversprechen). Der Pull Request dokumentiert die abschließende GitHub-Abnahme.

[PR #98](https://github.com/jolnir-de/star-wars-ccg-trainer/pull/98) basiert auf dem veröffentlichten Entwicklungsstand codex/original-card-back-covers. Implementierungscommits: c506c18, be19996 und e043ea4; die Abnahme ist in 580f7b9 dokumentiert. Kein main-Push oder GitHub-Merge.
