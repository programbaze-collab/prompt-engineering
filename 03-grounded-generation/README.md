# Генерация энциклопедических текстов строго по фактам

**Задача.** [wiki-brand.com](https://wiki-brand.com) — энциклопедия брендов на трёх языках: около 2 800 брендов, больше 300 посетителей в день из поиска. Тексты мини-сайтов брендов (история, продукты, как отличить подделку, аналоги, где купить) пишет DeepSeek. Тексты должны быть нейтральными, без рекламы и, главное, без выдуманных фактов: энциклопедия, в которой бренд «продаётся в Macy's», хотя это не так, теряет доверие.

**Кто управляет генерацией:** агент в IDE (Claude Code или Cursor) готовит бриф, запускает генератор, проверяет результат и решает, публиковать ли. Тексты пишет только DeepSeek: агенту запрещено переписывать их «для качества» — только перегенерировать с лучшим брифом. Так у текстов один автор и один набор правил.

**Модель:** deepseek-chat, температура 0,85 для текстов страниц (нужен живой язык), 0,6 для структурированных данных, 0,5 для мета-тегов.

## Как устроено

```
Карточка фактов бренда ─┐
Бриф страницы ──────────┼─→ DeepSeek ─→ Валидатор ──→ прошла ─→ на диск
Уже занятые заголовки ──┘       ▲            │
                                └── критика ─┘ не прошла (1 повтор)
```

### 1. Карточка фактов вместо знаний модели

Модель получает JSON с фактами, которые уже опубликованы на сайте для этого бренда: история, линейки продуктов, каналы продаж, заметки покупателей. И правило:

```
Never invent facts, dates, awards, certifications or model numbers. Use only the brand fact sheet you are given.
If public information is thin or inconsistent, say that it is thin or inconsistent and what a buyer should verify instead.
```

Вторая фраза важна: без неё модель на бренде с бедной карточкой «добирает» объём выдумками. С ней — честно пишет, что информации мало и что покупателю проверить.

### 2. Системный промпт: роль и жёсткие правила

Фрагменты:

```
You are the senior English editor and SEO lead for wiki-brand.com, a neutral, advertising-free brand encyclopedia.
You write native, idiomatic English prose. Never write translated-sounding copy, never calque another language's idiom.

Every page is a landing page for one cluster of real search queries, and it must satisfy the intent behind those
queries in the first screenful, then deepen it with checkable detail.

Hard rules: encyclopedic and neutral; no hype, no superlatives, no promises of performance or durability;
no prices, discounts, coupons, "buy now" or any call to action; no affiliate or store URLs; never link outside this site.

Distribution facts: never name a store, chain, department store or jeweler (for example Macy's, Nordstrom, Sephora,
Walmart, Costco, Jomashop) unless the brand fact sheet names it. Say where a brand sells only in generic terms —
marketplace listings, import sellers, brand website, authorized retail — and never claim a retailer carries the brand.

Do not repeat the section headings or the phrasing of the other pages listed as already written.
```

### 3. Бриф страницы

Для каждой страницы — свой кластер поисковых запросов, список обязательных разделов, разрешённые картинки и внутренние ссылки, минимальный объём. И список заголовков, которые уже использованы на других страницах этого бренда, — чтобы восемь страниц не начинались одинаково.

```
Length: at least 1000 words of body copy; aim for 1150. Depth comes from specifics — specs, ratings, checks,
failure modes — never from filler, restatement or a closing summary.
```

### 4. Валидатор и повтор с критикой

Каждая страница проверяется кодом до записи на диск: структура (секции, заголовки, абзацы), объём, 6–8 вопросов в FAQ на главной, запрещённые слова и шаблоны, отсутствие Markdown и внешних ссылок, рекламные слова и цены, внутренние ссылки только на существующие страницы, картинки только существующие, язык (нет кириллицы в английском тексте).

Если страница не прошла — модель получает тот же запрос плюс вывод валидатора (пример формата):

```
YOUR PREVIOUS ATTEMPT WAS REJECTED. Validator output: word_count:812<1000; invented_retailer:"Nordstrom":names a store
that is not in the fact sheet — drop the store name and describe the sales channel generically
Rewrite the complete fragment and fix exactly those problems.
```

Модель получает не «перепиши лучше», а конкретный список ошибок и для части из них — как исправить. Если и вторая попытка не прошла, страница не записывается и попадает в список ошибок.

## Ошибки модели, найденные на практике, и что с ними сделано

| Ошибка | Пример | Решение |
| --- | --- | --- |
| Выдуманные магазины | Крупная сеть названа местом продажи бренда, хотя в карточке фактов её нет | Правило в промпте с примерами сетей + валидатор `invented_retailer`: название магазина, которого нет в карточке фактов, отклоняет страницу |
| Смешанные алфавиты в русском тексте | «дьюti-фри», «парfюмерия», «реformulаций» | Правило проверки перед публикацией и поиск типичных гибридов регулярным выражением; исправление — перегенерацией или точечной правкой опечатки, но не переписыванием текста руками |
| Английские вставки в русском и испанском | «designer-», «beauty-», «entry-level» | То же + запрет в промпте |
| Выдуманные категории | «toys», «watch», «electronica» вместо «accessories», «watches», «electronics» | Список категорий в промпте («MUST be exactly one of these — never invented; a toy brand → accessories») + нормализация частых промахов в коде |
| Битый JSON | Невалидный ответ в пакетной генерации — даже в JSON mode | Проверка разбора и обязательных ключей, бренд с ошибкой уходит в журнал и перегенерируется |
| Повторы между страницами | Страницы одного бренда пишутся отдельными запросами и начинают повторять заголовки и формулировки друг друга | Список уже занятых заголовков в брифе каждой следующей страницы |
| Вода ради объёма | «В заключение можно сказать…» | «Depth comes from specifics… never from filler, restatement or a closing summary» |

Масштаб — из журналов пакетной генерации 1 099 брендов на трёх языках: 287 отказов, из них 216 — битый JSON, 43 — пропущен обязательный блок `products`, 28 — выдуманная категория. Ни один из них не попал на сайт: отказ останавливается проверкой, а не обнаруживается читателем.

## Выводы

1. **Генерация «по фактам» — это не одна фраза в промпте, а система:** карточка фактов на входе, запрет выходить за неё, разрешение честно сказать «информации мало» и проверка кодом на выходе.
2. **Модель выдумывает правдоподобное.** Самые опасные выдумки — не абсурдные, а типичные для категории: крупные сети для часов и парфюмерии. Поэтому в промпте перечислены именно они.
3. **Проверка кодом — обязательная часть промпта.** Правило в промпте снижает число ошибок, валидатор не пропускает оставшиеся, а повтор с конкретной критикой даёт модели шанс исправиться без участия человека.
4. **Один автор текстов.** Когда агент в IDE «улучшал» тексты DeepSeek руками, правила качества размывались — появилось правило: агент готовит бриф и проверяет, но не пишет текст.
