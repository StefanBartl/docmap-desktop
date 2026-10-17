// Layout probe for the engine report, for the browser preview. NOT part of the
// app and NOT run by CI: it needs a real layout engine. A preview
// with stubbed `invoke` answers is a layout check and nothing more: what the
// commands do is looked at in the installed app.
//
// Why it exists: the first version of the report was "verified in the preview"
// and was invisible after a successful run and unscrollable after "Show all",
// because the preview showed neither state. This drives the flows through the
// page's own controls and measures where things really are, so the answer to
// "can the reader reach the top and the button" is a number, not a look.
//
//   python tools/preview/preview.py
//   open http://localhost:8731/tools/preview/preview.html, set the window to
//   900x600 (the app's minimum, tauri.conf.json), then in the page's console:
//
//     const { probe } = await import("/tools/preview/probe-report.js");
//     for (const id of ["p7", "p2", "p5"]) console.log(JSON.stringify(await probe(id)));
//
//   (one after the other: each run replaces the view the next one measures)
//
// Projects (see stub.js `generate`): p7 = findings and a map appears, p2 = a
// failed run, p5 = a clean run.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const $ = (id) => document.getElementById(id);

function select(id) {
  const sel = $("projects");
  sel.value = id;
  sel.dispatchEvent(new Event("change", { bubbles: true }));
}

/** Is `el` inside `box` (top and bottom edge, 1px tolerance)? */
function inside(el, box) {
  const a = el.getBoundingClientRect();
  const b = box.getBoundingClientRect();
  return a.top >= b.top - 1 && a.bottom <= b.bottom + 1;
}

/**
 * Scroll `box` to its top and say whether `top` is then inside it, and to its
 * bottom for `bottom`: reachable means "by scrolling", which is all a reader
 * with a wheel or a keyboard has.
 */
function reach(box, top, bottom) {
  box.scrollTop = 0;
  const topOk = top ? inside(top, box) : null;
  box.scrollTop = box.scrollHeight;
  const bottomOk = bottom ? inside(bottom, box) : null;
  box.scrollTop = 0;
  return { topOk, bottomOk };
}

/**
 * Generate `id` and measure the report, folded, then expanded, then folded.
 *
 * @param {string} id project id in the stub
 */
export async function probe(id) {
  select(id);
  await sleep(700);
  $("gen").click();
  await sleep(1200);

  const out = { project: id, window: `${innerWidth}x${innerHeight}` };
  const docked = !$("run-report").hidden;
  const host = docked ? $("run-report-body") : $("placeholder");
  out.where = docked ? "run-report (map on screen)" : $("placeholder").hidden ? "NOWHERE" : "placeholder (no map)";
  if (out.where === "NOWHERE") return out;

  const state = (label) => {
    const box = host;
    // The top of what scrolls: the first report line (the docked panel's title
    // sits above the scroller and is always in view), or the message heading.
    const head = docked ? host.querySelector(".gen-log-rows > div") : host.querySelector("h2");
    const toggle = host.querySelector(".gen-log-toggle");
    out[label] = {
      rows: host.querySelectorAll(".gen-log-rows > div").length,
      scrollable: box.scrollHeight > box.clientHeight + 1,
      ...reach(box, head, toggle),
      // The shell must not scroll: the body is `overflow: hidden`.
      pageScrolls: document.scrollingElement.scrollTop !== 0 || document.body.scrollTop !== 0,
      toggleLabel: toggle && toggle.textContent,
    };
  };

  state("folded");
  const toggle = host.querySelector(".gen-log-toggle");
  // A clean run has nothing to fold: the button exists but its foot is hidden.
  out.toggleOffered = !!toggle && !toggle.closest(".gen-log-foot").hidden;
  if (out.toggleOffered) {
    toggle.focus();
    toggle.click();
    await sleep(100);
    state("expanded");
    out.focusKept = document.activeElement === toggle && document.activeElement.isConnected;
    out.ariaExpanded = toggle.getAttribute("aria-expanded");
    host.scrollTop = host.scrollHeight;
    out.toggleReachableAtBottom = inside(toggle, host);
    toggle.click();
    await sleep(100);
    out.foldedAgainRows = host.querySelectorAll(".gen-log-rows > div").length;
  }
  return out;
}
