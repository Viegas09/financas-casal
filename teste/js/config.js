// =====================================================================
// CONFIGURAÇÃO — preencha com os dados do SEU projeto Supabase
// (Supabase → Project Settings → API)
//
// A "anon key" é pública por natureza: quem protege os dados são as
// regras de segurança (RLS) criadas pelo arquivo supabase/schema.sql.
// NUNCA coloque aqui a "service_role key".
//
// Deixe SUPABASE_URL vazio para abrir em modo demonstração (dados só
// no navegador, sem login).
// =====================================================================
window.CONFIG = {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",

  // Nomes que aparecem em "Responsável" (o app acrescenta "Casal").
  PESSOAS: ["Vinícius", "Marcela"],

  // Categorias sugeridas (dá para digitar outras livremente).
  CATEGORIAS: [
    "Moradia", "Condomínio", "Energia", "Água", "Gás", "Internet e telefone",
    "Transporte", "Saúde", "Seguros", "Assinaturas", "Educação",
    "Pets", "Investimentos", "Outros"
  ],

  // Quantos dias antes do vencimento a conta aparece como "vence em breve".
  DIAS_ALERTA: 5
};
