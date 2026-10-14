/* My activities: upload a worksheet (HTML or text) and it becomes an interactive, self-checking activity.
   parse() reads the document and finds questions (numbered questions, a) b) c) options, ____ blanks,
   True/False, two-column matching tables, answer keys). The teacher checks the answers, then plays it
   on the board, runs it as Live play, or downloads a single HTML file for students' own devices.
   Saved on this device in localStorage ("class-points-activities-v1"). */
(() => {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const CP = () => window.ClassPoints;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = (s) => String(s ?? "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const STORE = "class-points-activities-v1";
  // Written answers: right when they match the teacher's answer, or contain its key words (any "/" alternative)
  const NUMS = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty".split(" ");
  const same = (a, b) => a === b || NUMS[+a] === b || NUMS[+b] === a;
  const STOP = new Set("a an the of to in on is are was be it and or for with that this by at as from they their them you your we our".split(" "));
  function fuzzy(given, want) {
    const g = norm(given), G = g.split(" ");
    return String(want || "").split("/").some((w) => {
      const n = norm(w); if (!n || !g) return false;
      if (n === g || same(n, g)) return true;
      const W = n.split(" ").filter((x) => x.length > 2 && !STOP.has(x));
      if (!W.length) return false;
      const hit = W.filter((x) => G.some((y) => y === x || (x.length > 4 && y.length > 4 && y.slice(0, 5) === x.slice(0, 5)))).length;
      return W.length <= 3 ? hit === W.length : hit / W.length >= 0.6;
    });
  }
  // Mark a submitted answer (as text) against the teacher's current answer key: 1 right, 0 wrong, null = can't tell
  function markText(it, text) {
    const t = String(text || "");
    if (it.type === "mcq" || it.type === "tf") return it.answer == null ? null : norm(t) === norm(it.options[it.answer]) ? 1 : 0;
    if (it.type === "blank") {
      const gaps = it.segs.filter((x) => typeof x !== "string"), parts = t.split(", ");
      const keyed = gaps.filter((x) => (it.answers[x.g] || "").trim());
      if (!keyed.length) return null;
      return keyed.every((x) => String(it.answers[x.g]).split("/").some((w) => norm(w) && same(norm(w), norm(parts[gaps.indexOf(x)] || "")))) ? 1 : 0;
    }
    if (it.type === "open") return it.model && it.mark ? (fuzzy(t, it.model) ? 1 : 0) : null;
    if (it.type === "match") { const got = Object.fromEntries(t.split("; ").map((p) => p.split(" → "))); return it.pairs.every((p) => norm(got[p[0]]) === norm(p[1])) ? 1 : 0; }
    return null;
  }
  const markable = (it) => it.type === "match" || markText(it, "") !== null;
  const LETTERS = "ABCDEFGH";

  /* ================= Reading the document ================= */
  const BLOCK = new Set("ADDRESS ARTICLE ASIDE BLOCKQUOTE CAPTION DD DIV DL DT FIELDSET FIGCAPTION FIGURE FOOTER FORM H1 H2 H3 H4 H5 H6 HEADER HR LEGEND LI MAIN OL P PRE SECTION TABLE TBODY TFOOT THEAD TR TD TH UL".split(" "));
  const SKIP = new Set("SCRIPT STYLE NOSCRIPT TEMPLATE HEAD NAV BUTTON SVG CANVAS IFRAME OBJECT META LINK TITLE AUDIO VIDEO".split(" "));
  const GAP = /_{3,}|\.{5,}|…{2,}|\[\s*\]|\(\s{3,}\)|\[\[[^\]]+\]\]/g;
  const HAS_GAP = new RegExp(GAP.source);
  const WRITE = "⟦write⟧";
  const TICK = /\s*(?:[✓✔✅☑]|\((?:correct|answer|betul)\))\s*/gi;
  const TF = /\(?\s*\b(true\s*\/\s*false|true\s+or\s+false|t\s*\/\s*f|betul\s*\/\s*salah|yes\s*\/\s*no)\b\s*\)?/i;

  // Form controls in an already-made worksheet become text the reader understands
  function prep(doc) {
    const done = new Set();
    $$('input[type=radio], input[type=checkbox]', doc).forEach((r) => {
      const lab = r.closest("label") || (r.id && doc.querySelector(`label[for="${CSS.escape(r.id)}"]`));
      const text = (lab ? lab.textContent : (r.nextSibling?.textContent || r.value || "")).trim();
      const p = doc.createElement("p");
      p.setAttribute("data-opt", "1");
      if (r.checked || r.hasAttribute("data-correct") || /\b(correct|answer)\b/i.test(r.className)) p.setAttribute("data-mark", "1");
      p.textContent = text;
      if (lab && !done.has(lab)) { done.add(lab); lab.replaceWith(p); if (r.isConnected) r.remove(); }
      else { if (!lab && r.nextSibling?.nodeType === 3) r.nextSibling.remove(); r.replaceWith(p); }
    });
    $$("select", doc).forEach((s) => {
      const opts = [...s.options].map((o) => o.textContent.trim()).filter((t) => t && !/^[-–—]+$|^(choose|select|pilih)\b/i.test(t));
      s.replaceWith(doc.createTextNode(opts.length ? ` [[${opts.join("|")}]] ` : " _____ "));
    });
    $$('input:not([type]), input[type=text], input[type=number], input[type=search]', doc).forEach((i) => i.replaceWith(doc.createTextNode(" _____ ")));
    $$("textarea", doc).forEach((t) => t.replaceWith(doc.createTextNode(` ${WRITE} `)));
    $$("input", doc).forEach((i) => i.remove());
  }

  const isMark = (el) => /^(STRONG|B|MARK|U|INS)$/.test(el.tagName) || /\b(correct|answer|right|betul)\b/i.test(el.className || "") || /color:\s*(green|#0?[0-9a-f]{0,2}[89a-f][0-9a-f]{0,2}0{2}\b)/i.test(el.getAttribute?.("style") || "");

  function readLines(doc) {
    prep(doc);
    const out = [];
    let buf = "", marked = false, cur = null;
    const flush = () => { const t = buf.replace(/\s+/g, " ").trim(); if (t) out.push({ ...cur, text: t, marked: marked || !!cur?.mark }); buf = ""; marked = false; cur = null; };
    const cellText = (c) => c.textContent.replace(/\s+/g, " ").trim();
    function walk(el, ctx) {
      for (const n of el.childNodes) {
        if (n.nodeType === 3) { if (n.nodeValue.trim() && !cur) cur = ctx; buf += n.nodeValue; continue; }
        if (n.nodeType !== 1 || SKIP.has(n.tagName) || n.hidden || /display:\s*none/i.test(n.getAttribute("style") || "")) continue;
        if (n.tagName === "BR" || n.tagName === "HR") { flush(); continue; }
        if (n.tagName === "IMG") {
          const src = n.getAttribute("src") || "";
          if (/^(https?:|data:image\/)/i.test(src)) { flush(); out.push({ img: src, alt: n.getAttribute("alt") || "" }); }
          continue;
        }
        if (n.tagName === "TABLE") {
          flush();
          const rows = $$("tr", n).filter((tr) => tr.closest("table") === n).map((tr) => [...tr.cells]);
          const head = rows[0]?.every((c) => c.tagName === "TH") ? rows.shift().map(cellText) : null;
          const two = rows.map((r) => r.map(cellText).filter(Boolean));
          if (two.length >= 2 && two.every((r) => r.length === 2 && r.every((t) => /\p{L}/u.test(t) && !HAS_GAP.test(t) && t.length < 160))) {
            out.push({ table: two, head });
            continue;
          }
          walk(n, { ...ctx, tag: "td" }); flush(); continue;
        }
        if (BLOCK.has(n.tagName)) {
          flush();
          const tag = n.tagName.toLowerCase();
          const next = { ...ctx, tag, opt: n.hasAttribute("data-opt") || ctx.opt, mark: n.hasAttribute("data-mark") || (tag === "li" && isMark(n)) || ctx.mark };
          if (tag === "ol" || tag === "ul") { next.list = tag; next.alpha = tag === "ol" && /^[aA]$|alpha/.test((n.getAttribute("type") || "") + (n.getAttribute("style") || "")); }
          if (tag === "li") { next.ordered = ctx.list === "ol"; next.alpha = ctx.alpha; }
          walk(n, next); flush(); continue;
        }
        const own = n.textContent.trim();
        if (!n.children.length && /^[A-Ha-h][.)]?$/.test(own)) { if (!cur) cur = ctx; buf += ` ${own[0]}) `; continue; }
        if (isMark(n) && own) marked = true;
        walk(n, ctx);
      }
    }
    walk(doc.body || doc.documentElement, { tag: "p" });
    flush();
    return { title: (doc.title || "").trim(), lines: out };
  }

  /* ================= Finding the questions ================= */
  const OPT = /^\(?([a-hA-H])\s*[).:]\s+(.+)$/;
  const BULLET = /^[-•*○◦▪➤►]\s+(.+)$/;
  const NUM = /^(?:(?:q(?:uestion)?|soalan|no\.?)\s*)?(\d{1,3})\s*[.)]\s+(.+)$|^(?:q(?:uestion)?|soalan)\s*(\d{1,3})\s*[:.\-–]\s*(.*)$/i;
  const ANS = /^(?:answers?|ans|correct answer|jawapan)\s*[:：\-–]\s*(.+)$/i;
  const KEYHEAD = /answer\s*key|^answers?\b|^jawapan|skema|kunci\s*jawapan/i;
  const BANK = /^(?:word\s*bank|word\s*box|words?|perkataan|kata(?:\s*kunci)?)\s*[:：]\s*(.+)$/i;

  // "a) cat b) dog c) fish" on one line
  function inlineOpts(t) {
    const re = /(?:^|\s)\(?([a-hA-H])\)\s+/g, hits = [];
    let m; while ((m = re.exec(t))) hits.push({ at: m.index + (m[0].match(/^\s/) ? 1 : 0), end: re.lastIndex, letter: m[1].toLowerCase() });
    if (hits.length < 2 || hits[0].letter !== "a") return null;
    return { before: t.slice(0, hits[0].at).trim(), opts: hits.map((h, i) => t.slice(h.end, hits[i + 1]?.at ?? t.length).trim()).filter(Boolean) };
  }

  function toItems(lines, docTitle) {
    const items = [], key = {};
    let q = null, inKey = false, title = "", qNo = 0;
    const start = (text, num, L) => {
      q = { type: "q", num: num ?? ++qNo, text, options: [], ans: null, write: false };
      if (num) qNo = num;
      const io = inlineOpts(text);
      if (io && io.before) { q.text = io.before; io.opts.forEach((o) => q.options.push({ text: o, marked: false })); }
      if (q.text.includes(WRITE)) { q.write = true; q.text = q.text.replace(WRITE, "").trim(); }
      items.push(q);
    };
    for (const L of lines) {
      if (L.img) { q = null; items.push({ type: "info", kind: "img", src: L.img, alt: L.alt }); continue; }
      if (L.table) {
        q = null;
        const strip = (s) => s.replace(/^\(?(?:\d{1,2}|[a-hA-H])\s*[.)]\s+/, "");
        items.push({ type: "match", text: L.head ? `Match each ${L.head[0]} with its ${L.head[1]}.` : "Match each one with its partner.", pairs: L.table.map((r) => [strip(r[0]), strip(r[1])]) });
        continue;
      }
      const t = L.text.replace(/\s+/g, " ").trim();
      if (/^h[1-6]$/.test(L.tag)) {
        q = null;
        if (KEYHEAD.test(t)) { inKey = true; continue; }
        inKey = false;
        if (!title && /^h[12]$/.test(L.tag) && !items.some((i) => i.type !== "info")) { title = t; continue; }
        items.push({ type: "info", kind: "h", text: t });
        continue;
      }
      if (/^(?:answer\s*key|answers|jawapan|skema(?:\s*jawapan)?|kunci\s*jawapan)\s*[:：]?\s*$/i.test(t)) { q = null; inKey = true; continue; }
      if (inKey) {
        const re = /(\d{1,3})\s*[.):\-–]\s*(.+?)(?=\s+\d{1,3}\s*[.):\-–]\s|$)/g;
        let m, any = false; while ((m = re.exec(t))) { key[+m[1]] = m[2].trim(); any = true; }
        if (any) continue;
        inKey = false;
      }
      if (t === WRITE) { if (q) q.write = true; continue; }
      if (/^(?:name|nama|class|kelas|date|tarikh|year|tahun)\s*[:：]/i.test(t) && HAS_GAP.test(t)) continue; // the student page asks for the name itself
      let m;
      if ((m = t.match(ANS))) { const tgt = q || [...items].reverse().find((i) => i.type === "q"); if (tgt) tgt.ans = m[1].trim(); continue; }
      if ((m = t.match(BANK))) { q = null; items.push({ type: "info", kind: "bank", words: m[1].split(/\s*[,;|•·/]\s*|\s{2,}/).filter(Boolean) }); continue; }
      const optM = t.match(OPT), bul = t.match(BULLET);
      const canOpt = q && !HAS_GAP.test(q.text) && !q.write;
      if ((q && !q.write && (L.opt || optM)) || (canOpt && ((L.tag === "li" && (L.alpha || L.list === "ul")) || bul))) {
        const io = inlineOpts(t);
        if (io && !io.before) io.opts.forEach((o) => q.options.push({ text: o, marked: false }));
        else q.options.push({ text: optM ? optM[2] : bul ? bul[1] : t, marked: !!L.marked || !!L.mark });
        continue;
      }
      if ((m = t.match(/^(?:q(?:uestion)?\s*|soalan\s*)?(\d{1,3})[.):]?$/i))) { start("", +m[1], L); continue; }
      if ((m = t.match(NUM))) { start((m[2] ?? m[4] ?? "").trim(), +(m[1] ?? m[3]), L); continue; }
      if (L.tag === "li" && L.ordered && !L.alpha) { start(t, null, L); continue; }
      if (q && !q.text) { q.text = t; continue; }
      if (/\?\s*$/.test(t) || HAS_GAP.test(t) || TF.test(t) || t.includes(WRITE)) { start(t, null, L); continue; }
      q = null;
      items.push({ type: "info", kind: L.tag === "li" ? "li" : "p", text: bul ? bul[1] : t });
    }
    return { title: title || docTitle || "My activity", items: items.map((i) => (i.type === "q" ? finalize(i, key) : i)).filter(Boolean) };
  }

  function pickAnswer(ans, options) {
    if (ans == null) return null;
    const a = String(ans).trim();
    const letter = a.match(/^\(?([a-hA-H])\)?(?:[.)\s]|$)/);
    if (letter && (a.length <= 3 || options.length > LETTERS.indexOf(letter[1].toUpperCase()))) { const k = LETTERS.indexOf(letter[1].toUpperCase()); if (k < options.length && (a.length <= 3 || norm(a.slice(2)) === norm(options[k]) || !options.some((o) => norm(o) === norm(a)))) return k; }
    const k = options.findIndex((o) => norm(o) === norm(a));
    if (k >= 0) return k;
    const tf = norm(a);
    if (options.length === 2) { if (/^(t|true|betul|yes|ya|b)$/.test(tf)) return 0; if (/^(f|false|salah|no|tidak|s)$/.test(tf)) return 1; }
    const p = options.findIndex((o) => norm(o).includes(tf) && tf.length > 2);
    return p >= 0 ? p : null;
  }

  function finalize(q, key) {
    const ans = q.ans ?? key[q.num] ?? null;
    let text = q.text;
    if (q.options.length >= 2) {
      const opts = q.options.map((o) => { const ticked = new RegExp(TICK.source, "i").test(o.text) || /^\*/.test(o.text); return { text: o.text.replace(TICK, " ").replace(/^\*\s*/, "").trim(), marked: o.marked || ticked }; });
      const marked = opts.filter((o) => o.marked);
      const options = opts.map((o) => o.text);
      let answer = marked.length === 1 ? opts.indexOf(marked[0]) : pickAnswer(ans, options);
      const tf = options.length === 2 && options.every((o) => /^(true|false|betul|salah|yes|no|ya|tidak|t|f)$/i.test(o));
      return { type: tf ? "tf" : "mcq", text, options, answer };
    }
    if (HAS_GAP.test(text)) {
      GAP.lastIndex = 0;
      const segs = []; let last = 0, m, g = 0;
      while ((m = GAP.exec(text))) {
        if (m.index > last) segs.push(text.slice(last, m.index));
        const dd = m[0].match(/^\[\[(.+)\]\]$/);
        segs.push({ g: g++, choices: dd ? dd[1].split("|").map((s) => s.trim()) : null });
        last = GAP.lastIndex;
      }
      if (last < text.length) segs.push(text.slice(last).replace(/^\s+(?=[.,!?;:])/, ""));
      const answers = ans ? (g > 1 ? ans.split(/\s*[,;]\s*/) : [ans]).map((s) => s.trim()) : [];
      while (answers.length < g) answers.push("");
      return { type: "blank", segs, answers: answers.slice(0, g) };
    }
    const tfm = text.match(TF);
    if (tfm) {
      const labels = /betul/i.test(tfm[1]) ? ["Betul", "Salah"] : /yes/i.test(tfm[1]) ? ["Yes", "No"] : ["True", "False"];
      return { type: "tf", text: text.replace(TF, "").replace(/\s+([.?!])$/, "$1").trim(), options: labels, answer: pickAnswer(ans, labels) };
    }
    if (!text) return null;
    return { type: "open", text, model: ans || "", mark: !!ans && ans.split(/\s+/).length <= 6 };
  }

  function parse(source, name = "") {
    let html = source;
    if (!/<[a-z!][\s\S]*>/i.test(source)) html = source.split(/\r?\n/).map((l) => `<p>${esc(l)}</p>`).join("");
    const doc = new DOMParser().parseFromString(html, "text/html");
    const { title, lines } = readLines(doc);
    const act = toItems(lines, title || name.replace(/\.[a-z]+$/i, "").replace(/[-_]+/g, " "));
    return act;
  }

  /* ================= The student page (one self-contained HTML file) ================= */
  // Runs inside the student page. Kept as a real function so it can be written into the downloaded file as-is.
  function runtime(A, H) {
    H = H || {};
    const SEND = A.mode === "submit"; // student devices: each question has its own Submit, sent to the teacher's board
    const $ = (s, el = document) => el.querySelector(s);
    const $$ = (s, el = document) => [...el.querySelectorAll(s)];
    const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const norm = (s) => String(s ?? "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    const COLORS = ["#ef4444", "#3b82f6", "#f59e0b", "#22c55e", "#a855f7", "#14b8a6", "#ec4899", "#f97316"];
    const HUES = [0, 210, 40, 140, 280, 180, 320, 25];
    const root = $("#act");
    let st = A.items.map(() => ({})), checked = false;
    const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const rights = A.items.map((it) => (it.type === "match" ? shuffle(it.pairs.map((p) => p[1])) : null));

    function card(it, i, n) {
      if (it.type === "info") {
        if (it.kind === "skip") return "";
        if (it.kind === "h") return `<h2 class="sec">${esc(it.text)}</h2>`;
        if (it.kind === "img") return `<figure class="pic"><img src="${esc(it.src)}" alt="${esc(it.alt)}"></figure>`;
        if (it.kind === "bank") return `<div class="bank"><b>🧺 Word bank</b>${it.words.map((w) => `<span>${esc(w)}</span>`).join("")}</div>`;
        return `<p class="info">${it.kind === "li" ? "• " : ""}${esc(it.text)}</p>`;
      }
      const head = `<div class="qn" style="--c:${COLORS[n % COLORS.length]}">${n}</div>`;
      let body = "";
      if (it.type === "mcq" || it.type === "tf") {
        body = `<p class="qt">${esc(it.text)}</p><div class="opts ${it.type}">${it.options.map((o, k) => `<button class="opt" data-k="${k}" style="--c:${it.type === "tf" ? (k ? "#ef4444" : "#22c55e") : COLORS[k % COLORS.length]}"><i>${it.type === "tf" ? (k ? "✗" : "✓") : "ABCDEFGH"[k]}</i><span>${esc(o)}</span></button>`).join("")}</div>`;
      } else if (it.type === "blank") {
        body = `<p class="qt gaps">${it.segs.map((s) => typeof s === "string" ? esc(s) : s.choices
          ? `<select class="gap" data-g="${s.g}"><option value="">choose…</option>${s.choices.map((c) => `<option>${esc(c)}</option>`).join("")}</select>`
          : `<input class="gap" data-g="${s.g}" autocomplete="off" spellcheck="false" size="${Math.max(6, Math.min(18, (it.answers[s.g] || "").length + 2))}" placeholder="✏️">`).join("")}</p>`;
      } else if (it.type === "open") {
        body = `<p class="qt">${esc(it.text)}</p><textarea class="write" rows="3" placeholder="Write your answer here ✏️"></textarea>`;
      } else if (it.type === "match") {
        body = `<p class="qt">${esc(it.text)}</p><p class="hint">Tap one on the left, then its partner on the right.</p><div class="match"><div>${it.pairs.map((p, k) => `<button class="mc" data-l="${k}">${esc(p[0])}</button>`).join("")}</div><div>${rights[i].map((r) => `<button class="mc" data-r="${esc(r)}">${esc(r)}</button>`).join("")}</div></div>`;
      }
      return `<section class="q" data-i="${i}">${head}<div class="qb">${body}<div class="fb"></div>${SEND ? `<button class="send">Submit ✈️</button>` : ""}</div></section>`;
    }

    function draw() {
      let n = 0;
      const count = A.items.filter((x) => x.type !== "info").length;
      root.innerHTML = `<header class="hero"><div class="spark">${esc(A.emoji || "✏️")}</div><h1>${esc(A.title)}</h1>
        <p class="sub">${count} question${count === 1 ? "" : "s"} · ${SEND ? "tap <b>Submit</b> after each answer" : "answer them all, then tap <b>Check</b>"}</p>
        ${SEND ? `<div class="who me">🙂 <b>${esc(A.name || "")}</b></div>` : `<label class="who">🙂 <input id="who" placeholder="Type your name" maxlength="40" autocomplete="given-name"></label>`}
        <div class="prog"><i></i></div></header>
        ${A.items.map((it, i) => card(it, i, it.type === "info" ? 0 : ++n)).join("")}
        ${SEND ? "" : `<div class="actions"><button class="big" id="check">✅ Check my answers</button></div>`}<div id="result"></div>`;
      wire(); progress();
    }

    function answered(it, s) {
      if (it.type === "mcq" || it.type === "tf") return s.pick != null;
      if (it.type === "blank") return it.segs.filter((x) => typeof x !== "string").every((x) => (s.gaps || {})[x.g]?.trim());
      if (it.type === "open") return !!s.text?.trim();
      if (it.type === "match") return Object.keys(s.pairs || {}).length === it.pairs.length;
      return true;
    }
    function progress() {
      const qs = A.items.map((it, i) => [it, i]).filter(([it]) => it.type !== "info");
      const done = qs.filter(([it, i]) => (SEND ? st[i].sent : answered(it, st[i]))).length;
      $(".prog i").style.width = (qs.length ? (done / qs.length) * 100 : 0) + "%";
      if (SEND) {
        let right = 0, wrong = 0, wait = 0;
        qs.forEach(([it, i]) => { if (!st[i].sent) return; const g = grade(it, st[i]); if (g.score == null) wait++; else if (g.score) right++; else wrong++; });
        let bar = $("#tally");
        if (!bar) { bar = document.createElement("div"); bar.id = "tally"; document.body.appendChild(bar); }
        bar.innerHTML = `<span>✅ ${right}</span><span>❌ ${wrong}</span>${wait ? `<span>✍️ ${wait}</span>` : ""}<span class="t-done">${done} / ${qs.length} done</span>`;
      }
    }

    function paintMatch(sec, i) {
      const s = st[i]; s.pairs = s.pairs || {};
      $$(".mc", sec).forEach((b) => { b.classList.remove("sel"); b.style.background = ""; b.style.borderColor = ""; });
      Object.entries(s.pairs).forEach(([l, r], k) => {
        const c = `hsl(${HUES[+l % HUES.length]} 85% 86%)`, bc = `hsl(${HUES[+l % HUES.length]} 70% 50%)`;
        [$(`[data-l="${l}"]`, sec), $(`[data-r="${CSS.escape(r)}"]`, sec)].forEach((b) => { if (b) { b.style.background = c; b.style.borderColor = bc; } });
      });
      if (s.sel != null) $(`[data-l="${s.sel}"]`, sec)?.classList.add("sel");
    }

    function wire() {
      root.onclick = (e) => {
        const sec = e.target.closest(".q"); if (!sec || checked) return;
        if (e.target.closest(".send")) return send(+sec.dataset.i);
        if (st[+sec.dataset.i].sent) return;
        const i = +sec.dataset.i, it = A.items[i], s = st[i];
        const opt = e.target.closest(".opt");
        if (opt) { s.pick = +opt.dataset.k; $$(".opt", sec).forEach((b) => b.classList.toggle("on", b === opt)); pop(opt); progress(); return; }
        const l = e.target.closest("[data-l]"), r = e.target.closest("[data-r]");
        if (l) { s.sel = +l.dataset.l; paintMatch(sec, i); return; }
        if (r && s.sel != null) {
          s.pairs = s.pairs || {};
          Object.keys(s.pairs).forEach((k) => { if (s.pairs[k] === r.dataset.r) delete s.pairs[k]; });
          s.pairs[s.sel] = r.dataset.r; s.sel = null; paintMatch(sec, i); pop(r); progress();
        }
      };
      root.oninput = root.onchange = (e) => {
        const sec = e.target.closest(".q"); if (!sec) return;
        const s = st[+sec.dataset.i];
        if (e.target.matches(".gap")) { s.gaps = s.gaps || {}; s.gaps[e.target.dataset.g] = e.target.value; }
        if (e.target.matches(".write")) s.text = e.target.value;
        progress();
      };
      if ($("#check")) $("#check").onclick = check;
    }
    const pop = (el) => el.animate([{ transform: "scale(.92)" }, { transform: "scale(1.04)" }, { transform: "scale(1)" }], { duration: 260 });
    const NUMS = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty".split(" ");
    const same = (a, b) => a === b || NUMS[+a] === b || NUMS[+b] === a; // "2" counts as "two"
    const ok = (given, want) => String(want).split("/").some((w) => norm(w) && same(norm(w), norm(given)));

    function grade(it, s) {
      if (it.type === "mcq" || it.type === "tf") {
        if (it.answer == null) return { score: null, show: "" };
        return { score: s.pick === it.answer ? 1 : 0, show: it.options[it.answer] };
      }
      if (it.type === "blank") {
        const gaps = it.segs.filter((x) => typeof x !== "string");
        const keyed = gaps.filter((x) => (it.answers[x.g] || "").trim());
        if (!keyed.length) return { score: null, show: "" };
        const right = keyed.filter((x) => ok((s.gaps || {})[x.g] || "", it.answers[x.g]));
        return { score: right.length === keyed.length ? 1 : 0, show: keyed.map((x) => it.answers[x.g].split("/")[0]).join(", "), per: gaps.map((x) => (it.answers[x.g] || "").trim() ? ok((s.gaps || {})[x.g] || "", it.answers[x.g]) : null) };
      }
      if (it.type === "match") {
        const p = s.pairs || {};
        return { score: it.pairs.every((pair, k) => p[k] === pair[1]) ? 1 : 0, show: it.pairs.map((x) => `${x[0]} → ${x[1]}`).join(" · ") };
      }
      if (it.type === "open") {
        if (!(it.model && it.mark)) return { score: null, show: it.model || "" };
        const STOP = new Set("a an the of to in on is are was be it and or for with that this by at as from they their them you your we our".split(" "));
        const g = norm(s.text), G = g.split(" ");
        const right = String(it.model).split("/").some((w) => { const n = norm(w); if (!n || !g) return false; if (n === g || same(n, g)) return true;
          const W = n.split(" ").filter((x) => x.length > 2 && !STOP.has(x)); if (!W.length) return false;
          const hit = W.filter((x) => G.some((y) => y === x || (x.length > 4 && y.length > 4 && y.slice(0, 5) === x.slice(0, 5)))).length;
          return W.length <= 3 ? hit === W.length : hit / W.length >= 0.6; });
        return { score: right ? 1 : 0, show: it.model.split("/")[0] };
      }
      return { score: null };
    }

    // What the student gave, in words, for the teacher's board
    function given(it, s) {
      if (it.type === "mcq" || it.type === "tf") return s.pick != null ? it.options[s.pick] : "";
      if (it.type === "blank") return it.segs.filter((x) => typeof x !== "string").map((x) => ((s.gaps || {})[x.g] || "").trim()).join(", ");
      if (it.type === "open") return (s.text || "").trim();
      if (it.type === "match") return it.pairs.map((p, k) => `${p[0]} → ${(s.pairs || {})[k] || "?"}`).join("; ");
      return "";
    }
    function lock(i, quiet) {
      const it = A.items[i], s = st[i], sec = $(`.q[data-i="${i}"]`), g = grade(it, s), fb = $(".fb", sec);
      s.sent = true; sec.classList.add("locked", g.score == null ? "done" : g.score ? "right" : "wrong");
      $$("input, select, textarea", sec).forEach((x) => (x.disabled = true));
      const b = $(".send", sec); if (b) { b.disabled = true; b.textContent = "✅ Submitted"; }
      if (g.score == null) fb.innerHTML = `✍️ Sent to your teacher${g.show ? ` · <b>Teacher's answer:</b> ${esc(g.show)}` : ""}`;
      else fb.innerHTML = g.score ? "🎉 Correct!" : `💪 Not quite — the answer is <b>${esc(g.show)}</b>`;
      if (it.type === "mcq" || it.type === "tf") $$(".opt", sec).forEach((b, k) => { if (it.answer == null) return; b.classList.toggle("good", k === it.answer); b.classList.toggle("bad", k === s.pick && k !== it.answer); });
      if (g.per) $$(".gap", sec).forEach((x) => { const v = g.per[+x.dataset.g]; if (v != null) x.classList.add(v ? "good" : "bad"); });
      if (!quiet && g.score) pop(sec);
      progress();
      return g;
    }
    function send(i) {
      const it = A.items[i], s = st[i], sec = $(`.q[data-i="${i}"]`);
      if (s.sent) return;
      if (!answered(it, s)) { $(".fb", sec).innerHTML = "✋ Answer this one first, then tap Submit"; sec.animate([{ translate: "-6px 0" }, { translate: "6px 0" }, { translate: "0 0" }], { duration: 250 }); return; }
      const g = lock(i);
      if (g.score) confettiSmall(sec);
      H.onSend && H.onSend(i, { a: given(it, s).slice(0, 300), ok: g.score }, JSON.parse(JSON.stringify(s)));
      finishIfDone();
    }
    function finishIfDone() {
      const qs = A.items.map((it, i) => [it, i]).filter(([it]) => it.type !== "info");
      if (!qs.every(([, i]) => st[i].sent)) return;
      let got = 0, total = 0;
      qs.forEach(([it, i]) => { const g = grade(it, st[i]); if (g.score != null) { total++; got += g.score; } });
      const pct = total ? got / total : 1;
      const wait = qs.length - total, wrong = total - got;
      const face = pct === 1 ? "🏆" : pct >= .8 ? "🌟" : pct >= .5 ? "👍" : "💪";
      const words = !total ? "Your teacher will mark your answers 📺" : pct === 1 ? "Perfect score — amazing work!" : pct >= .8 ? "Brilliant work!" : pct >= .5 ? "Good try — look at the answers you missed." : "Keep going — you'll get there!";
      const card = document.createElement("div"); card.className = "final";
      card.innerHTML = `<div class="final-in"><div class="face">${face}</div><p class="final-name">${esc(A.name || "")}, you scored</p>
        <div class="final-score"><b>${got}</b><span>/ ${total}</span></div>${total ? `<div class="final-pct">${Math.round(pct * 100)}%</div>` : ""}
        <div class="stars">${total ? "⭐".repeat(Math.max(1, Math.round(pct * 5))) : "⭐⭐⭐"}</div>
        <div class="final-break"><span>✅ ${got} right</span><span>❌ ${wrong} wrong</span>${wait ? `<span>✍️ ${wait} for your teacher</span>` : ""}</div>
        <p>${words}</p><p class="when">${esc(A.title)} · ${new Date().toLocaleString()}</p>
        <button class="big" id="seeAns">👀 See my answers</button></div>`;
      document.querySelector(".final")?.remove();
      document.body.appendChild(card);
      $("#seeAns").onclick = () => { card.remove(); scrollTo({ top: 0, behavior: "smooth" }); };
      $("#result").innerHTML = `<div class="res"><div class="face">${pct === 1 ? "🏆" : pct >= .8 ? "🌟" : pct >= .5 ? "👍" : "💪"}</div><h2>All done, ${esc(A.name || "")}!</h2>
        <h2>${got} / ${total}</h2><div class="stars">${total ? "⭐".repeat(Math.max(1, Math.round(pct * 5))) : "⭐⭐⭐"}</div><p>Your answers are on your teacher's board 📺</p><p class="when">${esc(A.title)} · ${new Date().toLocaleString()}</p></div>`;
      if (pct >= .8) confetti();
    }
    function confettiSmall(sec) {
      const r = sec.getBoundingClientRect();
      for (let k = 0; k < 24; k++) { const p = document.createElement("i"); p.className = "cf"; p.style.cssText = `left:${r.left + Math.random() * r.width}px;top:${r.top}px;background:${COLORS[k % COLORS.length]};animation-duration:${1 + Math.random()}s`; document.body.appendChild(p); setTimeout(() => p.remove(), 2200); }
    }
    // Put back answers already submitted on this device (page reloaded)
    function restore(saved) {
      Object.entries(saved || {}).forEach(([i, s]) => {
        i = +i; if (!A.items[i] || A.items[i].type === "info") return;
        st[i] = { ...s, sent: false };
        const sec = $(`.q[data-i="${i}"]`);
        if (s.pick != null) $$(".opt", sec)[s.pick]?.classList.add("on");
        $$(".gap", sec).forEach((x) => (x.value = (s.gaps || {})[x.dataset.g] || ""));
        const ta = $(".write", sec); if (ta) ta.value = s.text || "";
        if (A.items[i].type === "match") paintMatch(sec, i);
        lock(i, true);
      });
      finishIfDone();
    }

    function check() {
      const missing = A.items.map((it, i) => [it, i]).filter(([it, i]) => it.type !== "info" && !answered(it, st[i]));
      if (missing.length && !$("#check").dataset.sure) {
        $("#check").dataset.sure = "1"; $("#check").textContent = `⚠️ ${missing.length} not answered yet — tap again to check anyway`;
        $(`.q[data-i="${missing[0][1]}"]`).scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      checked = true;
      let got = 0, total = 0;
      A.items.forEach((it, i) => {
        if (it.type === "info") return;
        const sec = $(`.q[data-i="${i}"]`), g = grade(it, st[i]), fb = $(".fb", sec);
        sec.classList.add("locked");
        if (g.score == null) {
          sec.classList.add(answered(it, st[i]) ? "done" : "wrong");
          fb.innerHTML = answered(it, st[i]) ? `✍️ Answer saved${g.show ? ` · <b>Teacher's answer:</b> ${esc(g.show)}` : ""}` : "⏳ Not answered";
          return;
        }
        total++; got += g.score;
        sec.classList.add(g.score ? "right" : "wrong");
        fb.innerHTML = g.score ? "🎉 Correct!" : `💪 Not quite — the answer is <b>${esc(g.show)}</b>`;
        if (it.type === "mcq" || it.type === "tf") $$(".opt", sec).forEach((b, k) => { b.classList.toggle("good", k === it.answer); b.classList.toggle("bad", k === st[i].pick && k !== it.answer); });
        if (g.per) $$(".gap", sec).forEach((x) => { const v = g.per[+x.dataset.g]; if (v != null) x.classList.add(v ? "good" : "bad"); });
      });
      const who = $("#who").value.trim(), pct = total ? got / total : 1;
      const face = pct === 1 ? "🏆" : pct >= .8 ? "🌟" : pct >= .5 ? "👍" : "💪";
      const stars = total ? "⭐".repeat(Math.max(1, Math.round(pct * 5))) : "⭐⭐⭐";
      $("#result").innerHTML = `<div class="res"><div class="face">${face}</div><h2>${who ? esc(who) + ", y" : "Y"}ou got ${got} / ${total}!</h2>
        <div class="stars">${stars}</div><p>${pct === 1 ? "Perfect score — amazing work!" : pct >= .8 ? "Brilliant! Just a little more to perfect." : pct >= .5 ? "Good try! Look at the answers and try again." : "Keep going — you can do it! Try again."}</p>
        <p class="when">${esc(A.title)} · ${new Date().toLocaleString()}</p>
        <div class="row"><button class="big alt" id="fix">✏️ Fix my answers</button><button class="big" id="again">🔁 Start again</button></div></div>`;
      $("#check").hidden = true;
      $("#result").scrollIntoView({ behavior: "smooth", block: "center" });
      if (pct >= .8) confetti();
      $("#fix").onclick = () => { checked = false; $$(".q").forEach((s) => { s.classList.remove("locked", "right", "wrong", "done"); $(".fb", s).innerHTML = ""; }); $$(".good,.bad").forEach((x) => x.classList.remove("good", "bad")); $("#result").innerHTML = ""; $("#check").hidden = false; delete $("#check").dataset.sure; $("#check").textContent = "✅ Check my answers"; };
      $("#again").onclick = () => { const w = $("#who").value; st = A.items.map(() => ({})); checked = false; draw(); $("#who").value = w; scrollTo({ top: 0, behavior: "smooth" }); };
      try { parent !== window && parent.postMessage({ type: "cp-activity", got, total, name: who }, "*"); } catch (e) { /* standalone */ }
    }

    function confetti() {
      for (let k = 0; k < 120; k++) {
        const p = document.createElement("i"); p.className = "cf";
        p.style.cssText = `left:${Math.random() * 100}vw;background:${COLORS[k % COLORS.length]};animation-delay:${Math.random() * .6}s;animation-duration:${1.8 + Math.random() * 1.6}s;transform:rotate(${Math.random() * 360}deg)`;
        document.body.appendChild(p); setTimeout(() => p.remove(), 4200);
      }
    }
    draw();
    if (SEND) restore(H.saved);
  }

  const PAGE_CSS = `
:root{--ink:#24124d;--muted:#6b5f8a;--card:#fff}
*{box-sizing:border-box}
body{margin:0;font-family:"Nunito",system-ui,sans-serif;color:var(--ink);min-height:100vh;
 background:radial-gradient(1200px 600px at 10% -10%,#ffe36e 0,transparent 55%),radial-gradient(900px 600px at 110% 10%,#ff9ad5 0,transparent 55%),radial-gradient(900px 700px at 50% 120%,#7dd3fc 0,transparent 60%),#f6f0ff;background-attachment:fixed}
#act{max-width:820px;margin:0 auto;padding:16px 16px 60px}
h1,h2,.qn,.big{font-family:"Baloo 2",system-ui,sans-serif}
.hero{text-align:center;background:linear-gradient(135deg,#7c3aed,#ec4899 55%,#f97316);color:#fff;border-radius:28px;padding:22px 18px 18px;box-shadow:0 14px 30px rgba(124,58,237,.3);position:relative;overflow:hidden}
.hero:after{content:"⭐ ✨ 🌈 ✨ ⭐";position:absolute;top:8px;right:14px;opacity:.35;font-size:1.1rem}
.spark{font-size:3rem;animation:bob 2.4s ease-in-out infinite}
@keyframes bob{50%{transform:translateY(-6px) rotate(-4deg)}}
.hero h1{margin:4px 0;font-size:clamp(1.6rem,5vw,2.4rem);line-height:1.1}
.sub{margin:4px 0 12px;opacity:.92}
.who{display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,.22);border-radius:999px;padding:4px 6px 4px 12px;font-size:1.2rem}
.who input{border:0;border-radius:999px;padding:9px 14px;font:inherit;font-size:1rem;font-weight:800;color:var(--ink);width:min(240px,60vw)}
.prog{height:10px;background:rgba(255,255,255,.3);border-radius:99px;margin-top:14px;overflow:hidden}.prog i{display:block;height:100%;width:0;background:#ffe14d;border-radius:99px;transition:width .4s}
.sec{margin:26px 4px 6px;font-size:1.5rem;color:#7c3aed}
.info{background:rgba(255,255,255,.75);border-radius:16px;padding:10px 14px;margin:10px 0;line-height:1.5}
.pic{margin:12px 0;text-align:center}.pic img{max-width:100%;border-radius:18px;box-shadow:0 8px 20px rgba(0,0,0,.12)}
.bank{display:flex;flex-wrap:wrap;gap:8px;align-items:center;background:#fff7d1;border:3px dashed #f59e0b;border-radius:18px;padding:12px;margin:12px 0}
.bank span{background:#fff;border-radius:999px;padding:5px 12px;font-weight:800;box-shadow:0 3px 0 #f5c451}
.q{display:flex;gap:12px;background:var(--card);border-radius:22px;padding:16px;margin:14px 0;box-shadow:0 8px 0 rgba(36,18,77,.08),0 12px 24px rgba(36,18,77,.08);border:3px solid transparent;transition:border-color .2s,transform .2s;animation:rise .4s both}
@keyframes rise{from{opacity:0;transform:translateY(12px)}}
.q:focus-within{border-color:#c4b5fd}
.qn{flex:0 0 44px;height:44px;border-radius:14px;background:var(--c);color:#fff;display:grid;place-items:center;font-size:1.4rem;box-shadow:0 4px 0 rgba(0,0,0,.15)}
.qb{flex:1;min-width:0}
.qt{font-size:1.15rem;font-weight:700;margin:6px 0 12px;line-height:1.6}
.opts{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(220px,100%),1fr));gap:10px}
.opt{display:flex;align-items:center;gap:10px;text-align:left;border:3px solid color-mix(in srgb,var(--c) 35%,#fff);background:color-mix(in srgb,var(--c) 10%,#fff);color:var(--ink);border-radius:16px;padding:10px 12px;font:inherit;font-weight:700;font-size:1.05rem;cursor:pointer;transition:transform .12s}
.opt:hover{transform:translateY(-2px)}
.opt i{flex:0 0 34px;height:34px;border-radius:10px;background:var(--c);color:#fff;font-style:normal;display:grid;place-items:center;font-weight:800}
.opt.on{background:var(--c);color:#fff;border-color:var(--c);box-shadow:0 5px 0 color-mix(in srgb,var(--c) 60%,#000)}
.opt.on i{background:#fff;color:var(--c)}
.opts.tf{grid-template-columns:1fr 1fr}.opts.tf .opt{justify-content:center;font-size:1.25rem;padding:16px}
.gap{font:inherit;font-weight:800;color:#7c3aed;border:0;border-bottom:3px dashed #a78bfa;background:#f5f0ff;border-radius:10px 10px 0 0;padding:4px 8px;margin:0 4px;text-align:center;max-width:100%}
.gap:focus{outline:3px solid #fde047;background:#fffbe6}
.gap.good{background:#dcfce7;border-color:#22c55e;color:#166534}.gap.bad{background:#fee2e2;border-color:#ef4444;color:#991b1b}
.write{width:100%;font:inherit;font-size:1.05rem;border:3px solid #ddd6fe;border-radius:16px;padding:12px;resize:vertical;background:#faf7ff}
.write:focus{outline:none;border-color:#a78bfa}
.hint{color:var(--muted);margin:-6px 0 10px;font-size:.92rem}
.match{display:grid;grid-template-columns:1fr 1fr;gap:12px}.match>div{display:flex;flex-direction:column;gap:8px}
.mc{border:3px solid #e9e3ff;background:#fff;border-radius:14px;padding:10px;font:inherit;font-weight:700;cursor:pointer;color:var(--ink)}
.mc.sel{outline:4px solid #fde047}
.fb{font-weight:800;margin-top:10px;min-height:0}
.send{display:block;margin:12px 0 0 auto;border:0;border-radius:14px;padding:10px 20px;font:inherit;font-weight:800;font-size:1.05rem;cursor:pointer;color:#fff;background:#7c3aed;box-shadow:0 5px 0 #5b21b6}
.send:active{transform:translateY(3px);box-shadow:0 2px 0 #5b21b6}.send:disabled{background:#22c55e;box-shadow:none;cursor:default}
.q.wrong .send:disabled{background:#fb7185}.q.done .send:disabled{background:#a78bfa}
.who.me{padding:8px 16px}
#tally{position:fixed;top:8px;right:8px;z-index:40;display:flex;gap:10px;align-items:center;background:#24124d;color:#fff;font-weight:800;border-radius:999px;padding:7px 14px;box-shadow:0 6px 16px rgba(0,0,0,.25);font-size:.95rem}
#tally b{color:#fde047}#tally .t-done{opacity:.8;font-size:.85rem}
.final{position:fixed;inset:0;z-index:90;display:grid;place-items:center;padding:16px;background:rgba(36,18,77,.55);backdrop-filter:blur(4px);animation:rise .3s both}
.final-in{background:#fff;border-radius:32px;padding:26px 22px;text-align:center;width:min(440px,100%);max-height:100%;overflow:auto;border:5px solid #fde047;box-shadow:0 30px 60px rgba(0,0,0,.3);animation:rise .5s .1s both}
.final .face{font-size:4.5rem;animation:bob 1.6s ease-in-out infinite}
.final-name{margin:0;font-weight:800;color:var(--muted)}
.final-score{font-family:"Baloo 2",sans-serif;line-height:1;color:#7c3aed}.final-score b{font-size:5.5rem}.final-score span{font-size:2.4rem;color:var(--muted)}
.final-pct{display:inline-block;background:#7c3aed;color:#fff;font-weight:800;border-radius:999px;padding:4px 16px;font-size:1.3rem;margin:4px 0}
.final-break{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:10px 0}.final-break span{background:#f5f0ff;border-radius:999px;padding:5px 12px;font-weight:800}
.q.right{border-color:#22c55e;background:#f0fdf4}.q.wrong{border-color:#fb7185;background:#fff1f2}.q.done{border-color:#a78bfa}
.q.locked .opt,.q.locked .mc{cursor:default}
.opt.good{background:#22c55e;border-color:#22c55e;color:#fff}.opt.bad{background:#ef4444;border-color:#ef4444;color:#fff;opacity:.85}
.actions{text-align:center;margin:26px 0 10px}
.big{border:0;border-radius:18px;padding:14px 26px;font-size:1.3rem;font-weight:800;cursor:pointer;color:#3a2500;background:#ffd23f;box-shadow:0 6px 0 #c99a00;transition:transform .1s}
.big:active{transform:translateY(4px);box-shadow:0 2px 0 #c99a00}
.big.alt{background:#fff;color:#7c3aed;box-shadow:0 6px 0 #c4b5fd}
.res{text-align:center;background:#fff;border-radius:28px;padding:24px 16px;box-shadow:0 14px 30px rgba(36,18,77,.15);border:4px solid #fde047;animation:rise .5s both}
.res .face{font-size:4.5rem;animation:bob 1.6s ease-in-out infinite}.res h2{margin:4px 0;font-size:2rem}
.stars{font-size:2rem;letter-spacing:4px}.when{color:var(--muted);font-size:.85rem}
.row{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:10px}
.cf{position:fixed;top:-12px;width:10px;height:16px;border-radius:3px;z-index:99;animation:fall linear forwards;pointer-events:none}
@keyframes fall{to{top:105vh;transform:translateX(40px) rotate(720deg)}}
[hidden]{display:none!important}
@media (max-width:520px){.q{padding:12px;gap:8px}.qn{flex-basis:34px;height:34px;font-size:1.1rem}.match{gap:8px}}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}`;

  function buildHtml(act) {
    const data = JSON.stringify({ title: act.title, emoji: act.emoji, items: act.items }).replace(/</g, "\\u003c").replace(/\u2028|\u2029/g, " ");
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(act.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;800&family=Nunito:wght@600;700;800&display=swap" rel="stylesheet">
<style>${PAGE_CSS}</style></head>
<body><main id="act"></main>
<script>(${runtime.toString()})(${data});<\/script></body></html>`;
  }

  /* ================= Saving ================= */
  const load = () => { try { return JSON.parse(localStorage.getItem(STORE) || "[]"); } catch { return []; } };
  const save = (list) => { try { localStorage.setItem(STORE, JSON.stringify(list)); return true; } catch { CP().toast("⚠️ Too big to save on this device — try removing big pictures from the document"); return false; } };
  const questions = (a) => a.items.filter((i) => i.type !== "info");
  const unkeyed = (a) => questions(a).filter((i) => !markable(i)).length;
  const KINDS = { mcq: "🔤 Multiple choice", tf: "✅ True / False", blank: "✏️ Fill in the blank", open: "📝 Write an answer", match: "🔗 Matching" };
  const EMOJIS = ["✏️", "📚", "🧠", "🌟", "🚀", "🌈", "🔍", "🎯", "🧩", "🌍"];

  /* ================= Teacher screens ================= */
  let ctx = null, readyPick = null;
  function open(c) { ctx = c; readyPick = c.plan && c.w ? { id: c.plan.id, week: c.w.week } : readyPick; library(); }
  const rowHtml = (a) => `<div class="am-item${a.ready ? " ready" : ""}" data-id="${a.id}">
          <div class="am-emo">${esc(a.emoji || "✏️")}</div>
          <div class="am-meta"><b>${esc(a.title)}</b><small>${questions(a).length} questions · ${[...new Set(questions(a).map((q) => KINDS[q.type]))].join(" · ")}${a.ready ? "" : `${a.where ? ` · ${esc(a.where)}` : ""} · ${new Date(a.created).toLocaleDateString()}`}${unkeyed(a) ? ` · <span class="am-warn">${unkeyed(a)} ${a.ready ? "for you to mark" : "without an answer"}</span>` : ""}</small></div>
          <div class="am-btns"><button class="btn" data-a="play">▶ Play</button><button class="btn" data-a="assign" title="Students do it on their own devices and submit each answer — names and marks appear on your board">📲 Students' devices</button><button class="btn ghost" data-a="live" title="A quiz game: everyone answers the same question together">📱 Live game</button><button class="btn ghost" data-a="print" title="Print a paper worksheet (or save it as a PDF) — every answer box is left empty">🖨️ Print worksheet</button><button class="btn ghost" data-a="dl" title="Download the interactive page for students' devices">⬇️ Download</button>${a.ready ? `<button class="btn ghost" data-a="copy" title="Save your own copy in My activities and change it">✏️ Copy &amp; edit</button>` : `<button class="btn ghost" data-a="edit">✏️ Edit</button><button class="btn ghost am-del" data-a="del" title="Delete">🗑</button>`}</div>
        </div>`;

  // Ready-made worksheets for any year / term / week (made by lessons.js worksheetsFor from the LC lesson)
  function readyHtml() {
    const R = ctx.ready; if (!R) return { html: "", list: [] };
    const plans = R.plans();
    let plan = plans.find((p) => p.id === readyPick?.id) || plans[0];
    if (!readyPick || !plan.weeks.some((w) => w.week === readyPick.week)) readyPick = { id: plan.id, week: plan.weeks[0].week };
    const list = R.make(plan, readyPick.week);
    const years = [...new Set(plans.map((p) => p.year))].sort((a, b) => a - b);
    const terms = plans.filter((p) => p.year === plan.year).sort((a, b) => a.term - b.term);
    return { list, html: `<section class="am-ready">
      <h3 class="lc-sub">📚 Ready-made worksheets <small class="muted">for every year and topic — ${list.length} for this week</small></h3>
      <div class="am-rpick">
        <label>Year <select data-r="year">${years.map((y) => `<option value="${y}" ${y === plan.year ? "selected" : ""}>Year ${y}</option>`).join("")}</select></label>
        <label>Term <select data-r="term">${terms.map((p) => `<option value="${p.id}" ${p.id === plan.id ? "selected" : ""}>Term ${p.term}</option>`).join("")}</select></label>
        <label class="wide">Topic <select data-r="week">${plan.weeks.map((w) => `<option value="${w.week}" ${w.week === readyPick.week ? "selected" : ""}>${esc(R.label(plan, w.week))}</option>`).join("")}</select></label>
      </div>
      <div class="am-list">${list.map(rowHtml).join("")}</div>
    </section>`, plan };
  }

  function library() {
    const el = ctx.stage("📄 My activities", { jars: false }), body = $(".lc-stage-body", el);
    const list = load().sort((a, b) => b.created - a.created);
    const ready = readyHtml();
    body.innerHTML = `<div class="am">${ready.html}
      <h3 class="lc-sub">⬆️ Make your own</h3>
      <label class="am-drop" tabindex="0">
        <input type="file" accept=".html,.htm,.txt,text/html,text/plain" hidden>
        <div class="am-drop-ico"><span>📄</span><span class="am-arrow">➜</span><span>🎮</span></div>
        <b>Upload your activity document</b>
        <small>Drop an HTML file here, or tap to choose one (.html, .htm or .txt)</small>
      </label>
      <details class="am-more"><summary>✍️ …or paste your questions as text</summary>
        <textarea class="am-paste" rows="7" placeholder="1. What is the capital of Malaysia?&#10;a) Penang  b) Kuala Lumpur  c) Ipoh&#10;Answer: b&#10;&#10;2. The sun is a star. (True/False)&#10;Answer: True&#10;&#10;3. A baby cat is called a ______.&#10;Answer: kitten"></textarea>
        <button class="btn am-go">✨ Make it interactive</button></details>
      <details class="am-more"><summary>💡 How to write questions so they turn out best</summary>
        <ul class="am-tips">
          <li><b>Number each question</b> — <code>1.</code> <code>2.</code> or <code>Q1:</code></li>
          <li><b>Multiple choice:</b> options on new lines as <code>a)</code> <code>b)</code> <code>c)</code>, or all on one line</li>
          <li><b>Fill in the blank:</b> use <code>_____</code> where the answer goes</li>
          <li><b>True / False:</b> add <code>(True/False)</code> after the sentence</li>
          <li><b>Matching:</b> a table with two columns</li>
          <li><b>Answers:</b> a line <code>Answer: b</code> under the question, an <b>Answer key</b> heading at the end, a ✓ next to the right option, or the right option in <b>bold</b>. You can also tap the right answers after uploading.</li>
          <li>Questions with no options become a box to write in.</li>
        </ul></details>
      <h3 class="lc-sub">📚 My activities${list.length ? ` (${list.length})` : ""}</h3>
      <div class="am-list">${list.length ? list.map(rowHtml).join("") : `<p class="muted am-none">Nothing here yet — upload your first worksheet above ⬆️</p>`}</div>
    </div>`;

    const drop = $(".am-drop", body), file = $("input[type=file]", drop);
    const take = async (f) => {
      if (!f) return;
      if (/\.(docx?|pdf|pptx?)$/i.test(f.name)) return CP().toast("📄 Please save it as a Web Page (.html) first: File › Save As › Web Page");
      try { const text = await f.text(); fromSource(text, f.name); } catch { CP().toast("⚠️ Couldn't read that file"); }
    };
    file.onchange = () => take(file.files[0]);
    drop.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); file.click(); } };
    ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
    ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove("over")));
    drop.addEventListener("drop", (e) => { e.preventDefault(); take(e.dataTransfer.files[0]); });
    $(".am-go", body).onclick = () => { const t = $(".am-paste", body).value.trim(); if (t) fromSource(t, "My activity"); else CP().toast("Paste some questions first"); };

    if (ready.plan) {
      const plans = ctx.ready.plans(), R = (k) => $(`[data-r="${k}"]`, body);
      R("year").onchange = () => { const p = plans.filter((x) => x.year === +R("year").value).sort((a, b) => a.term - b.term)[0]; readyPick = { id: p.id, week: p.weeks[0].week }; library(); };
      R("term").onchange = () => { const p = plans.find((x) => x.id === R("term").value); readyPick = { id: p.id, week: p.weeks[0].week }; library(); };
      R("week").onchange = () => { readyPick = { ...readyPick, week: +R("week").value }; library(); };
    }
    $$(".am-item", body).forEach((row) => {
      const a = list.find((x) => x.id === row.dataset.id) || ready.list.find((x) => x.id === row.dataset.id);
      $$("[data-a]", row).forEach((b) => b.onclick = () => {
        const go = b.dataset.a;
        if (a.ready && ready.plan) { ctx.plan = ready.plan; ctx.w = ready.plan.weeks.find((w) => w.week === readyPick.week); }
        if (go === "play") play(a);
        else if (go === "copy") { const c = JSON.parse(JSON.stringify(a)); delete c.ready; c.id = "a" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); c.created = Date.now(); edit(c, true); }
        else if (go === "edit") edit(a, false);
        else if (go === "dl") download(a);
        else if (go === "print") printSheet(a);
        else if (go === "live") live(a);
        else if (go === "assign") assign(a);
        else if (go === "del") {
          if (!b.classList.contains("sure")) { b.classList.add("sure"); b.textContent = "Delete?"; setTimeout(() => { b.classList.remove("sure"); b.textContent = "🗑"; }, 3000); return; }
          save(load().filter((x) => x.id !== a.id)); CP().toast("🗑 Deleted"); library();
        }
      });
    });
  }

  function fromSource(text, name) {
    const act = parse(text, name);
    act.id = "a" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    act.created = Date.now();
    act.emoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)];
    act.where = ctx.where || "";
    edit(act, true);
  }

  function edit(src, isNew, after) {
    const act = JSON.parse(JSON.stringify(src));
    const el = ctx.stage(isNew ? "✨ Check your activity" : "✏️ Edit activity", { jars: false }), body = $(".lc-stage-body", el);
    $(".lc-stage-extra", el).innerHTML = `<button class="btn ghost am-back">‹ My activities</button>`;
    $(".am-back", el).onclick = () => (after ? after(src) : library());
    const draw = () => {
      const qs = questions(act), counts = {};
      qs.forEach((q) => (counts[q.type] = (counts[q.type] || 0) + 1));
      const miss = unkeyed(act);
      let n = 0;
      body.innerHTML = `<div class="am">
        <div class="card am-head">
          <button class="am-emo big" title="Change the picture">${esc(act.emoji)}</button>
          <input class="am-title" value="${esc(act.title)}" maxlength="80" aria-label="Activity title">
        </div>
        ${qs.length ? `<div class="am-sum"><b>${isNew ? "🎉 I found" : "📋"} ${qs.length} question${qs.length === 1 ? "" : "s"}:</b> ${Object.entries(counts).map(([k, v]) => `<span class="lc-badge">${KINDS[k]} × ${v}</span>`).join(" ")}</div>
          ${miss ? `<div class="am-note">👆 <b>${miss} question${miss === 1 ? " has" : "s have"} no right answer yet</b> (orange). Tap the right option, or type the right answer, so students see ✅ Correct / ❌ Wrong as soon as they submit. Without one, you mark it yourself on the board.</div>` : `<div class="am-note ok">✅ Every question has an answer — students will get marked straight away.</div>`}`
        : `<div class="am-note">😕 <b>I couldn't find any questions in this document.</b> Number your questions (1. 2. 3.) and put options as a) b) c) — open “How to write questions” on the previous page for help.</div>`}
        <div class="am-items">${act.items.map((it, i) => itemCard(it, i, it.type === "info" ? 0 : ++n)).join("")}</div>
        <div class="am-save"><button class="btn ghost am-back2">Cancel</button><button class="btn am-keep" ${qs.length ? "" : "disabled"}>💾 Save</button><button class="btn am-keep-play" ${qs.length ? "" : "disabled"}>▶ Save &amp; play</button></div>
      </div>`;
      wire();
    };
    const itemCard = (it, i, n) => {
      const del = `<button class="am-x" data-del="${i}" title="Remove">✕</button>`;
      if (it.type === "info") return `<div class="am-info">${del}${it.kind === "img" ? `<img src="${esc(it.src)}" alt="">` : it.kind === "bank" ? `🧺 <b>Word bank:</b> ${esc(it.words.join(", "))}` : it.kind === "h" ? `<b>${esc(it.text)}</b>` : esc(it.text)}</div>`;
      let inner = "";
      if (it.type === "mcq" || it.type === "tf") inner = `<p class="am-qt" contenteditable="plaintext-only" data-text="${i}">${esc(it.text)}</p>
        <div class="am-opts">${it.options.map((o, k) => `<button class="am-opt ${it.answer === k ? "on" : ""}" data-pick="${i}:${k}"><i>${it.answer === k ? "✓" : it.type === "tf" ? "" : LETTERS[k]}</i>${esc(o)}</button>`).join("")}</div>
        <small class="muted">${it.answer == null ? "👆 Tap the right answer" : "Right answer ✓ — tap another to change"}</small>`;
      else if (it.type === "blank") inner = `<p class="am-qt">${it.segs.map((s) => typeof s === "string" ? esc(s) : `<input class="am-gap" data-gap="${i}:${s.g}" value="${esc(it.answers[s.g] || "")}" placeholder="answer" size="${Math.max(7, (it.answers[s.g] || "").length + 1)}">${s.choices ? `<small class="muted"> (${esc(s.choices.join(" / "))})</small>` : ""}`).join("")}</p>
        <small class="muted">Type the answer in each gap. More than one right answer? Use / — like <code>colour/color</code></small>`;
      else if (it.type === "open") inner = `<p class="am-qt" contenteditable="plaintext-only" data-text="${i}">${esc(it.text)}</p><input class="am-model" data-model="${i}" value="${esc(it.model)}" placeholder="✏️ Type the right answer (use / for other right answers, e.g. the creator/the author)">
        <label class="am-auto"><input type="checkbox" data-mark="${i}" ${it.mark ? "checked" : ""}> ✅ Mark it automatically — students see Correct / Wrong straight away (turn off for opinion questions)</label>`;
      else if (it.type === "match") inner = `<p class="am-qt">${esc(it.text)}</p><div class="am-pairs">${it.pairs.map((p) => `<span>${esc(p[0])}</span><span>→</span><span>${esc(p[1])}</span>`).join("")}</div>`;
      const switchTo = it.type === "open" ? `<button class="am-mini" data-tf="${i}">Make it True/False</button>` : it.type === "tf" ? `<button class="am-mini" data-open="${i}">Make it a written answer</button>` : "";
      return `<div class="am-card ${markable(it) ? "" : "need"}">${del}<div class="am-kind"><span class="am-n">${n}</span>${KINDS[it.type]}${switchTo}</div>${inner}</div>`;
    };
    const wire = () => {
      $(".am-title", body).oninput = (e) => (act.title = e.target.value);
      $(".am-emo.big", body).onclick = () => { act.emoji = EMOJIS[(EMOJIS.indexOf(act.emoji) + 1) % EMOJIS.length]; $(".am-emo.big", body).textContent = act.emoji; };
      $$("[data-pick]", body).forEach((b) => b.onclick = () => { const [i, k] = b.dataset.pick.split(":").map(Number); act.items[i].answer = k; draw(); });
      $$("[data-gap]", body).forEach((x) => x.oninput = () => { const [i, g] = x.dataset.gap.split(":").map(Number); act.items[i].answers[g] = x.value; });
      $$("[data-model]", body).forEach((x) => x.oninput = () => { const it = act.items[+x.dataset.model]; if (!it.model && x.value && !it.markSet) { it.mark = true; const c = $(`[data-mark="${x.dataset.model}"]`, body); if (c) c.checked = true; } it.model = x.value; });
      $$("[data-mark]", body).forEach((x) => x.onchange = () => (act.items[+x.dataset.mark].mark = x.checked, act.items[+x.dataset.mark].markSet = true));
      $$("[data-text]", body).forEach((x) => x.oninput = () => (act.items[+x.dataset.text].text = x.textContent.trim()));
      $$("[data-del]", body).forEach((b) => b.onclick = () => { act.items.splice(+b.dataset.del, 1); draw(); });
      $$("[data-tf]", body).forEach((b) => b.onclick = () => { const it = act.items[+b.dataset.tf]; act.items[+b.dataset.tf] = { type: "tf", text: it.text, options: ["True", "False"], answer: pickAnswer(it.model, ["True", "False"]) }; draw(); });
      $$("[data-open]", body).forEach((b) => b.onclick = () => { const it = act.items[+b.dataset.open]; act.items[+b.dataset.open] = { type: "open", text: it.text, model: it.answer != null ? it.options[it.answer] : "" }; draw(); });
      $(".am-back2", body).onclick = () => (after ? after(src) : library());
      const keep = (thenPlay) => {
        act.title = act.title.trim() || "My activity";
        const list = load().filter((x) => x.id !== act.id);
        list.push(act);
        if (!save(list)) return;
        CP().toast("💾 Saved in My activities"); CP().beep("up");
        after ? after(act) : thenPlay ? play(act) : library();
      };
      $(".am-keep", body).onclick = () => keep(false);
      $(".am-keep-play", body).onclick = () => keep(true);
    };
    draw();
  }

  function play(act) {
    const el = ctx.stage(`${esc(act.emoji || "📄")} ${esc(act.title)}`);
    $(".lc-stage-extra", el).innerHTML = `<button class="btn am-print" style="margin-right:8px" title="Print a paper worksheet (or save it as a PDF) — every answer box is left empty">🖨️ Print worksheet</button><button class="btn ghost am-back">‹ My activities</button>`;
    $(".am-back", el).onclick = library;
    $(".am-print", el).onclick = () => printSheet(act);
    const body = $(".lc-stage-body", el);
    body.innerHTML = `<iframe class="lc-frame" title="${esc(act.title)}" sandbox="allow-scripts"></iframe><div class="am-after" hidden></div>`;
    $(".lc-frame", body).srcdoc = buildHtml(act);
    const onMsg = (e) => {
      if (e.source !== $(".lc-frame", body)?.contentWindow || e.data?.type !== "cp-activity") return;
      const after = $(".am-after", body); after.hidden = false;
      if (e.data.total && e.data.got / e.data.total >= .8) CP().confetti(80);
      ctx.starPicker(after, `📄 ${act.title}`, { label: `${e.data.name ? esc(e.data.name) + ": " : ""}${e.data.got}/${e.data.total} — give stars to:` });
    };
    window.addEventListener("message", onMsg);
    ctx.onClose(() => window.removeEventListener("message", onMsg));
  }

  // Every question goes to Live play: blanks get options from the word bank / other answers (or are typed),
  // matching becomes one question per pair, written answers are typed and shown on the board as a word wall.
  function liveQuestions(act) {
    const mix = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const first = (s) => String(s || "").split("/")[0].trim();
    const bank = act.items.filter((i) => i.type === "info" && i.kind === "bank").flatMap((i) => i.words);
    const others = act.items.filter((i) => i.type === "blank").flatMap((i) => i.answers.map(first)).filter(Boolean);
    const out = [];
    act.items.forEach((it) => {
      if (it.type === "mcq" || it.type === "tf") out.push({ q: it.text, options: it.options, answer: it.answer != null ? it.options[it.answer] : null });
      else if (it.type === "blank") it.segs.filter((x) => typeof x !== "string").forEach((g) => {
        const q = it.segs.map((x) => (typeof x === "string" ? x : x.g === g.g ? " _____ " : " … ")).join("").replace(/\s+/g, " ").trim();
        const ans = first(it.answers[g.g]);
        let options = g.choices;
        if (!options && ans) { const pool = [...new Set([...bank, ...others])].filter((x) => norm(x) !== norm(ans)); if (pool.length >= 2) options = mix([ans, ...mix(pool).slice(0, 3)]); }
        out.push(options ? { q, options, answer: ans || null } : { q, kind: "type", options: [], answer: ans || null });
      });
      else if (it.type === "open") out.push({ q: it.text, kind: "type", options: [], answer: null, model: it.model });
      else if (it.type === "match") {
        const rights = it.pairs.map((p) => p[1]);
        it.pairs.forEach(([l, r]) => out.push({ q: `🔗 Which one goes with “${l}”?`, options: mix([r, ...mix(rights.filter((x) => x !== r)).slice(0, 3)]), answer: r }));
      }
    });
    return out;
  }

  function live(act) {
    const qs = liveQuestions(act);
    if (!qs.length) return CP().toast("📱 This activity has no questions yet — tap ✏️ Edit to check it");
    if (!ctx.plan) return CP().toast("Open a lesson week first, then Live play");
    window.LiveBoard.board(ctx.stage(`📱 Live play · ${esc(act.title)}`, { jars: false }), ctx.plan, ctx.w, act.title, qs);
  }


  /* ================= Students' devices: each answer is submitted, the board shows names + marks ================= */
  // Uses the Life Competencies app's online-lesson hand-in (mint_lesson / submit_lesson / lesson_submissions_for).
  // The activity itself travels inside the link (gzipped), so nothing about it is stored on the server.
  const b64u = { enc: (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
    dec: (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)) };
  const streamBytes = async (bytes, T) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(T)).arrayBuffer());
  async function pack(act) {
    // big embedded pictures stay out of the link; a placeholder keeps every question's number the same as on the board
    const items = act.items.map((i) => (i.type === "info" && i.kind === "img" && /^data:/.test(i.src) ? { type: "info", kind: "skip" } : i));
    const raw = new TextEncoder().encode(JSON.stringify({ title: act.title, emoji: act.emoji, items }));
    if (window.CompressionStream) return "z" + b64u.enc(await streamBytes(raw, new CompressionStream("gzip")));
    return "j" + b64u.enc(raw);
  }
  async function unpack(p) {
    let bytes = b64u.dec(p.slice(1));
    if (p[0] === "z") bytes = await streamBytes(bytes, new DecompressionStream("gzip"));
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  const KEY_STORE = "class-points-live-key";
  function assign(act) {
    let key = ""; try { key = sessionStorage.getItem(KEY_STORE) || ""; } catch { /* private mode */ }
    const year = ctx.plan?.year;
    const classes = [...new Set(CP().students().filter((s) => !year || s.year === year).map((s) => s.cls).filter(Boolean))];
    const last = act.links ? Object.keys(act.links).pop() : "";
    CP().modal(`<h2>📲 Do it on students' devices</h2>
      <p class="muted">Students open a link (or scan the QR code), type their name and tap <b>Submit</b> on each question. Their names, answers and marks appear on your board straight away, and right answers add ⭐ to their jars.</p>
      ${unkeyed(act) ? `<div class="am-note">⚠️ <b>${unkeyed(act)} question${unkeyed(act) === 1 ? " has" : "s have"} no right answer</b>, so students won't see Correct / Wrong for ${unkeyed(act) === 1 ? "it" : "them"}. <button class="btn ghost" data-fix>✏️ Set the answers first</button></div>` : ""}
      <label class="edit-label">Class <input data-class list="as-classes" value="${esc(last || classes[0] || (year ? `Year ${year}` : "My class"))}" /></label>
      <datalist id="as-classes">${classes.map((c) => `<option value="${esc(c)}">`).join("")}</datalist>
      <label class="edit-label">Teacher key <input data-key type="password" autocomplete="current-password" value="${esc(key)}" placeholder="The school's teacher key (same as Live play)" /></label>
      <p class="lv-err" hidden></p>
      <div class="opts"><button class="btn ghost" data-no>Cancel</button><button class="btn" data-go>🚀 Open for students</button></div>`, (d) => {
      $("[data-no]", d).onclick = () => d.close();
      const fix = $("[data-fix]", d); if (fix) fix.onclick = () => { d.close(); edit(act, false, (a) => assign(a)); };
      $("[data-go]", d).onclick = async () => {
        const btn = $("[data-go]", d), err = $(".lv-err", d);
        const k = $("[data-key]", d).value.trim(), cls = $("[data-class]", d).value.trim() || "My class";
        if (!k) { err.hidden = false; err.textContent = "Type the teacher key first."; return; }
        btn.disabled = true; btn.textContent = "Opening…"; err.hidden = true;
        try {
          const token = await window.Live.rpc("mint_lesson", { p_key: k, p_academic_year: String(new Date().getFullYear()), p_class_id: `cp-${cls}`, p_class_label: cls, p_plan_id: `cp-act-${act.id}`, p_week: 1, p_title: act.title });
          try { sessionStorage.setItem(KEY_STORE, k); } catch { /* private mode */ }
          const list = load(), me = list.find((x) => x.id === act.id);
          if (me) { me.links = { ...(me.links || {}), [cls]: token }; save(list); }
          d.close();
          results(act, { key: k, token, cls });
        } catch (e) { err.hidden = false; err.textContent = "⚠️ " + (/teacher key/i.test(e.message) ? "That teacher key is not right" : e.message); btn.disabled = false; btn.textContent = "🚀 Open for students"; }
      };
    });
  }

  async function results(act, g) {
    const el = ctx.stage(`📲 ${esc(act.title)} · ${esc(g.cls)}`, { jars: false }), body = $(".lc-stage-body", el);
    $(".lc-stage-extra", el).innerHTML = `<button class="btn ghost am-back">‹ My activities</button>`;
    $(".am-back", el).onclick = library;
    const qs = act.items.map((it, i) => ({ it, i })).filter((x) => x.it.type !== "info");
    const link = `${location.origin}${location.pathname.replace(/[^/]*$/, "")}do.html#${g.token}~${await pack(act)}`;
    const noKey = qs.map((q, k) => (markable(q.it) ? 0 : k + 1)).filter(Boolean);
    body.innerHTML = `<div class="as">
      <div class="as-join card"><h3>📲 Join on your device</h3><div class="as-qr"></div>
        <p class="muted small">Scan the code, or open the link your teacher shares</p>
        <div class="as-btns"><button class="btn" data-copy>📋 Copy link</button><a class="btn ghost" href="${esc(link)}" target="_blank" rel="noopener">🔗 Open</a></div>
        <div class="as-stats"><div><b data-n="in">0</b><small>handed in</small></div><div><b data-n="done">0</b><small>finished</small></div><div><b data-n="avg">–</b><small>class average</small></div></div></div>
      <div class="as-board card"><div class="as-head"><h2>🏆 Live results</h2><span class="as-live">● live</span></div>
        ${noKey.length ? `<div class="am-note as-warn">⚠️ <b>Question${noKey.length > 1 ? "s" : ""} ${noKey.join(", ")} ${noKey.length > 1 ? "have" : "has"} no right answer</b>, so ${noKey.length > 1 ? "they" : "it"} can't be marked automatically (✍️).
          <button class="btn" data-fix>✏️ Set the right answers</button><small>Everything already handed in is marked again straight away. Or tap any ✍️ below to mark it yourself.</small></div>` : ""}
        <div class="as-qhead"><span></span><span></span><span>Name</span><span>Marks</span><span class="as-dots">${qs.map((_, k) => `<i>${k + 1}</i>`).join("")}</span></div>
        <div class="as-rows"><p class="muted as-wait">Waiting for the first answers… 👀</p></div>
        <div class="as-key muted small">✅ right · ❌ wrong · ✍️ to mark · ⬜ not answered yet — <b>tap a ✅ ❌ ✍️ to change the mark</b>, tap a name to see their answers</div></div>
    </div>`;
    const fix = $("[data-fix]", body);
    if (fix) fix.onclick = () => edit(act, false, (a) => results(a, g));
    const qr = $(".as-qr", body);
    if (link.length < 2900 && window.QRCode) new window.QRCode(qr, { text: link, width: 220, height: 220, correctLevel: window.QRCode.CorrectLevel.L });
    else qr.innerHTML = `<p class="muted">This activity is too long for a QR code — use 📋 Copy link and share it (Google Classroom, WhatsApp…)</p>`;
    $("[data-copy]", body).onclick = async (e) => { try { await navigator.clipboard.writeText(link); e.target.textContent = "✅ Copied!"; } catch { prompt("Copy this link:", link); } setTimeout(() => (e.target.textContent = "📋 Copy link"), 2000); };

    // Teacher's own marks (tap to change) are kept on this device, per link
    const local = (name) => ({ get: () => { try { return JSON.parse(localStorage.getItem(name) || "{}")[g.token] || {}; } catch { return {}; } },
      set: (v) => { try { const all = JSON.parse(localStorage.getItem(name) || "{}"); all[g.token] = v; localStorage.setItem(name, JSON.stringify(all)); } catch { /* private mode */ } } });
    const MARKS = local("class-points-assign-marks"), STARS = local("class-points-assign-stars");
    const marks = MARKS.get(), starred = new Set(Object.keys(STARS.get()).length ? STARS.get() : []);
    let rows = [], seen = new Set(), alive = true, timer = null, first = true;
    const by = (r) => Object.fromEntries((r.answers || []).map((a) => [a.i, a]));
    const eff = (r, q, a) => { const k = `${r.student}|${q.i}`; return k in marks ? marks[k] : a ? markText(q.it, a.a) : null; };
    const tally = (r) => { const a = by(r); let right = 0, judged = 0, todo = 0; qs.forEach((q) => { if (!a[q.i]) return; const m = eff(r, q, a[q.i]); if (m === null) todo++; else { judged++; right += m; } }); return { right, judged, todo, n: Object.keys(a).length }; };
    const dot = (r, q, a) => { if (!a) return `<i class="n">⬜</i>`; const m = eff(r, q, a), mine = `${r.student}|${q.i}` in marks;
      return `<button class="as-mark ${m === 1 ? "y" : m === 0 ? "x" : "w"} ${mine ? "mine" : ""}" data-m="${esc(r.student)}|${q.i}" title="${esc(a.a || "")}">${m === 1 ? "✅" : m === 0 ? "❌" : "✍️"}</button>`; };
    function setMark(student, i, v) {
      const k = `${student}|${i}`;
      if (v === undefined) delete marks[k]; else marks[k] = v;
      MARKS.set(marks); draw(); stars();
    }
    function draw() {
      const T = new Map(rows.map((r) => [r, tally(r)]));
      const sorted = [...rows].sort((a, b) => T.get(b).right - T.get(a).right || T.get(b).n - T.get(a).n || Date.parse(a.submitted_at) - Date.parse(b.submitted_at));
      const box = $(".as-rows", body);
      if (!sorted.length) return;
      box.innerHTML = sorted.map((r, k) => { const a = by(r), t = T.get(r), fin = t.n >= qs.length;
        return `<div class="as-row ${fin ? "fin" : ""} ${seen.has(r.student + t.n) ? "" : "fresh"}">
          <span class="as-rank">${k < 3 && t.right > 0 ? ["🥇", "🥈", "🥉"][k] : k + 1}</span><span class="as-av">${esc(r.student.slice(0, 1).toUpperCase())}</span>
          <button class="as-name" data-s="${esc(r.student)}">${esc(r.student)}${fin ? " 🏁" : ""}</button>
          <span class="as-score"><span><b>${t.right}</b> / ${t.judged}</span><small>${t.n}/${qs.length} done${t.todo ? ` · ${t.todo} to mark` : ""}</small></span>
          <span class="as-dots">${qs.map((q) => dot(r, q, a[q.i])).join("")}</span></div>`; }).join("");
      sorted.forEach((r) => seen.add(r.student + T.get(r).n));
      $$("[data-s]", box).forEach((b) => b.onclick = () => detail(rows.find((r) => r.student === b.dataset.s)));
      // tap a mark: ✍️ → ✅ → ❌ → back to automatic
      $$("[data-m]", box).forEach((b) => b.onclick = () => { const cut = b.dataset.m.lastIndexOf("|"), student = b.dataset.m.slice(0, cut), i = +b.dataset.m.slice(cut + 1), k = `${student}|${i}`;
        const cur = k in marks ? marks[k] : undefined; setMark(student, i, cur === undefined ? (b.classList.contains("y") ? 0 : 1) : cur === 1 ? 0 : undefined); CP().beep("tick"); });
      const fin = rows.filter((r) => T.get(r).n >= qs.length).length, judged = rows.filter((r) => T.get(r).judged);
      $("[data-n=in]", body).textContent = rows.length; $("[data-n=done]", body).textContent = fin;
      $("[data-n=avg]", body).textContent = judged.length ? Math.round((judged.reduce((s, r) => s + T.get(r).right / T.get(r).judged, 0) / judged.length) * 100) + "%" : "–";
      // per-question % right, in the header
      $$(".as-qhead .as-dots i", body).forEach((x, k) => { const q = qs[k], done = rows.map((r) => { const a = by(r)[q.i]; return a ? eff(r, q, a) : null; }).filter((m) => m !== null);
        x.title = done.length ? `${Math.round((done.filter(Boolean).length / done.length) * 100)}% right` : ""; x.style.setProperty("--p", done.length ? done.filter(Boolean).length / done.length : 0); });
    }
    function stars() {
      const students = CP().students(), ids = [];
      rows.forEach((r) => { const a = by(r); qs.forEach((q) => { const k = `${r.student}|${q.i}`; if (a[q.i] && eff(r, q, a[q.i]) === 1 && !starred.has(k)) { starred.add(k); const s = window.LiveBoard?.matchStudent(r.student, students); if (s) ids.push(s.id); } }); });
      STARS.set([...starred]);
      if (!ids.length) return;
      CP().awardStudents(ids, 1, `📲 ${act.title}`);
      if (!first) { new Set(students.filter((s) => ids.includes(s.id)).map((s) => s.groupId).filter(Boolean)).forEach((gid) => CP().react(gid, "cheer")); CP().beep("up"); }
    }
    async function poll() {
      if (!alive) return;
      try {
        const got = await window.Live.rpc("lesson_submissions_for", { p_key: g.key, p_token: g.token });
        const sig = (list) => (list || []).map((r) => r.student + ":" + (r.answers || []).length).join(",");
        const changed = sig(got) !== sig(rows), more = (got || []).reduce((s, r) => s + (r.answers || []).length, 0) > rows.reduce((s, r) => s + (r.answers || []).length, 0);
        rows = got || [];
        if (changed || first) { draw(); stars(); if (!first && more) CP().beep("tick"); }
        first = false; $(".as-live", body)?.classList.remove("off");
      } catch { $(".as-live", body)?.classList.add("off"); }
      if (alive) timer = setTimeout(poll, 2500);
    }
    function detail(r) {
      const a = by(r), t = tally(r);
      const right = (it) => it.type === "mcq" || it.type === "tf" ? (it.answer != null ? it.options[it.answer] : "") : it.type === "blank" ? it.answers.filter((s) => s.trim()).join(", ") : it.type === "open" ? it.model : it.type === "match" ? it.pairs.map((p) => `${p[0]} → ${p[1]}`).join("; ") : "";
      CP().modal(`<h2>${esc(r.student)} · ${t.right}/${t.judged}</h2>
        <ol class="as-detail">${qs.map((q) => { const x = a[q.i], it = q.it, m = x ? eff(r, q, x) : null, want = right(it);
          return `<li class="${!x ? "n" : m === 1 ? "y" : m === 0 ? "x" : "w"}"><p>${esc(it.text || (it.segs || []).map((s) => (typeof s === "string" ? s : "____")).join(""))}</p>
            <b>${x ? `${m === 1 ? "✅" : m === 0 ? "❌" : "✍️"} ${esc(x.a || "—")}` : "⬜ Not answered yet"}</b>${x && m !== 1 && want ? `<small>Right answer: ${esc(want)}</small>` : ""}
            ${x ? `<span class="as-judge"><button class="btn ghost" data-j="${q.i}:1">✅ Right</button><button class="btn ghost" data-j="${q.i}:0">❌ Wrong</button></span>` : ""}</li>`; }).join("")}</ol>
        <div class="opts"><button class="btn" data-ok>Close</button></div>`, (d) => {
        $("[data-ok]", d).onclick = () => d.close();
        $$("[data-j]", d).forEach((b) => b.onclick = () => { const [i, v] = b.dataset.j.split(":").map(Number); setMark(r.student, i, v); d.close(); detail(r); });
      });
    }
    ctx.onClose(() => { alive = false; clearTimeout(timer); });
    poll();
  }

  /* ================= Printable worksheet (paper copy: every box left empty for students to write in) ================= */
  function printHtml(act) {
    const L = "ABCDEFGH";
    let n = 0;
    const mix = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const total = act.items.filter((i) => i.type !== "info").length;
    const body = act.items.map((it) => {
      if (it.type === "info") {
        if (it.kind === "skip") return "";
        if (it.kind === "h") return `<h2>${esc(it.text)}</h2>`;
        if (it.kind === "img") return `<figure><img src="${esc(it.src)}" alt="${esc(it.alt)}"></figure>`;
        if (it.kind === "bank") return `<div class="bank"><b>Word bank:</b> ${it.words.map((w) => `<span>${esc(w)}</span>`).join("")}</div>`;
        return `<p class="info">${it.kind === "li" ? "• " : ""}${esc(it.text)}</p>`;
      }
      const num = `<span class="no">${++n}.</span>`;
      if (it.type === "mcq") return `<section class="q">${num}<div><p>${esc(it.text)}</p><ol class="opts">${it.options.map((o, k) => `<li><span class="circ"></span><b>${L[k]}.</b> ${esc(o)}</li>`).join("")}</ol></div></section>`;
      if (it.type === "tf") return `<section class="q">${num}<div><p>${esc(it.text)}</p><div class="tf">${it.options.map((o) => `<span><span class="box"></span> ${esc(o)}</span>`).join("")}</div></div></section>`;
      if (it.type === "blank") return `<section class="q">${num}<div><p class="gaps">${it.segs.map((sg) => typeof sg === "string" ? esc(sg) : `<span class="gap"></span>${sg.choices ? `<small> (${sg.choices.map(esc).join(" / ")})</small>` : ""}`).join("")}</p></div></section>`;
      if (it.type === "open") return `<section class="q">${num}<div><p>${esc(it.text)}</p><div class="lines"><i></i><i></i><i></i><i></i></div></div></section>`;
      if (it.type === "match") {
        const right = mix(it.pairs.map((p) => p[1]));
        return `<section class="q">${num}<div><p>${esc(it.text)} <small>Write the letter in the box.</small></p><table class="match">${it.pairs.map((p, k) => `<tr><td>${k + 1}. ${esc(p[0])}</td><td class="lb"><span class="box big"></span></td><td><b>${L[k] || k + 1}.</b> ${esc(right[k])}</td></tr>`).join("")}</table></div></section>`;
      }
      return "";
    }).join("");
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(act.title)}</title>
<style>
@page{size:A4;margin:14mm}
*{box-sizing:border-box}
body{font:12.5pt/1.5 "Nunito","Segoe UI",Arial,sans-serif;color:#111;margin:0;background:#fff}
h1{font-size:19pt;margin:0 0 6px;text-align:center}
.who{display:flex;gap:18px;margin:10px 0 14px;font-weight:700}.who span{flex:1;display:flex;gap:6px;align-items:flex-end}.who i{flex:1;border-bottom:1.5px solid #111;height:1.2em}
.who .sc{flex:0 0 auto}.who .sc i{flex:0 0 60px}
h2{font-size:14pt;margin:16px 0 6px;border-bottom:2px solid #111;padding-bottom:2px;break-after:avoid}
p{margin:0 0 6px}.info{margin:6px 0}
figure{margin:8px 0;text-align:center}figure img{max-width:60%;max-height:45mm}
.q{display:flex;align-items:baseline;gap:8px;margin:10px 0;break-inside:avoid}.q>div{flex:1}.no{font-weight:800;min-width:1.6em}
.opts{list-style:none;padding:0;margin:4px 0 0;display:grid;grid-template-columns:1fr 1fr;gap:4px 18px}.opts li{display:flex;gap:6px;align-items:baseline}
.circ{display:inline-block;width:13px;height:13px;border:1.5px solid #111;border-radius:50%;flex:none;transform:translateY(2px)}
.box{display:inline-block;width:15px;height:15px;border:1.5px solid #111;vertical-align:-3px}.box.big{width:30px;height:26px}
.tf{display:flex;gap:30px;margin-top:4px}
.gaps{line-height:2.2}.gap{display:inline-block;min-width:110px;border-bottom:1.5px solid #111;margin:0 4px}
.lines i{display:block;height:9mm;border-bottom:1px solid #777}
.match{border-collapse:collapse;margin-top:4px;width:100%}.match td{padding:5px 8px;vertical-align:middle}.match .lb{width:46px;text-align:center}
.bank{border:1.5px solid #111;border-radius:6px;padding:6px 10px;margin:8px 0}.bank span{display:inline-block;margin:2px 10px 2px 0}
small{color:#444}
</style></head><body>
<h1>${esc(act.title)}</h1>
<div class="who"><span>Name: <i></i></span><span>Class: <i></i></span><span>Date: <i></i></span><span class="sc">Score: <i></i> / ${total}</span></div>
${body}
</body></html>`;
  }
  function printSheet(act) {
    const f = document.createElement("iframe");
    f.setAttribute("aria-hidden", "true");
    f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(f);
    const d = f.contentDocument; d.open(); d.write(printHtml(act)); d.close();
    const imgs = [...d.images].map((im) => im.complete ? 0 : new Promise((r) => { im.onload = im.onerror = r; }));
    Promise.race([Promise.all(imgs), new Promise((r) => setTimeout(r, 3000))]).then(() => {
      f.contentWindow.focus(); f.contentWindow.print();
      setTimeout(() => f.remove(), 60000);
    });
    CP().toast("🖨️ Choose your printer — or “Save as PDF” to download it");
  }

  function download(act) {
    const blob = new Blob([buildHtml(act)], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (act.title.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").toLowerCase() || "activity") + ".html";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    CP().toast("⬇️ Downloaded — share this file (or host it) so students can do it on their devices");
  }

  window.ActivityMaker = { open, parse, buildHtml, printHtml, liveQuestions, runtime, PAGE_CSS, pack, unpack, markable };
})();
