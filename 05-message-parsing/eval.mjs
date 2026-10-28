// Прогон промпта на наборе сообщений: node --env-file-if-exists=../.env eval.mjs v2 [holdout]
// Второй аргумент — набор: dataset (по умолчанию, на нём отлаживается промпт) или holdout
// (отложенный, на нём только проверяется). Нужен DEEPSEEK_API_KEY.
// Результат — в консоли и в results/<версия>[-holdout].md.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const FIELDS = ['intent', 'articles', 'brands', 'in_stock_only', 'order_number', 'vin']
const CONCURRENCY = 6

const version = process.argv[2]
if (!version) throw new Error('Укажите версию промпта: node eval.mjs v1')
const apiKey = process.env.DEEPSEEK_API_KEY
if (!apiKey) throw new Error('Нет DEEPSEEK_API_KEY')

const read = (file) => readFileSync(new URL(file, import.meta.url), 'utf8')
const prompt = read(`./prompts/${version}.md`)
const datasetName = process.argv[3] ?? 'dataset'
const dataset = JSON.parse(read(`./${datasetName}.json`))
const reportName = datasetName === 'dataset' ? version : `${version}-${datasetName}`

async function parse(message) {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: message },
      ],
    }),
  })
  if (!response.ok) throw new Error(`DeepSeek ${response.status}: ${await response.text()}`)
  return JSON.parse((await response.json()).choices[0].message.content)
}

// Списки сравниваем как множества: порядок артикулов и брендов не важен.
const normalize = (field, value) =>
  Array.isArray(value) ? [...value].map(String).sort() : field === 'in_stock_only' ? Boolean(value) : (value ?? null)
const same = (field, a, b) => JSON.stringify(normalize(field, a)) === JSON.stringify(normalize(field, b))

const results = []
let next = 0
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (next < dataset.length) {
      const item = dataset[next++]
      let actual
      try {
        actual = await parse(item.message)
      } catch (error) {
        actual = { error: error.message }
      }
      const wrong = FIELDS.filter((field) => !same(field, actual[field], item.expected[field]))
      results.push({ ...item, actual, wrong })
    }
  }),
)
results.sort((a, b) => dataset.indexOf(dataset.find((d) => d.id === a.id)) - dataset.indexOf(dataset.find((d) => d.id === b.id)))

const exact = results.filter((result) => result.wrong.length === 0).length
const perField = FIELDS.map((field) => {
  const ok = results.filter((result) => !result.wrong.includes(field)).length
  return { field, ok, pct: Math.round((ok / results.length) * 100) }
})
const summary = `Сообщений разобрано полностью верно: ${exact} из ${results.length} (${Math.round((exact / results.length) * 100)}%).`
console.log(summary)
console.log(perField.map(({ field, pct }) => `${field}: ${pct}%`).join(' · '))

const cell = (value) => JSON.stringify(value).replaceAll('|', '\\|')
const report = [
  `# Результаты: промпт ${version}, набор ${datasetName}`,
  '',
  `${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })} (МСК) · deepseek-chat, температура 0, JSON mode`,
  '',
  summary,
  '',
  '| Поле | Верно |',
  '| --- | --- |',
  ...perField.map(({ field, ok, pct }) => `| ${field} | ${ok} из ${results.length} (${pct}%) |`),
  '',
  '## Ошибки',
  '',
  '| Сообщение | Поле | Ожидалось | Получено |',
  '| --- | --- | --- | --- |',
  ...results.flatMap((result) =>
    result.wrong.map(
      (field) =>
        `| ${result.id}: «${result.message.replaceAll('|', '\\|')}» | ${field} | ${cell(result.expected[field])} | ${cell(result.actual[field] ?? result.actual.error ?? null)} |`,
    ),
  ),
  '',
]
mkdirSync(new URL('./results/', import.meta.url), { recursive: true })
writeFileSync(new URL(`./results/${reportName}.md`, import.meta.url), report.join('\n'))
