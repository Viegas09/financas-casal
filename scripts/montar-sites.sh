#!/usr/bin/env bash
# Monta os dois sites do Plinc para a Cloudflare Pages, só com os arquivos públicos
# (testes, supabase, README etc. ficam de fora):
#   dist/app  → app.useplinc.com.br   (o app)
#   dist/site → useplinc.com.br       (página de venda, a que o Google mostra)
# Uso: scripts/montar-sites.sh producao|teste
#   teste = app em MODO DEMONSTRAÇÃO (sem chaves do Supabase) e site fora do Google.
set -euo pipefail
MODO="${1:-producao}"
cd "$(dirname "$0")/.."
if [ "$MODO" = "teste" ]; then
  APP_URL="https://teste.plinc-app.pages.dev"; SITE_URL="https://teste.plinc-site.pages.dev"
else
  APP_URL="https://app.useplinc.com.br"; SITE_URL="https://useplinc.com.br"
fi
rm -rf dist && mkdir -p dist/app dist/site

# ---------- app ----------
cp -r index.html manifest.webmanifest sw.js css js icons fonts dist/app/
printf 'User-agent: *\nDisallow: /\n' > dist/app/robots.txt
cat > dist/app/_headers <<HDR
/*
  X-Robots-Tag: noindex
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
/sw.js
  Cache-Control: no-cache
/index.html
  Cache-Control: no-cache
HDR
if [ "$MODO" = "teste" ]; then
  sed -i 's#SUPABASE_URL: "[^"]*"#SUPABASE_URL: ""#; s#SUPABASE_ANON_KEY: "[^"]*"#SUPABASE_ANON_KEY: ""#' dist/app/js/config.js
  sed -i 's#<title>[^<]*</title>#<title>TESTE · Plinc</title>#; s#Modo demonstração · dados só neste navegador#VERSÃO DE TESTE · dados de exemplo, só neste celular#' dist/app/index.html
  sed -i 's#"name": "[^"]*"#"name": "Plinc (teste)"#; s#"short_name": "[^"]*"#"short_name": "Teste"#' dist/app/manifest.webmanifest
fi

# ---------- site (página de venda na raiz) ----------
cp -r plinc/. dist/site/
cp -r icons fonts dist/site/
S=dist/site/index.html
# caminhos: ../icons → /icons ; links para o app → endereço do app
sed -i "s#\.\./icons/#/icons/#g; s#\.\./fonts/#/fonts/#g; s#href=\"\.\./?#href=\"$APP_URL/?#g; s#href=\"\.\./\"#href=\"$APP_URL/\"#g" "$S"
sed -i "s#\.\./icons/#/icons/#g; s#\.\./fonts/#/fonts/#g" dist/site/*.js 2>/dev/null || true
if grep -q 'href="\.\./' "$S"; then echo "ERRO: sobrou link ../ na página de venda" >&2; grep -n 'href="\.\./' "$S" >&2; exit 1; fi
# informações para o Google e para a prévia no WhatsApp
EXTRA="  <link rel=\"canonical\" href=\"$SITE_URL/\" />\n  <meta property=\"og:url\" content=\"$SITE_URL/\" />\n  <meta property=\"og:image\" content=\"$SITE_URL/img/og.jpg\" />\n  <meta property=\"og:image:width\" content=\"1200\" />\n  <meta property=\"og:image:height\" content=\"630\" />\n  <meta property=\"og:locale\" content=\"pt_BR\" />\n  <meta property=\"og:site_name\" content=\"Plinc\" />\n  <meta name=\"twitter:card\" content=\"summary_large_image\" />\n  <script type=\"application/ld+json\">{\"@context\":\"https://schema.org\",\"@type\":\"SoftwareApplication\",\"name\":\"Plinc\",\"description\":\"App de finanças do casal: contas, gastos, cartões e metas num lugar só.\",\"applicationCategory\":\"FinanceApplication\",\"operatingSystem\":\"Web, iOS, Android\",\"url\":\"$SITE_URL/\",\"inLanguage\":\"pt-BR\",\"offers\":{\"@type\":\"Offer\",\"price\":\"19.90\",\"priceCurrency\":\"BRL\"}}</script>"
sed -i "s#^\(  <meta property=\"og:type\".*\)\$#\1\n$EXTRA#" "$S"
if [ "$MODO" = "teste" ]; then
  printf 'User-agent: *\nDisallow: /\n' > dist/site/robots.txt
  printf '/*\n  X-Robots-Tag: noindex\n' > dist/site/_headers
else
  # no domínio de verdade, o Google pode ler
  sed -i '/enquanto estiver no endereço provisório/d; /<meta name="robots" content="noindex, nofollow" \/>/d' "$S"
  printf 'User-agent: *\nAllow: /\n\nSitemap: %s/sitemap.xml\n' "$SITE_URL" > dist/site/robots.txt
  printf '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>%s/</loc><lastmod>%s</lastmod></url>\n</urlset>\n' "$SITE_URL" "$(date -u +%F)" > dist/site/sitemap.xml
  printf '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n' > dist/site/_headers
fi
echo "Pronto ($MODO): dist/app → $APP_URL · dist/site → $SITE_URL"
