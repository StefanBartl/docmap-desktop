//! The window's menu bar.
//!
//! **Structure here, strings in the frontend.** Which items exist, what order
//! they sit in, which are platform-predefined and what each is bound to are
//! facts about this application and belong in one place. The *labels* are
//! translations, and translations already live in `src/lib/i18n.js` with a
//! spec that fails when a locale is missing a key or carries one the source
//! no longer has. A second catalog in Rust would be two files with one
//! meaning, and `docs/MENUBAR.md` names that as the wrong answer before it
//! was written — the same drift that cost `to_json` and the page payload six
//! fields between them.
//!
//! So the frontend builds the menu: it calls `set_menu` with a label per id
//! after i18n has initialised, and again whenever the language changes.
//! Missing keys are an error naming them rather than a silent fallback,
//! because the catalog test guarantees they cannot be missing and a quiet
//! English label in a German menu is exactly the failure that test exists to
//! prevent.
//!
//! Clicking an item emits `menu` to the webview with the item's id. The
//! handlers stay in `main.js` beside the buttons that already call them —
//! one implementation, two ways to reach it, rather than a second copy
//! behind the menu.

use std::collections::HashMap;

use tauri::menu::{Menu, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::{AppHandle, Emitter, Runtime};

/// One clickable item: the id the frontend will receive, and its accelerator.
///
/// Accelerators are written in Tauri's own notation and deliberately *not*
/// translated — `Ctrl+G` is a key on the keyboard, not a word.
struct Item {
    id: &'static str,
    accel: Option<&'static str>,
    /// Whether this item acts on the selected project, and so is disabled
    /// when there is none. The sidebar's Generate button is disabled today
    /// with nothing saying why; a greyed menu item at least sits under a
    /// heading called Project.
    needs_project: bool,
}

const fn item(id: &'static str, accel: Option<&'static str>, needs_project: bool) -> Item {
    Item {
        id,
        accel,
        needs_project,
    }
}

/// The tree, as data.
///
/// Read top to bottom this is the whole menu; `docs/MENUBAR.md` argues each
/// placement. `None` in a submenu's item list is a separator.
struct Group {
    /// Label key for the submenu title.
    id: &'static str,
    items: &'static [Option<Item>],
}

const GROUPS: &[Group] = &[
    Group {
        id: "menu.file",
        items: &[
            Some(item("menu.file.add", Some("CmdOrCtrl+N"), false)),
            Some(item("menu.file.open_browser", Some("CmdOrCtrl+Shift+O"), true)),
            Some(item("menu.file.reveal", None, true)),
            None,
            Some(item("menu.file.remove", Some("Delete"), true)),
        ],
    },
    Group {
        id: "menu.project",
        items: &[
            Some(item("menu.project.generate", Some("CmdOrCtrl+G"), true)),
            Some(item("menu.project.generate_all", Some("CmdOrCtrl+Shift+G"), false)),
            None,
            Some(item("menu.project.regenerate", Some("F5"), true)),
        ],
    },
    Group {
        id: "menu.tools",
        items: &[
            Some(item("menu.tools.engine", None, false)),
            Some(item("menu.tools.grammars", None, false)),
            None,
            Some(item("menu.tools.nvim", None, false)),
            Some(item("menu.tools.nvim_config", None, false)),
        ],
    },
    Group {
        id: "menu.help",
        items: &[
            Some(item("menu.help.usage", None, false)),
            Some(item("menu.help.engine", None, false)),
        ],
    },
];

/// Every label key this module needs, in one list.
///
/// Exposed so a test can assert the frontend catalog covers it: the two are
/// joined by string keys, and nothing else would notice the day an id is
/// renamed on one side.
pub fn label_keys() -> Vec<&'static str> {
    let mut keys = Vec::new();
    for group in GROUPS {
        keys.push(group.id);
        for entry in group.items.iter().flatten() {
            keys.push(entry.id);
        }
    }
    // Quit and Close window are predefined items, and the platform supplies
    // their text — but not their submenu placement, so File still needs to
    // know they belong to it. No label key: asking the frontend to translate
    // "Quit" would override the OS's own wording, which on macOS is where
    // the item does not even live.
    keys
}

/// Build the menu from the frontend's labels and set it on the main window.
///
/// `enabled` is the selected-project state: everything marked `needs_project`
/// is greyed when it is false. Passed in rather than read from the workspace
/// file because "which project is selected" is the frontend's own state and
/// has never been anywhere else.
pub fn build<R: Runtime>(
    app: &AppHandle<R>,
    labels: &HashMap<String, String>,
    has_project: bool,
) -> Result<Menu<R>, String> {
    let missing: Vec<&str> = label_keys()
        .into_iter()
        .filter(|k| !labels.contains_key(*k))
        .collect();
    if !missing.is_empty() {
        // Named rather than defaulted. The catalog spec makes this
        // unreachable; if it is ever reached, the menu is out of step with
        // the interface and saying so is more use than an English label
        // sitting in a German menu.
        return Err(format!("menu labels missing: {}", missing.join(", ")));
    }

    let menu = Menu::new(app).map_err(|e| e.to_string())?;

    for group in GROUPS {
        let mut sub = SubmenuBuilder::new(app, &labels[group.id]);
        for entry in group.items {
            match entry {
                None => sub = sub.separator(),
                Some(it) => {
                    let mut b = MenuItemBuilder::with_id(it.id, &labels[it.id])
                        .enabled(!it.needs_project || has_project);
                    if let Some(accel) = it.accel {
                        b = b.accelerator(accel);
                    }
                    sub = sub.item(&b.build(app).map_err(|e| e.to_string())?);
                }
            }
        }
        // The window-level items go at the bottom of File, where the
        // convention puts them on Windows and Linux. `PredefinedMenuItem`
        // rather than our own: it carries the platform's own wording and,
        // on macOS, the platform's own placement.
        if group.id == "menu.file" {
            sub = sub.separator();
            sub = sub.item(
                &PredefinedMenuItem::close_window(app, None).map_err(|e| e.to_string())?,
            );
            sub = sub.item(&PredefinedMenuItem::quit(app, None).map_err(|e| e.to_string())?);
        }
        menu.append(&sub.build().map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())?;
    }

    Ok(menu)
}

/// Forward every click to the webview as a `menu` event carrying the id.
///
/// Registered once at startup rather than per rebuild: `set_menu` replaces
/// the menu whenever the language or the selection changes, and a handler
/// re-registered each time would fire once per rebuild it survived.
pub fn forward_clicks<R: Runtime>(app: &AppHandle<R>) {
    app.on_menu_event(|app, event| {
        let _ = app.emit("menu", event.id().0.clone());
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The labels the frontend would send, faked with the key as its own
    /// text. The *content* is `src/lib/i18n.js`'s problem and
    /// `src/lib/menu.test.js` checks the two lists agree; what cannot be
    /// checked from JavaScript is whether Tauri will actually build this
    /// tree, which is what these exercise.
    fn labels() -> HashMap<String, String> {
        label_keys()
            .into_iter()
            .map(|k| (k.to_string(), k.to_string()))
            .collect()
    }

    #[test]
    fn the_menu_builds_with_a_complete_label_set() {
        // The one thing this environment cannot verify by eye. A window with
        // no menu looks, from here, exactly like a window whose menu is fine
        // — `mock_app()` gives a real `AppHandle` with no window, which is
        // enough for the menu builder to succeed or fail for real.
        let app = tauri::test::mock_app();
        assert!(build(app.handle(), &labels(), true).is_ok());
    }

    #[test]
    fn it_builds_the_same_with_nothing_selected() {
        // The project-scoped items are disabled rather than absent, so the
        // tree has to build in both states — a menu that only exists once
        // something is selected is a menu nobody finds.
        let app = tauri::test::mock_app();
        assert!(build(app.handle(), &labels(), false).is_ok());
    }

    #[test]
    fn a_missing_label_is_an_error_naming_it() {
        // Rather than an English label quietly sitting in a German menu,
        // which is the failure the catalog spec exists to prevent and would
        // be undone by a silent fallback here.
        let app = tauri::test::mock_app();
        let mut incomplete = labels();
        incomplete.remove("menu.tools.grammars");
        let err = match build(app.handle(), &incomplete, true) {
            Err(e) => e,
            Ok(_) => panic!("an incomplete label set must not produce a menu"),
        };
        assert!(err.contains("menu.tools.grammars"), "unhelpful error: {err}");
    }

    #[test]
    fn every_id_is_unique() {
        // Two items sharing an id would send one event for two commands, and
        // the frontend's action table would run whichever it mapped.
        let keys = label_keys();
        let mut seen = std::collections::HashSet::new();
        for key in &keys {
            assert!(seen.insert(*key), "duplicate menu id: {key}");
        }
        assert!(keys.len() >= 15, "expected the whole menu, got {}", keys.len());
    }
}
