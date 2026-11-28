# V3 – Spielverständnis, Decks und Spielfluss

V3 wird parallel zu V2 entwickelt. V2.19.3 bleibt unter `v2.html` der Standard; die Vorschau liegt unter `v3.html`. Beide besitzen eigene Regelmodule, Kataloge, Deckdefinitionen, Autosaves und Darstellungseinstellungen. Die Vorschau startet mit dem Funktionsstand von V2.19.3. Die folgenden Verbesserungen sind damit noch nicht umgesetzt.

## 0. Sichere Parallelversion

- [x] V3 vom aktuellen Entwicklungsstand isolieren, V2-Quelldateien erhalten und ihre Prüfsummen festhalten.
- [x] Eigene V3-Regelmodule, Karten-/Deckdaten, Speicher- und Exportversion einrichten.
- [x] Beide Varianten mit klarer Kennzeichnung von der Startseite erreichbar machen; V2 bleibt Standard.
- [x] Getrennte und gleichzeitige Partien, Fortsetzen, fehlerhaften Import und fehlende gegenseitige Downloads prüfen.
- [ ] Vollständige Tests, PR und öffentliche Abnahme beider Varianten abschließen.

## 1. Aktionen und Berechnungen nachvollziehen – zuerst Force Drain

- [ ] Force Drain aus dem tatsächlich ausgeführten Regelpfad erklären: Grundwert, einzelne Boni/Abzüge, freiwillige Boni, Grenzen, Zurücksetzungen und Aufhebungen.
- [ ] Jede Änderung mit anklickbarer Quellkarte und Wirkungsort belegen; globale und lokale Quellen unterscheiden.
- [ ] Ausführungskosten und verursachten Force-Verlust getrennt anzeigen.
- [ ] Während eines Antwortfensters Änderungen erklären und nach Abschluss das tatsächliche Ergebnis im Zugprotokoll erhalten.
- [ ] Dasselbe Quellenmodell für Power, Ability, Deploy-/Bewegungskosten, Waffen und Attrition ausbauen; keine zweite unabhängige Regelberechnung in der Oberfläche.
- [ ] Kombinationen, aufgehobene positive Boni, negative Modifikatoren, beide Spielseiten und Fortsetzen während einer Antwort prüfen.

## 2. Vorhandene Decks und Bot-Pläne verbessern

- [ ] Vorhandene Themendecks mit vielen reproduzierbaren Starthänden und vollständigen Partien untersuchen: früher Aufbau, Force, Einsatzmöglichkeiten und lange unspielbare Karten.
- [ ] Decks gezielt verbessern, ohne ihre Themen zu verlieren; Kartenauswahl und Änderungen begründen.
- [ ] Je Deck einen konkreten Aufbau-, Haupt- und Ausweichplan hinterlegen, den auch der Bot ausführt.
- [ ] Bot auf passende Besatzungen, Suchfähigkeiten, Missionsvorbereitung, sichere Drains, Rückzug und sinnvolle Verstärkung ausrichten.
- [ ] Vorhandene Spielstile mit kurzen vorbereitenden Aktionsfolgen verbinden; keine verdeckte gegnerische Hand oder unbekannte Deckreihenfolge auswerten.
- [ ] Lerngegner und stärkeren Gegner anhand nachvollziehbarer Testpositionen prüfen; Siegquote nicht als einziges Qualitätsmaß verwenden.

## 3. Phasen- und Kampfberater

- [ ] Pro Phase Vorschlag, Begründung, Alternative und eher ungünstige Aktion zeigen; auch bewusstes Zurückhalten von Force oder Passen erklären.
- [ ] Empfehlungen nach relevanten Aktionen aktualisieren und pro Spielzustand zwischenspeichern.
- [ ] Vor einem Battle „angreifen“, „erst verstärken“ oder „verzichten“ begründet empfehlen.
- [ ] Waffen, Destiny-Möglichkeiten, Immunität, Forfeit, Force-Kosten und nachfolgende Kontrolle einbeziehen; Unsicherheit kennzeichnen.
- [ ] Dieselbe Bewertung als Grundlage für Spielerhilfe und Bot nutzen, begrenzt auf die jeweilige zulässige Spielersicht.

## 4. Kompakte Übersicht und schnelleres Spielen

- [ ] Feste kompakte Aktionsleiste bei der Hand mit Ziel, Kosten, Entscheidung und Empfehlung gestalten.
- [ ] Eindeutige Ziele vorauswählen und mögliche Zielorte besser markieren; mehrdeutige oder endgültige Entscheidungen bewusst bestätigen lassen.
- [ ] Häufige Aktionen und vorhandene Sammelbewegung schneller erreichbar machen.
- [ ] Zusammengehörige Schritte bündeln, aber jede Zahlung, Reaktion und Zustandsänderung weiterhin einzeln regelgerecht abwickeln.
- [ ] Kurze sichtbare Rückmeldung nach Aktionen und hilfreiche Tastaturbedienung ergänzen; Desktop und Mobilgerät prüfen.

## 5. Lernen und Stabilität

- [ ] Kurze Zugauswertung mit gutem Schritt, verpasster Möglichkeit und Vorbereitung für den nächsten Zug anbieten.
- [ ] Übungen zu Deckstrategien und schwierigen Mechaniken erstellen.
- [ ] Wichtige Entscheidungen mit erklärten Alternativen wiedergeben.
- [ ] Reproduzierbare Fehlerfälle und zufällige legale Aktionsfolgen prüfen; 120 eindeutige Karteninstanzen und deterministische Replays erhalten.
- [ ] Die große V3-Session schrittweise in überschaubare Module aufteilen; V2 dabei unverändert erhalten.
- [ ] Ladezeit, Reaktionszeit und Bot-Rechenzeit messen; V2/V3 sowie Erweiterungen nicht unnötig gegenseitig laden.

## 6. Deckeditor – ausdrücklich zuletzt

- [ ] Erst nach den Verbesserungen am Spiel, den vorhandenen Decks und der Lernführung: eigene 60-Karten-Decks mit Filtern, Regelprüfung, Speichern und Import/Export bearbeiten.

Die 308 privaten Premiere-Drucktexte bleiben außerhalb des Repositorys auf dem Laptop. Genau 16 geprüfte Premiere-Drucktexte sind öffentlich; die V3-Katalogkopie enthält dieselben freigegebenen Texte und keine zusätzlichen Transkriptionen.
