# Online Dominance Dashboard

Marketing intelligence для Magnum Estate — собирает GA4, Google Search Console и Bitrix24 CRM в единый Web Dominance Index, плюс AI Visibility через probe Claude.

## Что показывает

- **Web Dominance Index 2.2** — взвешенная свёртка четырёх компонент: рост non-brand, лиды, трафик, pipeline в Bitrix24
- **GA4** — трафик, лиды, источники
- **GSC** — clicks/impressions/CTR + brand vs non-brand split
- **Bitrix24 CRM** — лиды (total/qualified/junk + источники), сделки (won/lost/open)
- **30-дневный тренд** индекса (snapshot-based)
- **Executive Brief** — еженедельный LLM-нарратив (Claude Opus 4.7) на RU и EN с headline, что выросло, где проседаем, 3 действия, что отслеживать

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
| `BITRIX_WEBHOOK_URL` | inbound webhook URL из Bitrix24 (CRM-скоуп) |
| `SNAPSHOT_TOKEN` | bearer для защиты `/api/snapshot` |
| `ANTHROPIC_API_KEY` | (опц.) включает еженедельный LLM-брифинг через Claude Opus 4.7 |
| `ANTHROPIC_BRIEFING_MODEL` | (опц.) переопределить модель — по умолчанию `claude-opus-4-7` |

## Конфиг данных

- `data/snapshots.db` — SQLite-история (gitignored, создаётся при первом snapshot)

## Dominance Index 2.2

```
DI = 0.40 × Non-brand growth  (GSC non-brand clicks vs prev period)
   + 0.25 × Lead growth       (GA4 key events vs prev)
   + 0.20 × Traffic growth    (GA4 sessions vs prev)
   + 0.15 × Sales execution   (Bitrix CRM pipeline value vs prev)
```

Каждый компонент капируется в [0, 2]. Итог × 100. Статусы: ≥130 Dominating, ≥110 Gaining, ≤90 Slipping, ≤70 At Risk.

**v2.2 changelog:** убраны SERP coverage и SEO execution. Их веса (22% + 8%) пропорционально перераспределены между оставшимися 4 компонентами.

## Executive Brief (LLM-нарратив)

Раз в неделю после snapshot'а Claude Opus 4.7 генерирует executive briefing на основе всех собранных данных и записывает в SQLite. Возвращает строгий JSON из 5 полей:

- **headline** — одно предложение, что главное произошло
- **what_grew** — позитивные движения с цифрами
- **what_slipped** — негатив и потери против конкурентов
- **actions** — 3 действия на следующую неделю, по приоритету
- **watch_next** — что отслеживать дальше

Брифинг отображается в дашборде в секции `08 / Executive Brief` и доступен через `GET /api/briefing`.

**Стоимость:** ~$0.024 за генерацию × 52 недели ≈ **$1.25/год**.

**Запуск без API key:** дашборд работает, секция брифа показывает заглушку.

**Регенерация на лету** (без полного snapshot'а):
```bash
curl -X POST -H "Authorization: Bearer $SNAPSHOT_TOKEN" \
  http://localhost:3000/api/briefing/regenerate
```

## Деплой на Render

Push → Render подхватит `render.yaml`:
- web service `online-dominance-dashboard` (Node 22)
- cron `weekly-snapshot` (понедельник 06:00 UTC)

Все ENV нужно проставить вручную в Render dashboard (`sync: false`), кроме `SNAPSHOT_TOKEN` — генерируется автоматически.
