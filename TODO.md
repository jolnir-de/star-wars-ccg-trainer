# Offene Funktionen für den Star Wars CCG Premiere Trainer

## 17. Cloud City integrieren

V2.18.0 erweitert den Pool um 180 Cloud-City-Karten und acht Themendecks je Spielseite. [Regelstand und Prüfmatrix](CLOUD_CITY_REGELSTAND.md) · [Anleitung](anleitungen/cloud-city.html). Veröffentlicht auf www.starwarsccg.de; lokale und öffentliche Abnahme sind abgeschlossen.

- [x] Genau 180 physische Karten aus der festgeschriebenen öffentlichen Quelle übernehmen; Hindsight-Lesehilfe mit gleichem Gemp-Slot ausschließen.
- [x] Wolkensektoren, Site-Anordnung und sämtliche Standorttexte vervollständigen.
- [x] Sabacc einschließlich Einsätzen, Inserts, Antworten und Speicher-/Replay-Fällen abschließen.
- [x] Carbonit, Binders, Gefangenenmissionen und Weather Vane vollständig umsetzen.
- [x] Alle Charaktere, Fahrzeuge, Raumschiffe, Devices und Waffen integrieren.
- [x] Sämtliche Effects, Interrupts und Epic Duel mit Antworten und Bot anbinden.
- [x] Alle 180 Karten einzeln und in Kombination prüfen und erst dann freigeben.
- [x] Je acht legale 60-Karten-Themendecks für Light und Dark mit allen Karten bis einschließlich Cloud City, Strategie und Cover ergänzen.
- [x] Sofortige leichte Deckübersicht und verzögertes Laden der Spieldaten erweitern; frühere Formate und Spielstände erhalten.
- [x] Alle Katalogprüfungen, Node-Tests und Browserprüfungen ausführen; per PR dokumentieren und auf www.starwarsccg.de veröffentlichen.

Die 308 privaten Premiere-Drucktexte bleiben unberührt außerhalb des Repositorys.


## 15. Hoth integrieren

Ziel: Premiere und Premiere + A New Hope weiter spielbar halten; Hoth ist seit V2.16.0 als zusätzliches Format integriert. [Regelstand, Quellen und Reihenfolge](HOTH_REGELSTAND.md)

- [x] Alle 162 Hoth-Karten (81 je Seite) aus fixierten Quellen importieren und prüfen; aktive Texte, Scans und Errata getrennt halten.
- [x] Hoth als verzögert geladenen Katalog in V2 anzeigen und nach Regelprüfung für Decks/Partien freigeben.
- [x] Nummerierte Marker-Anordnung und Einfügepositionen einschließlich Wampa Cave ergänzen und testen.
- [x] Main Power Generators mit Pflichtsuche und sicherer Starting-Location-Abwicklung umsetzen.
- [x] Energieschild mit allen Deploy-, Bewegungs- und Kampf-Beschränkungen umsetzen; spätere Klarstellung (Echo Base und Marker 1–3) beachten.
- [x] Übrige Standorttexte, Konvertierung, eingestürzte Sites und Wiederaufbau implementieren.
- [x] Missing, Suchgruppen, Scouts und Wettereffekte implementieren.
- [x] Kampffahrzeuge, Fahrer/Piloten/Kanoniere, AT-ATs und Snowspeeder vervollständigen.
- [x] Artillerie, Energieversorgung, Reichweite, Artillery Remote, Harpunen und Abstürze implementieren.
- [x] Wampa und zugehörige Creature-/Beute-Abläufe implementieren.
- [x] Target The Main Generator vollständig abwickeln.
- [x] Alle 162 Kartentexte einzeln und in Kombination prüfen und erst danach freigeben.
- [x] Spielformat Premiere + A New Hope + Hoth mit legalen Decks für beide Seiten ergänzen.
- [x] Bot, Hilfen und Anzeigen ergänzen; Autosave/Replays sowie vollständige Partien testen und veröffentlichen.

## 16. Dagobah integrieren

V2.17.0 ergänzt das Format **Premiere + A New Hope + Hoth + Dagobah**. Die [Regeldokumentation](DAGOBAH_REGELSTAND.md) beschreibt die verwendete Fassung und die Prüfmatrix.

- [x] 180 öffentliche Karten aus der festgeschriebenen Datenrevision übernehmen und mit Regelversion 32 anbinden.
- [x] Jedi-Tests, Asteroiden, Creatures, neue Charaktere, Schiffe, Devices, Waffen, Effects und Interrupts an die gemeinsame Aktionsfolge anbinden.
- [x] Je acht Themendecks mit 60 Karten, Strategieeinweisung und Cover erstellen; alle Dagobah-Karten über die Deckauswahl erreichbar machen.
- [x] Daten und Module erst bei Bedarf laden; bestehende Spielformate und gespeicherte Regelsätze erhalten.
- [x] Dagobah-Anleitung, Karteninspektor, sichtbare Spielzustände und mehrstufige Speicher-/Replay-Prüfungen ergänzen.
- [x] Abschließende vollständige Tests, Pull Request und Veröffentlichung auf www.starwarsccg.de abnehmen.

Die 308 privaten Premiere-Drucktexte bleiben außerhalb des Repositorys auf dem Laptop.

## Aktuelle Priorität: eigener Webspace und Domain

- [x] Veröffentlichung nach bestandenen Tests direkt auf www.starwarsccg.de als verbindliche Projektregel festhalten; Entwicklungsbranches und PRs ohne main-Push oder automatischen Merge beibehalten.
- [x] Editions- und Kartenarchiv ergänzen: 27 Veröffentlichungen mit belegten Erscheinungsdaten, 26 durchsuchbare Listen mit 2.557 Einträgen, Filter, Pagination, Scan-Popup und getrennte Angaben zu AI/Foils. [Umfang und Quellen](docs/SAMMLERDATEN.md)
- [x] Sieben Verbesserungsideen für später in [docs/VERBESSERUNGSIDEEN.md](docs/VERBESSERUNGSIDEEN.md) sichern.
- [x] Fanprojekt-Startseite mit kurzer Erklärung, Spieleinstieg, deutschen Anleitungen und Originalregelquellen erstellen. Sammler-Kartenliste ausdrücklich als spätere Funktion kennzeichnen.
- [x] Statisches ALL-INKL-Paket mit expliziter Dateiauswahl, versionierten Ressourcen, Cache-Regeln und Komprimierung vorbereiten; die 308 privaten Drucktexte ausschließen.
- [x] Homepage ohne Engine-/Katalog-Downloads ausliefern, Deck-Cover verzögert laden und Browserprüfung des fertigen Pakets in den Veröffentlichungsworkflow aufnehmen.
- [x] Architekturentscheidung und Erweiterungspfad für weitere Editionen [dokumentieren](docs/ALL_INKL.md): aktuell ohne Datenbank; vor starkem Ausbau Kataloge und Regeln je Format nachladen.
- [x] SSH-Schlüssel im KAS hinterlegen, absolutes Zielverzeichnis bestätigen und getestetes Paket auf www.starwarsccg.de veröffentlichen. HTTPS, Caching, Komprimierung und neue/fortgesetzte Partien auf dem Zielserver sind geprüft. Die alte WordPress-Installation wurde auf ausdrücklichen Wunsch nach privater Sicherung entfernt. [Release-Abnahme](docs/ALL_INKL.md#erste-veröffentlichung)

Ziel ist eine vollständige lokale Einzelspielerpartie mit dem Premiere-Set und deutscher Lernführung. In freien Partien spielt der Bot die jeweils andere Seite. Der [Entwicklungsplan](ENTWICKLUNGSPLAN.md) hält den vorgesehenen Regelumfang fest.

## 4. Charaktere, Fahrzeuge, Schiffe und Bewegung

In V2.15.15 abgeschlossen. Die Tests decken Deploy, Besatzung, Reacts, Bewegung und das erneute Ausspielen gestohlener Karten durch ihren neuen Besitzer ab.

## 5. Battle, Destiny und Schadensauflösung

In V2.15.15 abgeschlossen. Die Tests decken Antwortfenster, Destiny, Immunität und Schadensauflösung ab. Bei vorzeitigem Kampfende gehen bereits getroffene Karten verloren.

## 6. Premiere-Waffen vervollständigen

In V2.15.15 abgeschlossen. Die Tests prüfen die 25 Premiere-Waffen und Kombinationen mit Karteneffekten, darunter umgelenkte Treffer, Forfeit-Ersatz mit Talz und gestohlene Waffen.

## 7. Kartentexte für alle Kartentypen

V2.15.14 führt alle 324 Premiere-Karten im [Kartenregelregister](engine/premiere-card-rules.js). Die Testsuite prüft die Abdeckung des Katalogs und spielt Regel- und Kombinationsfälle nach. Das Deck Imperiale Garnison enthält außerdem den Todesstern, Retract The Bridge und Death Star Tractor Beam aus A New Hope für die Interaktionen mit Central Core.

V2.15.18 nimmt die neun zuvor vom Deckvalidator abgelehnten Premiere-Karten auf. „Rebellen-Spezialeinsatz“ und „Imperiale Sondereinheit“ ergänzen die 71 bisher fehlenden Karten in der Deckauswahl. Die Datenprüfung testet die Abdeckung aller 324 Karten.

V2.15.19 prüft alle zwölf Decks in vollständigen Partien. Neue Regelfälle decken Beggar, Beru Stew, die Zeitgrenze von Scomp Link Access beim Fortsetzen und die Kampfwerte geschlossener oder unbemannter Fahrzeuge und Raumschiffe ab.

## 8. Bot

In V2.15.16 abgeschlossen. Der Bot bewertet Startorte, Force-Ausgaben, Deploy, Besatzung, Bewegung, Battle, Antworten und Verluste mit einer eigenen Spielersicht. Die Tests prüfen verdeckte Karten, legale Entscheidungen und die Wiederholbarkeit vollständiger Partien.

## 9. Bedienung und Lernfunktionen

In V2.15.17 abgeschlossen. Aktive Standortbedingungen und legale Aktionen erscheinen am Ort und im Inspektor. Alle 324 Premiere-Karten haben eine deutsche Erklärung, einen Auslösezeitpunkt und ein Beispiel. Drei Übungen zeigen Force und Deploy, Bodenkampf mit Blaster sowie Fahrzeug- und Raumbewegung. Der Lernmodus bietet Rückgängig für überprüfte Schritte ohne neue Karteninformationen. Beendete Partien lassen sich auswerten und mit Decklisten, Seed und Aktionen als Szenario speichern, laden und neu starten.

## 10. Aktionen und Ziele auf der Playmat

In V2.15.26 abgeschlossen. Die Playmat zeigt bei ausgewählten Hand- und Tischkarten legale Aktionen mit Zielen und Force-Kosten. Sie markiert die Zielorte und führt auch durch Antwortfenster und mehrstufige Kartenaktionen. Die Tests prüfen unter anderem ortsabhängige Deploy-Kosten, fehlende Ziele, verbrauchte Bewegung sowie Effects, Interrupts und Reacts für beide Spielseiten. Ausführbare Aktionen und Kostenhinweise basieren auf denselben Regelangeboten der Engine.

## 11. Kampfvorschau und Ablauflogik im Popup

In V2.15.27 abgeschlossen. Die Kampfvorschau zeigt vor der Zahlung die sichtbare Power, mögliche Destiny-Ziehungen, einsatzbereite Waffen und Attrition-Immunität beider Seiten. Das Kampf-Popup zeigt die Priorität im aktuellen Segment, offene oder aufgedeckte Destiny-Ziehungen, Waffenergebnisse und die Berechnung von Power, Battle Damage und Attrition. Im Schadenssegment stehen anstehende Pflicht-Forfeits und die verbleibenden Verluste.

## 12. Spielstile für den Bot

In V2.15.28 abgeschlossen. Beim Start einer freien Partie stehen Defensiv, Ausgewogen und Offensiv zur Wahl. Der defensive Bot sichert kontrollierte Orte und spart Force für Antworten. Der offensive Bot sucht günstige Kämpfe. Der Spielstil gilt für beide Bot-Seiten und wird im Spielstand und beim Szenarioexport gespeichert. Kurze Gründe für wichtige Entscheidungen werden aus derselben regelgerechten Spielersicht wie die Bot-Planung abgeleitet.

## 13. Geführte Dark-Side-Übung

In V2.15.29 abgeschlossen. Die Dark-Side-Übung startet mit festem Seed, festen Starthänden und kontrollierten Starting Locations. Sie führt von Presence und Kontrolle bei Jundland Wastes zum Force Drain und anschließend zum Battle mit Vader und Tarkin bei Docking Bay 94. Das Übungsziel schließt mit Tarkins Aufhebung einer gegnerischen Destiny ab. Fortsetzen und Neustart verwenden denselben Startzustand.

## 14. A New Hope integrieren

Neue freie Partien starten standardmäßig mit **Premiere** und den 324 Karten aus Set 1. **Premiere + A New Hope** erweitert die Deckauswahl auf beide Seiten um die bereits freigegebenen Karten aus Set 2. Beide Formate prüfen Spieler- und Bot-Decks einschließlich Startorten. Autosave, Szenarioexport und Neustart führen Format, Datenrevision und Regelversion mit. Historische Spielstände mit der alten „Imperialen Garnison“ behalten ihr Deck und ihren Regelsatz.

V2.15.34 gibt alle **162 Karten aus A New Hope** frei. Die letzten 74 Karten besitzen ausführbare Regelangebote und Einzelkarten-/Kombinationstests. Die [Regeldokumentation](A_NEW_HOPE_REGELSTAND.md) hält Quellen, die verwendete Fassung und die Prüfzuordnung fest.

- [x] Regelstand und Abweichungen gegenüber der Beilage von 1996 dokumentieren; aktive Texte, Errata und Druckscans getrennt halten.
- [x] Verbleibende 74 Karten in das versionierte Regelregister aufnehmen und für neue Mischpartien freigeben; historische Spielstände weiter mit ihrer Regelversion validieren.
- [x] Immediate Effects, festgehaltene Interrupts, eindeutige Interrupt-Limits und zusätzliche Kosten abwickeln.
- [x] R2-D2s Destiny-Wahl, Brainiacs exakte Werte, kumulative Boni und unterschiedliche Use-/Lose-Force-Zahlungen umsetzen.
- [x] Undercover, Eskorte, Gefangennahme und Haft mit den neuen Fang-, Befreiungs- und Missionskarten verbinden.
- [x] Tractor Beam, festgehaltene Schiffe, Besieged und eingeschlossene Besatzung abwickeln.
- [x] Dianogas Habitat, Bewegung, Pflicht- und freiwillige Creature-Angriffe sowie Waffen und Mahlzeiten getrennt von Battles abwickeln.
- [x] Squadrons, Fahrzeug-Innenräume, Holosites, Bluffs, Laser Gate und neue Devices integrieren.
- [x] Trench, Attack Run, Superlaser, Commence Primary Ignition, Recharging und Blown Away integrieren.
- [x] Neue legale Aktionen auf der Playmat und in Entscheidungsfenstern anbieten und durch den Bot bewerten.
- [x] Drei zusätzliche Mischdeck-Varianten je Seite mit Strategiehinweisen erstellen; sämtliche 162 ANH-Karten über die validierte Deckauswahl erreichbar machen.
- [x] Vollständige Partien beider Formate und beider Spielseiten mit verschiedenen Seeds auf legale Entscheidungen und Erhalt aller 120 Karteninstanzen prüfen.

### Absicherung

- [x] Gezielt mitten in den neuen Antwortfenstern speichern, in einer frischen Instanz fortsetzen und als JSON-Szenario importieren. 43 zusätzliche Fälle prüfen Epic Events, Creatures, Gefangene, Traktorstrahlen, Destiny-Folgen, Spione, verdeckte Karten, Transfers und automatische Bot-Antworten. Verglichen werden Zustand, Zufallsfolge, legale Optionen und beide Spielersichten; ungültige Folgeaktionen müssen den bisherigen Stand erhalten. Regelversion 29 bleibt reproduzierbar. [Prüfmatrix](A_NEW_HOPE_REGELSTAND.md#autosave-und-szenarioprüfung)

Die 308 privaten Premiere-Drucktexte bleiben ausschließlich lokal. Ein vollständig freigegebener Kartenkatalog ist kein formaler Nachweis sämtlicher denkbarer Kartenkombinationen. Neue gefundene Kombinationen werden weiterhin als Regressionstests ergänzt.

Für fertige Schritte Entwicklungsbranches verwenden und Commit, Testergebnis sowie offene Fehler im Pull Request dokumentieren. Kein direkter Push auf main, kein Force-Push und kein automatischer Merge.

## 18. Jabba’s Palace vollständig integrieren

- [ ] 180 reguläre Karten nach JABBAS_PALACE_REGELSTAND.md implementieren und prüfen.
- [ ] Je acht Themendecks für Light und Dark Side (Karten bis einschließlich Jabba’s Palace).
- [ ] Formatauswahl und nachgeladene Kataloge/Bundles ergänzen.
- [ ] Alle Tests ausführen, PR erstellen und auf starwarsccg.de veröffentlichen.
