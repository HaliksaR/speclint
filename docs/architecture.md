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
                     requirement: string; to: string | null; file: string; line: number; scenarios: Scenario[] }
type Reference   = { address: string; file: string; line: number; change: Change | null }        // адрес как в тексте, разбирается правилами
type Corpus      = { root: Root; capabilities: Capability[]; requirements: Requirement[]; changes: Change[]; references: Reference[]; decisions: Decision[]; files: number }
type Decision    = { id: string; status: string; supersededBy: string | null; rationale: boolean; file: string }  // M3
type TestMark    = { address: string; root: Root | null; file: string; line: number }  // M4; root — корень-владелец теста
```

`Delta.scenarios` — сценарии блока ADDED/MODIFIED: без них не разрешить `#сценарий` в ссылке из изменения (D15). `Corpus` — всё, что адаптер прочитал из корня; `files` — число прочитанных файлов.

`Decision.status` — строка как в файле: адаптер не выдаёт находок, неверный статус ловит правило `decision-status-invalid` (D25). `rationale` — есть ли непустое обоснование.

`Reference` — ссылка из Markdown корня, `TestMark` — та же разметка в тестовом файле. `change` у ссылки — изменение, в чьей папке она лежит. Адрес метки — строка, как у ссылки (D15); `root` — корень, которому принадлежит тест, `null` — тест вне корней (D29, D33).

## Адрес (D5)

```
адрес        = [пространство ":"] цель
цель         = capability ["/" требование ["#" сценарий]]
             | "change/" id-изменения
             | "decision/" id-решения
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

Токен — `spec:` и адрес до первого символа, который в адрес не входит (буквы, цифры, `_ - / # :`). Перед `spec:` не должно быть буквы, цифры, `_`, `-` или `/`, а пустой адрес токеном не считается: `openspec:archive`, `Bash(openspec:*)`, «each spec: has», `https://example.com/spec:x` — не ссылки (D18, D23). Блоки кода не исключаются: токен везде один. Markdown ищется во всех `*.md` корня, кроме `changes/archive/**`: архив — история, ссылки в нём не проверяются.

### Переименование

Адрес строится из текущего имени, поэтому переименование требования меняет адрес. Ссылка на старый слаг — `ref-dangling`; если старый слаг есть в RENAMED FROM открытого или архивного изменения, сообщение называет новый адрес и изменение, а `related` указывает на строку RENAMED. Цепочки переименований прослеживаются до последнего имени.

Два требования одной capability (или два сценария одного требования) с одинаковым слагом — `address-collision`: адрес обязан быть однозначным.

## CLI (D4)

По образцу Clear `req/cli`:

```
speclint [путь] [--format text|json]
speclint --version
```

- `путь` — папка репозитория, по умолчанию текущая. Без конфигурации корень — `<путь>/openspec`; с `<путь>/speclint.json` — корни из `roots`, автопоиска нет (D21).
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
- Находки упорядочены по `file`, `line`, `rule` (сравнение по кодовым точкам) — отчёт детерминирован.
- `summary.files` — число прочитанных файлов: спеки, дельты открытых и архивных изменений, `*.md` корня вне архива, решения, тестовые файлы (D33).

### Текстовый отчёт

По строке на находку, затем итог (D16):

```
openspec/README.md:3: error ref-dangling: spec:auth/session-timout: требования нет в auth
speclint: ошибок 1, предупреждений 0, файлов 9
```

`related` в тексте не печатается — только в JSON.

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
| `decision-status-invalid` | M3 | error | статус не `active`/`superseded`/`revoked`, `superseded` без `superseded-by` или `superseded-by` при другом статусе |
| `decision-supersede-missing` | M3 | error | `superseded-by` на решение, которого нет в корне |
| `decision-supersede-cycle` | M3 | error | цепочка замен возвращается к решению |
| `test-ref-dangling` | M4 | error | метка в тесте на несуществующий адрес |
| `scenario-untested` | M4 | warning | у сценария нет ни одной метки в тестах |
| `dependency-missing` | M5 | error | внешнее пространство не объявлено в зависимостях или манифест не найден |
| `scenario-untested-anywhere` | M5 | warning | сценарий не покрыт ни в одном репозитории, чьи манифесты известны |
| `scenario-steps-missing` | M6 | warning | в тесте с меткой сценария нет его шагов дословно среди строковых литералов |

### Как работают правила M1

- **Видимость.** Для каждого открытого изменения строится своя картина: основные спеки + его дельты в порядке RENAMED → REMOVED → MODIFIED → ADDED. MODIFIED и ADDED приносят блок дельты целиком (имя, строку, сценарии), RENAMED сохраняет сценарии и место старого блока, дельта на новую capability создаёт её.
- **`ref-dangling`.** Разбор цели: capability — самый длинный префикс, затем ровно один сегмент требования и необязательный `#сценарий`. Если требования нет, по порядку: цепочка RENAMED архивных изменений и своего изменения → подсказка нового адреса, `related` — строки FROM; REMOVED архивного изменения → `ref-archived`; цель разрешается в картине чужого открытого изменения → «есть в открытом изменении X», `related` — место в дельте. `change/<id>`: открытое — ок, архивное — `ref-archived`, иначе висячая.
- **`delta-target-missing` / `delta-target-exists`.** Проверяются по ходу применения дельт изменения к основным спекам: MODIFIED/REMOVED/RENAMED FROM — на имя, которого нет на этом шаге и нет в ADDED другого открытого изменения; ADDED — на имя, которое на этом шаге уже есть. Сравнение имён точное, как в OpenSpec. Архивные изменения не проверяются.
- **`delta-overlap`.** Две дельты разных открытых изменений с одной capability и одним именем (для RENAMED — FROM). Предупреждение получает каждая такая дельта, `related` — дельты других изменений (D19).
- **`address-collision`.** Проверяется в основных спеках и в картине каждого открытого изменения; одна и та же пара имён сообщается один раз — на втором по порядку элементе, `related` — первый.

### Реестр решений (M3)

Решения — расширение формата, в OpenSpec их нет; корень без папки `decisions/` проверяется как раньше (D24).

- **Где.** `<корень>/decisions/<id>.md`, без вложенных папок; `id` — имя файла без `.md`, поэтому дубликатов в корне нет. Общие решения монорепо — в любом корне или в отдельном корне из `speclint.json`; в M5 общие решения публикуются отдельным репозиторием, то есть ещё одним пространством.
- **Формат.** Front-matter между строками `---` в начале файла, ключи `status: active | superseded | revoked` и `superseded-by: <id>` (решение того же корня). Обоснование — непустой раздел `## Rationale` или `## Обоснование`.

```markdown
---
status: superseded
superseded-by: 0012-paseto
---

# 0007 JWT для сессий

## Rationale

…
```

- **Ссылка** `spec:[пространство:]decision/<id>` разрешается по общим правилам адреса, в том числе в другой корень по пространству. Нет решения — `ref-dangling`. `superseded` или `revoked` — `decision-inactive-ref`: для заменённого сообщение называет цепочку замен до первого не заменённого решения (или до несуществующего id), `related` — файлы замен. Ссылки из самих файлов `decisions/` на неактивные решения не ошибка: реестр ссылается на свою историю (D26).
- **Реестр.** `decision-status-invalid`, `decision-no-rationale`, `decision-supersede-missing`, `decision-supersede-cycle` — на строке 1 файла решения. Цикл сообщается на каждом решении цикла (D27).
- Метки в тестах (M4) разрешают `decision/<id>` тем же кодом.

### Покрытие (M4)

- **Тестовые файлы.** Без `tests` в `speclint.json` — по конвенциям (D28), пути относительно репозитория:

| Язык | Тестовый файл |
|---|---|
| Kotlin/Java | `.kt`, `.kts`, `.java` под `src/<…>test/` или `src/<…>Test/` (`src/test`, `src/androidTest`, `src/integrationTest`); `*Test.kt`, `*Tests.kt`, `*IT.kt` и то же для `.java` где угодно |
| TypeScript/JS | `*.test.*`, `*.spec.*` (`.ts`, `.tsx`, `.js`, `.jsx`, `.mts`, `.cjs` …); любой `.ts`, `.tsx`, `.js`, `.jsx` … под `__tests__/` |
| Swift | `.swift` под папкой, чьё имя кончается на `Tests` (`Tests/`, `AppTests/`) |
| Python | `test_*.py`, `*_test.py`; любой `.py` под `test/` или `tests/` |

  `tests` — список glob-шаблонов (`**` — любые папки, `*` — часть имени, `?` — символ) и заменяет конвенции целиком. Папки, начинающиеся с `.`, и `node_modules`, `build`, `dist`, `out`, `target`, `Pods`, `Carthage`, `DerivedData`, `venv`, `__pycache__` не читаются никогда, и с `tests` тоже.
- **Метка** — токен `spec:` по общей разметке в любой строке тестового файла; язык не важен.
- **Корень теста** (D29). Один корень — все тесты его. Несколько — корень, чья родительская папка — ближайший предок файла (`services/auth/openspec` владеет `services/auth/**`). Тест вне всех корней обязан писать адрес с пространством, иначе `test-ref-dangling` «тест вне корней».
- **Что видит метка** (D31) — основные спеки и картины всех открытых изменений: тест пишут до архивации. Подсказки RENAMED, архив и решения — как у ссылок.
- **`test-ref-dangling`** (D32) — любая неразрешённая метка: висячая, в архив, на заменённое или отменённое решение; сообщение — как у ссылки. Внешний адрес — `ref-external-unchecked`.
- **`scenario-untested`** — сценарий основных спек, на который нет метки ни сценария, ни его требования: метка требования покрывает все его сценарии (D30), метка capability — нет. Сценарии открытых изменений тестов не требуют до архивации (D31). Предупреждение — на строке сценария.

Внутрифайловые проверки `openspec validate` (дубликаты в разделах, конфликты разделов, непарные RENAMED, потеря сценариев) speclint не повторяет — см. [openspec-format.md](openspec-format.md#что-уже-проверяет-openspec-validate).

## Конфигурация (`roots` — M2, остальное — черновик M4–M5)

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

- `roots` — M2: непустой список; `path` — папка корня относительно репозитория, `space` обязательно, `[a-z0-9-]+`, уникально. Иначе — код `2` «нечитаемая конфигурация»; несуществующий `path` — код `2` «корень не найден». С конфигурацией проверяются только перечисленные корни, `<путь>/openspec` не подразумевается (D21).
- Каждый корень проверяется правилами M1 отдельно: дельты, `delta-overlap` и коллизии адресов — внутри своего корня. Ссылка `spec:<space>:…` с пространством другого локального корня разрешается в его основных спеках (дельты своего изменения к чужому корню не применяются); подсказки RENAMED, `ref-archived` и «есть в открытом изменении» берутся из изменений того корня (D22).
- `tests` — M4; glob-шаблоны тестовых файлов, заменяют конвенции (D28). Не список строк — код `2`.
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
- Решения — по формату M3: адрес, статус, замена.
