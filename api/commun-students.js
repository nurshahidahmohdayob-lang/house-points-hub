// Server-side Commun import for Setup → "Students from Commun". The Commun key stays on Vercel (env COMMUN_KEY) and
// is never sent to the browser; every call needs the teacher password.
//   POST { password }               → { students: [{ communId, name }] }  all active students (list pages)
//   POST { password, ids: [...] }   → { years: { id: 5 | 0 } }            year group from each detail record
// Commun's list has no year; only the detail record has cohort ("Year 5"), and Commun allows 60 calls a minute, so
// the page asks for details in batches of at most 45 and waits between batches.
const crypto = require("crypto");
const BASE = "https://zera-education.commun.cloud/api/v1/students";
const PASS_SHA = "8b42d912a9d46626e3dc9895a15ce1ff70456abc7167d6498c45921336625816";

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const body = req.body || {};
  if (crypto.createHash("sha256").update(String(body.password || "").trim()).digest("hex") !== PASS_SHA) return res.status(401).json({ error: "Wrong password" });
  const key = process.env.COMMUN_KEY;
  if (!key) return res.status(500).json({ error: "COMMUN_KEY is not set on the server" });
  const get = async (url) => {
    const r = await fetch(url, { headers: { Accept: "application/json", Authorization: `Bearer ${key}` } });
    if (r.status === 429) { const e = new Error("Commun says: too many requests — wait a minute"); e.rate = true; throw e; }
    if (!r.ok) throw new Error(`Commun returned ${r.status}`);
    return r.json();
  };
  try {
    if (Array.isArray(body.ids)) {
      const ids = body.ids.map(String).filter((x) => /^\d+$/.test(x)).slice(0, 45);
      const years = {};
      let i = 0;
      await Promise.all(Array.from({ length: 8 }, async () => {
        while (i < ids.length) {
          const id = ids[i++];
          try {
            const d = await get(`${BASE}/${id}`);
            const m = /year\s*(\d{1,2})/i.exec(String(d.cohort || d.class || d.grade || ""));
            years[id] = m ? Number(m[1]) : 0;
          } catch { years[id] = null; } // failed or rate-limited: the page asks again
        }
      }));
      return res.status(200).json({ years });
    }
    const out = [];
    for (let page = 1, last = 1; page <= last && page <= 50; page++) {
      const d = await get(`${BASE}?page=${page}`);
      (d.data || []).filter((s) => s.status === 1).forEach((s) => {
        const name = (s.nric_name || [s.first_name, s.last_name].filter(Boolean).join(" ") || s.preferred_name || "").trim();
        if (name) out.push({ communId: String(s.id), name });
      });
      last = (d.meta && d.meta.last_page) || d.last_page || 1;
    }
    return res.status(200).json({ students: out });
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
};
