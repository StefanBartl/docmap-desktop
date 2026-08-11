// The whole frontend: load the project list, show one project's map, switch.
//
// `convertFileSrc` is what makes the map viewable at all. The generated page
// is an ordinary file on disk, and a webview will not load `file://` into an
// iframe from an app-protocol page. Tauri's asset protocol exists for exactly
// this — it hands out a URL the webview will accept for a path the app is
// allowed to read (`assetProtocol.scope` in tauri.conf.json).

const { invoke } = window.__TAURI__.core;
const { convertFileSrc } = window.__TAURI__.core;
const { open } = window.__TAURI__.dialog;

const els = {
  list: document.getElementById("projects"),
  empty: document.getElementById("empty"),
  add: document.getElementById("add"),
  status: document.getElementById("status"),
  frame: document.getElementById("map"),
  placeholder: document.getElementById("placeholder"),
};

let projects = [];
let selectedId = null;

/** Last selection, so a restart lands where the last session left off. */
const LAST_KEY = "docmap.lastProject";

function say(msg) {
  els.status.textContent = msg || "";
}

/** Show a message in the view area instead of a map. */
function showPlaceholder(title, body) {
  els.frame.hidden = true;
  els.frame.removeAttribute("src");
  els.placeholder.hidden = false;
  els.placeholder.innerHTML =
    "<h2></h2><p></p>";
  els.placeholder.querySelector("h2").textContent = title;
  els.placeholder.querySelector("p").innerHTML = body;
}

async function render() {
  els.list.innerHTML = "";
  els.empty.hidden = projects.length > 0;

  for (const p of projects) {
    const status = await invoke("map_status", { mapDir: p.map_dir });

    const li = document.createElement("li");
    li.className = "proj" + (p.id === selectedId ? " sel" : "");
    li.dataset.id = p.id;
    li.title = p.root;

    const nm = document.createElement("span");
    nm.className = "nm";
    nm.textContent = p.name;

    const meta = document.createElement("span");
    meta.className = "meta" + (status.exists ? "" : " nomap");
    // Counts rather than the path: two checkouts of the same plugin are told
    // apart by what is in them, and the full path is already the tooltip.
    meta.textContent = status.exists
      ? `${status.modules ?? "?"} modules · ${status.files ?? "?"} files`
      : "no map generated yet";

    li.append(nm, meta);
    li.addEventListener("click", () => select(p.id));
    els.list.append(li);
  }
}

async function select(id) {
  selectedId = id;
  try {
    localStorage.setItem(LAST_KEY, id);
  } catch (e) {
    // A workspace that cannot remember the last selection still works.
    void e;
  }

  const p = projects.find((x) => x.id === id);
  await render();
  if (!p) return;

  const status = await invoke("map_status", { mapDir: p.map_dir });
  if (!status.exists) {
    showPlaceholder(
      "No map in this project yet",
      "Nothing has generated <code>docs/map/index.html</code> here. " +
        "Generating one from inside this app is the next thing being built; " +
        "until then <code>:DocMap</code> in Neovim, or " +
        "<code>documentation.nvim</code>'s standalone binary, produces it."
    );
    say(p.root);
    return;
  }

  els.placeholder.hidden = true;
  els.frame.hidden = false;
  els.frame.src = convertFileSrc(status.index_path);
  say(`${p.root} · ${status.modules ?? "?"} modules`);
}

async function refresh(next) {
  projects = next ?? (await invoke("list_projects"));
  await render();
}

els.add.addEventListener("click", async () => {
  const dir = await open({ directory: true, multiple: false, title: "Add project" });
  if (!dir) return;
  try {
    await refresh(await invoke("add_project", { root: dir }));
    say(`Added ${dir}`);
  } catch (e) {
    say(String(e));
  }
});

// Roving tabindex over the list: one tab stop on the container, arrows
// within it. Same reasoning as the generated page's own long lists — a
// project list should not put one press per project between the button
// above it and the content.
els.list.tabIndex = 0;
els.list.addEventListener("keydown", (ev) => {
  const items = [...els.list.querySelectorAll(".proj")];
  if (!items.length) return;
  const cur = document.activeElement.closest?.(".proj") ?? null;
  const i = cur ? items.indexOf(cur) : -1;

  const focus = (el) => {
    if (!el) return;
    el.tabIndex = -1;
    el.focus();
  };

  if (ev.key === "ArrowDown") {
    ev.preventDefault();
    focus(items[i < 0 ? 0 : Math.min(i + 1, items.length - 1)]);
  } else if (ev.key === "ArrowUp") {
    ev.preventDefault();
    focus(items[i <= 0 ? 0 : i - 1]);
  } else if (ev.key === "Home") {
    ev.preventDefault();
    focus(items[0]);
  } else if (ev.key === "End") {
    ev.preventDefault();
    focus(items[items.length - 1]);
  } else if ((ev.key === "Enter" || ev.key === " ") && cur) {
    ev.preventDefault();
    select(cur.dataset.id);
  } else if (ev.key === "Delete" && cur) {
    ev.preventDefault();
    const id = cur.dataset.id;
    invoke("remove_project", { id })
      .then((list) => {
        if (selectedId === id) {
          selectedId = null;
          showPlaceholder("Nothing selected", "Pick a project on the left.");
        }
        return refresh(list);
      })
      .catch((e) => say(String(e)));
  }
});

(async function start() {
  try {
    await refresh();
    const last = localStorage.getItem(LAST_KEY);
    if (last && projects.some((p) => p.id === last)) await select(last);
  } catch (e) {
    say(String(e));
  }
})();
