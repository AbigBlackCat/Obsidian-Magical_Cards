# Community submission: Magical Cards 0.3.0

The entry remains a **Draft**, not a published community listing. The **0.3.0 automatic scan has not yet been run**; the completed 0.2.1 scan below is historical evidence only and does not establish a result for 0.3.0 or approval by a community human reviewer.

| Field | Value |
| --- | --- |
| Name / ID | Magical Cards / magical-cards |
| Repository | AbigBlackCat/Obsidian-Magical_Cards |
| Version / target release tag | 0.3.0 |
| Minimum app version | 1.11.4 |
| Platforms | Desktop; macOS checks and their app version recorded in VERIFICATION.md; Windows not physically tested |
| Short description | Browse book, film and image showcase cards with editable descriptions, draggable modules and note embeds. |
| Payment | Free |

## Listing description

The text below is English-only and fits the community form's 1,000-character limit (910 characters):

Browse book, film and image showcase cards in a dedicated view or embed modules in notes. Choose from five layouts, including horizontal and vertical curved galleries. Each showcase stores explicitly imported images and optional names and descriptions in one local folder and Markdown note. Configure flipping and name position, edit descriptions, reorder cards, and drag modules to reposition them.

Start with six editable offline examples. Create modules with a name and aspect ratio; other options stay under Advanced. Removing a module hides it and keeps its notes, images and settings for restoration. Settings previews browse without flipping.

The interface is in Chinese, with complete Chinese and English guides. No account, sync service or audio playback is required. User-provided remote covers load from their image servers. Built-in covers work offline and are excluded from the MIT code license.

## Remediation of the 0.2.0 review

- Executable script-resource creation paths in the pinned React DOM production renderer are explicitly disabled by a checked, documented build adaptation.
- The six original covers are losslessly packed with Brotli and verified before writing. The build rejects main.js at 5,000,000 bytes or larger.
- Standard MIT license text is retained in LICENSE; third-party image exclusions remain explicit in README.md, README_en.md, THIRD_PARTY.md and examples/SOURCES.md.
- The root README includes an English introduction, Installation and Usage, with a full English guide and current native screenshots.
- Source checks use the official typed Obsidian lint configuration. Settings use searchable definitions on 1.13+ and retain a display fallback for 1.11.4.
- Releases contain only main.js, manifest.json and styles.css. CI creates verifiable build attestations.

Vault enumeration is used for card discovery and the user-invoked linked-note picker. Showcase imports copy only images explicitly selected or dropped by the user; folders are not scanned automatically. Clipboard writes occur when the user clicks Copy for generated embed code. No background clipboard reading or note-content upload is performed. Card and showcase edit failures retain drafts; final shutdown backs up drafts that cannot be saved into the local plugin directory and reports the recovery path.

## Historical automatic scan of 0.2.1

On 2026-10-11, the scan of **0.2.1** at commit `1c33e9c2aa4787332f322813c2b694c8468d7bd1` completed. The status below was read from the existing [draft entry](https://community.obsidian.md/account/plugins/magical-cards) through native Chrome DOM that day. The earlier automatic review of 0.2.0 failed on the same date. These results apply to 0.2.1, not the new 0.3.0 candidate.

| Check | Result |
| --- | --- |
| Overall scan | Completed; no Failed/Error findings |
| Release attestations | main.js and styles.css: Pass |
| Network | Pass |
| Dependencies | Pass |
| Build verification | Pass; main.js reproduced byte for byte |
| Listing | Draft; no publication action taken |

Four recommendations were reported in that scan and are retained with their functional reasons:

| Recommendation | Functional reason |
| --- | --- |
| Vault Enumeration | Card discovery and user-invoked linked-note search |
| Clipboard Access | Writing generated embed code when the user clicks Copy |
| keyCode | Keeping keyCode 229 for IME composition compatibility |
| execCommand | Inserting pasted text while preserving native undo |

These recommendations are not reported as blocking failures by this scan. Completion of the scan does not establish community human-review approval or publication.

## Review and release checklist

1. Verify the default branch manifest, package version and release tag match 0.3.0.
2. Verify the release's three files, build size, artifact attestations and reproducible clean build.
3. Run and inspect the **0.3.0** automatic review in the existing [draft entry](https://community.obsidian.md/account/plugins/magical-cards); it has not yet been run. Record its own commit, result and recommendations without replacing the historical scan above.
4. Keep the entry a Draft until publication is requested. Automatic scan completion alone does not establish human-review approval.

## Verification and limits

See VERIFICATION.md for recorded checks. Windows has not been tested on a physical machine. No mobile compatibility is claimed. Compatible host **0.1.33** shares showcase editing, per-module settings and removed-module restoration. When an older host owns the shared runtime, the plugin preserves it and prompts an upgrade for unsupported showcase and restoration features. Original cover rights and source notices remain applicable and are not expanded by this release.
