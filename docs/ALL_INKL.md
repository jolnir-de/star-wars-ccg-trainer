# Veröffentlichung auf www.starwarsccg.de

## Architekturentscheidung

Der Einzelspieler-Trainer bleibt zunächst eine statische Website. HTML, CSS, JavaScript und geprüfte JSON-Kataloge genügen für das Spiel gegen den Bot. Die Regeln, Zufallsfolge und Entscheidungen laufen im Browser; Autosaves liegen im Browserprofil des Spielers. Auf dem Webspace werden weder PHP noch ein laufender Node-Server für den Trainer benötigt.

**Eine Datenbank ist für weitere Editionen keine Voraussetzung.** Das erste Veröffentlichungspaket lag bei etwa 403 KiB gzip. Mit fünf spielbaren Editionen werden der erste Spielstart (höchstens 600 KiB gzip), die verzögert geladenen Dagobah-Regeln und -Decks (höchstens 180 KiB) und das gesamte Code-/Datenpaket einschließlich Sammlerlisten und Anleitungen (höchstens 1000 KiB) getrennt geprüft. Editionsbanner haben ein eigenes Budget und laden bei Bedarf. Cloud-City-Karten, Decks und Regeln benötigen zusammen 105.206 Bytes gzip bei Bedarf; die Regeln werden im öffentlichen Paket zu einer Skriptdatei gebündelt. Externe Kartenbilder zählen separat. Die genauen Größen stehen im Buildbericht und in `release.json`; sie sind keine gemessenen Netzwerk- oder Ladezeitwerte.

Für spätere Editionen:

1. Jede Edition erhält ihren eigenen Katalog, ihre Regeln, Deckdefinitionen und Prüfungen.
2. Vor größerem Ausbau den Startbildschirm von den vollständigen Katalogen entkoppeln: kleine Deck-/Cover-Metadaten zuerst, benötigte Kataloge und Regelmodule beim Wählen eines Formats laden. Seit V2.17.1 zeigt eine kleine separate Deckübersicht Hoth, Dagobah und Cloud City sofort an. Ihre vollständigen Kataloge, Decks und Regelmodule laden erst bei Bedarf; die Sammlerlisten laden keine Spieldaten nach.
3. Große Listen virtualisieren bzw. seitenweise anzeigen; Bilder bei Bedarf laden. Die Deck-Cover werden bereits verzögert geladen.
4. Bot- und Replay-Rechenzeit messen. Bei belegten längeren Blockierungen die Ausführung unter Beibehaltung der deterministischen Reihenfolge aufteilen oder in einen Web Worker verlagern.
5. Neue Editionen nur mit versionierten Regeln, Legalitätsprüfung und Autosave-/Replay-Tests freigeben. Bestehende Spielstände behalten ihren Regelstand.

Eine serverseitige API mit Datenbank wird sinnvoll, wenn Benutzerkonten, geräteübergreifende Spielstände/Sammlungen oder Online-Mehrspieler hinzukommen. Eine spätere Sammler-Kartenliste kann zunächst ebenfalls aus statischen Katalogen bestehen; persönliche Bestände könnten lokal gespeichert werden. Eine Datenbank allein beschleunigt weder Bot-Entscheidungen noch den Bildaufbau im Browser.

## Paket bauen und prüfen

Die originalen Kartenrückseiten teilen sich eine lokale SVG-Datei mit zwei verlustfrei eingebetteten Bildern und einem eigenen Bildbudget von 320 KiB gzip. Auf der Startseite laden die fünf Editionsbanner verzögert; Spielkataloge und Regelmodule bleiben dort unangefordert.

Aus einem sauberen Entwicklungsbranch, niemals direkt aus main:

```powershell
node scripts/import_premiere.mjs --check
node scripts/import_premiere.mjs --edition a-new-hope --check
node scripts/import_premiere.mjs --edition hoth --check
node scripts/import_premiere.mjs --edition dagobah --check
node scripts/import_premiere.mjs --edition cloud-city --check
node scripts/build-deck-overview.mjs --check
node --test
npm run test:browser
node scripts/build-web.mjs --output dist/all-inkl-release
```

Das Ausgabeverzeichnis muss leer sein. Für ein weiteres Release einen neuen Verzeichnisnamen verwenden. Der Builder kopiert ausschließlich freigegebene Dateien, kompaktiert JSON, vereinheitlicht Zeilenenden und versieht CSS, Engine und Daten mit einem Inhalts-Hash. HTML verweist auf genau diese Dateien. `release.json` enthält Version, Releasekennung, Prüfsummen und Größen. Keine privaten Berichte, Schlüssel, Repository-Metadaten oder Testdateien werden übernommen.

GitHub Actions prüft zusätzlich alle fünf Browserabläufe und stellt dasselbe Paket als Artefakt **all-inkl-web-release** bereit. Die bisherige GitHub-Pages-Vorschau verwendet ebenfalls den Paket-Builder. Verbindliches Veröffentlichungsziel ist seit dem 18.11.2026 **https://www.starwarsccg.de/**: Nach bestandenen Tests jede Änderung direkt vom Laptop per SSH/SFTP veröffentlichen und öffentlich prüfen, ohne erneut nach Zustimmung zu fragen. Der eingerichtete SSH-Schlüssel bleibt auf dem Laptop; GitHub Actions erhält keinen privaten Schlüssel. Die GitHub-Pages-Veröffentlichung bleibt eine zusätzliche Vorschau. Kein direkter main-Push, Force-Push oder automatischer Merge.

## ALL-INKL einrichten

Domain und HTTPS sind laut Betreiber bereits eingerichtet. Das bestätigte SSH-Webverzeichnis ist `/www/htdocs/w01d94d2/starwarsccg.de/`; im KAS ist das Domainziel `/starwarsccg.de/`. Vor jedem weiteren Upload das Ziel erneut lesend prüfen. Keine Dateien in andere Domain-Verzeichnisse hochladen.

Im KAS müssen `starwarsccg.de` und `www.starwarsccg.de` auf dasselbe dedizierte Webverzeichnis zeigen. Für beide Hostnamen ein gültiges Zertifikat aktivieren. Die mitgelieferte `.htaccess` leitet auf `https://www.starwarsccg.de` um. Mail- und andere DNS-Einträge nicht verändern.

### SSH-Schlüssel

Auf dem Laptop einen eigenen Schlüssel erstellen; einen vorhandenen Schlüssel nicht überschreiben:

```powershell
ssh-keygen -t ed25519 -a 100 -f "$env:USERPROFILE\.ssh\starwarsccg_allinkl"
Get-Content "$env:USERPROFILE\.ssh\starwarsccg_allinkl.pub" | Set-Clipboard
```

Den öffentlichen Schlüssel unter **KAS → Tools → SSH-Zugänge → Benutzer bearbeiten → SSH-Schlüssel** als eigene Zeile hinzufügen, vorhandene Schlüssel erhalten und SSH aktivieren. Der private Schlüssel bleibt außerhalb des Repositorys auf dem Laptop. Eine gesetzte Passphrase beim lokalen Verbindungsaufbau eingeben oder den Schlüssel in einen bereits eingerichteten lokalen SSH-Agent laden. Zugangsdaten nicht im Chat, Repository oder Buildpaket speichern.

### Upload und Rollback

1. Verbindung und absolutes Zielverzeichnis lesend prüfen. Vorhandene Website-Dateien vor dem ersten Überschreiben außerhalb des öffentlichen Verzeichnisses sichern; eine bestehende `.htaccess` prüfen.
2. Nur den **Inhalt des gebauten Release-Verzeichnisses** per SFTP hochladen. Nie den Repository-Ordner hochladen und keine Synchronisation mit Löschen aktivieren.
3. Zuerst die versionierten Dateien unter `assets/`, `engine/` und `data/` sowie die Datenlizenz übertragen. Alle Transfers auf Erfolg prüfen.
4. Danach Anleitungsseiten und `v2.html`, zuletzt `index.html` sowie `release.json` aktualisieren. `.htaccess` beim ersten Deployment nach Prüfung übernehmen. Alte Hash-Dateien zunächst erhalten: offene Browser-Tabs können sie noch benötigen. Der Upload ist kein atomarer Austausch der gesamten Website; die versionierten Referenzen verhindern vermischte Engine-/Datenstände.
5. Bei Fehlern vor dem HTML-Schritt die bisherigen Seiten erhalten. Nach dem HTML-Schritt gegebenenfalls die gesicherten HTML-Dateien und die vorherige Releasekennung zurückspielen. Alte Assets nicht löschen, solange ein Rückgriff noch nötig ist.

### Nach der Veröffentlichung

- Startseite, alle Anleitungen und V2 unter HTTPS prüfen; auch die Weiterleitung von HTTP und der Domain ohne www.
- Einen neuen Premiere- und einen Mischformat-Start sowie Speichern und Fortsetzen ausprobieren.
- `release.json` mit dem gebauten Paket vergleichen. Im Netzwerk prüfen: HTML wird revalidiert, Hash-Dateien tragen `Cache-Control: public, max-age=31536000, immutable`; Textdateien werden bei passender Browser-Anfrage komprimiert.
- Eine typische Erstladung und Wiederholung auf Laptop und Mobilgerät messen. Externe Kartenbilder separat betrachten; deren Verfügbarkeit und Übertragungszeit hängen weiterhin vom Bildserver ab. Eigene Bildkopien erst nach geklärter öffentlicher Nutzung ergänzen.
- `/local-print-texts.json`, private Prüfdateien und Repository-Metadaten dürfen nicht öffentlich abrufbar sein. Der öffentliche Pakettest verlangt genau 16 Premiere-Drucktexte. Die übrigen 308 bleiben unverändert privat auf dem Laptop.

## Browser-Spielstände beim Domainwechsel

Browser-Speicher ist an die Origin gebunden. Ein auf GitHub Pages gespeicherter Spielstand erscheint auf der neuen Domain nicht automatisch. Die alte Adresse daher als Übergang erhalten. Der bereits geplante Export laufender Partien wäre eine bequeme spätere Umzugshilfe; vorhandene Szenario-Dateien lassen sich über „Szenario laden“ öffnen. Nicht behaupten, dass die Domainumstellung bestehende Autosaves überträgt.

## Quellen

- [ALL-INKL: öffentlichen SSH-Schlüssel im KAS hinterlegen](https://all-inkl.com/wichtig/anleitungen/kas/ssh/dateiverwaltung/verbindung-mit-terminal-auf-mac-aufbauen-public-key-verfahren_432.html)
- [ALL-INKL: Let's-Encrypt-Zertifikat einbinden](https://all-inkl.com/wichtig/anleitungen/kas/ssl-protection/ssl-certificate/how-to-install-a-lets-encrypt-certificate_470.html)
- [Apache: Komprimierung mit mod_deflate](https://httpd.apache.org/docs/2.4/mod/mod_deflate.html)
- [MDN: HTTP-Caching und versionierte Ressourcen](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching)

## Erste Veröffentlichung

Am 18.11.2026 wurde **V2.15.38**, Release **6d55720487d2ea1a**, auf [www.starwarsccg.de](https://www.starwarsccg.de/) veröffentlicht. Der KAS-Redirect auf GitHub Pages wurde durch das Domainziel `/starwarsccg.de/` ersetzt. Die zugehörige ältere WordPress-Installation wurde auf ausdrücklichen Wunsch nach einer geprüften privaten Sicherung außerhalb des öffentlichen Webverzeichnisses gelöscht. Das Zertifikatsverzeichnis `.well-known` blieb erhalten. Es wurde keine Datenbank gelöscht.

Abnahme:

- 605 Node-Tests, beide Daten-/Deckprüfungen und beide lokalen Chrome-Browserprüfungen bestanden. Auch die neuen GitHub-Push- und PR-Workflows mit Chromium waren erfolgreich.
- Alle 28 per SFTP übertragenen Dateien stimmen auf dem Server per SHA-256 mit dem geprüften Paket überein. Das öffentliche `release.json` nennt dieselbe Releasekennung.
- Öffentliche Startseite, alle fünf Anleitungsseiten und beide Spielformate funktionieren. Neue Light-Side-Premiere- und Dark-Side-Mischpartien wurden bis zur Starthand begonnen und nach Browser-Neuladen mit identischen Seed-, Aktions- und Revisionsdaten fortgesetzt.
- Die beiden V2-Aufrufe waren in dieser Abnahme nach rund 1,0 Sekunden startbereit. Das ist eine Messung aus dieser Verbindung und kein allgemeines Ladezeitversprechen; weitere Geräte- und Netzbedingungen bleiben separat zu messen.
- Hash-Ressourcen werden mit einem Jahr Cache-Laufzeit und `immutable` ausgeliefert, HTML mit `no-cache`; gzip wurde auf dem öffentlichen Server nachgewiesen.
- Private Drucktext-Dateien, Git-Metadaten und die alten WordPress-Einstiege waren im öffentlichen Abruf nicht verfügbar. Genau 16 Drucktexte stehen im Paket; die übrigen 308 bleiben privat.

## Dagobah-Veröffentlichung

Am 19.11.2026 wurde **V2.17.0**, Release **7229795a81c9d182**, aus Implementierungscommit `e26b4c8` auf www.starwarsccg.de veröffentlicht. [PR #92](https://github.com/jolnir-de/star-wars-ccg-trainer/pull/92) dokumentiert 793 bestandene Node-Tests, alle fünf Katalog-/Deck-/Sammlerprüfungen und vier bestandene Browserprüfungen. Die veröffentlichten Spielfeldansichten aus V2.16.1 bleiben erhalten.

Die bisherige Domain wurde vorher außerhalb des Webverzeichnisses unter `/.local/swccg-backups/starwarsccg-before-v2.17.0-20261119-0613.tar.gz` gesichert (SHA-256: `80e476f39278d585c786c89098355534a96a18352903e013648766187073b042`, Dateirechte 600). Nur die 116 Dateien des geprüften Pakets einschließlich Manifest wurden per SFTP übertragen; bestehende Hash-Dateien blieben erhalten. Alle 115 im Manifest aufgeführten Dateien wurden auf dem Server per SHA-256 geprüft.

Die öffentliche Abnahme begann alle vier Formate mit beiden Seiten und setzte jede Partie nach Reload mit identischen Seed-, Format-, Aktions- und Revisionsdaten fort. Die Startbereitschaft lag dabei zwischen rund 0,9 und 1,7 Sekunden; externe Bilder waren für diesen Funktionscheck gesperrt. Das ist kein allgemeines Ladezeitversprechen. Dagobah lädt erst bei Auswahl, HTTPS-Weiterleitungen und Cache-/gzip-Header wurden bestätigt. Private Drucktext- und Git-Pfade waren nicht abrufbar; weiterhin genau 16 öffentliche Premiere-Drucktexte. [Regelstand und Abnahme](../DAGOBAH_REGELSTAND.md).

## Vollständige Deckübersicht

Am 19.11.2026 wurde **V2.17.1**, Release **ecd398ebdebb4c9c**, veröffentlicht. [PR #93](https://github.com/jolnir-de/star-wars-ccg-trainer/pull/93) basiert auf dem Dagobah-Entwicklungsstand. Commit `fe4fc04` ergänzt die Übersicht; `d170767` passt die Browserprüfung an alle vier Editionsabschnitte an. Kein main-Push oder Merge.

Die Übersicht ergänzt Namen und Cover für sämtliche Hoth-/Dagobah-Decks mit **1.575 Bytes gzip**; insgesamt wächst das geprüfte Webpaket nur um 2.268 Bytes gzip. Alle 32 Decks der gewählten Seite sind sofort aufgeführt. Vollständige Erweiterungskataloge, Decklisten und Regelmodule laden erst bei Strategieaufruf oder Deckauswahl. Cover werden nur nahe dem sichtbaren Bereich angefordert.

Abnahme: alle fünf Katalog-/Deck-/Sammlerprüfungen, der neue Übersichtsabgleich, **794 Node-Tests** und **vier Browserprüfungen** bestanden. Die GitHub-Push- und PR-Prüfungen sind ebenfalls erfolgreich. Öffentlich wurden alle vier Formate mit beiden Seiten gestartet und nach Reload identisch fortgesetzt; Strategie und Karten-Popup wurden geprüft. Die anfängliche Übersicht lädt keine Hoth-/Dagobah-Spielkataloge. Alle **116 Manifest-Dateien** stimmen auf dem Server per SHA-256 überein. Die Übersichtsdatei wird mit gzip und unveränderlichem Hash-Cache ausgeliefert.

Vorherige Website privat gesichert: `/.local/swccg-backups/starwarsccg-before-v2.17.1-20261119-0710.tar.gz`, SHA-256 `86055033b95763d89765533d3086410e5698523dc3d0d4dccc049d19a7c77b1c`. Bestehende Hash-Dateien bleiben erhalten. Keine offenen Abnahmefehler bekannt; die 308 privaten Premiere-Drucktexte bleiben unverändert privat.

## Cloud-City-Veröffentlichung

Am 19.11.2026 wurde **V2.18.0**, Release **2ffd6c3c0a485a83**, aus Implementierungscommit `3e8ac56` auf [www.starwarsccg.de](https://www.starwarsccg.de/) veröffentlicht. [PR #94](https://github.com/jolnir-de/star-wars-ccg-trainer/pull/94) basiert auf `codex/complete-deck-overview`; main wurde weder direkt geändert noch automatisch zusammengeführt. Alle 180 physischen Cloud-City-Karten und je acht zusätzliche Themendecks sind im Pool Premiere bis Cloud City integriert. Bedingte Ziele aus späteren Editionen bleiben verbindlich; siehe [Regelstand](../CLOUD_CITY_REGELSTAND.md).

Abnahme: alle fünf Karten-/Deckprüfungen, Sammlerprüfung und Deckübersichtsabgleich, **886 Node-Tests** und **fünf Chrome-Browserprüfungen** bestanden. Die acht vollständigen Cloud-City-Deckpaarungen erreichen ein Spielende mit 120 eindeutigen Karteninstanzen.

Vor dem Upload wurde die bisherige Website außerhalb des Webverzeichnisses unter `/.local/swccg-backups/starwarsccg-before-v2.18.0-20261119-1015.tar.gz` gesichert (SHA-256 `2b3d007d44a9a2d064c1fbc7755a73e6c4bd4e580ed33fd2565a89f508f09f9d`, Rechte 600). Es wurden ausschließlich die 120 geprüften Release-Dateien und das Manifest per SFTP übertragen, Assets zuerst und HTML zuletzt. Bestehende Hash-Dateien blieben erhalten. Alle 120 Manifest-Dateien sind auf dem Server per SHA-256 identisch, ebenso das öffentliche Manifest.

Öffentlich wurden alle fünf Formate mit beiden Seiten gestartet und nach Reload mit identischen Seed-, Format-, Aktions- und Revisionsdaten fortgesetzt. Alle 40 Decks der gewählten Seite sind sofort sichtbar. Strategie, Karten-Popup und das einzelne Cloud-City-Regelpaket sind geprüft; der Erststart lädt keine Hoth-/Dagobah-/Cloud-City-Spielkataloge. Startbereitschaft in diesen zehn Prüfungen: **906–1.982 ms** bei gesperrten externen Kartenbildern, kein allgemeines Ladezeitversprechen. Alle elf öffentlichen HTML-Seiten, drei HTTPS-/www-Weiterleitungen, gzip und unveränderliche Hash-Caches sind geprüft; HTML wird revalidiert. Private Drucktext- und Git-Pfade waren nicht abrufbar.

Cloud-City-Katalog, Decks und Regelpaket umfassen zusammen **105.206 Bytes gzip** und laden bei Bedarf. Genau 16 Premiere-Drucktexte stehen im Paket; die übrigen 308 wurden nicht gelesen, kopiert oder veröffentlicht. Keine offenen öffentlichen Abnahmefehler bekannt.
