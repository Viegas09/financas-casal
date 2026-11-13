/* Plinc — Service worker: guarda as telas e arquivos do app no celular.
 * • Página (index.html): tenta a internet primeiro (até 3 s); sem resposta, usa a cópia guardada.
 * • Arquivos com ?v= (js/css), ícones e fontes: usa a cópia guardada (abre rápido).
 * • Biblioteca do Supabase (CDN): usa a cópia e atualiza por trás.
 * • Dados (Supabase): nunca passam por aqui — sempre direto do servidor.
 * O link de teste (/teste/) tem o próprio service worker; este aqui não mexe nele.
 */
"use strict";

const VERSAO = "2";
const BASE = new URL("./", self.location).pathname;              // ex.: /financas-casal/ ou /financas-casal/teste/
const PREFIXO = "plinc:" + BASE + ":";
const CACHE = PREFIXO + VERSAO;
const FONTES = ["inter-latin-400-normal", "inter-latin-500-normal", "inter-latin-600-normal", "inter-latin-700-normal",
  "space-grotesk-latin-500-normal", "space-grotesk-latin-700-normal"].map((f) => "fonts/" + f + ".woff2");
const CDN = "cdn.jsdelivr.net";

/** Endereços que a página usa (scripts, css, ícones), lidos do próprio index.html. */
function referenciasDe(html) {
  return [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map((m) => m[1])
    .filter((u) => !/^(https?:|data:|mailto:)/.test(u) || u.includes(CDN));
}

async function guardarTudo(html) {
  const c = await caches.open(CACHE);
  const locais = [...new Set([...referenciasDe(html).filter((u) => !u.startsWith("http")), ...FONTES, "manifest.webmanifest"])];
  await Promise.all(locais.map((u) => c.match(u).then((tem) => tem || c.add(u)).catch(() => {})));
  for (const u of referenciasDe(html).filter((u) => u.includes(CDN))) await c.add(new Request(u, { mode: "cors" })).catch(() => {});
}

/** Apaga versões antigas de js/css que a página nova não usa mais. */
async function limparAntigos(html) {
  const usados = new Set(referenciasDe(html).map((u) => new URL(u, self.location).href));
  const c = await caches.open(CACHE);
  for (const req of await c.keys()) {
    const u = new URL(req.url);
    if (u.origin === self.location.origin && /\.(js|css)$/.test(u.pathname) && u.search && !usados.has(u.href)) await c.delete(req);
  }
}

self.addEventListener("install", (ev) => {
  ev.waitUntil((async () => {
    const r = await fetch("index.html", { cache: "no-store" });
    const html = await r.clone().text();
    const c = await caches.open(CACHE);
    await c.put("./", r);
    await guardarTudo(html);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (ev) => {
  ev.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith(PREFIXO) && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

const comPrazo = (p, ms) => Promise.race([p, new Promise((_, ko) => setTimeout(() => ko(new Error("demorou")), ms))]);

async function pagina(req) {
  const c = await caches.open(CACHE);
  const rede = fetch(req, { cache: "no-store" }).then(async (r) => {
    if (r.ok) {
      const html = await r.clone().text();
      await c.put("./", r.clone());
      guardarTudo(html).then(() => limparAntigos(html)).catch(() => {});
    }
    return r;
  });
  rede.catch(() => {});
  try { return await comPrazo(rede, 3000); }
  catch {
    const guardada = await c.match("./");
    return guardada || rede;   // nunca abriu antes: espera a internet mesmo
  }
}

async function arquivo(req) {
  const c = await caches.open(CACHE);
  const guardado = await c.match(req);
  const versionado = new URL(req.url).search !== "";
  if (guardado && versionado) return guardado;          // ?v= muda a cada atualização: a cópia nunca fica velha
  const novo = fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; });
  if (guardado) { novo.catch(() => {}); return guardado; }   // ícones/fontes: usa a cópia e atualiza por trás
  return novo;
}

async function biblioteca(req) {
  const c = await caches.open(CACHE);
  const guardada = await c.match(req);
  const nova = fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => null);
  return guardada || (await nova) || Response.error();
}

self.addEventListener("fetch", (ev) => {
  const req = ev.request;
  if (req.method !== "GET") return;
  const u = new URL(req.url);
  if (u.hostname === CDN) return ev.respondWith(biblioteca(req));
  if (u.origin !== self.location.origin || !u.pathname.startsWith(BASE)) return;   // Supabase e outros sites: direto
  const resto = u.pathname.slice(BASE.length);
  if (resto.startsWith("teste/")) return;                                          // o link de teste tem o próprio
  if (resto === "" || resto === "index.html") return ev.respondWith(pagina(req));
  if (req.mode === "navigate" || resto.startsWith("plinc/")) return;                // página de venda e outras páginas: direto
  if (/\.(js|css|png|svg|woff2|webmanifest)$/.test(u.pathname)) return ev.respondWith(arquivo(req));
});
