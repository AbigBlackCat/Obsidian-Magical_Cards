[简体中文](README.md) · English

<h1 align="center">Magical Cards</h1>
<p align="center">Browse your books, films and collections as cover cards, and bring them into your notes.</p>
<p align="center">
  <a href="https://github.com/AbigBlackCat/Obsidian-Magical_Cards/releases"><img alt="Latest release" src="https://img.shields.io/github/v/release/AbigBlackCat/Obsidian-Magical_Cards?style=flat-square"></a>
  <a href="LICENSE"><img alt="License: free use, restricted redistribution" src="https://img.shields.io/badge/license-free_use-blue?style=flat-square"></a>
</p>
<p align="center">
  <a href="https://github.com/AbigBlackCat/Obsidian-Magical_Cards/releases/latest">Download</a> ·
  <a href="#usage">Usage</a> ·
  <a href="https://github.com/AbigBlackCat/Obsidian-Magical_Cards/releases">Changelog</a> ·
  <a href="https://github.com/AbigBlackCat/Obsidian-Magical_Cards/issues">Report a bug</a>
</p>

**The author’s preferred card style; the plugin offers several layouts:**

<img width="1509" height="947" alt="The author’s preferred card layout" src="https://github.com/user-attachments/assets/b4a68687-3389-4eb4-8da3-5a91ffc45ca9" />

[Available in the Obsidian community](https://community.obsidian.md/plugins/magical-cards), with ongoing updates.

<img width="688" height="761" alt="Magical Cards community listing" src="https://github.com/user-attachments/assets/e37d8e9a-3b02-46fe-8985-22c086d64986" />

Magical Cards is an Obsidian plugin for browsing and editing book, film, general collection and image showcase cards on desktop and mobile. Open a dedicated cards view or embed collections in your notes. Both use the same work notes, with search, sorting, linked notes, and editable summaries on the back of each card.

From **0.9.0**, the complete source is maintained in a private repository. This public repository continues to provide installation, updates, documentation and Issues. Personal and business use is free under the [license and redistribution terms](#license-and-source).

**The interface is currently in Chinese.** This guide includes the original labels so you can find the controls. Install from the community browser or use the manual steps below.

## Contents

- [Installation](#installation)
- [Usage](#usage)
- [Features and layouts](#features-and-layouts)
- [Media cases and the 3D timeline](#media-cases-and-the-3d-timeline)
- [WeRead bookshelf import](#weread-bookshelf-import)
- [Appearance and settings](#appearance-and-settings)
- [Note embeds](#note-embeds)
- [FAQ and data](#faq-and-data)
- [License and source](#license-and-source)

## Installation

Requires **Obsidian 1.11.4 or later**. In Settings → Community plugins → Browse, search for **Magical Cards**, install and enable it.

For manual installation:

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/AbigBlackCat/Obsidian-Magical_Cards/releases/latest).
2. Put all three files in `<vault>/.obsidian/plugins/magical-cards/`.
3. Reload Obsidian and enable **Magical Cards** in Settings → Community plugins.

Supports Obsidian for iOS/iPadOS and Android. HarmonyOS devices that can run Android Obsidian use the same plugin files. Native HarmonyOS hosts and compatibility containers depend on their ability to run Obsidian plugins and are unverified; the [official mobile downloads](https://obsidian.md/download) currently list iOS and Android. Mobile browser emulation is not physical-device acceptance. iOS, Android, HarmonyOS and Windows have not been tested on physical hardware.

On mobile, choose **打开 Magical Cards** (Open Magical Cards) from the bottom menu, or run **Magical Cards：打开卡片视图** from the command palette. Use **上一张 / 下一张** (Previous / Next) below the cards: tap once to advance one card, or hold for 400ms to begin advancing every 160ms; release to stop. Single-finger swipes remain available to Obsidian sidebars and page scrolling, and pinch zoom stays available. Both gallery directions use the same paging buttons. Tap a neighboring card to center it, the transparent top-right area to flip, or elsewhere on the current card to open its note. The back expands inside its module for editing and pauses paging; returning to the front keeps your position. Three cards fit the module width and visible height without changing saved ratios or appearance. Use the module menu to select multiple images or SVGs (choose SVGs through the system file picker). Swipe the Dashboard tab strip to see more categories; use **Dashboard 向前移动 / 向后移动** in its menu to reorder. Module title handles still support dragging. Finish syncing notes and attachments with your chosen vault sync tool before opening cards; the plugin itself performs no sync.

## Usage

On first use in an empty directory, the plugin creates a guide, three books, and three films in `卡片库` and opens the guide. The six editable covers are bundled with the plugin and work offline.

The initial appearance is **cylindrical layout, full cover, fill and crop, paper material, 2:3, and at most three visible cards**. You can still browse every work using paging buttons on mobile, or dragging and arrow keys on desktop.

1. **Open cards:** use the ribbon cards icon or the **打开卡片视图** (Open cards view) command.
2. **Add a work:** click `+` in a module and enter its title, cover, and details.
3. **Write a summary:** flip a card to edit its back, or open the linked work note.

The **查看示例及用法说明** (Open examples and guide) command reopens the guide and can retry an interrupted initialization. Existing collections and appearances are preserved. Deleted examples do not return on restart.

## Features and layouts

| Feature | How to use it |
| --- | --- |
| Browse and search | Swipe, scroll, or use arrow keys. Click the magnifying glass to search. |
| Manage works | Add or edit covers and details, link notes, delete works, and change their order. |
| Back-of-card summaries | Flip the card and write. Switching layouts preserves the current card and summary draft. |
| Dashboards | Organize modules into equal categories, assign them in Settings, and drag tabs to reorder categories. Each category has an independent module order. |
| WeRead import | Authorize in Settings, load the current shelf, and select books to import into a book module. |
| Module works Dashboard | Use the portal action before search to open the module’s statistics, latest work, filters and cover grid. |
| 3D timeline | Browse dated cards in reading, film, custom and image showcase modules, independently of their saved order. |
| Reorder modules | Drag the title handle, or focus it and press Alt / Option + ↑ / ↓. |
| Embed collections | Use reading mode or Live Preview; the same collection can appear in multiple notes. |

### Dashboards

Every Dashboard is an ordinary category and can contain any number of modules. There is no fixed All tab. A module may belong to several Dashboards when explicitly assigned, while its notes and images remain shared. Unassigned modules stay in Settings and remain available for note embeds.

Use the horizontal category menu in the cards tab to create, rename or delete a Dashboard. Deleting a category preserves its modules and data. Drag the tabs, or focus a tab and press Alt / Option + Left or Right, to reorder categories. Each Dashboard keeps its own module order, and each window remembers the selected category by ID.

The selected category expands to show its name; other categories show icons, with full names available on hover or keyboard focus. Choose an icon when creating or editing a category, or use Automatic to match its name. Existing categories require no migration, and icon changes preserve membership and order.

Module actions spring open from a round button into a compact capsule, with larger touch targets on mobile. In the Magical Cards tab, desktop hides the permanent paging row: drag, scroll or use arrow keys to browse. Phones and iPads retain Previous / Next and hold-to-repeat. The curtain's enlarged viewer keeps its adjacent-card controls. Note embeds, settings previews and other hosts retain their existing paging rules.

The Dashboard action menu offers **加入已有模块** (Join existing modules) and **新建卡片模块** (Create cards module). Search and select existing modules to append them to the current category without copying notes or images. New modules take a name, work type and aspect ratio and join the category on Save; use the module action menu for further styling. Failed saves retain input and selections, with Reload available after external category changes.

**移出卡片模块** (Move modules out) searches and selects members of the current category. Confirming removes only their membership in that category; module settings, other categories, notes and images remain, and modules can be joined again. Create Dashboard uses a grid-plus icon, while Create cards module uses a card-plus icon.

You can also manage module membership in **Settings**:

- **Add to Dashboard:** expand a module, choose existing categories, or create a category and save it together with the module. Category selection is optional when creating a module.
- **Remove from Dashboard:** the exit-arrow icon beside a membership removes only that category reference; other categories and note embeds keep displaying the module.
- **Delete module:** the trash icon beside an expanded module title removes its configuration, category references and positions after confirmation. Work notes, showcase notes, images and work IDs remain intact. Existing embeds report a deleted module; there is no module restoration control.
- **Delete current card or image:** use the module's horizontal action menu. The confirmation identifies the individual card being deleted.

First-time users get a normal, renameable and deletable 示例 (Example) Dashboard containing Reading and Films. Existing libraries do not receive an automatic category. During upgrade, historically hidden modules become unassigned, old hiding states are cleared, and affected note embeds display those modules again.

### Module works Dashboard

Click the portal action immediately before search in a module menu to browse its statistics, latest update, search, filters, temporary sorting and cover grid. Opening from the Magical Cards category view uses the same tab; note embeds reuse a Magical Cards tab in the same window, creating one only when needed. The page header contains only **返回** (Return) and the module name. Temporary sorting does not rewrite saved module order; existing cover proportions and note-opening behavior are retained.

Return restores the source page's scroll position and portal focus. If the source was closed, or the works page was restored after restarting Obsidian, Return opens the Magical Cards category view. Custom cards prefer their linked note; showcase cards open the module note.

**启用模组作品 Dashboard** (Enable module works Dashboard) is enabled by default and saved in local plugin configuration. Turning it off immediately hides portal actions and shows a disabled message on open works pages, with Return still available. Existing installations open Magical Cards Settings after an upgrade and show the update dialog once for that version; closing it or choosing the checkmark button records it as read. Fresh installations keep the existing starter guide. No work-data migration, film fields or Dashboard category changes are introduced.

### Media cases and the 3D timeline

Choose **盒装封面** (Boxed cover) and **3D 斜列漫游** (3D diagonal gallery) in module appearance. The **影像盒** (Media case) material mixes transparent CD cases and matte-black VHS cases using stable choices weighted by cover brightness. Refreshing or reordering does not reshuffle them. Choose automatic mixing or force either case for a module; an individual card's choice takes precedence.

The timeline action is immediately to the right of **查看全部作品** (View all works) in each module menu. The first time, choose collection/recorded date or work date and add dates to individual cards. Year, year-month and full dates are supported. After saving, the module remembers its choice and opens the gallery directly next time; an unsaved draft reopens the settings. Use the pencil in the work-date heading to rename it for that module. The segmented date editor uses an existing default when available, or pre-fills today's local date for an empty field.

Drag cards directly, release or stop scrolling to settle, and select the current card to open details; closing returns it to the gallery. Details offer the original note and card editing. The gallery mounts nearby cards while retaining access to the whole collection; its date order never changes the module's manual order. The upper-right action menu contains search, **补充时间** (Add dates) and timeline settings. Add dates lists cards missing the selected date in a searchable dialog and can also show all cards. A separate bottom ruler displays the current full date.

Collection dates default to card creation dates. New showcase images record their addition date; older images can be dated manually. Work dates prefer a manual value, then a WeRead ebook's publication date, a film's valid release year or a general work's valid year. For a WeRead source card, **微信读书补全出版时间** (Fill publication date from WeRead) adds the result to the draft; **保存并进入** saves it to the note. Clearing a manual value restores its default. Conflicts retain the draft and failed batch items can be retried. The timeline remains available if the module works Dashboard is disabled.

### Layouts and extension previews

| Folded-cover carousel | Fan card rack |
| --- | --- |
| ![Folded-cover carousel in a native Obsidian note](previews/coverflow-carousel.png) | ![Fan card rack in a native Obsidian note, showing sleeves only](previews/album-rail.png) |
| Horizontal curved gallery | Skewed carousel |
| ![Horizontal scroll-bend gallery in a native Obsidian note](previews/scroll-bend.png) | ![Skewed carousel in a native Obsidian note](previews/skewed-carousel.png) |

The cylindrical layout is shown at the top of this page. The curved gallery also supports vertical scrolling:

![Vertical scroll-bend gallery in a native Obsidian note](previews/scroll-bend-vertical.png)

Two more layouts are available through **动效布局** (Layout):

| Layout | Browsing |
| --- | --- |
| 3D转轮 (3D wheel) | The ring shows at most eight cards; dragging, arrow keys and paging buttons still browse the entire collection. Browsing is manual by default, with an optional **自动旋转** (Auto rotate) switch. |
| 纸片卷曲 (Curling paper) | A continuous mesh draws the bent paper without white gaps between slices. Use dragging, arrow keys or paging buttons; repeated covers are visual copies of the same cards. |

Auto rotate appears only for the wheel and starts off. When enabled, it pauses during hover, focus, dragging and back-of-card editing; animation also stops outside the viewport or while the page is hidden. The five existing layouts remain manual. The wheel and curling-paper layout use their own visible-card arrangements and ignore the three-card limit, while preserving its saved value for other layouts.

The curved gallery, curtain and magazine scroller read cover bytes through Obsidian and create safe image data for rendering, including remote covers whose servers do not allow cross-origin canvas access. Original cover references stay unchanged; failed reads show a safe placeholder while browsing and editing remain available.

Fan card rack displays sleeves without playback controls or a spinning record. The curved gallery provides an **打开笔记** (Open note) control for the current card and a summary editor. It falls back to ordinary cards if WebGL or texture loading fails. Slide curtain is now preview-only under About → Extension effects. Existing modules and embeds render as cylinders without rewriting saved settings or code blocks. Its in-memory demo has no edit, note-opening or apply action and falls back to ordinary cards when WebGL fails. Reduced motion disables wheel auto rotation, curtain swinging and magazine bending while preserving button and keyboard browsing. New layouts use existing work covers and do not include the reference sites' demo artwork.

![Dashboard categories reference shared modules and save their own order](previews/dashboards.png)

## WeRead bookshelf import

In Settings → Magical Cards, open **微信读书** from the category index. Open [获取 API Key](https://weread.qq.com/r/weread-skills), paste your key, and choose **保存授权**. The password field clears after saving. Choose **读取书架**, search by title or author, and select books; none are selected initially. Ebooks and audio albums are supported.

Choose a book module and select **导入所选**. Available ebook publication dates are read and saved to the note's `publicationDate` for the timeline. Leaving the target unset uses the built-in reading module under its current name. Deleted targets require a valid replacement and are never restored automatically. New ordinary modules offer **通用／书籍／影视** (General / Book / Film), defaulting to General; existing types cannot be converted. Showcases, general and film modules are excluded from WeRead import.

The same source book is skipped within a target without changing existing notes or manual content. Other modules receive independent notes; manual books without source IDs are not matched by title. Successful and skipped books are deselected; failed books stay selected for retry. Import locks authorization, target and directory changes. Closing Settings allows the import to finish; disabling the plugin or deleting the target stops subsequent writes. The target, shelf and selection last only for this Settings session.

The key is stored only in an independent Obsidian SecretStorage slot, never in plugin settings, card configuration or work notes. Loading the shelf, importing selected ebooks and filling a publication date make user-initiated requests to the official WeRead gateway. Unavailable or invalid publication dates stay empty, and a failed lookup does not prevent importing the basic book; dates can be filled later. Audio album IDs have no verified book-detail mapping, so their publication dates are not inferred. No automatic sync, highlights, thoughts, reading time or article-collection cards are included. Missing summaries and personal ratings stay empty. Audio-series completion is not treated as your reading completion.

## Appearance and settings

Settings open with five categories: **Card module management, General and data, WeRead, Note embeds, About**. Card module management provides a compact searchable list with card-module and image-showcase filters. Click a module to open its editing dialog, with basic fields and independently expandable advanced settings and Dashboard membership. General and data contains the directory and works Dashboard switch; Note embeds contains code generation.

Returning to a category or module list neither saves nor discards the current settings session's drafts; unsaved modules are marked. Native settings search still locates actual module fields. Search first opens the relevant dialog and then focuses the field. Settings editors do not mount card previews. Switching internal categories preserves WeRead imports and unsubmitted authorization input; closing the entire settings session retains the existing cleanup behavior.

Choose **添加卡片模块** (Add cards module) or **添加图片橱窗** (Add image showcase), enter a **module name**, choose its **work type** (ordinary modules only) and **aspect ratio**, optionally select one or more Dashboards or create a new category, then click **保存** (Save) at the bottom right. Each creator keeps its own draft and a fixed storage type; advanced card style offers full cover or minimal without converting the module type. Click the gold card ribbon icon to experience the module in the **Magical Cards** tab. Closing the dialog keeps the current Settings-session draft; Reload discards unsaved choices. Settings editors do not display previews.

![Basic module settings with name, aspect ratio, save controls and collapsed advanced settings](previews/settings.png)

**高级设置** (Advanced settings) contains **card style → image fit → material → layout**, followed by applicable options: the three-card limit for existing layouts, **自动旋转** (Auto rotate, initially off) for the wheel, and direction for the curved gallery. New modules default to **full cover, fill and crop, paper, 2:3, skewed carousel, three-card limit off**. Reading/film examples and existing modules keep their appearance. The three-card option is per module where supported and does not remove any images.

Choose from **paper, matte, holographic foil, magazine, metal, glass and jade**, combined with any layout. Matte and foil retain clear cover images, with texture concentrated on edges, backing and subtle highlights. Jade uses soft pale-green edges and backing while keeping the cover clear. Changing material preserves original images, proportions and work data; existing and new-module defaults remain unchanged.

Choose **模块样式** (Module style) in a module's action menu to adjust its appearance in a dialog while the underlying module previews changes. **保存** (Save) at the bottom right updates other displays of the same module and plugin settings; **取消** (Cancel), closing the dialog or Escape restores the saved appearance. Save or cancel unsaved choices before switching categories. Layout and direction explicitly set in a note code block retain precedence over module settings.

Note embeds always inherit the module material; saving a material change updates every display of that module.

About includes a reusable Changelog dialog grouped by version, date and additions/improvements/fixes. The latest entry opens by default, older entries collapse. Version 1.0.0 includes the layout, material, category and settings updates. The bottom-right checkmark confirms and closes; there is no donation button.

![Showcase advanced settings with layout, three-card limit, flipping and name position](previews/settings-advanced.png)

The trash icon beside an expanded module heading **deletes the module**, preserving work notes, showcase notes and images. The exit-arrow beside a Dashboard membership **removes only that category reference**. Both operations are available only in Settings and have explicit icon labels. Save failures keep the membership or module and retain unsaved appearance drafts.

Cards and showcase toolbars use a horizontal action menu for search, add, sort, edit and individual-card deletion. Success messages disappear after four seconds; errors and retry prompts remain visible. Click the transparent region at the upper-right of the current card to flip it, or focus the carousel and press F. No flip icon covers the image. Other card areas still open the note; Save, Cancel and Retry remain accessible.

Enter a directory relative to the current vault, such as `卡片库`. Work notes live under `书籍` (books), `观影` (films) and `收藏` (general works); showcases live under `橱窗/<module ID>/`. Configuration is in `_数据/卡片配置.md`. Changing this setting does not move existing data. Absolute computer paths are rejected.

### Ordinary-card image imports and note properties

Reading, film and custom ordinary-module menus include **批量导入图片／SVG** (Import multiple images/SVGs). Each selected file creates a separate card and work note, using the filename without its extension as the title and an empty summary. PNG, JPEG, WebP, GIF and safe SVGs are supported, up to 10 MB per image and 2 MB per SVG.

Partial retries resend only unfinished files and retain stable IDs. They never duplicate successful cards or overwrite later title, summary or cover edits. Complete or explicitly discard unfinished imports before switching categories or deleting modules; discard keeps files already written. File retry queues last only while the shared library remains open. After a full application exit, selecting files again starts a new import.

Work notes initially show only **Name and Summary**. Expand **更多信息** (More information) for the other properties. Watching date/status controls are removed while stored values remain intact. Each film or general card can rename its creator field, for example to “Developer”; an empty label restores “Director” for films or “Creator” for general works.

The new **32:15 wide image** ratio suits banners near 2.13:1. **2:3 portrait cover** is the general portrait preset. Contain preserves the full image; fill/crop fills the card and may trim its edges.

### Image showcases

Expand the separate **添加图片橱窗** (Add image showcase) settings group, enter a name, choose the aspect ratio, and save. This creator always creates a showcase; existing work modules cannot be converted. Failed saves keep the draft and any already-created showcase note, so retry does not create another note.

| Image front | Description on the back |
| --- | --- |
| ![An image-only showcase front with an optional empty name](previews/showcase-front.png) | ![The showcase back provides a plain-text description editor and a shared-note control](previews/showcase-back.png) |

- Select multiple images or drag images into the showcase. Folders are never scanned automatically. PNG, JPEG, WebP, GIF and SVG are supported, up to 10 MB per image and 2 MB per SVG.
- Each showcase has its own folder containing one `橱窗.md` note and all imported images. The note uses local embeds to show every image, optional name and description. Names may be empty.
- Advanced options enable flipping and place names on the front, back, or nowhere. Flipping is on and names are on the back by default. Front-name mode shows only the description on the back; hiding names preserves the stored text.
- Descriptions are plain text, limited to 400 characters, and saved automatically. IME composition waits for confirmation; failed saves and conflicts retain the draft with retry controls. With flipping off, use **编辑当前图片** (Edit current image) or edit the shared note.
- Removing a card removes only its note block and keeps the image file. Ordering and field edits preserve other blocks, unknown properties and surrounding text. Keep card IDs and management markers intact. Missing notes or damaged markers require repair; an empty replacement note is never generated.
- Partial imports preserve saved files and stable IDs. Retry while the same library remains open does not duplicate successful cards. Retry before closing the vault or disabling the last shared cards plugin; after a full restart, selecting images again is a new import and may duplicate cards. Saved image files remain intact.

## Note embeds

![Reading and film modules embedded in a native Obsidian note](previews/note-embed.png)

Expand **笔记代码块生成** (Generate a note code block) in Settings. Select one or more existing modules, generate and copy the code, then paste it into a note. Alternatively, run **插入卡片模块** (Insert cards modules) in a note; selecting modules inserts the code block directly into that note.

Each generation creates new block and module-instance IDs. The block references existing works and inherits collection appearance; it does not duplicate work data.

````markdown
```magical-cards
id: reading-and-films
modules:
  - id: reading-instance
    collection: book
  - id: films-instance
    collection: film
```
````

Dragging modules inside an embed changes only that block. The plugin atomically updates its `modules` array and preserves the rest of the note. Duplicate IDs, source conflicts, or unsaved native editor changes block an overwrite and preserve the draft. Generate fresh IDs when duplicating a block within the same note.

<details>
<summary>Advanced: override a layout for one embed</summary>

`collection` refers to `book`, `film`, or an existing custom collection's stable ID. Add `layout` to a module to select `cylinder`, `coverflow-carousel`, `album-rail`, `scroll-bend`, `skewed-carousel`, `3d-wheel-carousel`, or `magazine-scroller`. A curved gallery can also use `orientation: vertical`. Legacy `hologram-slide-curtain` overrides remain readable and render as cylinders without rewriting the code block. Overrides apply only to that embed; omitted values inherit collection settings. Wheel auto rotation uses the module setting and has no separate embed field.

</details>

## FAQ and data

**Does the three-card option hide or delete other works?**

No. In supported layouts it shows the current card and at most two neighbors at once. Every work remains available to browse; collection size is unchanged. The wheel, slide curtain and magazine scroller ignore this limit and hide the option while preserving its saved value.

**Why is there space around a cover?**

Show whole image preserves all image content and may leave space when the ratios differ. Fill and crop fills the card and crops part of the image. A border already present in the original image remains part of that image.

**Where is my data saved?**

Works are ordinary Markdown notes inside the card directory. Appearance and module order are stored in `_数据/卡片配置.md`. Local plugin configuration stores the directory, first-run progress, module works Dashboard preference, update-dialog read state, and recovery information. Switching directories neither imports examples again nor moves existing works.

**What if the tab turns black after changing an appearance?**

Wait for the save to finish, quit and restart Obsidian, then reopen the same vault. The appearance is saved and works and images are preserved. Saving appearance changes to an existing module also shows this recovery hint.

**Does the plugin use the network or clipboard?**

WeRead import is optional. Loading the shelf, importing selected ebooks or filling publication dates sends the relevant shelf or book-detail requests to the official WeRead gateway at `https://i.weread.qq.com/api/agent/gateway`, using the authorization key held in SecretStorage. There is no automatic sync or note upload. Built-in examples work offline. Remote cover URLs, including imported covers, load from their image servers. The plugin does not collect telemetry. The Copy control writes generated code only after you click it. When editing a title, pasting reads only the plain text from that paste event; there is no background clipboard reading. The linked-note picker searches note paths within your vault and does not send note content elsewhere.

<details>
<summary>Upgrading from the previous plugin and recovering drafts</summary>

Existing `barry-cards` blocks, work IDs, `bw_*` properties, views, and recovery drafts remain compatible. Previous directory settings and unknown configuration fields are preserved.

Back up `.obsidian/plugins/barry-cards/` and your card directory, then disable the old plugin and let pending edits finish saving. Install the three new files in `magical-cards`, preserve the old `data.json` and recovery JSON files in the new directory, then enable the new plugin according to the previous enabled state. Do not enable both standalone plugins together.

New versions preserve existing collections, editing and sorting drafts. If a draft cannot be saved during final shutdown, it is written to a recovery JSON file in the plugin directory and its location is shown.

</details>

## 1.1.0 changes

- Browse reading, film, custom and image showcase cards in a 3D timeline, with per-module date preferences, partial dates and a searchable dialog for missing dates.
- Drag cards directly and settle on release; open card details and return to the same place. Timeline sorting does not change the module's manual order.
- Choose boxed covers, the 3D diagonal gallery and media cases that mix transparent CD and matte-black VHS cases, with module and per-card overrides.
- Save available ebook publication dates during WeRead import or fill them for existing WeRead cards from timeline settings.
- Review card-note issues and associated notes in the warning dialog, ignore individual issues, and have resolved issues disappear automatically.

## 1.0.0 changes

- New 3D wheel and curling-card layouts, seven materials including jade, clearer covers and smoother motion.
- Categorized Settings and modal module editors, searchable Dashboard membership controls, category icons and distinct create icons.
- Desktop cards hide permanent paging buttons; phones and iPads keep them. The slide curtain is available as a read-only extension preview.
- Magical Cards category and module works pages hide library-wide diagnostics while keeping operation failures and retry controls.
- Existing modules, notes, images, embeds and drafts remain compatible.

## 0.9.1 fixes

Fix transparent module deletion confirmations overlapping Settings. The dialog supports separate settings windows, light and dark themes, and narrow panels, including when another plugin loads older styles with the same class name.

## 0.9.0 changes

- **WeRead bookshelf import:** authorize in Settings, load your shelf, search and select ebooks or audio albums, then import into the built-in reading module or an ordinary book module. Existing cards are skipped within a module; other modules can hold independent copies.
- **Independent module works Dashboard:** the portal action before search opens a compact statistics, featured-work and cover-grid page. Search, status filters and temporary sorting are available, and Return restores the source position.
- **Work types:** choose General, Book or Film when creating an ordinary module. General is the default; existing module types cannot be converted.

See [Releases](https://github.com/AbigBlackCat/Obsidian-Magical_Cards/releases) for the full release history.

## License and source

From **0.9.0**, author-owned Magical Cards code uses a [proprietary license](LICENSE). Personal and business use is free, and personal backups and private modifications are allowed. Redistributing, rebranding for distribution or selling the plugin or source from this version onward requires the author’s permission. The complete project, tests and build process are maintained in a private source repository. This public repository provides installation, updates, documentation and [issue tracking](https://github.com/AbigBlackCat/Obsidian-Magical_Cards/issues).

Previously published MIT versions retain their original [MIT license](LICENSE-LEGACY-MIT); the new terms do not revoke rights already granted for those versions. Third-party components retain their own licenses in [THIRD_PARTY.md](THIRD_PARTY.md). Covers and previews containing them remain the property of their respective rights holders and are excluded from the author’s code license. Preserve the [cover sources and rights notice](examples/SOURCES.md).

The [example vault](examples/vault/) contains only three books, three films, and independent example IDs. Install the three plugin files and open it with Obsidian. Its card directory is `示例`. The [guide template](examples/Magical_Cards示例及用法说明.md) is used for the first-run experience.
