# Magical Cards 0.2.0 verification

Candidate verified on 2026-10-11. Native checks use macOS and Obsidian 1.14.4.

| Check | Result |
| --- | --- |
| Standalone TypeScript | Pass |
| Standalone automated tests | 72 / 72 pass |
| Standalone production build | Pass; eight original offline covers embedded in main.js |
| Compatible host 0.1.31 TypeScript / build | Pass |
| Host automated tests, including installation migration | 248 / 248 pass |
| Clean clone | Pass; npm ci, TypeScript, all 72 tests and build; main.js byte-identical to the tested candidate |
| Final native fresh install and process restart | Pass; 27 / 27 checks, including an actual process quit and cold restart |

Automated coverage includes legacy configuration and implicit directories, unknown fields, appearance defaults, journal failure recovery across restarts, interruption and retries, no reseeding after deletion or directory changes, five setting fields and draft conflicts, code generation and both block languages, source protection, shared registration and both plugin loading orders, layouts and WebGL cleanup/fallback.

The final native results are recorded in [verification/native-0.2.0.json](verification/native-0.2.0.json). Manual checks also confirmed the settings copy button followed by a native paste, reading and live preview in the specified acceptance guide, and migration into an existing vault after backup with original card files, host settings and enabled states preserved. Image and face geometry match, with `object-fit: cover`, zero padding and zero margins.

The native acceptance helper runs in a separate empty vault with startup synchronization disabled for the compatible host. It is not bundled in the public plugin or the example vault. No personal vault records, account settings or recovery drafts are published.

Windows has not been verified on a physical machine. No mobile support is claimed. Community submission materials are prepared, but the plugin has not been submitted or listed.
