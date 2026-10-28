# Changelog

## v1.2.0 — 2026-10-28

### Added

- Experimental microphone timegrapher accessible from the main menu or from a watch.
- 90-second measurement sessions: 30 seconds of warm-up followed by three separate 20-second evaluation intervals. Inconsistent or unreliable intervals are rejected instead of silently saved.
- Automatic beat-rate detection, estimated daily rate and beat error, a detector plausibility score and interval-to-interval spreads.
- Six selectable watch positions with pictograms; the position is saved alongside each microphone result.
- Timegrapher measurement history in each watch's details, plus manual entry of measurements from a physical timegrapher, including amplitude where available.
- Assign completed microphone measurements to a watch, including when opening the timegrapher from the three-dot menu.

### Improved

- The microphone is the default timegrapher source; the synthetic demo remains available as an optional collapsible diagnostic tool and cannot save measurements.
- Local ZIP backup, restore preview and Restore V3 safeguards, including pre-restore safety copies, storage checks and interruption recovery.
- Local Termux startup and IPv6-loopback support; other collection dashboard, watch-form and interface refinements.

### Important limitations

- The microphone timegrapher is **experimental and uncalibrated**. Signal plausibility is not proof of absolute rate accuracy; no amplitude is inferred from phone audio.
- The app is designed for local use on one device. It has no server-facing multi-user authentication. Never expose the Python API publicly.
- Personal watch data, photos and backups are not included in source releases and must be backed up separately.

## v1.1.4 — 2026-09-24

- Fixed collection sorting so sort key and direction persist after opening a watch and returning to the collection.
- Collection cards show the effective acquisition price again.
- Improved mobile image management for multiple images.
- Added selectable cover image and image ordering controls.
- Improved image deletion behavior.
- Continued local-first Termux support while preserving existing collection data during upgrades.

## v1.1.3

- Collection cards show the effective price paid instead of market value.
- List view purchase-price column uses the same effective price.
- Collection sort key and direction persist across navigation and browser restarts.
- Grid/list view persists as well.
- Mobile image management uses a two-column responsive layout with controls separated from the image.

See the version-specific changelog files for earlier v1.1.x development notes.
