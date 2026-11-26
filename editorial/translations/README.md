# SWCCG: getrennte Kartenübersetzung Englisch → Deutsch

Stand 26.11.2026: **vorbereitet und ausgeschaltet**. Gemini ist der vorgesehene Übersetzer über die vorhandene kostenlose JOLNIR-Antigravity-Route. Kein neues Konto, kein API-Schlüssel, keine bezahlte Ersatzroute. Es wurde kein echter Kartentext geöffnet, übertragen oder übersetzt.

Dieser Zweig enthält ausschließlich das neue Vorbereitungspaket. Als Basis wurde der vorhandene Remote-HEAD c97f617c5a6ecb3df53008063bb9356ac8ce37fb anhand Metadaten geprüft. Der README-Stand ist historisch und kein Nachweis des aktuellen anderen lokalen Arbeitsstands. Nur README und dieser neue Bereich wurden ausgecheckt; data/, engine/, bestehende Tests, Drucktexte und andere lokale Projektkopien wurden nicht gelesen oder geändert.

## Ablauf

1. **Quelle festlegen:** eigenständiger Export nur der erlaubten game_text-Felder samt stabiler Karten-ID, englischem Namen und Quellenbeleg. Keine automatische Suche in Dateien, kein pauschaler Import. Der bisherige private Drucktextausschluss gilt weiter. brief.template.json wartet deshalb noch auf Quellen und Karten.
2. **Glossar prüfen:** glossary.json ist eine vorläufige Arbeitsfassung. Englische Namen und festgelegte SWCCG-Begriffe bleiben unverändert; deutsche Regelwörter werden vor Verwendung abgestimmt. Keine offizielle deutsche Übersetzung behauptet.
3. **Gemini-Auftrag:** zunächst eine Karte, maximal drei je Batch und ein Modellaufruf. Erst nach Daten-/Anbieterfreigabe, abgestimmtem Glossar und frischem Gratisnachweis. Kein Toolzugriff. Das Paket enthält nur den geprüften Promptaufbau und eine reine Startentscheidung, keinen aktiven Dispatcher.
4. **Formale Prüfung:** Projekt-/Batch-/Karten-ID, Quellhash, englischer Name, Zahlen und Vorzeichen, geschützte Begriffe sowie Platzhalter abgleichen. Das Original bleibt unverändert. Ein fehlendes Negationssignal wird als Prüfhinweis markiert.
5. **Inhaltliche Prüfung:** Regelbedeutung, Timing, Kosten, Optionalität, Bedingungen und Ausnahmen anhand des Originals prüfen. Formale Tests ersetzen diese Prüfung nicht; jede Ausgabe bleibt awaiting_semantic_review. Eine etwaige Rückübersetzung wäre ein eigener Modellauftrag.
6. **Getrennte Ablage:** Originalquelle, Gemini-Erstentwurf, korrigierte Fassung, Glossarversion, Hash und Prüfentscheidung pro Batch versionieren. Ziel eigener freigegebener SWCCG-Ergebnisbereich; JOLNIR übernimmt nur Metadaten. Export/Spielimport/Veröffentlichung sind ausgeschaltet und brauchen einen eigenen Folgeauftrag.

## Prüfung der Vorbereitung

`node --test editorial/translations/translation-workflow.test.mjs`

18 deterministische Tests verwenden ausschließlich den selbst erstellten synthetic-fixture.json. Sie prüfen die Grenzen und den Ablauf, keine tatsächliche Gemini-Ausgabe und keine Übersetzungsqualität echter SWCCG-Karten. Keine vollständige Spiel- oder Projektabnahme.

## Vor dem ersten echten Test noch nötig

Eine ausdrücklich erlaubte Quelle beziehungsweise eine einzelne freigegebene Karte auswählen; dabei klären, dass sie nicht unter den bestehenden privaten Drucktextausschluss fällt. Glossar und gewünschte Behandlung der englischen Begriffe bestätigen. Erst dann den begrenzten Gemini-Auftrag separat freigeben und die reale Daten-/Ergebnisspeicherung prüfen. Bis dahin execution_enabled=false, model_transfer_enabled=false, production_import_enabled=false und publication_enabled=false.
