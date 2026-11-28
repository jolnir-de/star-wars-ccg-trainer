# V2 erhalten, V3 parallel entwickeln

V2.19.3 unter `v2.html` bleibt die stabile Spielvariante. `v3.html` ist die gekennzeichnete Entwicklungsversion `3.0.0-preview.1`, zunächst mit demselben Funktionsstand. Die in [V3_TODO.md](../V3_TODO.md) beschriebenen Verbesserungen entstehen anschließend ausschließlich in V3. Der Deckeditor ist zuletzt eingeordnet.

## Technische Grenze

- V2-HTML, ihre Engine, Kataloge, Decks und bisherigen Darstellungsressourcen bleiben unverändert. `v3/v2-baseline.json` hält die Quell- und veröffentlichten Prüfsummen von Commit `c85d8ff` und Release `86c5d193b834d79d` fest. Die Tests prüfen außerdem, dass der Builder dieselben veröffentlichten V2-Spieldateien ausgibt.
- V3 besitzt eigene Kopien unter `v3/engine/` und `v3/data/`. Neue V3-Regeln und Deckänderungen gehören dorthin. Änderungen an diesen Dateien verändern die entsprechende V2-Datei nicht.
- Kartenbilder, Banner und unveränderte Styles können beide Varianten verwenden. Sie werden weiterhin mit Inhalts-Hash veröffentlicht; V3 lädt keine V2-Engine oder V2-Deckdaten. Beim Start von V2 werden keine V3-Spieldateien geladen.
- V2 verwendet `swccg.v2.autosave`, Speicherformat 1. V3 verwendet `swccg.v3.autosave`, Speicherformat 3. Auch Bot-Automatik und Tischansicht besitzen getrennte Schlüssel. Beide Varianten können in getrennten Fenstern gleichzeitig laufen.
- Es gibt keine automatische Spielstandmigration. Ein Import der jeweils anderen Speicherformat-Version wird vor einer Änderung der laufenden Partie zurückgewiesen. V3-Exporte heißen `swccg-v3-partie-….json`.
- `scripts/create-v3-variant.mjs` dokumentiert die einmalige Anlage und verweigert ein erneutes Überschreiben einer existierenden V3. Die eigenen V3-Quellen sind versioniert; sie werden nicht bei jedem Build aus einer später geänderten V2 neu erzeugt.

## Veröffentlichung und Prüfung

Der offizielle Builder erstellt ein gemeinsames Paket mit beiden HTML-Einstiegen und getrennten gehashten V3-Ressourcen. `release.json` behält seine bisherige V2-Versionsangabe für vorhandene Werkzeuge; das neue Feld `variants` nennt Einstieg, Status und Version beider Varianten. Die gemeinsame Releasekennung beschreibt das gesamte Paket.

Die bisherigen V2-Ladebudgets gelten unverändert. V3 erhält eigene Prüfungen für höchstens 600 KiB gzip beim ersten Spielstart, 180 KiB je optionalem Dagobah-/Cloud-City-/Jabba’s-Palace-Paket und 1000 KiB für ihren gesamten Code-/Datenanteil. Beide Varianten zusammen benötigen mehr Webspace; ein einzelner Spieleinstieg lädt weiterhin nur seine eigene Variante. Gemeinsame Sammlerlisten und Banner bleiben außerhalb des jeweiligen Spielstarts.

`tests/v3-isolation.test.mjs` prüft Quell- und Release-Schutz, Ressourcenpfade, Speicherformate, Ladebudgets und genau dieselben 16 öffentlichen Premiere-Drucktexte in der V3-Katalogkopie. `scripts/v3-browser-check.mjs` prüft gebaute Dateien im echten Browser: getrennte und gleichzeitig laufende Partien, Darstellungseinstellungen, Fortsetzen beider Versionen, zurückgewiesene Fremdimporte und alle sechs V3-Formate mit beiden Spielseiten. Dabei wird ein einzelner Browser-Tab mit zwei isolierten Fenstern verwendet. Die übrigen acht Browserprüfungen bleiben Teil der Abnahme.

Für ALL-INKL gilt weiter [ALL_INKL.md](ALL_INKL.md): getestete Assets zuerst, HTML danach, Manifest zuletzt. Das Domainverzeichnis vorher prüfen und sichern; bestehende Hash-Dateien für offene Partien erhalten. Neue V3-Verzeichnisse dürfen ausschließlich innerhalb des bestätigten Domainverzeichnisses angelegt werden. Die Startseite behält V2 als Standard und verlinkt V3 zusätzlich.

Die 308 privaten Premiere-Drucktexte bleiben außerhalb des Repositorys und werden weder eingelesen noch kopiert. V3 enthält ausschließlich die bereits öffentlichen Katalogdaten.

## Abnahme am 28.11.2026

V2.19.3 und V3 `3.0.0-preview.1` wurden als gemeinsames Release **fe66650262f79540** auf www.starwarsccg.de veröffentlicht. [PR #102](https://github.com/jolnir-de/star-wars-ccg-trainer/pull/102) dokumentiert Codecommit `5314c38`, die isolierte Arbeitskopie und die Abnahme. Es wurde weder auf main gepusht noch automatisch gemergt.

- Alle Katalog-/Deckprüfungen, Sammlerprüfung und Deckübersicht bestanden. Die getrennten V3-Kataloge und sämtliche V3-Deckangebote bestehen zusätzlich die eigene V3-Validierung.
- **991 Node-Tests und neun Browserprüfungen** bestehen für den Implementierungscommit in Push- und PR-CI. Lokal bestehen die gezielten Paket-/Isolationsprüfungen und der vollständige V3-Browserablauf. Die doppelten lokalen Gesamtläufe wurden nach erfolgreicher vollständiger CI beendet; sie werden nicht als vollständig bestandene lokale Läufe ausgegeben.
- Der öffentliche Browserablauf startet und setzt alle sechs V3-Formate mit beiden Spielseiten fort. Eine gleichzeitig laufende V2-Partie behält ihren Zustand und ihren Speicher; Einstellungen und abgewiesene Fremdimporte sind ebenfalls geprüft. Keine Browserfehler, kein seitlicher Seitenüberlauf bei 1440, 390 und 320 Pixeln.
- Alle **180 Manifest-Dateien** stimmen auf dem Server per SHA-256 mit dem geprüften Paket überein. Alle 13 HTML-Seiten und drei HTTPS-/www-Weiterleitungen sind geprüft; neue V3-Ressourcen haben gzip und unveränderliche Hash-Caches.
- Bereits vor dem Upload wurden die **84 geschützten V2-Spieldateien** auf dem Server geprüft. Keine davon wurde übertragen oder ersetzt. Auch die öffentliche V2-HTML-Datei behält SHA-256 `74897f86de2c2ee1577e64f41c7316a1f9b0118c33c920c2d7fc8520e6c53f7b`.
- Es wurden nur 54 neue beziehungsweise geänderte Dateien einschließlich Manifest übertragen. Vorheriger Stand privat gesichert: `/.local/swccg-backups/starwarsccg-before-v3-preview-20261128T150439.tar.gz`, SHA-256 `33086d64ea1f32bc851a4cedc7cbc5e379acb8433491fe0b2eb44abef38e96e4`, Rechte 600. Bestehende Hash-Dateien bleiben erhalten.
- Private Drucktext-/Git-Pfade sind nicht abrufbar. V2 und V3 enthalten dieselben **16 unterschiedlichen öffentlichen Premiere-Drucktexte**; keine der 308 privaten Transkriptionen wurde ergänzt. Das interne V2-Prüfsummenverzeichnis wird nicht ausgeliefert.

Die Parallelbasis ist damit abgeschlossen. Die in V3_TODO.md ab Abschnitt 1 aufgeführten Spielverbesserungen bleiben offen und werden anschließend in V3 entwickelt; der Deckeditor kommt zuletzt.
