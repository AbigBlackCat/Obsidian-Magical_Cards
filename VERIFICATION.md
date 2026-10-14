# Magical Cards 0.5.0 verification

Released on 2026-10-14 as [Magical Cards **0.5.0**](https://github.com/AbigBlackCat/Obsidian-Magical_Cards/releases/tag/0.5.0), with compatible host **0.1.38**. Ordinary Dashboard categories replace the fixed All page and hiding controls. Module membership and confirmed module deletion are managed in Settings; moving out changes one category reference, while deletion removes the module configuration and references but preserves notes and images. Dashboard tabs can be reordered, and compact horizontal menus group card tools.

| Check | Result |
| --- | --- |
| Clean public clone | Node 24.19.0 / npm 11.17.0; 244 / 244 tests, type check, resource check and reproducible builds pass |
| Clean compatible host | 254 / 254 tests; shared cards 244 / 244; both type checks and reproducible builds pass; local Gantt work is excluded |
| Typed lint | 0 errors; the same 3 compatibility/fixture warnings |
| Native macOS acceptance | 22 checks before reload, 3 additional renderer-reload checks and 3 dual-plugin checks: 28 unique checks pass |
| Native data preservation | 20 work/image files are unchanged across reload; 21 files including configuration and the enabled-plugin list are unchanged across both plugin loading orders |
| Native diagnostics | No unhandled/React errors; one initial ResizeObserver warning, with none during reload or compatibility checks |
| Public production bundle | main.js is 4,760,390 bytes, below 5,000,000; six bundled original-cover hashes pass |
| Releases and provenance | Both tag workflows succeed; each release has exactly three installation files; downloads match clean builds and local installation packages byte for byte |
| Public attestations | All three files verify against the public release workflow, tag 0.5.0 and commit 6558cb3c7c28f4cd3b393f0e372cfdf9eb7f85e4; private-host attestation is not claimed |
| Documentation and local work | 44 local links pass; the author's development notes and original Gantt changes are preserved byte for byte |

[Release record](verification/release-0.5.0.json) · [Sanitized native record](verification/native-0.5.0.json). Public [tag CI](https://github.com/AbigBlackCat/Obsidian-Magical_Cards/actions/runs/38507111576) and compatible-host [tag CI](https://github.com/AbigBlackCat/obsidian-barry-workbench/actions/runs/38507112511) passed.

Regression coverage includes idempotent hidden-state migration, zero categories, first-run Example Dashboard, explicit repeated membership, independent category order, atomic module/category creation, stale drafts and concurrent conflicts, resource cleanup, both embed languages and legacy shared runtimes. Native checks verify the five layouts, horizontal/vertical gallery, settings-only membership/deletion, retained save-failure drafts, preview flip guards, menu keyboard focus and four-second success notices. A menu visibility-transition focus race found during acceptance was corrected before the final candidate passed. Earlier harness failures remain in the local evidence and are not counted as passes.

Native keyboard, pointer and input checks use synthetic DOM events on Obsidian's rendered UI; the drag check stubs pointer capture. One image was imported through the actual input in native acceptance; batch and retry behavior also has automated coverage. Restart evidence uses Obsidian's native Reload command, not an operating-system process quit. The acceptance helper and vault are excluded from release files.

The current vault was not updated. No new community scan or approval is claimed, and the historical README-language warning is not claimed resolved. Physical Windows testing and a black-screen fix are not claimed. Prior verification records below remain unchanged.

---

# Magical Cards 0.4.2 verification

Released on 2026-10-13 as [Magical Cards **0.4.2**](https://github.com/AbigBlackCat/Obsidian-Magical_Cards/releases/tag/0.4.2), with compatible host **0.1.37**. Module hiding stays recoverable; confirmed deletion removes module configuration, all Dashboard references and module positions while preserving work notes, showcase notes, images and work IDs. Existing note embeds report that the module was removed. Removing a module from one Dashboard continues to affect that category only.

The preceding local implementation check passed **212 / 212 cards tests** and **258 / 258 host development-tree tests**, type checks and builds. The host development tree includes existing Gantt work; these numbers are a local baseline, not clean official-release evidence. The final clean builds pass **212 / 212 cards tests** and **254 / 254 official-host tests**, both type checks, resource checks and reproducible builds. Lint has 0 errors and the same 3 warnings. The official host excludes the local Gantt changes.

Both tag workflows passed and published exactly `main.js`, `manifest.json` and `styles.css`. Downloaded files match the tested clean builds byte for byte. All three public files passed attestation verification bound to the release workflow, tag `0.4.2` and source commit `1fc580fe0d785eaa27e932a2c9f400c26f09a4b6`; no private-host attestation is claimed. Card main.js is **4,748,598 bytes**, below 5,000,000. [Release record](verification/release-0.4.2.json). Current-vault installation was not changed.

New regression coverage includes recoverable hiding versus deletion, removal of category and placement references, preserved notes/images and unrelated configuration, stale-view and stale-draft rejection, same-field conflicts, failed writes, concurrent saves, edit/sort guards, default modules that stay deleted after restart, and older shared-runtime capability checks. README.md retains its English opening, Chinese primary instructions and the author's development notes.

No new community scan is requested for this documentation change. The recorded 0.4.1 release and main-branch preview results remain historical; the README English-language warning is not claimed resolved. Fresh native deletion checks and physical Windows testing have not been performed for this release. Existing release verification below is unchanged.

---

# Magical Cards 0.4.0 verification

Checked on 2026-10-12 from source commit `1868348817d4c243a88485eefcb66b8673191b71`. This version adds Dashboard categories and separate ordinary-card and image-showcase creation. The checks below cover the clean public source, its native installation, compatible-host loading orders and the official release. Tag `0.4.0` uses source commit `93050e9b74b6a8d049de37cd14dfe89453e8507a`; its installation bytes match the checked clean build.

| Check | Result |
| --- | --- |
| Standalone clean GitHub clone | Node 24.19.0 / npm 11.17.0; npm ci, TypeScript, 168 / 168 tests, resource checks, two independent reproducible builds and release checks pass; tracked source remains clean |
| Dependency audit and official typed lint | 0 vulnerabilities; 0 lint errors and the three existing compatibility/fixture warnings |
| Installation bytes | main.js: 4,730,659 bytes, below 5,000,000; manifest.json: 285 bytes; styles.css: 32,913 bytes; all three clean-build files match the tested native installation |
| Compatible-host builds | Clean host 0.1.35: 251 / 251 tests; shared cards: 168 / 168. The separate local host with Gantt changes passes 255 / 255 after the required cards prebuild; those local changes are excluded from the official host release |
| Dashboard regression coverage | Independent membership and ordering, hidden/missing references, failed-sort baseline retention, draft-safe navigation, slow-save IME guards, title-save failures, per-leaf state and older shared API compatibility pass |
| Native Dashboard acceptance | 14 / 14 pass on macOS / Obsidian 1.14.4: 12 checks before restart and 2 after an actual acceptance-vault window close and reopen |
| Native file and state preservation | 18 checkpointed files and settings are byte-preserved after restart; the selected Dashboard and nonzero card stage are restored |
| Five native layouts and popout ownership | Layout saves retain the card tabs and loaded images in both windows; each window uses its own document and selection |
| Public example assets and authored guide | Six original local-cover hashes match; expected visible guide bytes, the author's introduction and hidden identity are preserved |
| Native diagnostics | 0 unhandled/React errors; 1 ResizeObserver warning in the pre-restart checks, with 0 in the cold-restart checks |
| Native dual-plugin compatibility | 10 / 10 pass; both loading orders, stopping/restarting either consumer, a shared Store and editing sessions, both block languages in reading and Live Preview, and the original leaf/board selection are verified |
| Compatibility data and diagnostics | 18 card files, configuration and the enabled-plugin list remain byte-identical; no unhandled/React errors or warnings |
| Official releases and provenance | Public 0.4.0 and compatible host 0.1.35 release CI succeed; each release has exactly three installation files matching the tested builds. All three public files pass signer-workflow-bound GitHub attestation verification; private-host attestation is not claimed |
| Community automated scan | 0.4.0 Completed with no Failed/Error: release attestations, network, dependencies and byte-for-byte build verification pass. Four recommendations and one English-README warning remain; this is not evidence of human review approval |
| Existing-library deployment | Four whole-vault backups verified; 21 existing plugin files updated. Original plugin data, enabled states and drafts remain intact. The current cards tab and the original workbench/Gantt are visible after relaunch; the original enabled host startup sync updates its managed timestamps while preserving note bodies and other book fields |

Sanitized records: [clean-0.4.0.json](verification/clean-0.4.0.json), [native-0.4.0.json](verification/native-0.4.0.json), [compatibility-0.4.0.json](verification/compatibility-0.4.0.json), [release-0.4.0.json](verification/release-0.4.0.json), [community-0.4.0.json](verification/community-0.4.0.json) and [deployment-0.4.0.json](verification/deployment-0.4.0.json). main.js SHA-256 is `821bac93390a2d8cffb2e29f8c8b916d571870d778a5bfcc432d00fba8b709fd`.

The final native report is dated 2026-10-12T09:32:05.515Z and verifies the restart checkpoint from 2026-10-12T09:31:31.106Z. The independent creation check explicitly reuses the successful native checkpoint from 2026-10-12T09:25:00.875Z; it does not claim another fresh creation. Earlier helper failures were corrected before this final run and are not counted as product fixes. The warning recorded in the earlier window check remains part of the evidence even though the cold-stage warning list is empty.

The final dual-plugin compatibility report is dated 2026-10-12T09:56:21.311Z. Its first two failed helper checks used the SDK focused-view API as a gate after tab changes. The corrected helper verifies that the original cards tab is foreground before simulating user focus and checking that API. These were harness preparation failures; no automatic `openCards` focus fix or product focus change is claimed. Both `magical-cards` and `barry-cards` render one surface with two modules in reading and Live Preview, without Dashboard navigation, after each tested loading-order transition.

Native checks confirm empty new Dashboard defaults, explicit module sharing between boards, keyboard reordering independent of the complete library and other boards, global hiding/restoration without changing membership or files, and deletion of a Dashboard without deleting modules, notes or images. The helper and acceptance-vault contents are excluded from the public plugin and these records.

A whole-tab native black screen was not reproduced. The historical WebGL resource checks below establish context retirement and reuse, but do not establish the black screen's root cause or claim it resolved. Physical Windows and system-level disconnected-network testing are not claimed. All earlier release evidence is preserved below.

---

# Magical Cards 0.3.1 verification

Checked on 2026-10-12. [Magical Cards 0.3.1](https://github.com/AbigBlackCat/Obsidian-Magical_Cards/releases/tag/0.3.1) is released from commit `bb34c362c2dcec353e04c7633484ef3fc01e3a55`; compatible host 0.1.34 is released from `f935506e2adc2355b526db77276df4254f18f89f`. This patch preserves the author's welcome-guide text, adds the appearance-save recovery hint and retires WebGL contexts when their canvases exit. Release provenance, community review and deployment evidence are recorded separately.

| Check | Result |
| --- | --- |
| Standalone clean Git clone | Node 24.19.0 / npm 11.17.0; npm ci, TypeScript, 138 / 138 tests, resource checks, reproducible builds and release checks pass; all three files match the tested candidate |
| Compatible host clean release export | Root workspace npm ci only; TypeScript, build and 251 / 251 host tests pass, with 138 / 138 cards tests and all cards checks; no `bw-gantt-order` work-in-progress selector in generated styles |
| Dependency audit and official typed lint | 0 vulnerabilities; 0 lint errors and the three existing compatibility/fixture warnings |
| Installation bytes | main.js: 4,715,979 bytes; manifest.json: 285 bytes; styles.css: 31,284 bytes |
| Original covers and generated guide | Six original cover hashes match; the generated template matches its source; default visible guide text is 4,691 bytes and custom roots change only five path prefixes |
| Guide retry and user-edit protection | Tests pass for the hidden identity marker, old heading/UUID identity, progress-write failures, edited pages and reuse without duplicate creation |
| Native patch regression | 13 / 13 pass on macOS / Obsidian 1.14.4; 0 errors and 3 ResizeObserver warnings |
| Browser appearance stress | 200 updates preserve the root and three stages; 120 instrumented main contexts created and 120 retired, none active at finish; 0 WebGL context warnings |
| Browser ratio/direction reuse | 200 saves keep the same three main canvas contexts; all three retire after layout exit; current-card selection is retained |
| Tag CI | [Public workflow passed](https://github.com/AbigBlackCat/Obsidian-Magical_Cards/actions/runs/38220785507); compatible host tag workflow also passed |

Sanitized records: [clean-0.3.1.json](verification/clean-0.3.1.json), [native-0.3.1.json](verification/native-0.3.1.json) and [browser-0.3.1.json](verification/browser-0.3.1.json). The native installation's three files were checked against the clean artifacts. main.js SHA-256 is `9e3bc9d5c080d2ec37c8f7d8159a70dd8100112e55dda7a1c9212b2dfe757d7b`; compatible host main.js is 714,312 bytes with SHA-256 `788134d737b0071b34c2c2addc7546646603e05a93d1c50ccc62f0475554590b`.

The final native run at 2026-10-12T07:56:43.552Z reuses the explicit successful first-auto-open checkpoint from 2026-10-12T07:52:03.613Z. It does not count this as another fresh auto-open or claim a new cold-restart acceptance run for 0.3.1. The three reported ResizeObserver loop warnings are retained in the evidence, rather than treating the run as warning-free.

The browser probes use isolated live React surfaces and a separate settings preview in a srcdoc iframe. They establish context retirement and reuse after the resource fix. The earlier before-probe used terminal Chromium and the after-probe used CUA Chrome; their diagnostic environments differ. A whole-tab native black screen was not reproduced, so these checks do not establish its root cause or claim it resolved. The recovery hint appears only after an existing module's appearance changes save successfully; ordinary saves retain their original notice and failures retain drafts. The creation option is labelled “添加图片橱窗”. System-level disconnected-network testing and physical Windows testing are not claimed.

All earlier release evidence is preserved below.

---

# Magical Cards 0.3.0 verification

Checked on 2026-10-12. [Magical Cards 0.3.0](https://github.com/AbigBlackCat/Obsidian-Magical_Cards/releases/tag/0.3.0) is released from commit `5aae52cd6aa457611eed9408f823843c6c9afb2d`. Native acceptance, screenshots and both release workflows are complete. The community automatic scan completed with no Failed/Error findings, four recommendations and one README English-language warning. Deployment to the existing user vault remains pending.

| Check | Result |
| --- | --- |
| Standalone TypeScript and automated tests | Pass; 133 / 133 |
| Compatible host 0.1.33, clean release export | Pass; TypeScript, build and 251 / 251 tests |
| Host development tree with existing Gantt work | Pass; TypeScript and 255 / 255 tests; Gantt work is excluded from official release source |
| Official type-aware lint | 0 errors; the same three documented compatibility/fixture warnings |
| Released package | 4,714,582-byte main.js; exactly three installation files, matching the tested candidate |
| Lossless cover packing | Six original SHA-256 hashes match |
| Script-resource policy | All three renderer script entry points reject execution; version/source mismatch aborts building |
| Reproducible build | Independent build processes produce identical installation bytes |
| Clean Git clones | Standalone `1d547cd` on Node 24.19.0 and 26.8.1: all checks and 133 tests pass; host `f49675d` on Node 24.19.0: full workspace CI path and 251 tests pass; all three installation files match the candidates |
| Native Obsidian acceptance and actual process restart | Pass; 22 / 22 on macOS with Obsidian 1.14.4, Magical Cards 0.3.0 and compatible host 0.1.33 |
| Actual settings search | Manually confirmed; “翻面” finds “图片橱窗 · 允许翻面” |
| GitHub CI and release | [Tag workflow passed](https://github.com/AbigBlackCat/Obsidian-Magical_Cards/actions/runs/38211712309); exactly main.js, manifest.json and styles.css published |
| Artifact attestations | All three downloaded files verified against the official workflow, tag 0.3.0 and source commit 5aae52c |
| Compatible host release | 0.1.33 from commit 628240d; CI passed, three downloaded installation files match the clean candidate; no private-repository attestation is claimed |
| Community automatic scan | Completed for 0.3.0 / 5aae52c; no Failed/Error findings, four recommendations and one README English-language warning; default-branch warning re-review pending |
| Existing-vault deployment | Pending |

Release and attestation evidence: [verification/release-0.3.0.json](verification/release-0.3.0.json). Clean clone evidence: [verification/clean-0.3.0.json](verification/clean-0.3.0.json). Pre-release candidate hashes: [verification/candidate-0.3.0.json](verification/candidate-0.3.0.json).

Native acceptance covers the five layouts, image import retries, shared Markdown rendering, retained fields and surrounding text, settings save-failure drafts, IME save guards, name and flip controls, module restoration, both plugin loading orders, reading/Live Preview for both block languages, popout cleanup and open-view restoration. An actual application quit and new process launch preceded the final cold check at 2026-10-12T06:06:35.083Z; module settings, note bytes and image hashes remained unchanged. Sanitized results and the six bundled-cover hashes are recorded in [verification/native-0.3.0.json](verification/native-0.3.0.json).

The native WebGL loss/restoration case dispatches synthetic context events. It verifies the handlers and fallback lifecycle, without establishing a physical GPU failure. Bundled local covers are verified without remote image dependencies; system-level disconnected-network testing is not claimed. The native helper and acceptance-vault records are excluded from the public plugin.

New regression coverage includes native-readable showcase notes, image import identity and partial retries, safe SVGs, target-field merging, literal description newlines and repeated saves, damaged and duplicate markers, native unsaved-editor protection, retained names/descriptions and interrupted IME input, shared import/sort retries across view remounts, per-module appearance and three-card limits, read-only settings previews, hidden-module restoration, and real 0.2.1 final-release closures preserving showcase recovery drafts.

Import retry Files and stable IDs are retained while the shared library remains open. Closing a view or removing/restoring a module keeps this queue. A full application restart does not serialize File objects; already written images and note blocks remain on disk. Missing showcase notes are never automatically recreated.

Windows has not been tested on physical hardware. The existing published community entry now displays 0.3.0, preserving its publication state. The 0.3.0 scan completed without Failed/Error findings; its four recommendations and README English-language warning remain recorded. Moving the English introduction to the top has not yet been re-reviewed. No community human-review approval is claimed. The previous scan below applies to 0.2.1 only. See [COMMUNITY.md](COMMUNITY.md) for current community status.

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

The purple ribbon and tab icons were visually checked in both the default light and dark themes. [Native dark-theme preview](previews/showcase-dark.png). The test vault’s original system-following color setting was restored.

GitHub artifact attestations are generated for the public plugin. The private compatible-host workflow records SHA-256 values and reproducible builds instead: GitHub requires Enterprise Cloud for private-repository attestations, so that workflow does not claim a signed attestation.
