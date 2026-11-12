// Supabase de mentira para testes: tabelas em memória, sem regras de segurança (o banco real faz isso)
window.supabase = { createClient() {
  const M = window.__MOCK;
  const err = (m) => ({ data: null, error: { message: m } });
  function from(t) {
    let op = "select", filtros = [], payload = null, single = false, maybe = false, cols = "*";
    const tab = () => { if (!M.tabelas[t]) return null; return M.tabelas[t]; };
    const b = {
      select(c) { if (op === "select") cols = c || "*"; return b; },
      eq(k, v) { filtros.push([k, v]); return b; },
      limit() { return b; },
      insert(r) { op = "insert"; payload = r; return b; },
      update(r) { op = "update"; payload = r; return b; },
      delete() { op = "delete"; return b; },
      single() { single = true; return b; }, maybeSingle() { maybe = true; return b; },
      then(ok, ko) { return Promise.resolve(run()).then(ok, ko); }
    };
    function run() {
      const T = tab(); if (!T) return err(`relation "public.${t}" does not exist`);
      if (cols !== "*" && T.length && !(cols in T[0]) && M.colunasFaltando?.[t]?.includes(cols)) return err(`column ${t}.${cols} does not exist`);
      if (cols !== "*" && M.colunasFaltando?.[t]?.includes(cols)) return err(`column ${t}.${cols} does not exist`);
      const casa = (r) => filtros.every(([k, v]) => r[k] === v);
      if (op === "select") { const rs = T.filter(casa).map((r) => ({ ...r })); return { data: maybe || single ? rs[0] || null : rs, error: null }; }
      if (op === "insert") { const arr = (Array.isArray(payload) ? payload : [payload]).map((r) => ({ id: crypto.randomUUID(), created_at: new Date().toISOString(), ...(M.padroes?.[t] || {}), ...r })); T.push(...arr); return { data: single ? arr[0] : arr, error: null }; }
      if (op === "update") { const rs = T.filter(casa); rs.forEach((r) => Object.assign(r, payload)); return { data: single ? rs[0] : rs, error: null }; }
      if (op === "delete") { M.tabelas[t] = T.filter((r) => !casa(r)); return { data: null, error: null }; }
    }
    return b;
  }
  let sess = M.sessao || null;
  return {
    from,
    auth: {
      async getSession() { return { data: { session: sess } }; },
      async getUser() { return { data: { user: sess?.user } }; },
      async signInWithPassword({ email, password }) { const u = M.usuarios.find((x) => x.email === email && x.senha === password); if (!u) return err("Invalid login credentials"); sess = { user: u }; return { data: { session: sess }, error: null }; },
      async signUp({ email, password }) { return M.signUp ? M.signUp(email, password) : err("Signups not allowed for this instance"); },
      async signOut() { sess = null; M.saiu = true; return { error: null }; },
      onAuthStateChange() {}, async resetPasswordForEmail() { return { error: null }; }, async updateUser() { return { error: null }; }
    }
  };
} };
