# speclint — архитектура

Контракты зафиксированы в M0. Формат OpenSpec, на котором они построены, — [openspec-format.md](openspec-format.md).

## Слои

```
адаптеры форматов  →  модель ядра  →  правила  →  отчёт (text | json)
(OpenSpec, позже       (требование,     (ссылки,
 Spec Kit, Kiro)        сценарий,        дельты,
                        решение,         решения,
адаптеры тестов    →    изменение,       покрытие)
(Kotlin/Java, TS,       ссылка, метка)
 Swift, Python)
                        манифесты зависимостей (M5)
```

- Правила видят только модель ядра и не знают формата файлов.
- Каждый элемент модели знает свой корень и пространство — так несколько корней (M2) и внешние манифесты (M5) добавляются как источники данных без переделки правил.

## Модель ядра

```ts
type Root        = { path: string; space: string | null }
type Capability  = { root: Root; id: string; file: string }                     // id = "identity/user-auth"
type Requirement = { capability: Capability; name: string; slug: string; line: number; scenarios: Scenario[] }
type Scenario    = { name: string; slug: string; line: number; steps: string[] }
type Change      = { root: Root; id: string; archived: boolean; deltas: Delta[] } // id без даты архива
type Delta       = { change: Change; capability: string; op: "added" | "modified" | "removed" | "renamed";
                     requirement: string; to: string | null; file: string; line: number }
type Reference   = { address: Address; file: string; line: number; change: Change | null }
type Decision    = { id: string; status: "active" | "superseded" | "revoked"; supersededBy: string | null; file: string }  // M3, черновик
type TestMark    = { address: Address; file: string; line: number }            // M4
```

`Reference` — ссылка из Markdown корня, `TestMark` — та же разметка в тестовом файле. `change` у ссылки — изменение, в чьей папке она лежит.

## Адрес (D5)

```
адрес        = [пространство ":"] цель
цель         = capability ["/" требование ["#" сценарий]]
             | "change/" id-изменения
             | "decision/" id-решения                 (M3)
capability   = сегмент {"/" сегмент}                  путь папки относительно specs/
требование   = слаг
сценарий     = слаг
пространство = [a-z0-9-]+
сегмент      = [\p{L}\p{N}_-]+
```

**Слаг** имени требования или сценария: Unicode NFC → нижний регистр → каждая серия символов не из `\p{L}\p{N}` заменяется на `-` → `-` по краям убираются. `Session Timeout` → `session-timeout`, `Тайм-аут сессии (idle)` → `тайм-аут-сессии-idle`.

**Разбор пути.** Capability — самый длинный префикс сегментов, который есть среди capability корня; остаток — ноль или один сегмент (требование). Иначе адрес висячий.

**Префиксы `change/` и `decision/`** зарезервированы: capability с таким первым сегментом не адресуется.

**Где ищется.** Без пространства — в своём корне. С пространством, совпадающим с пространством локального корня (M2), — в нём. С чужим пространством — до M5 находка `ref-external-unchecked`, с M5 — по манифесту зависимости.

**Что считается существующим.** Ссылка из файла изменения X видит основные спеки с применёнными дельтами X (RENAMED → REMOVED → MODIFIED → ADDED, как архивация OpenSpec). Ссылка из любого другого файла видит только основные спеки. Требование, которое есть лишь в чужом открытом изменении, — висячая ссылка с указанием этого изменения в `related`.

### Разметка ссылки (Q2, Q4)

Один токен везде — в Markdown корня и в тестах на любом языке (в имени теста, аннотации, строке или комментарии):

```
spec:auth/session-timeout#idle-timeout
spec:billing:invoices/create
spec:change/add-2fa
```

Токен — `spec:` и адрес до первого символа, который в адрес не входит. Markdown ищется во всех `*.md` корня, кроме `changes/archive/**`: архив — история, ссылки в нём не проверяются.

### Переименование

Адрес строится из текущего имени, поэтому переименование требования меняет адрес. Ссылка на старый слаг — `ref-dangling`; если старый слаг есть в RENAMED FROM открытого или архивного изменения, сообщение называет новый адрес и изменение, а `related` указывает на строку RENAMED. Цепочки переименований прослеживаются до последнего имени.

Два требования одной capability (или два сценария одного требования) с одинаковым слагом — `address-collision`: адрес обязан быть однозначным.

## CLI (D4)

По образцу Clear `req/cli`:

```
speclint [путь] [--format text|json]
speclint --version
```

- `путь` — папка репозитория, по умолчанию текущая. Без конфигурации корень — `<путь>/openspec`.
- Коды возврата: `0` — ошибок нет (предупреждения и info допустимы), `1` — есть хотя бы одна находка уровня `error`, `2` — сломан запуск: неизвестный флаг, неверное значение, нечитаемая конфигурация, корень не найден.
- `--version` печатает версию пакета и выходит с `0`.

### JSON-отчёт

```json
{
  "tool": "speclint",
  "version": "0.1.0",
  "status": "findings",
  "findings": [
    {
      "level": "error",
      "rule": "ref-dangling",
      "file": "openspec/changes/add-2fa/design.md",
      "line": 12,
      "message": "spec:auth/session-timout: требования нет в auth",
      "related": [{ "file": "openspec/specs/auth/spec.md", "line": 40 }]
    }
  ],
  "summary": { "errors": 1, "warnings": 0, "infos": 0, "files": 30 }
}
```

- `status` — `ok`, если ошибок нет, иначе `findings`; дублирует код возврата.
- `level` — `error | warning | info`. `file` — путь относительно аргумента `путь` через `/`; `file` и `line` — `null`, если находка не привязана к месту.
- Находки упорядочены по `file`, `line`, `rule` — отчёт детерминирован.

## Правила

ID латинские, стабильные; уровень — по умолчанию.

| ID | Веха | Уровень | Что |
|---|---|---|---|
| `ref-dangling` | M1 | error | адрес не разрешается: нет capability, требования, сценария, изменения |
| `ref-archived` | M1 | error | ссылка на архивное изменение или на требование, удалённое архивным изменением |
| `address-collision` | M1 | error | два требования capability или два сценария требования дают один слаг |
| `delta-target-missing` | M1 | error | MODIFIED, REMOVED или RENAMED FROM на требование, которого нет в основной спеке и которое не добавляет ни одно другое открытое изменение |
| `delta-target-exists` | M1 | error | ADDED требования, которое уже есть в основной спеке |
| `delta-overlap` | M1 | warning | два открытых изменения трогают одно требование |
| `ref-external-unchecked` | M1 | info | внешний адрес до M5 не проверяется |
| `decision-inactive-ref` | M3 | error | ссылка на заменённое или отменённое решение |
| `decision-no-rationale` | M3 | warning | решение без обоснования |
| `test-ref-dangling` | M4 | error | метка в тесте на несуществующий адрес |
| `scenario-untested` | M4 | warning | у сценария нет ни одной метки в тестах |
| `dependency-missing` | M5 | error | внешнее пространство не объявлено в зависимостях или манифест не найден |
| `scenario-untested-anywhere` | M5 | warning | сценарий не покрыт ни в одном репозитории, чьи манифесты известны |
| `scenario-steps-missing` | M6 | warning | в тесте с меткой сценария нет его шагов дословно среди строковых литералов |

Внутрифайловые проверки `openspec validate` (дубликаты в разделах, конфликты разделов, непарные RENAMED, потеря сценариев) speclint не повторяет — см. [openspec-format.md](openspec-format.md#что-уже-проверяет-openspec-validate).

## Конфигурация (черновик, M2–M5)

Не нужна для одного корня `openspec/`. Файл `speclint.json` в корне репозитория:

```json
{
  "roots": [
    { "path": "services/auth/openspec", "space": "auth" },
    { "path": "services/billing/openspec", "space": "billing" }
  ],
  "tests": ["**/src/test/**", "**/*.test.ts", "**/Tests/**/*.swift", "**/tests/**/*.py"],
  "dependencies": {
    "identity": { "manifest": "speclint/identity.manifest.json", "version": "1.4.0" }
  }
}
```

- `roots` — M2; пространство корня делает его адресуемым из других корней.
- `tests` — M4; glob-шаблоны тестовых файлов.
- `dependencies` — M5; путь к локальной копии манифеста и зафиксированная версия. Способ доставки манифеста — Q5, решается в M5.

## Манифест (черновик, M5)

JSON, публикуется репозиторием на релизе командой `speclint manifest`:

```json
{
  "speclint": 1,
  "space": "identity",
  "version": "1.4.0",
  "requirements": [
    {
      "address": "auth/session-timeout",
      "name": "Session Timeout",
      "scenarios": [
        { "address": "auth/session-timeout#idle-timeout", "name": "Idle timeout", "covered": true }
      ]
    }
  ],
  "decisions": [
    { "address": "decision/0007-jwt", "status": "superseded", "supersededBy": "decision/0012-paseto" }
  ]
}
```

- `speclint` — версия формата манифеста.
- `version` сверяется с зафиксированной в `dependencies`; расхождение — ошибка запуска (`2`).
- Решения — по формату M3 (Q3).
