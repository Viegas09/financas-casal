# 💰 Finanças do Casal

Dashboard online de contas fixas do Vinícius e da Marcela.

- **Site:** HTML + JavaScript puro (sem instalar nada, sem etapa de build), hospedado no **GitHub Pages**.
- **Login e banco de dados:** **Supabase** (plano gratuito). Cada um tem o próprio e-mail e senha; os dois veem os mesmos dados.
- **Segurança:** só quem está na tabela `membros` consegue ler ou alterar qualquer coisa (regras RLS no banco).

## O que o painel faz

Funciona como um app de banco: abas fixas na parte de baixo (no computador viram um menu lateral), cada tela curta e focada, e formulários que sobem de baixo.

| Aba | O que tem |
|---|---|
| **Início** | Cartão com o total do mês, quanto já foi pago, quanto falta e quanto da renda está comprometido; atalhos (nova conta, pagar, nova renda, análises); alertas de contas atrasadas ou vencendo; as 3 próximas contas a pagar. |
| **Contas** | Contas do mês com filtro *A pagar / Pagas / Todas*. Toque no quadrado para marcar como paga (registra quem pagou e quando); toque na conta para editar. O número vermelho na aba mostra quantas estão atrasadas ou vencem hoje. |
| **Análises** | *Categorias* (para onde vai o dinheiro), *Quem paga* (contas do Casal divididas meio a meio) e *6 meses* (histórico). |
| **Mais** | Cadastro de contas fixas e rendas, exportar tudo em CSV (abre no Excel/Google Sheets) e sair. |

Use as setas ‹ › no topo para navegar entre os meses. Cada mês tem os próprios pagamentos, então o histórico fica guardado.

> Abrindo o `index.html` sem configurar nada, o painel entra em **modo demonstração** com dados de exemplo salvos só no seu navegador. Bom para ver como fica antes de configurar.

---

## Como colocar no ar (uns 20 minutos, uma vez só)

### 1. Criar o banco no Supabase
1. Crie uma conta em <https://supabase.com> e clique em **New project** (escolha a região *South America (São Paulo)*). Guarde a senha do banco num lugar seguro.
2. No menu lateral, abra **SQL Editor → New query**, cole todo o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e clique em **Run**.

### 2. Fechar o cadastro público e criar os dois usuários
1. Em **Authentication → Sign In / Providers** (ou *Settings*, dependendo da versão do painel), **desative “Allow new users to sign up”**. Assim ninguém de fora consegue criar conta.
2. Em **Authentication → Users → Add user → Create new user**, crie o seu usuário e o da Marcela (e-mail + senha) e marque **Auto Confirm User**.
3. Volte ao **SQL Editor** e rode (trocando os e-mails):
   ```sql
   insert into public.membros (user_id, nome)
     select id, 'Vinícius' from auth.users where email = 'seu@email.com';
   insert into public.membros (user_id, nome)
     select id, 'Marcela' from auth.users where email = 'email.da.marcela@email.com';
   ```
   Os nomes precisam ser iguais aos de `PESSOAS` em `js/config.js`.

### 3. Ligar o site ao banco
1. No Supabase, abra **Project Settings → API** e copie a **Project URL** e a chave **anon / public**.
2. Cole as duas em [`js/config.js`](js/config.js). **Nunca** use a chave `service_role`.

> A chave *anon* foi feita para ficar no navegador: sozinha ela não dá acesso a nada, porque o banco só libera dados para quem está logado **e** está na tabela `membros`.

### 4. Subir no GitHub e publicar
1. Crie um repositório (ex.: `financas-casal`) e envie todos os arquivos desta pasta.
2. No repositório: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, branch `main`, pasta `/ (root)` → **Save**.
3. Em 1–2 minutos o link aparece ali: `https://SEU-USUARIO.github.io/financas-casal/`.
4. No Supabase, em **Authentication → URL Configuration**, coloque esse link em **Site URL** (é para onde o e-mail de “esqueci minha senha” leva).

**Repositório público ou privado?** No plano gratuito do GitHub, o Pages só publica repositórios **públicos**. Isso é ok aqui: o código fica visível, mas **os dados não** — eles estão no Supabase, protegidos por login. Se preferirem repositório privado, use o plano GitHub Pro ou publique de graça pela [Vercel](https://vercel.com) ou [Netlify](https://netlify.com) conectando o repositório (sem configuração extra: é um site estático).

### 5. Usar
- Abram o link no celular e instalem como app: no **iPhone**, Safari → botão Compartilhar → **Adicionar à Tela de Início**; no **Android**, Chrome → menu ⋮ → **Instalar app** (ou *Adicionar à tela inicial*). Ele abre em tela cheia, sem a barra do navegador, com ícone próprio.
- Comecem pela aba **Rendas**, depois cadastrem as **Contas fixas**. No dia a dia, só marcar ✓ quando pagar.

---

## Dicas de uso

- **Conta que acabou** (ex.: cancelou um streaming): edite e desmarque **Conta ativa**. Ela some dos próximos meses mas o histórico fica. Só use **Excluir** para contas cadastradas por engano.
- **Valor mudou** (ex.: aluguel reajustado): edite o valor. Os meses já pagos mantêm o valor antigo, porque o pagamento guarda o valor do mês.
- **Conta variável** (luz, água): cadastre uma média. Hoje o ✓ registra o valor cadastrado. Se quiserem guardar o valor exato da fatura, dá para acrescentar isso depois.
- **Backup:** de vez em quando, *Contas fixas → Exportar CSV*.
- **Supabase gratuito pausa** o projeto depois de uns 7 dias sem nenhum acesso. Usando toda semana isso não acontece; se pausar, é só entrar no painel do Supabase e clicar em *Restore*.

## Estrutura

```
index.html            página única do app
manifest.webmanifest  permite instalar como app na tela de início
icons/                ícones do app
css/style.css         visual (claro/escuro automático, feito primeiro para celular)
js/config.js          URL/chave do Supabase, nomes, categorias
js/app.js             lógica do painel
supabase/schema.sql   tabelas + regras de segurança
```

## Próximos passos possíveis
- Gastos variáveis (mercado, lazer) com orçamento por categoria
- Metas e aportes de investimento
- Registrar o valor exato pago em contas variáveis
- Avisos de vencimento por e-mail
