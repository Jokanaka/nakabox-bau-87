# Sorteio NAKABOX

Site de sorteio para feiras e eventos. A pessoa escaneia o QR code no estande,
preenche nome, WhatsApp e cidade, e recebe um número de ficha. No dia, você abre
o painel com um PIN e clica em **SORTEAR AGORA**.

- Front-end estático: um único `index.html` (HTML, CSS e JavaScript puro).
- Back-end: funções serverless do Vercel em `/api`, Node ESM, uma única
  dependência npm (`pg`, o driver de Postgres).
- Banco: **Postgres**, acessado só pelas funções, pela variável `DATABASE_URL`.

O navegador **nunca** fala com o banco: ele só conversa com `/api`. A string de
conexão do Postgres fica apenas nas variáveis de ambiente do Vercel.

---

## JÁ ESTÁ NO AR (18/08/2026)

**<https://nakabox-bau-87.vercel.app>**

Está publicado **e configurado** — banco, tabela e PIN já existem. Não precisa
criar conta em lugar nenhum nem cadastrar variável: é só abrir e usar.

O que ficou montado:

| Peça | Onde está |
|------|-----------|
| Projeto Vercel | time `nakabox`, projeto `nakabox-bau-87` |
| Banco | o **mesmo Postgres que a Nakabox já usa** (pooler do Supabase, região São Paulo) |
| Tabela | `public.bau87_participantes` — criada só para o sorteio |
| Variáveis | `DATABASE_URL` e `ORG_PIN`, nas três faixas (Production, Preview, Development) |

> O prefixo `bau87_` na tabela é de propósito: o sorteio divide o banco com os
> outros sistemas da Nakabox e **não encosta em nenhuma tabela deles**.

**O PIN do organizador** foi entregue à parte (não fica escrito neste arquivo,
que é público no GitHub). Perdeu? Troque por um novo — instruções na seção 2.

Para publicar de novo depois de mexer no código, de dentro da pasta do projeto:

```bash
npx vercel --prod --yes
```

> **Por que o deploy pelo site do Vercel não funcionava:** a conta
> (`jokanaka08-6107`) não tem *Login Connection* com o GitHub, então a tela
> **Add New → Project → Import Git Repository** não enxerga este repositório.
> O CLI publica direto da pasta e não precisa dessa conexão.
>
> Quer deploy automático a cada `git push`? Conecte o GitHub primeiro
> (**Account Settings** → **Authentication** → *Connect* GitHub), depois
> **Settings** → **Git** → *Connect Git Repository*, e ponha a **Production
> Branch** em `claude/nakabox-raffle-site-bmwrqd` (é onde o sorteio mora; o
> `main` só tem a página antiga do produto).

---

## 1. O banco

O sorteio guarda tudo numa tabela só, `public.bau87_participantes`, num Postgres
que a Nakabox já tinha. Não há Supabase-SDK, não há chave `service_role`, não há
REST: as funções abrem conexão direta com o Postgres usando o driver `pg`.

Se um dia precisar recriar a tabela (banco novo, restauração, outro ambiente):

```bash
psql "$DATABASE_URL" -f schema.sql
```

ou cole o conteúdo de `schema.sql` no SQL Editor do Supabase e clique em **Run**.
O arquivo é seguro de rodar duas vezes (`create table if not exists`) e não toca
em nada fora do prefixo `bau87_`.

E para apontar o site para **outro** banco, basta trocar a variável:

```bash
npx vercel env add DATABASE_URL production   # cola a nova string de conexão
npx vercel --prod --yes                      # variável nova só vale após novo deploy
```

Formato da string: `postgresql://usuario:senha@host:porta/banco`.

> A `DATABASE_URL` dá acesso total ao banco. Ela vive **só** nas variáveis de
> ambiente do Vercel. Nunca no HTML, nunca por WhatsApp, nunca comitada no Git.

---

## 2. As variáveis de ambiente

São só duas:

| Nome           | Para que serve                                              |
|----------------|-------------------------------------------------------------|
| `DATABASE_URL` | string de conexão do Postgres                               |
| `ORG_PIN`      | o PIN que você digita no painel do evento                   |

Se alguma faltar, o `/api` responde com a mensagem
*"Configuração incompleta no Vercel: falta ..."* dizendo exatamente qual.

**Trocar o PIN** (durante ou depois do evento):

```bash
npx vercel env add ORG_PIN production   # ele pergunta o valor e não mostra na tela
npx vercel --prod --yes                 # as funções só leem o valor novo após deploy
```

Quem já estava no painel vai precisar digitar o PIN novo na próxima ação.

**Escolha um PIN com pelo menos 8 caracteres**, misturando letras e números, e
nada de `123456` ou a data do evento. Quem tem o PIN sorteia, remove pessoas e
apaga a lista. Cada tentativa errada leva meio segundo a mais para responder, o
que atrapalha quem tentar adivinhar por força bruta — mas um PIN curto ainda é
um PIN fraco.

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
api/_db.js             conexão com o Postgres e conferência do PIN
api/inscrever.js       POST público — cria a inscrição
api/participantes.js   POST com PIN — lista todo mundo
api/sortear.js         POST com PIN — sorteia e marca o ganhador
api/remover.js         POST com PIN — apaga um inscrito
api/zerar.js           POST com PIN — zera ganhadores ou apaga tudo
schema.sql             a tabela bau87_participantes
package.json           Node ESM + a dependência pg
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
Não. Todas as rotas de leitura exigem o PIN, conferido no servidor. Toda consulta
usa parâmetros (`$1`, `$2`), então texto digitado por visitante nunca vira comando
SQL. A tabela também está com RLS ligado e sem policies.

**O sorteio pode bagunçar os outros sistemas que usam o mesmo banco?**
Não. Ele só conhece a tabela `bau87_participantes` — nenhuma consulta do código
cita qualquer outra tabela.

---

## 7. Rodar na sua máquina (opcional)

Precisa do [Vercel CLI](https://vercel.com/docs/cli):

```bash
npm install                  # instala o pg
npx vercel link
npx vercel env pull .env.local   # baixa DATABASE_URL e ORG_PIN
npx vercel dev
```

Abrir o `index.html` direto no navegador (sem `vercel dev`) mostra o formulário,
mas nenhuma chamada a `/api` funciona — o próprio site avisa isso na tela.
