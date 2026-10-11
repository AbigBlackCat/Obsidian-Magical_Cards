# Community submission: Magical Cards 0.2.1

The entry exists as a **draft**, not a published community listing. The automatic review of 0.2.0 failed on 2026-10-11. Version 0.2.1 is the remediation release; its review outcome will be recorded after the actual community scan.

| Field | Value |
| --- | --- |
| Name / ID | Magical Cards / magical-cards |
| Repository | AbigBlackCat/Obsidian-Magical_Cards |
| Version / release tag | 0.2.1 |
| Minimum app version | 1.11.4 |
| Platforms | Desktop; native verification on macOS / Obsidian 1.14.4 |
| Short description | Turn book and film collections into interactive cover cards with draggable modules and note embeds. |
| Payment | Free |

## Listing description

Browse and edit book and film covers in Obsidian. Open a dedicated cards view or embed collections in notes, with reading mode and Live Preview support. Choose a cylindrical carousel, coverflow, album rail, horizontal or vertical curved gallery, or a skewed carousel. Drag modules to reorder them and use the keyboard to browse. New users start with six editable offline examples. Your collections and settings remain ordinary Markdown files in your vault.

The interface is currently in Chinese; both Chinese and English guides are provided. No account is required. The plugin does not sync data or play audio. User-supplied remote cover URLs load from their image servers. Built-in sample covers are bundled for offline use and are excluded from the code license; attribution is in examples/SOURCES.md.

## Remediation of the 0.2.0 review

- Executable script-resource creation paths in the pinned React DOM production renderer are explicitly disabled by a checked, documented build adaptation.
- The six original covers are losslessly packed with Brotli and verified before writing. The build rejects main.js at 5,000,000 bytes or larger.
- Standard MIT license text is retained in LICENSE; third-party image exclusions remain explicit in README.md, README_en.md, THIRD_PARTY.md and examples/SOURCES.md.
- The root README includes an English introduction, Installation and Usage, with a full English guide and current native screenshots.
- Source checks use the official typed Obsidian lint configuration. Settings use searchable definitions on 1.13+ and retain a display fallback for 1.11.4.
- Releases contain only main.js, manifest.json and styles.css. CI creates verifiable build attestations.

Vault enumeration is used for card notes and the user-invoked linked-note picker. Clipboard writes occur when the user clicks Copy for generated embed code. These existing functions are described in both guides; no background clipboard reading or note-content upload is performed.

## Review and release checklist

1. Verify the default branch manifest, package version and release tag match 0.2.1.
2. Verify the release's three files, build size, artifact attestations and reproducible clean build.
3. Inspect the latest automatic review in the existing [draft entry](https://community.obsidian.md/account/plugins/magical-cards).
4. Resolve remaining blocking findings and record the actual outcome here. Keep the entry a draft until publication is requested.

## Verification and limits

See VERIFICATION.md for recorded checks. Windows has not been tested on a physical machine. No mobile compatibility is claimed. Full duplicate-ID checks across both block aliases require compatible host version 0.1.31 or later. Host 0.1.32 adds the reviewed cover-reading and lifecycle fixes. Original cover rights and source notices remain applicable and are not expanded by this release.
