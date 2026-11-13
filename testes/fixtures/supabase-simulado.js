// Supabase de mentira para testes: tabelas em memória, sem regras de segurança (o banco real faz isso)
window.supabase = { createClient() {
  const M = window.__MOCK;
  const err = (m) => ({ data: null, error: { message: m } });
  // sem internet simulado: window.__MOCK.semRede = true (ou localStorage "teste-semRede")
  const semRede = () => M.semRede || localStorage.getItem("teste-semRede") === "1";
  const CHAVE = "sb-simulado-auth-token";   // como o Supabase de verdade, a sessão fica guardada no aparelho
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
      if (semRede()) return err("TypeError: Failed to fetch");
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
  let sess = M.sessao || JSON.parse(localStorage.getItem(CHAVE) || "null");
  // canais ao vivo: M.canais[nome] = funções que recebem; M.enviados = avisos mandados por este celular
  M.canais ||= {}; M.enviados ||= [];
  function channel(nome) {
    const c = { nome,
      on(tipo, filtro, cb) { if (tipo === "broadcast") (M.canais[nome] ||= []).push({ evento: filtro.event, cb }); return c; },
      subscribe(cb) { cb?.("SUBSCRIBED"); return c; },
      send(msg) { M.enviados.push({ canal: nome, ...msg }); return Promise.resolve("ok"); } };
    return c;
  }
  // teste chama: __MOCK.receber("plinc-familia:f1") como se outro celular tivesse salvo
  M.receber = (nome, evento = "mudou") => (M.canais[nome] || []).filter((x) => x.evento === evento).forEach((x) => x.cb({ event: evento, payload: {} }));
  return {
    from, channel,
    removeChannel(c) { delete M.canais[c.nome]; return Promise.resolve("ok"); },
    auth: {
      async getSession() { return { data: { session: sess } }; },
      async getUser() { return semRede() ? { data: { user: null }, error: { name: "AuthRetryableFetchError", message: "Failed to fetch" } } : { data: { user: sess?.user } }; },
      async signInWithPassword({ email, password }) { const u = M.usuarios.find((x) => x.email === email && x.senha === password); if (!u) return err("Invalid login credentials"); sess = { user: u }; localStorage.setItem(CHAVE, JSON.stringify(sess)); return { data: { session: sess }, error: null }; },
      async signUp({ email, password }) { return M.signUp ? M.signUp(email, password) : err("Signups not allowed for this instance"); },
      async signOut() { sess = null; localStorage.removeItem(CHAVE); M.saiu = true; return { error: null }; },
      onAuthStateChange() {}, async resetPasswordForEmail() { return { error: null }; }, async updateUser() { return { error: null }; }
    }
  };
} };
