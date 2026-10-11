/* The app moved from house-points-hub.vercel.app to lifecomp.vercel.app.
   Visiting the old address sends you to the new one and brings this browser's saved data along
   (points, students, groups, lesson choices), so nothing is left behind. Runs before app.js. */
(() => {
  const NEW = "lifecomp.vercel.app", OLD = "house-points-hub.vercel.app", MAIN = "class-points-hub-v1";
  const toB64 = (s) => btoa(unescape(encodeURIComponent(s)));
  const fromB64 = (s) => decodeURIComponent(escape(atob(s)));

  if (location.hostname === OLD) {
    const data = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (/^(class-points|live-)/.test(k)) data[k] = localStorage.getItem(k);
      }
    } catch { /* storage blocked: just move */ }
    const packed = Object.keys(data).length ? "#move=" + encodeURIComponent(toB64(JSON.stringify(data))) : "";
    if (packed.length > 1800000) return; // too big for a link - stay here so nothing is lost (use Setup > Download backup)
    location.replace("https://" + NEW + location.pathname + location.search + packed);
    return;
  }

  const m = location.hash.match(/^#move=(.+)$/);
  if (!m) return;
  history.replaceState(null, "", location.pathname + location.search); // tidy the address bar
  try {
    const data = JSON.parse(fromB64(decodeURIComponent(m[1])));
    const mine = localStorage.getItem(MAIN);
    const theirs = data[MAIN];
    const ask = mine && theirs && mine !== theirs;
    if (!ask || confirm("Bring your points, students and groups from the old address (house-points-hub)?\n\nOK = use the old data here.\nCancel = keep what is already saved on lifecomp.")) {
      Object.entries(data).forEach(([k, v]) => localStorage.setItem(k, v));
    }
  } catch { /* a damaged link: ignore it */ }
})();
