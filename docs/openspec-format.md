# Формат OpenSpec

Разобран по репозиторию `Fission-AI/OpenSpec`, версия 1.15.0 (коммит `6d04a1b`, 2026-10-24): `docs/concepts.md`, `docs/writing-specs.md`, `docs/stores-beta/user-guide.md`, исходники `src/core/parsers/requirement-blocks.ts`, `src/core/parsers/requirement-text.ts`, `src/utils/spec-discovery.ts`, `src/utils/item-discovery.ts`, `src/core/specs-apply.ts`, `src/core/validation/validator.ts`, `src/core/change-metadata/schema.ts`.

## Раскладка

```
openspec/
├── config.yaml                      настройки проекта; references:, store: (бета)
├── specs/
│   ├── <capability>/spec.md         плоско
│   └── <area>/<capability>/spec.md  вложенно (с 1.x, #1353)
└── changes/
    ├── <change>/
    │   ├── proposal.md              ## Why, ## What Changes
    │   ├── design.md
    │   ├── tasks.md
    │   ├── .openspec.yaml           schema, created, goal, affected_areas, initiative, skip_specs, retire_capabilities, x-*
    │   └── specs/<capability>/spec.md   дельта
    └── archive/YYYY-MM-DD-<change>/ та же папка после архивации
```

- **ID capability** — путь папки относительно `specs/` через `/`: `auth`, `identity/user-auth`. `spec.md` прямо в `specs/` игнорируется, папки с точкой пропускаются, порядок — по кодовым точкам.
- **ID изменения** — имя папки в `changes/` (kebab-case), кроме `archive/` и скрытых.
- **Архивное изменение** — папка `changes/archive/YYYY-MM-DD-<change>`; дата — день архивации.
- Дельта лежит по тому же пути capability, что и основная спека: `changes/<change>/specs/<capability>/spec.md`. Другие `.md` в `specs/` изменения не читаются (validate сообщает ошибку).

## Основная спека

```markdown
# <заголовок>

## Purpose
<зачем capability>

## Requirements

### Requirement: <имя>
<текст с SHALL/MUST>

#### Scenario: <имя>
- **GIVEN** ...
- **WHEN** ...
- **THEN** ...
```

- **Требование** — блок от `### Requirement: <имя>` (регистр слова `Requirement` любой) до следующего `### Requirement:` или `## `. Ищется только внутри `## Requirements` и вне блоков кода.
- **Имя требования** — текст заголовка после `Requirement:`, обрезанный, без закрывающего `###`. Сравнение **точное, с учётом регистра**; явных ID нет. Свёртка регистра и пробелов используется только для подсказок об опечатках.
- **Сценарий** — любой заголовок `####` внутри требования с непустым телом; имя — текст без префикса `Scenario:`. Сценарий без тела не считается.
- Шаги сценария — свободный текст, обычно список `GIVEN/WHEN/THEN/AND`, жирным или нет.

## Дельта

Четыре раздела (регистр не важен, пробелы — ровно как здесь):

| Раздел | Содержимое | При архивации |
|---|---|---|
| `## ADDED Requirements` | полные блоки `### Requirement:` | дописываются в основную спеку |
| `## MODIFIED Requirements` | полные блоки, заменяют старый целиком (сценарии тоже) | заменяют блок с тем же именем |
| `## REMOVED Requirements` | блоки `### Requirement:` (с причиной) или список `` - `### Requirement: <имя>` `` | удаляются |
| `## RENAMED Requirements` | пары `- FROM: `` ### Requirement: <старое> `` ` / `- TO: `` ### Requirement: <новое> `` ` | имя меняется, содержимое остаётся |

- Порядок применения: RENAMED → REMOVED → MODIFIED → ADDED. MODIFIED после RENAMED обязан называть требование новым именем.
- `## Purpose` в дельте используется только при создании новой capability.
- Удаление последнего требования capability удаляет файл спеки, только если в `.openspec.yaml` стоит `retire_capabilities: true`.
- Сценарии в дельте не переименовываются и не адресуются отдельно: MODIFIED несёт весь блок.

## Ссылки

**Синтаксиса ссылок между спеками, требованиями, изменениями и тестами в OpenSpec нет.** В самом репозитории OpenSpec ссылки встречаются только как пути в тексте (`openspec/specs/cli-init/spec.md`). Связи между изменениями (`dependsOn`, `touches` и т.п.) описаны в предложении `add-change-stacking-awareness`, но не реализованы: в схеме `.openspec.yaml` их нет. Разметку ссылки speclint вводит сам — вопрос Q2.

## Что уже проверяет `openspec validate`

Проверка идёт по одному изменению или одной спеке.

Спека: есть `## Purpose` и `## Requirements`; у требования есть SHALL/MUST и хотя бы один сценарий; Purpose не заглушка и не короче 50 символов; требование не длиннее 500 символов.

Изменение:
- есть дельты (или `skip_specs: true`), дельты лежат в `specs/<capability>/spec.md`;
- дубликаты внутри ADDED, MODIFIED, REMOVED; повторы FROM/TO в RENAMED; непарные FROM/TO;
- одно требование в двух разделах (MODIFIED+REMOVED, MODIFIED+ADDED, ADDED+REMOVED); MODIFIED по старому имени из RENAMED; RENAMED TO совпадает с ADDED;
- MODIFIED теряет сценарии, которые есть в текущей спеке;
- требования вне дельта-разделов, текст, который архивация не перенесёт;
- предпросмотр архивации: если архивация отказала бы (MODIFIED/REMOVED/RENAMED на несуществующее требование, ADDED на существующее), — только **INFO**, вердикт не меняется, потому что цель может появиться в соседнем изменении.

Чего `openspec validate` не делает (ниша speclint):
- не сверяет изменения **между собой**: два открытых изменения на одно требование, ADDED в одном и MODIFIED в другом;
- отказ архивации — лишь INFO, а не ошибка по корпусу;
- не знает ссылок, решений, тестов и покрытия; папку `decisions/` speclint добавляет как расширение (см. [architecture.md](architecture.md#реестр-решений-m3)), OpenSpec её не читает;
- не сверяет репозитории по версиям.

## Несколько корней и репозиториев (бета)

- **Store** — отдельный репозиторий только для планирования: та же папка `openspec/` плюс `.openspec-store/store.yaml` с ID. Регистрируется на машине по имени (`openspec store register`), команды работают с ним через `--store <id>`.
- `openspec/config.yaml` может объявить `references:` — ID стор, на чьи спеки опирается работа; в инструкции агенту попадает их индекс, собранный из **локальных чекаутов**.
- Версий и фиксации нет: ссылка — на текущее состояние чекаута. Это и отличает D6 (опубликованный манифест с фиксацией версии) от стор OpenSpec.
- Несколько папок `openspec/` в одном репозитории OpenSpec как один корпус не рассматривает: корень выбирается по текущей папке или `--store`.

Формат стор помечен как бета и может измениться; speclint на него в M0–M6 не опирается.
