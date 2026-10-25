# speclint

Детерминированный линтер согласованности спецификаций для SDD-репозиториев. Первый поддерживаемый формат — OpenSpec.

Статус: M2 — один корень `openspec/` или несколько корней из `speclint.json` (монорепо), правила ссылок и дельт: `ref-dangling`, `ref-archived`, `address-collision`, `delta-target-missing`, `delta-target-exists`, `delta-overlap`, `ref-external-unchecked`. План — [PLAN.md](PLAN.md), требования — [docs/requirements.md](docs/requirements.md), архитектура и контракты — [docs/architecture.md](docs/architecture.md), формат OpenSpec — [docs/openspec-format.md](docs/openspec-format.md).

## Запуск

```bash
npx @haliksar/speclint [путь] [--format text|json]
npx @haliksar/speclint --version
```

Без `путь` проверяется текущая папка; корень — `<путь>/openspec`. Монорепо с несколькими корнями описывается в `<путь>/speclint.json`:

```json
{
  "roots": [
    { "path": "services/auth/openspec", "space": "auth" },
    { "path": "services/billing/openspec", "space": "billing" }
  ]
}
```

С конфигурацией проверяются только перечисленные корни. Ссылка в другой корень — с его пространством: `spec:auth:session/sign-in`; без пространства адрес ищется в своём корне. Ссылка в Markdown — токен `spec:<адрес>`, например `spec:auth/session-timeout#idle-timeout` или `spec:change/add-2fa`.

Коды возврата: `0` — ошибок нет, `1` — есть ошибки, `2` — сломан запуск (неизвестный флаг или формат, нет корня, нечитаемый `speclint.json`).

## Разработка

Node ≥ 20. Тесты — Vitest 4: Vitest 5 требует Node ≥ 22.12.

```bash
npm ci
npm test
```

Сценарные тесты — `test/openspec.test.ts` на фикстурах-репозиториях `test/fixtures/`: `clean` (чистый корпус: вложенная capability, ссылки из изменения на свои дельты, архив, ложные токены вроде `openspec:archive` и `…/spec:…` в URL), `refs` (все случаи ссылок), `deltas` (конфликты дельт и коллизии адресов), `monorepo` (два корня из `speclint.json`: ссылки между ними, одинаковые capability и изменения в разных корнях не конфликтуют, `openspec/` вне конфигурации не читается), `config-*` (ошибки конфигурации, код `2`).

`npm test` сначала собирает `dist/` через `tsc`: сценарные тесты запускают собранный `dist/cli.js` так же, как его запустит `npx`.

- `src/cli.ts` — разбор аргументов и `speclint.json`, коды возврата `2` для ошибок запуска; версия читается из `package.json` рядом с `dist/`.
- `src/model.ts` — модель ядра и слаг имени.
- `src/openspec.ts` — адаптер OpenSpec, один корень за вызов: capability из `specs/**/spec.md`, требования из `## Requirements` вне блоков кода, сценарии — заголовки `####` с непустым телом, дельты четырёх разделов, архив `changes/archive/YYYY-MM-DD-<id>` (дата отбрасывается), токены `spec:` во всех `*.md` корня кроме архива.
- `src/rules.ts` — правила M1 над моделью, по корню отдельно, ссылки с пространством — в корень с этим пространством; как они работают — [docs/architecture.md](docs/architecture.md#как-работают-правила-m1).
- `src/report.ts` — находка, код возврата (`1` только при `error`), отчёты `text` и `json` по контракту из [docs/architecture.md](docs/architecture.md#json-отчёт).

Если `npm install <пакет>` падает с `Cannot read properties of null (reading 'edgesOut')` — это ошибка npm 10 на необязательных peer-зависимостях Vitest; ставить с `--legacy-peer-deps`. `npm ci` по lock-файлу работает без флага.
