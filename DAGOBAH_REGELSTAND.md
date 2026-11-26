# Dagobah – Regelstand 35

Seit V2.17.0 sind die 180 Karten (90 je Seite) im Format `premiere-a-new-hope-hoth-dagobah` integriert. Jede Seite erhält acht zusätzliche Themendecks mit je 60 Karten, Startorten, Cover und Strategieeinweisung. Die Decks dürfen ausschließlich Premiere, A New Hope, Hoth und Dagobah enthalten und decken zusammen sämtliche Dagobah-Karten ab.

## V2.19.2: deutsche Erklärungen und bedienbare Jedi-Ausbildung

Alle **180 deutschen Spielerklärungen** sind einzeln in `data/dagobah-card-notes.json` gepflegt und im verzögert geladenen Dagobah-Katalog enthalten. Die Katalogprüfung verlangt vollständige Übereinstimmung. Der Import reproduziert die Erklärungen; englische Quelldaten, Vor-Errata-Fassungen und Drucktexte bleiben getrennt. At Peace berücksichtigt ausdrücklich die Errata zur jederzeitigen Verlagerung bei fortbestehender Ruhezeit. Die 308 privaten Premiere-Drucktexte wurden nicht gelesen oder übernommen.

Die Playmat bietet für Jedi-Tests ausdrücklich Trainingsort, Mentor und Schüler an. Kosten und nicht zulässige Auswahlen bleiben an die tatsächlichen Engine-Angebote gebunden. Der Spielerbereich zeigt laufende und bestandene Tests, fehlende Voraussetzungen, Versuche, Suchaktionen und offene Ausbildungsentscheidungen. Test 2 benötigt seine eigene Handkarte und eine unbesetzte Dagobah-Site. [Schritt-für-Schritt-Anleitung](anleitungen/dagobah.html#jedi-tests).

Neue Partien verwenden Regelstand **35**: Nach einem abgeschlossenen Test wird der Mentor für eine neue Ausbildung frei; parallele offene Ausbildungen desselben Mentors und gleichzeitige Mentor-/Schülerrollen bleiben verboten. Gedruckte Light-Side-Ability ab 6 zählt als Jedi und kann keine neue Schülerschaft beginnen. Bei Test 1 wird zwischen „hier“ bei der Zielwahl und „anwesend“ beim Versuch unterschieden: Ein Ziel an Bord ist beim Auslegen zulässig, muss für den Versuch aber anwesend sein. Der freiwillige Standortbonus kann von 0 bis zur Anzahl nicht-generischer Dagobah-Sites gewählt werden. Test 2 berücksichtigt Battle-Destiny-Ausnahmen mit „if unable to otherwise“. Ältere Replays behalten ihre bisherige Zielreihenfolge und Regelversion.

`tests/dagobah-training-revision.test.mjs` ergänzt Prüfungen für alle 180 Erklärungen, Mentorwahl und -wechsel, abgeschlossene gegenüber offenen Tests, Jedi-Status, Unterbrechung und Wiederaufnahme, freiwillige Boni, strikte Erfolgsgrenzen, den gesamten Weg 1–5, Test-2-Ausnahmen sowie Autosave und Szenarioimport. Der zusätzliche Browserablauf prüft die 180 Popup-Erklärungen und die bediente Auswahl bis zum Abschluss von Test 2. Die historische Abnahme weiter unten beschreibt unverändert die Erstveröffentlichung mit Regelstand 32.

## Quellen und Fassung

- [Dagobah-Regelbeilage von Decipher, 1997](https://res.starwarsccg.org/rules/dagobahrules.pdf).
- [Players Committee Advanced Rulebook, 2023](https://res.starwarsccg.org/rules/SWCCG_2023_AdvancedRulebook.pdf): Kapitel 5–9 sowie Anhänge A–C und E. Aktuelle Errata und Klarstellungen haben Vorrang vor der ursprünglichen Beilage.
- [Offizielle Kartenliste](https://res.starwarsccg.org/cardlists/DagobahType.html).
- Abgleich der Zielwahl mit der öffentlichen PC-Engine: [Jedi-Test-Ziele und freie Mentoren](https://github.com/PlayersCommittee/gemp-swccg-public/blob/05d5417ac9ec8b7402bfec9a76240dcbccb506e6/src/gemp-swccg-cards/src/main/java/com/gempukku/swccgo/cards/AbstractJediTest.java) sowie [Unterscheidung „here“/„present“](https://github.com/PlayersCommittee/gemp-swccg-public/blob/05d5417ac9ec8b7402bfec9a76240dcbccb506e6/src/gemp-swccg-logic/src/main/java/com/gempukku/swccgo/filters/Filters.java). Es wurde kein fremder Engine-Code übernommen.
- [Öffentlicher Kartenkatalog](https://github.com/swccgpc/swccg-card-json/tree/65cd150d20634447a5499d763ac324436158c7a8), festgeschriebene Revision `65cd150d20634447a5499d763ac324436158c7a8`; aktive Texte, Scans und ältere Textfassungen bleiben getrennt.

Die 308 privaten Premiere-Drucktexte wurden für diese Erweiterung weder gelesen noch kopiert. Im öffentlichen Paket bleiben genau 16 Premiere-Drucktexte. Dagobah verwendet die öffentlichen Katalogdaten; deren aktive Spieltexte werden nicht als eigene Scan-Transkriptionen ausgegeben.

## Umgesetzte Regelgruppen

| Karten | Ausführung und Interaktionen | Gezielte Prüfungen |
| --- | --- | --- |
| 5 Jedi-Tests | Mentor und Apprentice, geordnete Tests, strikte Trainingsschwellen, persönliche Landspeed, ruhender Apprentice, Meditation, gespeicherte und unmodifizierbare Destiny, Verlust der unterstützenden Karte | `dagobah-training`, `dagobah-session`, `dagobah-autosave` |
| 23 Locations | Gedrehte Textseiten, Deploy-Sonderregeln, Force und Drain, Raithal, Executor-Innenräume, Launch Bay, Sektoranordnung und Nachbarschaft | `dagobah-session`, `dagobah-space`, `dagobah-combinations` |
| 11 Creatures | Habitat, feste oder gezogene Ferocity, gedruckte Verteidigung, Parasiten, Wirt und Ablösen, Squeeze, Slug-Maul und Belly, Auswahl durch den Gegner des Opfers | `dagobah-space`, `dagobah-combinations`, `dagobah-autosave`, vollständige Partien |
| 19 Charaktere und 8 Schiffe | Suchfähigkeiten, Piloteneinschränkungen, Kapazitäten, Immunitäten, Präsenz der Kampfdroiden, zwei unterschiedliche Waffen bei IG-88, Reaktionen, Bewegung und Missionsfolgen | `dagobah-space`, `dagobah-combinations`, vollständige Partien |
| 8 Devices | Übersetzer, Claw, Backpack, Flight Suit, Generator, Sensorscope, Toolkit und Arm; Nutzungslimits, verdeckte Schiffe und gestohlene Ausrüstung | `dagobah-effects`, `dagobah-combinations`, `dagobah-autosave` |
| 7 Waffen | Kosten und Träger, Reichweite, Zielgruppen, Einzel- und Flächenwirkung, Gefangennahme, Forfeit, Neural Inhibitor, Pulse Cannon und Bombardement | `dagobah-weapons`, `dagobah-space`, `dagobah-autosave`, Kombinationen |
| 51 Effects | Deploy und Aufhebung, Utinni-Ziele, Reserve-Inserts, verwendete Karten, Retrieval, Ablaufzeitpunkte und Force-Verluste | `dagobah-effects`, `dagobah-combinations`, `dagobah-autosave` |
| 48 Interrupts | Verwendete/verlorene Varianten, benannte Aufhebungen, Kosten durch Use/Lose Force, Reaktionen, Sichtbarkeit, Zielwechsel, Battle und Attack Run | `dagobah-combinations`, `dagobah-autosave`, vollständige Partien |

Die Dateien der Prüfgruppen stehen unter `tests/`; die Erweiterungsmodule unter `engine/dagobah-*.js`. `Dark:2915` (Zuckuss’ Snare Rifle) verwendet weiterhin die bestehende Waffenregistrierung, damit ältere Garnisons-Partien reproduzierbar bleiben.

## Wesentliche Klarstellungen

- Dagobah-Deploy-Ausnahmen ersetzen keine zusätzlichen Zielbedingungen. Shuttling und Transportkarten bleiben gesperrt, soweit keine ausdrückliche Ausnahme gilt. Asteroidensektoren sind mit einem Planeten verwandt, gehören aber nicht zu seinen Locations.
- Die Rauten zählen die gleichnamigen Karten beider Spieler gemeinsam am selben System. Die Punkte der Launch Bay begrenzen ihre Anzahl auf dem gesamten Tisch. Unter Deck stationierte Charaktere besetzen keine Brückenplätze.
- Asteroiden-Destiny zieht der Gegner; er wählt die Reihenfolge der Schiffe. Ein gezogener Asteroidensektor verliert das Ziel auch bei negativem Modifikator. Die Höhle ist über ihren Big One erreichbar, ein geschlossenes Slug-Maul sperrt normale Ein- und Ausflüge.
- Great Warrior entfernt positive Drain-Boni einzeln und erhält negative Modifikatoren. At Peace darf gemäß aktueller Errata vor Ende der Ruhezeit auf einen Test verschoben werden; der Apprentice ruht trotzdem weiter. Failure At The Cave unterdrückt Testtexte, beendet jedoch keine bereits begonnene Meditation vorzeitig.
- Test 5 ersetzt einzelne Destiny-Ziehungen. Seine unterstützende Karte wird wiederverwendet und nicht durch normale Destiny-Modifikatoren verändert.
- Neural Inhibitor setzt die persönliche Landspeed auf null; erlaubte Transportbewegungen werden dadurch nicht pauschal verboten. IG-88 erhält zwei unterschiedliche Waffen pro Zug und keine zusätzliche Device-Nutzung.
- They’d Be Crazy To Follow Us verändert optional die gesamte auf das Ziel gerichtete Destiny-Summe einmal um zwei. Visored Vision und Voyeur benennen zuerst die Karte und lassen die Wirkung erst nach dem Aufdecken wählen.
- Sichtbare Stapel zeigen ausschließlich die offenliegende oberste Karte. Es wird keine zusätzliche Einsicht in verdeckte Force-, Reserve- oder Used-Piles gewährt. Beim regulären Recirculate werden Used-Karten wieder verdeckt.

## Verfügbarkeit und Grenzen der Auswahl

Alle 180 Karten sind über die acht Themendecks je Seite erreichbar. Eine Karte kann nur mit gültigen Zielen und im vorgesehenen Zeitfenster gespielt werden. Beispielsweise hat **Lando System?** ohne eine Cloud-City-Location aus einer späteren Edition kein legales Ziel; es werden dafür keine künstlichen Locations oder Ausnahmeregeln eingeführt. Die Prüfung einer Sammlerliste gibt weiterhin keine spätere Edition für das Spiel frei.

Die Tests prüfen konkrete Regeln und Kombinationen sowie vollständige Partien mit allen 120 Karteninstanzen. Sie sind kein formaler Nachweis jeder denkbaren Kartenkombination. Gefundene weitere Regelfehler werden als Regression ergänzt.

## Speichern und Browser

Die Autosave-Fälle prüfen nach jeder Aktion das Neuladen in einer frischen Instanz, die identische Fortsetzung, den JSON-Szenarioimport und die Ablehnung ungültiger Folgeaktionen. Verglichen werden Zustand, Zufallsfolge, legale Angebote und beide Spielersichten. Dazu gehören Ausbildung und Test-5-Waffen, Mynock, Landing Claw, Dark Path, Sensorscope, Visored Vision, Close Call, He Is Not Ready und Bombing Run.

Der Browsertest prüft beide Spielseiten, jeweils acht Decks, anklickbare Deckkarten, Format und Autosave nach Reload sowie die offene Used-Pile-Karte. Ein separater Pakettest prüft die statisch gebaute Website ohne externe Bilder. Dagobah-Daten und Regelmodule werden beim Start früherer Formate nicht zusätzlich heruntergeladen.

## Abnahme

Am 19.11.2026 wurde **V2.17.0**, Release **7229795a81c9d182**, auf [www.starwarsccg.de](https://www.starwarsccg.de/v2.html) veröffentlicht. Implementierungscommit: `e26b4c8`; [Pull Request #92](https://github.com/jolnir-de/star-wars-ccg-trainer/pull/92) gegen den veröffentlichten Entwicklungsstand aus PR #91. Kein main-Push oder Merge.

- Alle vier Spielkatalog-/Deckprüfungen und die Sammlerdatenprüfung bestanden.
- **793 Node-Tests bestanden**, einschließlich acht vollständiger Dagobah-Deckpaarungen und der bestehenden Premiere-, ANH- und Hoth-Regressionen. Lokal wurden die Testdateien unter `tests/` explizit übergeben, damit die ignorierten fremden Worktrees nicht zusätzlich ausgeführt werden. GitHub führte `node --test` ebenfalls erfolgreich aus.
- **Alle vier Chrome-Browserprüfungen bestanden**: Dagobah-Auswahl für beide Seiten, Spielfeldansichten, gebauter Webauftritt und allgemeiner V2-Ablauf. Zwei Zeitüberschreitungen beim parallelen Laptop-Lauf traten im getrennten Wiederholungslauf nicht mehr auf. Die GitHub-Push- und PR-Prüfungen sind ebenfalls erfolgreich.
- Alle **115 Release-Dateien** stimmen auf dem Server per SHA-256 mit dem geprüften Paket überein; das öffentliche Manifest ist identisch.
- Öffentlicher Start und Fortsetzen nach Reload wurden für alle vier Formate und beide Spielseiten geprüft. Format, Seed, Aktionszahl und Revision bleiben identisch; frühere Formate laden beim Erststart keine Hoth-/Dagobah-Kataloge.
- HTTPS-Weiterleitungen, HTML-Revalidierung, unveränderliche Hash-Dateien und gzip wurden öffentlich geprüft. Private Drucktext- und Git-Pfade sind nicht öffentlich abrufbar. Die 308 privaten Premiere-Drucktexte bleiben auf dem Laptop.

Es sind keine offenen Abnahmefehler bekannt. Die oben dokumentierte Zielabhängigkeit von Lando System? bleibt bestehen.
