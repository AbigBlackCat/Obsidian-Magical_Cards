# Community submission: Magical Cards 0.4.1

The entry is available in the [community directory](https://community.obsidian.md/plugins/magical-cards). On 2026-10-12, the **0.4.1 automatic scan completed with no Failed/Error findings**, four recommendations and one README English-language warning. Its existing publication state is preserved. Automatic scan completion does not establish approval by a community human reviewer.

The documentation and editing-test remediation was reviewed on the main branch on 2026-10-13. That preview completed without Failed/Error findings; the README warning and two source recommendations remain. Preview scope and evidence are recorded below.

| Field | Value |
| --- | --- |
| Name / ID | Magical Cards / magical-cards |
| Repository | AbigBlackCat/Obsidian-Magical_Cards |
| Version / target release tag | 0.4.1 |
| Minimum app version | 1.11.4 |
| Platforms | Desktop; macOS checks and their app version recorded in VERIFICATION.md; Windows not physically tested |
| Short description | Browse book, film and image showcase cards with editable descriptions, draggable modules and note embeds. |
| Payment | Free |

## Listing description

The text below fits the community form's 1,000-character limit. The existing published form is not changed automatically:

Browse book, film and image showcase cards in a dedicated view or note embeds. Choose five layouts, including horizontal and vertical curved galleries. A showcase stores explicitly imported images, optional names and descriptions in one local folder and Markdown note.

Start with six editable offline examples. Create card modules or image showcases with a name and aspect ratio; other options stay under Advanced. Manually place modules in Dashboards, each with its own order. Move a module out of one Dashboard, or hide it across the standalone view and restore it later. Both actions preserve cards, files and settings; note embeds still display hidden modules. Settings previews browse without flipping.

The interface is in Chinese, with full Chinese and English guides. No account, sync service or audio playback is required. Remote covers load from their image servers; built-in covers work offline and are excluded from the MIT code license.

## Remediation of the 0.2.0 review

- Executable script-resource creation paths in the pinned React DOM production renderer are explicitly disabled by a checked, documented build adaptation.
- The six original covers are losslessly packed with Brotli and verified before writing. The build rejects main.js at 5,000,000 bytes or larger.
- Standard MIT license text is retained in LICENSE; third-party image exclusions remain explicit in README.md, README_en.md, THIRD_PARTY.md and examples/SOURCES.md.
- The root README includes an English introduction, Installation and Usage, with a full English guide and current native screenshots.
- Source checks use the official typed Obsidian lint configuration. Settings use searchable definitions on 1.13+ and retain a display fallback for 1.11.4.
- Releases contain only main.js, manifest.json and styles.css. CI creates verifiable build attestations.

Vault file enumeration discovers card paths, but card content is read only after filtering paths to the configured card directory. The user-invoked linked-note picker searches Markdown paths across the vault to let users associate an existing note. Showcase imports copy only images explicitly selected or dropped by the user; folders are not scanned automatically. Clipboard writes occur when the user clicks Copy for generated embed code; editing reads plain text from a user-triggered paste event. No background clipboard reading or note-content upload is performed. Card and showcase edit failures retain drafts; final shutdown backs up drafts that cannot be saved into the local plugin directory and reports the recovery path.

## Automatic scan of 0.4.1

The [account entry](https://community.obsidian.md/account/plugins/magical-cards) reported **0.4.1**, released from commit `9e65579d2572e21ad46228eda75e5a9c55bd19fe`, as Completed on 2026-10-12. These results apply to that immutable release. Default-branch documentation or test changes do not alter its reviewed artifacts.

| Check | Result |
| --- | --- |
| Overall scan | Completed; no Failed/Error findings |
| Release attestations | main.js and styles.css: Pass |
| Network | Pass; no suspicious network requests reported |
| Dependencies | Pass; no vulnerabilities reported |
| Build verification | Pass; main.js reproduced byte for byte |

The scan retained exactly four recommendations and one warning:

| Finding | Level | Functional reason or review evidence |
| --- | --- | --- |
| Vault Enumeration | Recommendation | Automatic card-content reads are restricted to the configured directory. The linked-note picker searches vault-wide Markdown paths only when the user invokes it. |
| Clipboard Access | Recommendation | Copy writes generated embed code only on user action; paste reads only the event's plain text. There is no background clipboard read. |
| keyCode | Recommendation | The `229` guard preserves IME composition when an Enter or Escape key event does not reliably expose `isComposing`; it does not trigger a save or cancel during composition. |
| execCommand | Recommendation | `insertText` inserts plain text while retaining the editor's native undo history. The existing range fallback rejects clipboard HTML when that API is unavailable. |
| README does not appear to contain English text | Warning | The Chinese main README already includes an English overview and explicit Installation / Usage sections; README_en.md is a complete English guide. These sections are evidence for human review. The warning is not claimed resolved, and no assumption is made about the check's detection rules. |

Automatic completion does not establish approval by a human reviewer. Recommendations are reported with their functional reasons rather than removed by disabling existing editing or linked-note features.

The [regression record](verification/review-remediation-0.4.1.md) covers IME event boundaries, plain-text paste, and real Chrome / Obsidian undo and redo. The compatibility choices follow the documented [IME event ordering](https://developer.mozilla.org/en-US/docs/Web/API/Element/keydown_event) and [native undo history](https://developer.mozilla.org/en-US/docs/Web/API/Document/execCommand) limitations. This remediation changes documentation and tests; rebuilt installation files remain byte-identical to 0.4.1.

## Main-branch preview after remediation

On 2026-10-13, the account entry's **Review branch** scan of `main` at commit `856cc79ca6dff1779c3032c2aebdd421f5a41e32` completed. [Captured result](verification/community-remediation-0.4.1.jpg).

| Check | Result |
| --- | --- |
| Overall preview | Completed; no Failed/Error findings |
| Source code | Two recommendations remain: deprecated `keyCode` and `execCommand` |
| Dependencies | Pass; no vulnerable dependencies found |
| README | English-language warning remains despite the expanded English overview, Installation / Usage and full English guide |

This branch preview ran only source, dependency and README checks. It did not rerun release attestations, network, behavior or reproducible-build checks, so it does not establish that the release's Vault Enumeration or Clipboard Access recommendations have disappeared. The Chinese main README remains the author's chosen primary document. The expanded English sections, regression evidence and functional explanations are retained for human review; no detection-rule workaround or final approval is claimed.

## Historical automatic scan of 0.4.0

The [account entry](https://community.obsidian.md/account/plugins/magical-cards) reported **0.4.0**, released from commit `93050e9b74b6a8d049de37cd14dfe89453e8507a`, as Completed on 2026-10-12. The result was read from Chrome DOM after requesting a release scan. [Captured scan result](verification/community-0.4.0.jpg).

| Check | Result |
| --- | --- |
| Overall scan | Completed; no Failed/Error findings |
| Release attestations | main.js and styles.css: Pass |
| Network and dependencies | Pass |
| Build verification | Pass; main.js reproduced byte for byte |
| Listing | Existing published entry displays 0.4.0; publication state preserved |

The same four recommendations remain: vault enumeration for card discovery and user-invoked linked-note search, clipboard access for user-invoked code copying, keyCode 229 for IME compatibility, and execCommand for undo-preserving plain-text paste. The README English-language warning remains even though README.md has an English introduction and Installation / Usage sections and README_en.md is a complete English guide. It is not claimed resolved. Automatic completion does not establish approval by a human reviewer.

## Historical automatic scan of 0.3.0

On 2026-10-12, the existing [account entry](https://community.obsidian.md/account/plugins/magical-cards) reported the scan of **0.3.0**, released from commit `5aae52cd6aa457611eed9408f823843c6c9afb2d`, as Completed. The status was read through native Chrome DOM. [Captured scan result](verification/community-0.3.0.png).

| Check | Result |
| --- | --- |
| Overall scan | Completed; no Failed/Error findings |
| Release attestations | main.js and styles.css: Pass |
| Network | Pass |
| Dependencies | Pass |
| Build verification | Pass; main.js reproduced byte for byte |
| Listing | Existing published entry displays 0.3.0; publication state preserved |

The scan retained five findings:

| Finding | Level | Functional reason or follow-up |
| --- | --- | --- |
| Vault Enumeration | Recommendation | Card discovery and user-invoked linked-note search |
| Clipboard Access | Recommendation | Writing generated embed code when the user clicks Copy |
| keyCode | Recommendation | Keeping keyCode 229 for IME composition compatibility |
| execCommand | Recommendation | Inserting pasted text while preserving native undo |
| README does not appear to contain English text | Warning | The existing English overview was moved immediately below the language switch, before HTML and images. A default-branch re-review is pending; the warning is not claimed resolved. |

The scan reports no blocking failure. These results do not establish community human-review approval. The earlier Draft status below remains the historical state of the 0.2.1 review.

## Historical automatic scan of 0.2.1

On 2026-10-11, the scan of **0.2.1** at commit `1c33e9c2aa4787332f322813c2b694c8468d7bd1` completed. The status below was read from the existing [account entry](https://community.obsidian.md/account/plugins/magical-cards) through native Chrome DOM that day. The earlier automatic review of 0.2.0 failed on the same date. These results apply to 0.2.1, not the new 0.3.0 candidate.

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

1. Verify the default branch manifest, package version and release tag match 0.4.1.
2. Verify the release's three files, build size, artifact attestations and reproducible clean build.
3. Record the actual scan result and its release or branch commit. The completed 0.4.1 release scan still contains four recommendations and the README English-language warning.
4. Preserve the entry’s existing publication state. Automatic scan completion alone does not establish human-review approval.

## Verification and limits

See VERIFICATION.md for recorded checks. Windows has not been tested on a physical machine. No mobile compatibility is claimed. Compatible host **0.1.36** shares showcase editing, per-module settings, removed-module restoration and explicit Dashboard and standalone-module-visibility capabilities. Dashboard navigation and the new standalone hiding rule appear only in the standalone Magical Cards view; note embeds retain their existing display rules. When an older host owns the shared runtime, the plugin preserves it and prompts an upgrade for unsupported capabilities. Original cover rights and source notices remain applicable and are not expanded by this release.
