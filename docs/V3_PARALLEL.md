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
