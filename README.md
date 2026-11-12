# 💰 Finanças do Casal

Dashboard online de contas fixas do Vinícius e da Marcela.

- **Site:** HTML + JavaScript puro (sem instalar nada, sem etapa de build), hospedado no **GitHub Pages**.
- **Login e banco de dados:** **Supabase** (plano gratuito). Cada pessoa tem o próprio e-mail e senha.
- **Várias famílias:** cada família (ex.: um casal) tem os próprios dados; os membros veem tudo junto e uma família **não vê** a outra. Cadastro **só por convite**; cada pessoa pertence a uma família.
- **Segurança:** a separação é feita pelo próprio banco (regras RLS por família), não pela tela.

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

### 2. Criar o primeiro usuário (o cadastro é só por convite)
1. No **SQL Editor**, crie o seu convite (trocando os dados) e rode:
   ```sql
   insert into public.convites (email, nome, familia_nome) values ('seu@email.com', 'Seu nome', 'Nossa família');
   ```
2. Em **Authentication → Users → Add user → Create new user**, crie o seu usuário com esse e-mail e marque **Auto Confirm User**. Você vira dono da família.
3. Dê a você permissão de convidar outras famílias:
   ```sql
   update public.membros set admin = true where email = 'seu@email.com';
   ```
4. Em **Authentication → Sign In / Providers**, deixe **“Allow new users to sign up” ligado** e **“Confirm email” ligado**. Quem não tem convite é recusado pelo banco.
5. O cônjuge e outras famílias você convida pelo app: **Mais → Família**.

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

## Famílias e convites

- **Mais → Família** mostra a sua família, quem está nela e os convites pendentes.
- **Convidar para esta família:** para o cônjuge (ou outra pessoa que deve ver tudo junto). Informe o nome (como vai aparecer em “Quem paga”) e o e-mail.
- **Convidar uma nova família** (só admin): a pessoa ganha uma família separada, com os próprios dados, e depois convida o cônjuge dela.
- Depois de criar o convite, toque em **Compartilhar** e mande a mensagem. A pessoa abre o link, toca em **Criar minha conta**, usa **o mesmo e-mail** do convite, escolhe uma senha e confirma pelo e-mail que chega.
- Donos podem renomear a família e remover membros convidados (um dono não remove o outro).

## Dicas de uso

- **Importar extrato do banco:** em *Gastos → Importar* (ou *Mais → Importar extrato do banco*), escolha o arquivo **OFX** ou **CSV** exportado no app do banco (Nubank, Inter, Itaú, Bradesco, Santander, BB, C6, **Mercado Pago** e outros; também lê planilhas com colunas separadas de crédito e débito). O app lista as compras com a categoria sugerida (e aprende com o que vocês já classificaram), e já deixa **desmarcado** o que não deve entrar: gastos que já estão lançados (mesmo dia e valor), pagamentos de fatura, Pix/transferências recebidas e o que parece conta fixa (luz, aluguel). Revise, escolha se foi no cartão ou no Pix/débito e quem pagou, e toque em *Importar*. Dá para desfazer logo depois.

- **Excluir rápido:** arraste um gasto, conta fixa, renda ou aporte para a esquerda e toque em *Excluir* (ou arraste até o fim). Gastos, rendas e aportes podem ser desfeitos por 5 segundos; contas fixas pedem confirmação.

- **Tutorial:** o botão **?** no topo (ou *Mais → Tutorial do app*) abre um passo a passo de cada tela e a lista de *Primeiros passos*, que se marca sozinha. Ele abre sozinho no primeiro acesso de cada aparelho.

- **Filtro por pessoa:** nas abas *Gastos* e *Metas* há os botões *Todos / Vinícius / Marcela*. Com uma pessoa escolhida, aparecem só os gastos e aportes dela e quanto isso representa do total do casal. Os gastos lançados como “Casal” aparecem só em *Todos*. A escolha fica salva em cada celular; a tela inicial e as contas fixas sempre mostram o casal.

- **Conta que acabou** (ex.: cancelou um streaming): edite e desmarque **Conta ativa**. Ela some dos próximos meses mas o histórico fica. Só use **Excluir** para contas cadastradas por engano.
- **Valor mudou** (ex.: aluguel reajustado): edite o valor. Os meses já pagos mantêm o valor antigo, porque o pagamento guarda o valor do mês.
- **Tipo de conta:** no cadastro escolham *Mesmo valor todo mês* (aluguel), *Valor muda todo mês* (luz, água) ou *Só neste mês* (uma fatura, IPVA — aparece só no mês aberto no app e não se repete). Digitar “1.000” é lido como mil reais.
- **Conta variável** (luz, água, gás): escolha “Valor muda todo mês” no cadastro. Ao marcar como paga, o app pergunta quanto veio a fatura (já sugere a média dos últimos 3 meses). Enquanto não paga, aparece com “~” na frente: é a estimativa.
- **Cartão de crédito:** cadastre em *Mais → Cartões* com o dia de fechamento e de vencimento. Ao lançar um gasto, escolha o cartão em *Pagamento* (e as parcelas, se for parcelado). Contas fixas cobradas no cartão (streaming, internet) entram na fatura marcando o cartão no cadastro da conta. O gasto conta no orçamento do mês da compra pelo valor total; na fatura, entra parcela por parcela.
- **Backup:** de vez em quando, *Contas fixas → Exportar CSV*.
- **Supabase gratuito pausa** o projeto depois de uns 7 dias sem nenhum acesso. Usando toda semana isso não acontece; se pausar, é só entrar no painel do Supabase e clicar em *Restore*.

## Atualizações do banco de dados

Quando uma versão nova precisar de tabelas novas, vem um arquivo `supabase/migracao-XX-....sql`. Basta abrir, copiar tudo, colar no **SQL Editor** do Supabase e clicar em **Run** (uma vez só). Quem está instalando do zero não precisa: o `schema.sql` já inclui todas.

| Arquivo | O que adiciona |
|---|---|
| `migracao-02-gastos.sql` | Gastos variáveis, orçamentos por categoria e contas de valor variável |
| `migracao-03-metas-cartoes.sql` | Metas e aportes, cartões de crédito, faturas e compras parceladas |
| `migracao-04-conta-unica.sql` | Contas “só neste mês” (uma fatura, IPVA) que não se repetem |
| `migracao-05-familias.sql` | Várias famílias, convites e cadastro só por convite (desfazer: `migracao-05-desfazer.sql`) |

## Como as mudanças chegam no app (link de teste)

1. Toda mudança vai primeiro para o ramo **`teste`** do GitHub.
2. O GitHub roda os **testes automáticos** (pasta `testes/`: separação entre famílias no banco, migrações, telas, importação de extratos). Se algum falhar, nada é publicado.
3. Passando, a versão aparece no **link de teste**: `https://SEU-USUARIO.github.io/financas-casal/teste/`. Ele roda sempre em **modo demonstração** (dados de exemplo, só no celular de quem testa): não toca nos dados reais.
4. Depois do “pode subir”, a mudança é levada para o ramo **`main`**, que é o app de verdade.

Para rodar os testes no computador: `cd testes && npm install && npx playwright install chromium && npm test`.

## Backup semanal

O GitHub faz um backup do banco toda segunda (arquivo criptografado, guardado 90 dias em *Actions → Backup semanal*). Para ligar, cadastre em **Settings → Secrets and variables → Actions → New repository secret**:
- `SUPABASE_DB_URL`: no Supabase, botão **Connect** → *Session pooler* → copie a URI e troque `[YOUR-PASSWORD]` pela senha do banco.
- `BACKUP_SENHA`: uma senha forte inventada por vocês (guarde bem: sem ela o backup não abre).

As instruções para abrir e restaurar estão no começo de `.github/workflows/backup.yml`.

## Estrutura

```
index.html            página única do app
manifest.webmanifest  permite instalar como app na tela de início
icons/                ícones do app
css/style.css         visual (claro/escuro automático, feito primeiro para celular)
js/config.js          URL/chave do Supabase, categorias padrão
js/*.js               lógica do app, um arquivo por assunto (nucleo, auth, dados, telas,
                      gastos, cartoes, metas, acoes, eventos, tutorial, familia,
                      importar, arrastar, demo; inicio.js carrega por último)
testes/               testes automáticos (banco e telas)
.github/workflows/    testes, publicação do link de teste e backup semanal
supabase/schema.sql   tabelas + regras de segurança (instalação do zero)
supabase/migracao-*   atualizações do banco para quem já instalou
```

## Próximos passos possíveis
- Avisos de vencimento por e-mail
