# speclint

Детерминированный линтер согласованности спецификаций для SDD-репозиториев. Первый поддерживаемый формат — OpenSpec.

[English](README.md)

Статус: M8 — один корень `openspec/` или несколько корней из `speclint.json` (монорепо), правила ссылок и дельт: `ref-dangling`, `ref-archived`, `address-collision`, `delta-target-missing`, `delta-target-exists`, `delta-overlap`, `ref-external-unchecked`; реестр решений: `decision-inactive-ref`, `decision-no-rationale`, `decision-status-invalid`, `decision-supersede-missing`, `decision-supersede-cycle`; покрытие тестами: `test-ref-dangling`, `scenario-untested`; мультирепо через опубликованный манифест: `dependency-missing`, `scenario-untested-anywhere`; дословные шаги сценария в тестах: `scenario-steps-missing`; шум и ложные срабатывания полевого теста убраны. План — [PLAN.md](PLAN.md), требования — [docs/requirements.md](docs/requirements.md), архитектура и контракты — [docs/architecture.md](docs/architecture.md), формат OpenSpec — [docs/openspec-format.md](docs/openspec-format.md).

## Запуск

```bash
npx @haliksar/speclint [путь] [--format text|json]
npx @haliksar/speclint manifest [путь] --release <версия>
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

Решения необязательны: `<корень>/decisions/<id>.md` с front-matter `status: active | superseded | revoked`, `superseded-by: <id>` и разделом `## Rationale` (или `## Обоснование`). Ссылка — `spec:decision/0007-jwt` или `spec:shared:decision/0007-jwt`. Подробно — [docs/architecture.md](docs/architecture.md#реестр-решений-m3).

Покрытие: тест помечается токеном `spec:<адрес>` где угодно в тестовом файле — в имени теста, аннотации, строке или комментарии, на любом языке: `@Spec("spec:auth/sign-in")`, `it("spec:auth/session-timeout#idle-timeout …")`, `# spec:auth/logout`. Метка требования покрывает все его сценарии. Тестовые файлы Kotlin/Java, TypeScript/JS, Swift, Python и Go (`*_test.go`) находятся по конвенциям; свои шаблоны — `"tests": ["**/checks/**"]` в `speclint.json` (заменяют конвенции). В монорепо метка без пространства относится к корню, ближайшему к тесту по папкам. Строка `spec:…` в тесте, чьей capability нет нигде (ни в корнях, ни в зависимостях), — не метка, а чужие данные, например ID вроде `"spec:alpha"`; но если capability отличается от известной на одну-две буквы, это опечатка — ошибка `test-ref-dangling` с подсказкой. Пока на корень нет ни одной метки, вместо предупреждения на каждый сценарий выводится одна info «сценариев без теста: N». `node_modules`, `build`, `Pods`, `.venv` и подобные папки не читаются. Подробно — [docs/architecture.md](docs/architecture.md#покрытие-m4).

Мультирепо: репозиторий-поставщик на релизе печатает манифест `speclint manifest . --release 1.4.0 > identity.manifest.json` (нужен `speclint.json` с пространством у каждого корня) и публикует его как удобно. Потребитель коммитит копию к себе и фиксирует версию:

```json
{
  "roots": [{ "path": "openspec", "space": "web" }],
  "dependencies": {
    "identity": { "manifest": "speclint/identity.manifest.json", "version": "1.4.0" },
    "legacy": { "unchecked": true }
  }
}
```

Ссылки и метки `spec:identity:…` сверяются с копией без сети теми же правилами, что локальные; пространство без записи в `dependencies` — ошибка `dependency-missing`, `unchecked` — info. Сценарий, не покрытый ни здесь, ни в тестах репозиториев из известных манифестов, — `scenario-untested-anywhere`; о сценарии зависимости потребитель сообщает, только если сам ссылается на него, его требование или capability. Чтобы поставщик видел покрытие у потребителей, он объявляет их манифесты в своих `dependencies`: метки потребителей засчитываются его сценариям. Подробно — [docs/architecture.md](docs/architecture.md#манифест-m5).

Шаги: если на сценарий (или его требование) есть метка, каждый его шаг — строка с `GIVEN`/`WHEN`/`THEN`/`AND`/`BUT`, без маркера списка и `**` — должен дословно встретиться среди строковых литералов тестовых файлов с этой меткой: `- **WHEN** the user enters a valid password` в спеке → `step("WHEN the user enters a valid password")` в тесте. Литералы всех файлов с меткой складываются; комментарии не считаются. Нет шага — предупреждение `scenario-steps-missing` на строке сценария с подсказкой похожей строки. Шаги внешних сценариев сверяются по манифесту формата `2` (с M6 `speclint manifest` печатает их в `steps`). Подробно, включая что понимает лексер строк в каждом языке, — [docs/architecture.md](docs/architecture.md#шаги-m6).

Правила настраиваются в `speclint.json`: `"rules": { "scenario-steps-missing": "off", "scenario-untested": "error" }` — `off` выключает правило, `error`/`warning`/`info` меняют уровень. При промахе по требованию или сценарию в пределах двух букв сообщение подсказывает похожий адрес; тире в метке читается как дефис.

Ограниченные контексты (M10): у корня в `speclint.json` можно задать `class` (`core`, `supporting`, `generic`) и `uses` — пространства, от которых контекст зависит. Ссылка в пространство вне `uses` — `context-dependency-undeclared`, цикл в `uses` — `context-cycle`; в `core` сценарий без теста — ошибка; сценарий, повторяющий шаги другого, — `scenario-duplicate`.

Сила покрытия (M11): `textChecks` и `behaviourChecks` в `speclint.json` — строки, по которым тест считается чтением исходников или проверкой поведения. Сценарий, все тесты которого только читают исходники, — `scenario-tested-by-text` (info).

Аудит мутацией (M12, Go): `speclint mutate [путь] [--scope orders:review] [--budget 3]` для каждого сценария находит Go-тесты под метками, снимает их покрытие и инвертирует покрытые условия `if`, которые делит меньше всего других сценариев. Если тесты сценария всё равно проходят, мутация перепроверяется всеми тестами пакета, и в отчёт попадает, только если пережила их все: этот код не держит ни один тест. Выжившую смотрит человек — мутант может быть эквивалентным. Код `1`, если выжила хотя бы одна. Файлы временно меняются и восстанавливаются — запускать на копии.

Коды возврата: `0` — ошибок нет, `1` — есть ошибки, `2` — сломан запуск (неизвестный флаг или формат, нет корня, нечитаемый `speclint.json` или манифест, версия манифеста не совпадает с зафиксированной).

## Разработка

Node ≥ 20. Тесты — Vitest 4: Vitest 5 требует Node ≥ 22.12.

```bash
npm ci
npm test
```

Сценарные тесты — `test/openspec.test.ts` на фикстурах-репозиториях `test/fixtures/`: `clean` (чистый корпус: вложенная capability, ссылки из изменения на свои дельты, архив, ложные токены вроде `openspec:archive` и `…/spec:…` в URL), `refs` (все случаи ссылок), `deltas` (конфликты дельт и коллизии адресов), `monorepo` (два корня из `speclint.json`: ссылки между ними, одинаковые capability и изменения в разных корнях не конфликтуют, `openspec/` вне конфигурации не читается), `decisions` (реестр решений в двух корнях: ссылки между корнями, цепочки замен, ошибки реестра), `coverage` (тесты на четырёх языках, метки в рабочем коде, `node_modules` и `build` не читаются), `coverage-monorepo` (`tests` из `speclint.json`, корень теста по папкам, тест вне корней), `multirepo` (`identity` — поставщик, `web` — потребитель с копией манифеста `identity` 1.4.0, `unchecked` и отсутствующим манифестом, `web-stale` — зафиксирована другая версия; эталон `web/speclint/identity.manifest.json` — заодно ожидаемый вывод `speclint manifest identity --release 1.4.0`; `web-v1` — копия манифеста формата `1` без шагов), `steps` (шаги сценариев на четырёх языках: объединение литералов по адресу, метка требования, многострочные, сырые и f-строки, шаги в комментариях и в именах в обратных кавычках не считаются, подсказка похожей строки), `unmarked` (корень без меток — одна сводная info; строка `"spec:alpha"` без такой capability — не метка), `typo` (опечатка в capability метки), `go` (Go-тесты по конвенции, сырые строки, тире в метке, подсказка похожего сценария), `go-rules` (`rules` в `speclint.json`), `ticketly` (организация из пяти репозиториев с 20 заложенными дефектами из полевого теста — тест фиксирует полный вывод каждого репозитория и что закоммиченные копии манифестов равны выводу `speclint manifest`; после правки фикстуры манифесты пересобираются этой командой: `org` 1.2.0 и `web` 2.0.0 → `platform/speclint/`, `platform` 3.0.0 → `android`, `ios`, `web`), `config-*` (ошибки конфигурации, код `2`). Тесты M1–M3 не проверяют `scenario-untested` (хелпер `uncovered`), тесты M4 — `scenario-steps-missing` (хелпер `withoutSteps`): не их предмет. `test/cli.test.ts` — версия, ошибки запуска, отчёт больше буфера канала (64 КБ) выводится целиком. `test/literals.test.ts` — технические тесты лексера строк на краевые случаи. Vitest берёт только `test/*.test.ts` (`vitest.config.ts`) — тестовые файлы фикстур не запускаются; `.gitignore` не скрывает `node_modules` внутри фикстур.

`npm test` сначала собирает `dist/` через `tsc`: сценарные тесты запускают собранный `dist/cli.js` так же, как его запустит `npx`.

- `src/cli.ts` — разбор аргументов, команды `manifest` и `speclint.json`, загрузка манифестов зависимостей, коды возврата `2` для ошибок запуска; версия читается из `package.json` рядом с `dist/`.
- `src/model.ts` — модель ядра, слаг имени и шаги сценария для M6.
- `src/openspec.ts` — адаптер OpenSpec, один корень за вызов: capability из `specs/**/spec.md`, требования из `## Requirements` вне блоков кода, сценарии — заголовки `####` с непустым телом, дельты четырёх разделов, архив `changes/archive/YYYY-MM-DD-<id>` (дата отбрасывается), токены `spec:` во всех `*.md` корня кроме архива, решения из `decisions/*.md` (front-matter `key: value`, раздел обоснования).
- `src/tests.ts` — поиск тестовых файлов (конвенции или `tests`, пропуск `node_modules` и т. п.), корень-владелец теста, метки `spec:` тем же токеном, что в Markdown; литералы файлов с метками.
- `src/literals.ts` — лексер строковых литералов: режим по расширению (Python, JS/TS, прочие), комментарии пропускаются, экранирование кавычек и `\\` раскрывается, интерполяция и сырые строки — как написаны, регулярные выражения JS/TS — эвристика.
- `src/manifest.ts` — манифест из корпусов и покрытия (упорядоченный JSON) и обратно: корпус зависимости из манифеста, история `removed`/`renamed` — дельтами архивных изменений, чтобы работали те же правила.
- `src/rules.ts` — правила M1, реестра решений и покрытия над моделью, по корню отдельно, ссылки с пространством — в корень с этим пространством или в корпус зависимости из манифеста; как они работают — [docs/architecture.md](docs/architecture.md#как-работают-правила-m1).
- `src/report.ts` — находка, код возврата (`1` только при `error`), отчёты `text` и `json` по контракту из [docs/architecture.md](docs/architecture.md#json-отчёт).

Если `npm install <пакет>` падает с `Cannot read properties of null (reading 'edgesOut')` — это ошибка npm 10 на необязательных peer-зависимостях Vitest; ставить с `--legacy-peer-deps`. `npm ci` по lock-файлу работает без флага.
