# Sorteio NAKABOX

Site de sorteio para feiras e eventos. A pessoa escaneia o QR code no estande,
preenche nome, WhatsApp e cidade, e recebe um número de ficha. No dia, você abre
o painel com um PIN e clica em **SORTEAR AGORA**.

- Front-end estático: um único `index.html` (HTML, CSS e JavaScript puro).
- Back-end: funções serverless do Vercel em `/api`, Node ESM, **zero dependências npm**.
- Banco: Supabase, acessado só pelas funções, via REST.

O navegador **nunca** fala com o banco: ele só conversa com `/api`. A chave de
serviço do Supabase fica apenas nas variáveis de ambiente do Vercel.

---

## Deploy em 10 minutos (caminho curto)

Se está em cima da hora, siga só isto. O detalhe de cada passo está nas seções
seguintes.

**1. Supabase (≈4 min)**

1. <https://supabase.com> → **New project**. Nome `nakabox-sorteio`, região
   **South America (São Paulo)**. Enquanto ele sobe, siga para o passo 2 em outra aba.
2. Projeto pronto → **SQL Editor** → **New query** → cole todo o `schema.sql` → **Run**.
3. **Project Settings** → **API** → copie **Project URL** e a chave **service_role**.

**2. Vercel (≈4 min)**

1. <https://vercel.com> → **Add New** → **Project** → importe este repositório.
2. **Framework Preset: Other.** Não mexa em build — não existe build.
3. Em **Environment Variables**, cadastre as três (Production, Preview e Development):

   ```
   SUPABASE_URL          = a Project URL do Supabase
   SUPABASE_SERVICE_KEY  = a chave service_role
   ORG_PIN               = o PIN que você vai digitar no evento
   ```

4. **Deploy.**

**3. Publicar a branch certa (≈1 min)**

O sorteio está na branch `claude/nakabox-raffle-site-bmwrqd`. Para o endereço
público servir ele **sem mexer no `main`**:

- Vercel → **Settings** → **Git** → **Production Branch** → troque para
  `claude/nakabox-raffle-site-bmwrqd` → **Save**.
- **Deployments** → no último → **⋯** → **Redeploy**.

> Use o endereço de produção (`...vercel.app`), não o link de *preview*: em
> projetos novos o preview costuma vir com proteção de login ligada, e o pessoal
> do evento bateria numa tela de senha.
>
> A alternativa é dar merge no PR e deixar a produção no `main` — só lembre que
> isso troca o endereço da página do produto no GitHub Pages, que passa a ser
> `/bau-87.html`.

**4. Conferir (≈1 min)**

Abra o site no celular, faça uma inscrição de teste, entre no painel pelo link
**organizador** do rodapé, clique em **SORTEAR AGORA** e depois em **Apagar tudo**
para zerar antes do evento. Baixe o QR pelo botão **Baixar PNG para imprimir**.

---

## 1. Criar o banco no Supabase

1. Acesse <https://supabase.com>, crie uma conta e clique em **New project**.
2. Dê um nome (ex.: `nakabox-sorteio`), escolha uma senha para o banco e a região
   **South America (São Paulo)**. Espere uns 2 minutos até o projeto subir.
3. No menu lateral, vá em **SQL Editor** → **New query**.
4. Abra o arquivo `schema.sql` deste repositório, copie todo o conteúdo, cole no
   editor e clique em **Run**. Deve aparecer *Success. No rows returned*.
5. Ainda no Supabase, vá em **Project Settings** → **API** e anote:
   - **Project URL** — algo como `https://abcdefghij.supabase.co`
   - **service_role secret** — a chave longa marcada como `service_role`

> A chave `service_role` dá acesso total ao banco. Ela vai **só** para as
> variáveis de ambiente do Vercel. Nunca coloque no HTML, nunca mande por
> WhatsApp, nunca comite no Git.

---

## 2. Publicar no Vercel

1. Suba este repositório para o GitHub (se ainda não estiver lá).
2. Acesse <https://vercel.com>, entre com a conta do GitHub e clique em
   **Add New** → **Project**.
3. Escolha o repositório e clique em **Import**.
4. Em **Framework Preset**, deixe **Other**. Não precisa configurar build:
   não existe build step.
5. Antes de clicar em Deploy, abra **Environment Variables** e cadastre as três:

   | Nome                   | Valor                                              |
   |------------------------|----------------------------------------------------|
   | `SUPABASE_URL`         | a *Project URL* do passo 1                          |
   | `SUPABASE_SERVICE_KEY` | a chave *service_role* do passo 1                   |
   | `ORG_PIN`              | o PIN que você vai digitar no evento (ex.: `740193`) |

   Marque as três para **Production**, **Preview** e **Development**.
6. Clique em **Deploy** e espere. No fim, o Vercel mostra o endereço do site,
   algo como `https://nakabox-sorteio.vercel.app`.

> Mudou alguma variável depois? Vá em **Settings** → **Environment Variables**,
> edite e depois em **Deployments** → **⋯** → **Redeploy**. As funções só leem os
> valores novos depois de um novo deploy.

**Escolha um PIN com pelo menos 8 caracteres**, misturando letras e números
(ex.: `feira7k2v`), e nada de `123456` ou a data do evento. Quem tem o PIN
sorteia, remove pessoas e apaga a lista. Cada tentativa errada leva meio segundo
a mais para responder, o que atrapalha quem tentar adivinhar por força bruta —
mas um PIN curto ainda é um PIN fraco.

---

## 3. Testar antes do evento

1. Abra o site no celular e faça uma inscrição de teste.
2. Confira se aparece o número da ficha (`NB-1001`, `NB-1002`, ...).
3. Role até o rodapé, toque em **organizador**, digite o PIN e abra o painel.
4. No painel: veja o total, clique em **SORTEAR AGORA**, exporte o CSV.
5. Terminado o teste, use **Apagar tudo** na zona de risco para zerar a lista.

---

## 4. No dia do evento

**Antes de abrir o estande**

- Abra o painel, baixe o QR code em **Baixar PNG para imprimir** e imprima em
  A4 ou cole em um display. O QR aponta para o endereço do próprio site.
- Confirme que a lista está zerada.

**Durante**

- Deixe um celular ou tablet no estande com a tela de inscrição aberta. Depois de
  cada inscrição, a tela volta sozinha para o formulário em 30 segundos.
- Quem preencher duas vezes com o mesmo WhatsApp recebe a mesma ficha de volta,
  sem duplicar.

**Na hora do sorteio**

- Abra o painel, deixe **"não repetir quem já ganhou"** marcado e clique em
  **SORTEAR AGORA**. Os nomes embaralham por 2,5 segundos e o ganhador aparece.
- O sorteio acontece no servidor e já fica gravado no banco: recarregar a página
  não muda o resultado, e o painel continua mostrando o último ganhador.
- Vai sortear vários prêmios? Basta clicar de novo — quem já ganhou fica fora.

**Depois**

- Clique em **Exportar CSV**. O arquivo abre direto no Excel brasileiro
  (separador `;` e BOM UTF-8).
- Se quiser rodar outro sorteio com a mesma lista, use **Zerar sorteados**.

---

## 5. Estrutura dos arquivos

```
index.html             site inteiro: inscrição, confirmação, PIN e painel
api/_db.js             acesso ao Supabase e conferência do PIN
api/inscrever.js       POST público — cria a inscrição
api/participantes.js   POST com PIN — lista todo mundo
api/sortear.js         POST com PIN — sorteia e marca o ganhador
api/remover.js         POST com PIN — apaga um inscrito
api/zerar.js           POST com PIN — zera ganhadores ou apaga tudo
schema.sql             tabela do Supabase
package.json           só marca o projeto como Node ESM
bau-87.html            página antiga do produto (baú 87 L), preservada
```

O número da ficha é derivado do `id` da linha: ficha = `NB-` + (1000 + id).
Não existe coluna de ficha no banco.

---

## 6. Perguntas rápidas

**Dá para usar em mais de um evento?**
Dá. Entre cada evento, use **Apagar tudo** (exporte o CSV antes) ou apenas
**Zerar sorteados** se quiser manter a lista.

**E se a internet do evento cair?**
O site precisa de internet para inscrever e sortear. Leve um chip com 4G de
reserva ou use o roteamento do celular.

**O sorteio é confiável?**
O ganhador é escolhido no servidor com `crypto.randomInt` (gerador criptográfico
do Node) e gravado no banco na mesma requisição. A animação da tela é só visual —
ela não influencia nada, e a página respeita `prefers-reduced-motion`.

**Alguém consegue ler a lista sem o PIN?**
Não. Todas as rotas de leitura exigem o PIN, conferido no servidor. A tabela está
com RLS ligado e sem policies, então nem a chave pública do Supabase lê nada.

**Como troco o PIN no meio do evento?**
Altere `ORG_PIN` no Vercel e faça um *redeploy*. Quem já estava no painel vai
precisar digitar o PIN novo na próxima ação.

---

## 7. Rodar na sua máquina (opcional)

Precisa do [Vercel CLI](https://vercel.com/docs/cli):

```bash
npm i -g vercel
vercel link
vercel env pull .env.local   # baixa SUPABASE_URL, SUPABASE_SERVICE_KEY e ORG_PIN
vercel dev
```

Abrir o `index.html` direto no navegador (sem `vercel dev`) mostra o formulário,
mas nenhuma chamada a `/api` funciona — o próprio site avisa isso na tela.
