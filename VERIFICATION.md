# Magical Cards 0.3.0 candidate verification

Checked on 2026-10-12. This records a release candidate; 0.3.0 has not yet been published. Native acceptance and updated settings screenshots are complete. Deployment and the new community automatic scan remain pending.

| Check | Result |
| --- | --- |
| Standalone TypeScript and automated tests | Pass; 133 / 133 |
| Compatible host 0.1.33, clean release export | Pass; TypeScript, build and 251 / 251 tests |
| Host development tree with existing Gantt work | Pass; TypeScript and 255 / 255 tests; Gantt work is excluded from official release source |
| Official type-aware lint | 0 errors; the same three documented compatibility/fixture warnings |
| Candidate package | 4,714,582-byte main.js; three installation files |
| Lossless cover packing | Six original SHA-256 hashes match |
| Script-resource policy | All three renderer script entry points reject execution; version/source mismatch aborts building |
| Reproducible build | Independent build processes produce identical installation bytes |
| Clean Git clones | Standalone `1d547cd` on Node 24.19.0 and 26.8.1: all checks and 133 tests pass; host `f49675d` on Node 24.19.0: full workspace CI path and 251 tests pass; all three installation files match the candidates |
| Native Obsidian acceptance and actual process restart | Pass; 22 / 22 on macOS with Obsidian 1.14.4, Magical Cards 0.3.0 and compatible host 0.1.33 |
| Actual settings search | Manually confirmed; “翻面” finds “图片橱窗 · 允许翻面” |
| Deployment and new community scan | Pending; no 0.3.0 release or new scan is claimed |

Clean clone evidence: [verification/clean-0.3.0.json](verification/clean-0.3.0.json). Candidate file hashes: [verification/candidate-0.3.0.json](verification/candidate-0.3.0.json).

Native acceptance covers the five layouts, image import retries, shared Markdown rendering, retained fields and surrounding text, settings save-failure drafts, IME save guards, name and flip controls, module restoration, both plugin loading orders, reading/Live Preview for both block languages, popout cleanup and open-view restoration. An actual application quit and new process launch preceded the final cold check at 2026-10-12T06:06:35.083Z; module settings, note bytes and image hashes remained unchanged. Sanitized results and the six bundled-cover hashes are recorded in [verification/native-0.3.0.json](verification/native-0.3.0.json).

The native WebGL loss/restoration case dispatches synthetic context events. It verifies the handlers and fallback lifecycle, without establishing a physical GPU failure. Bundled local covers are verified without remote image dependencies; system-level disconnected-network testing is not claimed. The native helper and acceptance-vault records are excluded from the public plugin.

New regression coverage includes native-readable showcase notes, image import identity and partial retries, safe SVGs, target-field merging, literal description newlines and repeated saves, damaged and duplicate markers, native unsaved-editor protection, retained names/descriptions and interrupted IME input, shared import/sort retries across view remounts, per-module appearance and three-card limits, read-only settings previews, hidden-module restoration, and real 0.2.1 final-release closures preserving showcase recovery drafts.

Import retry Files and stable IDs are retained while the shared library remains open. Closing a view or removing/restoring a module keeps this queue. A full application restart does not serialize File objects; already written images and note blocks remain on disk. Missing showcase notes are never automatically recreated.

Windows has not been tested on physical hardware. The community entry remains a draft; the previous completed scan below applies to 0.2.1 only.

<details>
<summary>Previous verified releases</summary>

# Magical Cards 0.2.1 verification

Checked on 2026-10-11 with macOS and Obsidian 1.14.4. New installations include three books and three films; existing eight-item installations retain their works and import progress.

| Check | Result |
| --- | --- |
| Standalone TypeScript | Pass |
| Standalone automated tests | 93 / 93 pass |
| Compatible host 0.1.32, clean release export | 249 / 249 tests; TypeScript and build pass; npm ci reports 0 vulnerabilities |
| Compatible host development working tree | 253 / 253 tests; work in progress is excluded from the release export |
| Compatible host release bundle | 655,809 bytes; SHA-256 `148ab772ea11486ae8f380dc71693a7a898bd71e0c8f75a6e26d06ce09e32fb6` |
| Official type-aware lint | 0 errors; 3 documented compatibility/fixture warnings |
| Production package | 4,667,641-byte main.js; exactly three installation files |
| Lossless cover packing | Six original SHA-256 hashes verified after asynchronous Brotli decompression |
| Script-resource policy | All three React DOM script-creation paths throw; version, source and match-count mismatches stop the build |
| Reproducible build | Two separate production builds are byte-identical |
| Native fresh install and actual process restart | 31 / 31 pass with the final installation files |
| Actual settings search | “贴满卡片” finds reading/film fields, expands the reading module and focuses its display dropdown |
| Clean Git clones | Standalone 1c33e9c: npm ci, lint, type checking, 93 tests, cover hashes, reproducible build and release check pass; host db20729: 249 tests, type checking and build pass; all installation bytes match |
| GitHub CI and release | [Tag workflow passed](https://github.com/AbigBlackCat/Obsidian-Magical_Cards/actions/runs/38148859159); exactly three assets published |
| Artifact attestations | gh attestation verify passes independently for main.js, manifest.json and styles.css; provenance points to release tag 0.2.1 and source commit 1c33e9c |
| Community automatic scan | Completed on 2026-10-11 for 0.2.1 / 1c33e9c; no Failed/Error findings, four recommendations; listing remains Draft |

Native checks cover five layouts, full-cover geometry, horizontal/vertical WebGL and fallback, summary editing, settings drafts and failed saves, code generation, reading/Live Preview, both block languages, atomic reorder/source protection, shared runtime loading order, popout cleanup and open-view restoration. Screenshots contain only the six public examples. The helper runs only in a separate acceptance vault and is excluded from the public plugin.

The local-cover check verifies decoding of bundled images without remote image dependencies. It does not establish system-level disconnected-network testing.

The final cold-restart run at 2026-10-11T14:51:01.071Z completed all 31 native checks after reloading the final installation files.

The three lint warnings retain keyCode 229 for IME compatibility, execCommand insertText for native undo, and the conventional .obsidian folder in the offline fixture generator. They do not disable lint rules. Windows has not been tested on physical hardware; no mobile support is claimed. The community automatic scan completed with no blocking findings and four recommendations; the entry remains Draft. This is not community human-review approval. The scan checks and retained functional reasons are recorded in [COMMUNITY.md](COMMUNITY.md).

Final native summary: [verification/native-0.2.1.json](verification/native-0.2.1.json). Release evidence: [verification/release-0.2.1.json](verification/release-0.2.1.json).

<details>
<summary>Previous 0.2.0 verification</summary>

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

</details>

</details>
