# Online Dominance Dashboard

Marketing intelligence для Magnum Estate — собирает GA4, Google Search Console, SERP-позиции конкурентов в Google и Yandex через Bright Data, и прогресс SEO-плана из Google Sheets в один индекс доминирования.

## Что показывает

- **Dominance Index 2.1** — взвешенная свёртка шести источников
- **GA4** — трафик, лиды, источники
- **GSC** — clicks/impressions/CTR + brand vs non-brand split
- **SERP-позиции** — `magnumestate.com` против 4 конкурентов по ~30 ключам в Google **и Yandex** (Bright Data SERP API, weekly)
- **SEO progress** — % выполненных рекомендаций из контент-плана
- **Bitrix24 CRM** — лиды (total/qualified/junk + источники), сделки (won/lost/open), стоимость pipeline
- **30-дневный тренд** индекса (snapshot-based)

## Запуск локально

```bash
cp .env.example .env   # заполни ключи
npm install
npm run dev            # http://localhost:3000
```

Дашборд работает с любым подмножеством источников — недостающие отдают "neutral" значение в индексе и видны в блоке "Источники данных".

## Snapshot для истории и SERP

Чтобы появился тренд индекса и таблица SERP, нужно периодически вызывать snapshot endpoint:

```bash
curl -X POST -H "Authorization: Bearer $SNAPSHOT_TOKEN" \
  http://localhost:3000/api/snapshot
```

Локально удобно через `npm run snapshot` (использует `SNAPSHOT_TOKEN` из `.env`).

В продакшене — Render cron из `render.yaml` стучится сюда раз в день в 6:00 UTC.

## Источники

| Переменная | Описание |
|---|---|
| `GA4_PROPERTY_ID` | ID GA4 properties |
| `GA4_SERVICE_ACCOUNT_KEYFILE` | путь к JSON-ключу (используется и для GSC, и для Sheets если они не переопределены) |
| `LEAD_EVENTS` / `ACTIVITY_EVENTS` | события GA4 для лидов / активностей (через запятую) |
| `GSC_SITE_URL` | например `sc-domain:magnumestate.com` |
| `BRIGHT_DATA_API_KEY` | Bearer token для Bright Data SERP API (см. https://brightdata.com/cp/setting/users) |
| `BRIGHT_DATA_SERP_ZONE` | имя SERP-зоны из dashboard Bright Data (создаётся один раз) |
| `SEO_PROGRESS_SHEET_ID` | ID Google Sheet с контент-планом |
| `BITRIX_WEBHOOK_URL` | inbound webhook URL из Bitrix24 (CRM-скоуп) |
| `SNAPSHOT_TOKEN` | bearer для защиты `/api/snapshot` |

## Конфиг данных

- `data/keywords.json` — ключи для weekly SERP-трекинга. Поля: `q`, `lang` (ISO 2), `country` (ISO 2), `engine` (`google` или `yandex`), `tag`. Группы: high_priority, location, project, advisor, brand_baseline, multilingual, **russian_yandex**.
- `data/competitors.json` — наш домен + 4 конкурента
- `data/snapshots.db` — SQLite-история (gitignored, создаётся при первом snapshot)

## SERP-провайдер

Используется **Bright Data SERP API** (https://brightdata.com). Покрывает Google и Yandex (плюс Bing/DuckDuckGo при желании). Стоимость для нашего объёма (~30 ключей × weekly) — около $0.50/мес. Smart-прокси и решение CAPTCHA включены.

Перед первым запуском:
1. В Bright Data dashboard создать зону типа "SERP API" — имя пойдёт в `BRIGHT_DATA_SERP_ZONE`
2. Сгенерировать API-токен в Settings → API tokens → положить в `BRIGHT_DATA_API_KEY`

## Dominance Index 2.1

```
DI = 0.28 × Non-brand growth (GSC non-brand clicks vs prev period)
   + 0.22 × SERP coverage (наш Top-10 / (наш + конкуренты в Top-10))
   + 0.18 × Lead growth (GA4 key events vs prev)
   + 0.14 × Traffic growth (GA4 sessions vs prev)
   + 0.10 × Sales execution (Bitrix CRM pipeline value vs prev)
   + 0.08 × SEO execution (% Done из контент-плана)
```

Каждый компонент капируется в [0, 2]. Итог × 100. Статусы: ≥130 Dominating, ≥110 Gaining, ≤90 Slipping, ≤70 At Risk.

**v2.1 changelog:** добавлен 6-й компонент (sales_execution через Bitrix24 pipeline). Веса остальных уменьшены пропорционально.

## Деплой на Render

Push → Render подхватит `render.yaml`:
- web service `online-dominance-dashboard` (Node 22)
- cron `weekly-snapshot` (понедельник 06:00 UTC)

Все ENV нужно проставить вручную в Render dashboard (`sync: false`), кроме `SNAPSHOT_TOKEN` — генерируется автоматически.
