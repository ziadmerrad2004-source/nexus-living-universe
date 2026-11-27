// NEXUS client API — thin wrapper over the Supabase RPCs in schema.sql.
// Usage: import { createClient } from "@supabase/supabase-js";
//        const nx = makeNexus(createClient(URL, ANON_KEY));   // anon key is public by design; RLS protects data.
const K = "nexus:tokens:v1";
const load = () => { try { return JSON.parse(localStorage.getItem(K) || "{}"); } catch { return {}; } };
const save = (o) => { try { localStorage.setItem(K, JSON.stringify(o)); } catch {} };

export function makeNexus(sb) {
  const rpc = async (fn, args) => {
    const { data, error } = await sb.rpc(fn, args);
    if (error) throw Object.assign(new Error(error.message), { code: error.code });  // P0403 unauthorized · P0409 conflict · P0429 rate limited · P0400 invalid
    return data;
  };
  const tok = { // "My Access": tokens live only in this browser. Offer an export button — a lost token cannot be recovered.
    get: (kind, id) => load()[`${kind}:${id}`],
    set: (kind, id, t) => { const o = load(); o[`${kind}:${id}`] = t; save(o); },
    all: (kind) => Object.entries(load()).filter(([k]) => k.startsWith(kind + ":")).map(([k, v]) => [k.slice(kind.length + 1), v]),
  };
  return {
    tok,
    stats: () => rpc("universe_stats", {}),
    randomStar: () => rpc("random_star", {}),
    search: (q) => rpc("search_public", { p_q: q }),
    async createStar(nickname, title, content) { const r = await rpc("create_star", { p_nickname: nickname, p_title: title, p_content: content }); tok.set("star", r.id, r.owner_token); return r; },
    async createReply(starId, nickname, content) { const r = await rpc("create_reply", { p_star_id: starId, p_nickname: nickname, p_content: content }); tok.set("reply", r.id, r.author_token); return r; },
    async createPlanet(starId, nickname, name, note, passcode) { const r = await rpc("create_planet", { p_star_id: starId, p_nickname: nickname, p_name: name, p_note: note, p_passcode: passcode }); tok.set("planet-owner", r.id, r.owner_token); return r; },
    async unlockPlanet(id, passcode) { const r = await rpc("unlock_planet", { p_id: id, p_passcode: passcode }); if (r.ok) tok.set("planet-session", id, r.session_token); return r; },
    getPlanet: (id) => rpc("get_planet", { p_id: id, p_token: tok.get("planet-owner", id) || tok.get("planet-session", id) }),
    addPlanetReply: (id, nick, content) => rpc("add_planet_reply", { p_id: id, p_token: tok.get("planet-owner", id) || tok.get("planet-session", id), p_nickname: nick, p_content: content }),
    editStar: (id, title, content, expected) => rpc("edit_star", { p_id: id, p_token: tok.get("star", id), p_title: title, p_content: content, p_expected: expected ?? null }),
    revokePlanetAccess: (id, token) => rpc("revoke_planet_access", { p_id: id, p_token: token }),
    archiveStar: (id) => rpc("archive_star", { p_id: id, p_token: tok.get("star", id) }),
    restoreStar: (id) => rpc("restore_star", { p_id: id, p_token: tok.get("star", id) }),
    archived: () => rpc("list_archived", { p_tokens: [...tok.all("star"), ...tok.all("planet-owner")].map(([, t]) => t) }),
    report: (nick, type, id, reason) => rpc("submit_report", { p_nickname: nick, p_type: type, p_target: id, p_reason: reason }),
    // Reply moderation: the star owner's token also works. Try author token first, then star owner token.
    setReplyStatus: (replyId, starId, status) => rpc("set_reply_status", { p_id: replyId, p_token: tok.get("reply", replyId) || tok.get("star", starId), p_status: status }),

    // Public reads go straight to RLS-protected tables (only public columns exist there).
    galaxy: async (starId) => {
      const [s, r, p] = await Promise.all([
        sb.from("stars").select("*").eq("id", starId).maybeSingle(),
        sb.from("replies").select("*").eq("star_id", starId).order("created_at"),
        sb.from("planets").select("id,name,nickname,seed,created_at").eq("star_id", starId)]);
      return { star: s.data, replies: r.data || [], planets: p.data || [] };
    },
    // Realtime for PUBLIC tables only. Dedupe by id on the client (events can repeat after reconnect).
    subscribe(onEvent) {
      const ch = sb.channel("nexus-public");
      for (const table of ["stars", "replies", "planets"]) ch.on("postgres_changes", { event: "*", schema: "public", table }, (e) => onEvent(table, e));
      return ch.subscribe(), () => sb.removeChannel(ch);
    },
    // Private planets: NO public channel. Poll with the session token (cheap, and revocation takes effect immediately).
    watchPlanet(id, cb, ms = 5000) { const t = setInterval(() => this.getPlanet(id).then(cb).catch(() => {}), ms); return () => clearInterval(t); },
  };
}
