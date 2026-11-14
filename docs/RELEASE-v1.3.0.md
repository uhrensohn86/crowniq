# Crowniq v1.3.0 — TGBC & UI

## Deutsch

- TGBC-/USB- und internes Mikrofon unterscheiden; automatische Erkennung bei eindeutigen Browsernamen, manuelle Zuordnung als Fallback. Messquelle in Datenbank und Historie erhalten.
- Neues Dashboard, Fotokacheln, gemeinsame schwebende Navigation und konsistente Themes.
- Großbildgalerie mit Wischen, Pfeilen und Tastatur.
- Schnellmessung mit Zifferblatt oben und Expertenmodus. Identische 90 Sekunden: 30 Sekunden Einmessung plus drei Auswertungen zu je 20 Sekunden.
- Übersetzungen der Zeitwaage und Einstellungen in Deutsch, Englisch, Französisch und Spanisch; stabiles mobiles Menü bei wechselnder Firefox-Adressleiste.

Bestehende Daten und Messungen bleiben erhalten. Zusätzliche Messquellenfelder werden additiv ergänzt. Alte Messungen werden nicht rückwirkend einer Quelle zugeordnet. Amplitude wird weiterhin nicht aus Mikrofon-Audio berechnet; vorhandene manuelle Amplituden-/Hebewinkeleingaben bleiben verfügbar.

## English

- Internal and TGBC/USB microphone source tracking with browser-assisted detection and manual fallback; sources saved in measurement history.
- Redesigned dashboard, photo tiles, shared floating navigation and consistent themes.
- Full-size gallery with swipe, arrows and keyboard navigation.
- Quick dial-up measurements and expert diagnostics share the unchanged 90-second analysis.
- Complete timegrapher UI in German, English, French and Spanish; mobile dock follows the visible viewport.

Existing data and measurements are retained through additive schema migration. Legacy readings are not assigned a guessed source. Microphone values remain experimental and uncalibrated; amplitude is not inferred from audio.

## Validation / Prüfung

Production build; synthetic migration and safe-copy tests; measurement flow in all four languages; UI/navigation/viewport tests. User-confirmed Android/Firefox tests cover gallery, translations, fixed menu and TGBC measurement/save/restart persistence. No personal collection data, pictures or backups are included.

Before updating, stop Crowniq and keep an external full ZIP backup. See docs/PRODUCTION-v1.3.0.md for rollback and migration. Existing release v1.2.0 remains unchanged.
