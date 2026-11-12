# 💰 Finanças do Casal

Dashboard online de contas fixas do Vinícius e da Marcela.

- **Site:** HTML + JavaScript puro (sem instalar nada, sem etapa de build), hospedado no **GitHub Pages**.
- **Login e banco de dados:** **Supabase** (plano gratuito). Cada um tem o próprio e-mail e senha; os dois veem os mesmos dados.
- **Segurança:** só quem está na tabela `membros` consegue ler ou alterar qualquer coisa (regras RLS no banco).

## O que o painel faz

Funciona como um app de banco: abas fixas na parte de baixo (no computador viram um menu lateral), cada tela curta e focada, e formulários que sobem de baixo (arraste para baixo para fechar).

| Aba | O que tem |
|---|---|
| **Início** | Cartão com o total do mês, rosca de quanto já foi pago, quanto falta e quanto da renda está comprometido (o 👁 esconde os valores); atalhos (nova conta, pagar, nova renda, análises); alertas de contas atrasadas ou vencendo; as 3 próximas contas a pagar. |
| **Contas** | Contas do mês com filtro *A pagar / Pagas / Todas*. Toque no quadrado para marcar como paga (registra quem pagou e quando; aparece “Desfazer” por 5 s); toque na conta para editar. Cada conta ganha um ícone automático pela categoria ou nome. O número vermelho na aba mostra quantas estão atrasadas ou vencem hoje. |
| **Gastos** | Gastos do dia a dia (mercado, delivery, lazer…). *Orçamento*: quanto já foi gasto em cada categoria contra o limite do mês, quanto resta e quanto dá para gastar por dia. Toque numa categoria para ver só os gastos dela. *Extrato*: os lançamentos dia a dia, como no app do banco. *Cartões*: a fatura de cada cartão no mês (aberta, fechada, vencida ou paga), com compras parceladas e contas fixas cobradas no cartão, e quanto do limite está usado. |
| **Metas** | Reserva de emergência, viagem, entrada do apartamento… Cada meta mostra quanto já foi guardado, quanto falta e quanto guardar por mês para chegar no prazo (ou, sem prazo, quando chegam no ritmo atual). Toque numa meta para ver o histórico e registrar *Guardar* ou *Retirar*. |
| **Mais** | Cadastro de contas fixas, rendas, orçamentos (limite mensal por categoria de gasto) e cartões; *Análises e gráficos* (por categoria, quem paga o quê, últimos 6 meses); exportar tudo em CSV (abre no Excel/Google Sheets) e sair. |

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

- **Tutorial:** o botão **?** no topo (ou *Mais → Tutorial do app*) abre um passo a passo de cada tela e a lista de *Primeiros passos*, que se marca sozinha. Ele abre sozinho no primeiro acesso de cada aparelho.

- **Filtro por pessoa:** nas abas *Gastos* e *Metas* há os botões *Todos / Vinícius / Marcela*. Com uma pessoa escolhida, aparecem só os gastos e aportes dela e quanto isso representa do total do casal. Os gastos lançados como “Casal” aparecem só em *Todos*. A escolha fica salva em cada celular; a tela inicial e as contas fixas sempre mostram o casal.

- **Conta que acabou** (ex.: cancelou um streaming): edite e desmarque **Conta ativa**. Ela some dos próximos meses mas o histórico fica. Só use **Excluir** para contas cadastradas por engano.
- **Valor mudou** (ex.: aluguel reajustado): edite o valor. Os meses já pagos mantêm o valor antigo, porque o pagamento guarda o valor do mês.
- **Conta variável** (luz, água, gás): marque “Valor muda todo mês” no cadastro. Ao marcar como paga, o app pergunta quanto veio a fatura (já sugere a média dos últimos 3 meses). Enquanto não paga, aparece com “~” na frente: é a estimativa.
- **Cartão de crédito:** cadastre em *Mais → Cartões* com o dia de fechamento e de vencimento. Ao lançar um gasto, escolha o cartão em *Pagamento* (e as parcelas, se for parcelado). Contas fixas cobradas no cartão (streaming, internet) entram na fatura marcando o cartão no cadastro da conta. O gasto conta no orçamento do mês da compra pelo valor total; na fatura, entra parcela por parcela.
- **Backup:** de vez em quando, *Contas fixas → Exportar CSV*.
- **Supabase gratuito pausa** o projeto depois de uns 7 dias sem nenhum acesso. Usando toda semana isso não acontece; se pausar, é só entrar no painel do Supabase e clicar em *Restore*.

## Atualizações do banco de dados

Quando uma versão nova precisar de tabelas novas, vem um arquivo `supabase/migracao-XX-....sql`. Basta abrir, copiar tudo, colar no **SQL Editor** do Supabase e clicar em **Run** (uma vez só). Quem está instalando do zero não precisa: o `schema.sql` já inclui todas.

| Arquivo | O que adiciona |
|---|---|
| `migracao-02-gastos.sql` | Gastos variáveis, orçamentos por categoria e contas de valor variável |
| `migracao-03-metas-cartoes.sql` | Metas e aportes, cartões de crédito, faturas e compras parceladas |

## Estrutura

```
index.html            página única do app
manifest.webmanifest  permite instalar como app na tela de início
icons/                ícones do app
css/style.css         visual (claro/escuro automático, feito primeiro para celular)
js/config.js          URL/chave do Supabase, nomes, categorias
js/app.js             lógica do painel
supabase/schema.sql   tabelas + regras de segurança (instalação do zero)
supabase/migracao-*   atualizações do banco para quem já instalou
```

## Próximos passos possíveis
- Avisos de vencimento por e-mail
