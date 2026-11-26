# ingressa-api

API de venda de ingressos e check-in em tempo real para eventos. O foco é lidar com reservas sob alta concorrência e validar ingressos na entrada (gate) com baixa latência.

> **Estado atual:** fundação do projeto. Já existem servidor HTTP, validação de ambiente, logger, erro de aplicação e todo o ferramental de qualidade (lint, formatação, type-check, git hooks). O domínio (eventos, reservas, check-in) é o próximo passo. Veja o [Roadmap](#roadmap).

---

## Sumário

- [Stack](#stack)
- [Como rodar](#como-rodar)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Scripts](#scripts)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Decisões técnicas](#decisões-técnicas)
- [Qualidade de código e git hooks](#qualidade-de-código-e-git-hooks)
- [Roadmap](#roadmap)

---

## Stack

| Camada                 | Escolha                                                                  |
| ---------------------- | ------------------------------------------------------------------------ |
| Runtime                | Node.js 24+ (ESM)                                                        |
| Linguagem              | TypeScript 5.9 (modo `strict` e flags extras)                            |
| HTTP                   | Fastify 5                                                                |
| Banco                  | PostgreSQL + Prisma 7 com `@prisma/adapter-pg`                           |
| Validação              | Zod 4                                                                    |
| Build / dev            | tsup (esbuild) / tsx                                                     |
| Testes                 | Vitest + Supertest                                                       |
| Qualidade              | ESLint 9 (flat config) + typescript-eslint, Prettier, Husky, lint-staged |
| Gerenciador de pacotes | pnpm                                                                     |

---

## Como rodar

### Pré-requisitos

- **Node.js 24 ou superior.** O `package.json` declara `engines.node >= 24` e o build tem como alvo `node24`.
- **pnpm** (de preferência via Corepack: `corepack enable`).
- **PostgreSQL** acessível, local ou em container.

### Passo a passo

```bash
# 1. Instalar dependências
pnpm install

# 2. Criar o arquivo de ambiente e preencher os valores
cp .env.example .env

# 3. Subir em modo desenvolvimento (watch)
pnpm start:dev
```

Para verificar se está tudo de pé:

```bash
curl http://localhost:3333/health
# {"status":"ok","uptime":1.23,"timestamp":"2026-11-26T12:00:00.000Z"}
```

### Build de produção

```bash
pnpm build   # prisma generate + bundle em dist/
pnpm start   # node --enable-source-maps dist/server.js
```

> **Sobre os scripts de build das dependências:** o pnpm bloqueia, por padrão, scripts de `postinstall`. O [pnpm-workspace.yaml](pnpm-workspace.yaml) libera apenas `esbuild`, `prisma` e `@prisma/engines`, que precisam baixar binários nativos. Se o `pnpm install` reclamar de _ignored builds_, é esse controle agindo. Veja a [decisão sobre o pnpm](#pnpm-com-allowlist-de-scripts-e-versões-exatas).

---

## Variáveis de ambiente

Todas são validadas na inicialização por [src/utils/config/env/index.ts](src/utils/config/env/index.ts). Se alguma for inválida, a aplicação **não sobe** e mostra uma mensagem legível com o problema.

| Variável       | Obrigatória | Padrão                                                              | Descrição                                                                   |
| -------------- | ----------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `DATABASE_URL` | sim         | –                                                                   | Connection string, que precisa começar com `postgres://` ou `postgresql://` |
| `PORT`         | não         | `3000`                                                              | Porta HTTP (o `.env.example` usa `3333`)                                    |
| `HOST`         | não         | `localhost`                                                         | Interface de bind. Use `0.0.0.0` dentro de container                        |
| `NODE_ENV`     | não         | `production`                                                        | `development`, `test` ou `production`                                       |
| `LOG_LEVEL`    | não         | `info`                                                              | `debug`, `info`, `warn` ou `error`                                          |
| `CORS_ORIGINS` | não         | `http://localhost:3000,http://localhost:3002,http://localhost:5173` | Lista separada por vírgula. Valor vazio usa o padrão                        |

Observações:

- **`NODE_ENV` sem valor vira `production`.** Em desenvolvimento, defina `NODE_ENV=development` no `.env`, como já está no exemplo. Com `NODE_ENV=test`, o logger HTTP do Fastify fica desligado para não poluir a saída dos testes.
- As variáveis `POSTGRES_*` e `JWT_SECRET` do `.env.example` são para o docker-compose e a autenticação, que ainda estão no [Roadmap](#roadmap). Hoje o código não as lê.

---

## Scripts

| Script                         | O que faz                                                 |
| ------------------------------ | --------------------------------------------------------- |
| `pnpm start:dev`               | Sobe a API com `tsx watch` (recarrega ao salvar)          |
| `pnpm build`                   | `prisma generate` e bundle ESM com tsup em `dist/`        |
| `pnpm start`                   | Roda o bundle com source maps habilitados                 |
| `pnpm type:check`              | `tsc --noEmit`                                            |
| `pnpm lint` / `lint:fix`       | ESLint com **zero warnings tolerados** / com autocorreção |
| `pnpm format` / `format:check` | Prettier gravando / apenas verificando                    |

---

## Estrutura de pastas

```
src/
├── app.ts                         # Instância do Fastify e rotas (sem listen)
├── server.ts                      # Entry point: listen + graceful shutdown
└── utils/
    ├── config/env/                # Leitura e validação das variáveis de ambiente
    ├── errors/app.error.ts        # Erro base da aplicação
    └── infrastructure/logger/     # Logger estruturado para uso fora do HTTP
```

**`app.ts` e `server.ts` ficam separados de propósito.** O `app` é importável sem abrir porta, então os testes de integração com Supertest usam a instância diretamente, sem subir servidor nem disputar porta.

---

## Decisões técnicas

Cada decisão abaixo traz o motivo e o custo que aceitei com ela.

### Fastify em vez de Express

**Por quê:**

- **Performance.** Uma plataforma de ingressos tem picos muito concentrados, como a abertura de vendas e a entrada no evento. O Fastify tem overhead por request bem menor que o Express, o que dá mais margem para absorver esses picos.
- **Validação e serialização por schema.** Validar a entrada e serializar a resposta a partir de schemas é nativo, e a serialização compilada também é mais rápida que `JSON.stringify` genérico.
- **TypeScript e plugins.** A tipagem é de primeira classe, e o sistema de plugins com encapsulamento combina com a ideia de isolar contextos do domínio em módulos.

**Trade-off:** o ecossistema de middlewares é menor que o do Express, e algumas integrações exigem plugins específicos do Fastify.

### Prisma 7 com driver adapter (`@prisma/adapter-pg`)

**Por quê:**

- **Type-safety de ponta a ponta.** O client é gerado a partir do schema, e as migrations ficam versionadas junto com o código.
- **Driver `pg` nativo.** O adapter usa o driver `pg` em vez do query engine binário. Isso dá controle direto sobre o pool de conexões e deixa a aplicação mais leve para empacotar.

**Trade-off:** depende de `prisma generate` antes do build, por isso o script `build` já inclui esse passo (o `type:check` passará a incluir quando o schema existir). Consultas muito específicas, como locks pessimistas para reserva concorrente, podem precisar de SQL bruto.

### Validação de ambiente com Zod (fail-fast)

Toda a configuração passa por um schema Zod **antes** de qualquer coisa subir. Com isso:

- um `.env` incorreto quebra na inicialização, com mensagem clara, e não minutos depois em produção;
- o resto do código consome `env` já **tipado e convertido** (`PORT` é `number`, `CORS_ORIGINS` é `string[]`) e nunca lê `process.env` diretamente.

### Dois loggers: pino (HTTP) e logger próprio (fora do HTTP)

- **Dentro do ciclo de request**, uso o logger do Fastify (`app.log` / `request.log`, baseado em pino), que já traz contexto do request.
- **Fora do HTTP**, uso [src/utils/infrastructure/logger](src/utils/infrastructure/logger/index.ts): consumers de fila (SQS), scripts e jobs. Esse código não deve depender de uma instância do Fastify para conseguir logar.

O logger próprio emite **JSON em uma linha**, no mesmo formato estruturado que agregadores de log esperam, e respeita o `LOG_LEVEL`. `warn` e `error` vão para `stderr`, os demais para `stdout`.

**Trade-off:** são duas implementações de log convivendo. Se isso incomodar, o logger próprio pode virar um wrapper fino sobre pino sem mudar a interface usada pelo resto do código.

### `AppError` como erro base

Erros de negócio carregam `status` HTTP, um `code` estável para o cliente tratar programaticamente, `details` opcionais e uma flag `expose`. Essa flag separa erros cuja mensagem pode ir para o cliente dos que devem virar um 500 genérico, para não vazar detalhes internos.

### Graceful shutdown

O [server.ts](src/server.ts) trata `SIGINT` e `SIGTERM` chamando `app.close()`. Assim, requests em andamento terminam antes de o processo sair. É o comportamento esperado quando um orquestrador (ECS, Kubernetes) substitui o container durante um deploy.

### tsup para build e tsx para dev (tsc só para type-check)

**Por quê:**

- **Path alias `@/`.** O `tsc` não reescreve os aliases de `paths` no JavaScript emitido, então `@/utils/...` quebraria em runtime. O tsup (esbuild) resolve os aliases no bundle, e o tsx resolve em desenvolvimento.
- **Velocidade.** esbuild compila ordens de grandeza mais rápido que o `tsc`. A checagem de tipos não se perde: ela roda separada em `pnpm type:check` e no hook de pre-push.

**Trade-off:** o build não checa tipos. Um erro de tipo só é pego pelo `type:check`, e por isso ele está no pre-push.

### TypeScript mais estrito que o padrão

Além de `strict`, ativei:

- **`noUncheckedIndexedAccess`:** `array[i]` e `record[key]` passam a ser `T | undefined`, o que obriga a tratar o caso ausente;
- **`exactOptionalPropertyTypes`:** distingue "propriedade ausente" de "propriedade com valor `undefined`".

Em um sistema que lida com reservas e pagamentos, prefiro que o compilador reclame a ter um `undefined` silencioso em runtime.

### pnpm com allowlist de scripts e versões exatas

- **Allowlist de builds** ([pnpm-workspace.yaml](pnpm-workspace.yaml)): só pacotes explicitamente aprovados executam scripts de instalação. Scripts de `postinstall` são um vetor clássico de ataque de supply chain, então qualquer dependência nova que queira rodar código na instalação precisa de aprovação consciente.
- **`save-exact=true`** ([.npmrc](.npmrc)): novas dependências entram com versão fixa, sem `^`. Os builds ficam reprodutíveis e os upgrades são sempre explícitos e revisáveis, nunca um efeito colateral de um `install`.

---

## Qualidade de código e git hooks

### ESLint

Uso o flat config do ESLint 9 ([eslint.config.mjs](eslint.config.mjs)) com as regras recomendadas de `@eslint/js` e `typescript-eslint`. O `eslint-config-prettier` desliga as regras de estilo que conflitariam com o Prettier: **o ESLint cuida de correção e o Prettier cuida de formatação.**

Duas regras merecem destaque:

- **`no-console`** gera warning no projeto inteiro e fica **desligada só em `src/utils/infrastructure/logger/`**. O logger é o único lugar autorizado a escrever no console, e o resto do código usa `logger.*` ou `app.log`.
- **`no-unused-vars`** ignora argumentos com prefixo `_`, que é a convenção para parâmetros exigidos por assinatura mas não usados.

O script `lint` roda com `--max-warnings=0`. Um warning que ninguém precisa corrigir vira ruído, então aqui warning também quebra.

### Husky e lint-staged

| Hook         | Executa                                                                       | Por quê                                                                                                                           |
| ------------ | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `pre-commit` | `lint-staged`: `eslint --fix` e `prettier --write` **só nos arquivos staged** | Rápido o bastante para não atrapalhar o fluxo de commit                                                                           |
| `pre-push`   | `type:check`, `lint` e `format:check` no projeto inteiro                      | O type-check precisa do projeto todo e é lento demais para cada commit. O push é o último ponto antes de o código sair da máquina |

A configuração do lint-staged fica em [lint-staged.config.mjs](lint-staged.config.mjs), e não no `package.json`. Assim o `package.json` fica restrito a metadados e dependências, e o arquivo `.mjs` aceita comentários e lógica, se um dia for preciso.

Os hooks são instalados automaticamente pelo script `prepare` ao rodar `pnpm install`.

---

## Roadmap

- [ ] `docker-compose.yml` com PostgreSQL (as variáveis `POSTGRES_*` do `.env.example` já estão previstas)
- [ ] Schema do Prisma e primeiras migrations
- [ ] Error handler global do Fastify mapeando `AppError` para respostas HTTP
- [ ] CORS usando `CORS_ORIGINS`, que já é validada no env
- [ ] Autenticação (Cognito / JWT)
- [ ] Domínio de eventos e ingressos
- [ ] Reserva com controle de concorrência e idempotência
- [ ] Check-in em tempo real via WebSocket
- [ ] Integrações AWS (S3, SQS) e webhooks
- [ ] Suíte de testes com Vitest e script `test` no pre-push
