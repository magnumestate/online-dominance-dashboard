# AI Visibility Brief — {{week_start}}

> Magnum Estate Bali · сводка за неделю {{week_start}} → {{week_end}}

## TL;DR

- **Total Dominance:** {{total_index}} {{total_delta}} ({{total_status}})
- **AI Visibility:** {{ai_index}} {{ai_delta}} ({{ai_status}})
- **Web Dominance:** {{web_index}} {{web_delta}} ({{web_status}})
- AI probe: {{probe_responses}} ответов на {{probe_prompts}} prompt-семей × {{probe_engines}} движков
- AI Overviews: {{aio_summary}}

## Что произошло на этой неделе

### Share of Voice
{{sov_narrative}}

### Brand mentions
{{mentions_narrative}}

### Sentiment
{{sentiment_narrative}}

### Google AI Overviews
{{aio_narrative}}

## Топ-3 действия на следующую неделю
{{top_actions}}

## Прозрачность

Темы для действий выбраны по правилу: prompt где (а) конкурент упомянут, а Magnum нет,
ИЛИ (б) конкурент цитируется в Google AI Overview, а Magnum — нет.

AI Visibility Score = 0.40 × SOV + 0.30 × growth (4-week trailing) + 0.20 × positive sentiment + 0.10 × citation rate.
Total Dominance = {{td_web_weight}}% × Web Dominance + {{td_ai_weight}}% × AI Visibility.

## Метрики по движкам

{{engine_table}}

## Источники данных

- **AI probe:** прямые вызовы Claude / OpenAI / Perplexity / YandexGPT API на {{probe_prompts}} prompt-семей
- **AI Overviews:** Bright Data SERP API, парсинг блоков AI Overview в Google
- **Web Dominance:** GA4 + GSC + Bright Data SERP (Google + Yandex) + Google Sheets content plan

---

*Brief сгенерирован {{generated_at}}. Дашборд: {{dashboard_url}}*
