# speclint

Детерминированный линтер согласованности спецификаций для SDD-репозиториев. Первый поддерживаемый формат — OpenSpec.

Статус: M0 — контракты и каркас, проверок ещё нет. План — [PLAN.md](PLAN.md), требования — [docs/requirements.md](docs/requirements.md), архитектура и контракты — [docs/architecture.md](docs/architecture.md), формат OpenSpec — [docs/openspec-format.md](docs/openspec-format.md).

## Запуск

```bash
npx @haliksar/speclint [путь] [--format text|json]
npx @haliksar/speclint --version
```

Коды возврата: `0` — ошибок нет, `1` — есть ошибки, `2` — сломан запуск (неизвестный флаг или формат).

## Разработка

Node ≥ 20. Тесты — Vitest 4: Vitest 5 требует Node ≥ 22.12.

```bash
npm ci
npm test
```

`npm test` сначала собирает `dist/` через `tsc`: сценарные тесты запускают собранный `dist/cli.js` так же, как его запустит `npx`.

- `src/cli.ts` — разбор аргументов, коды возврата `2` для ошибок запуска; версия читается из `package.json` рядом с `dist/`.
- `src/report.ts` — находка, код возврата (`1` только при `error`), отчёты `text` и `json` по контракту из [docs/architecture.md](docs/architecture.md#json-отчёт).

Если `npm install <пакет>` падает с `Cannot read properties of null (reading 'edgesOut')` — это ошибка npm 10 на необязательных peer-зависимостях Vitest; ставить с `--legacy-peer-deps`. `npm ci` по lock-файлу работает без флага.
