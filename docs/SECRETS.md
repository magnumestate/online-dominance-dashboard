# Безопасное добавление API-ключей и веб-хуков

Все секреты живут в `.env` (gitignored) — **никогда** не коммитятся в репо. На проде используется тот же `.env`, лежащий рядом с приложением на сервере.

## Шаблон `.env`

Скопируй из репо и редактируй локально:

```bash
cp .env.example .env
$EDITOR .env
```

Файл уже в `.gitignore` — не нужно ничего добавлять.

## Где брать каждый секрет

### 1. ANTHROPIC_API_KEY (включает 3 фичи: Probe, Classifier, Briefing)

```
ANTHROPIC_API_KEY=sk-ant-…
```

1. Открыть [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
2. **Create Key** → имя `online-dominance-dashboard`
3. Скопировать `sk-ant-...` сразу (показывается один раз)
4. Вставить в `.env`

**Что включится:**
- AI Probe — еженедельный замер бренда в ответах Claude
- AI Classifier — sentiment-разметка ответов через Haiku 4.5
- Executive Brief — еженедельная LLM-сводка от Opus 4.7

**Стоимость**: ~$0.05–$0.10 за weekly run, ~$5/год.

**Безопасность**: ключ работает с любого IP. При компрометации:
1. [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) → Revoke
2. Создать новый → обновить `.env` на проде → `pm2 restart`

### 2. BITRIX_WEBHOOK_URL (CRM)

```
BITRIX_WEBHOOK_URL=https://your-portal.bitrix24.ru/rest/12/abcdef…/
```

1. Зайти в Bitrix24 как администратор
2. **Developer resources** → **Other** → **Inbound webhook**
3. Имя: `Online Dominance Dashboard`
4. **Permissions** — отметить только `CRM (crm)` (минимум привилегий)
5. **Save**
6. Скопировать URL целиком (включая trailing `/`)

**Безопасность Bitrix-вебхука:**
- URL содержит `<user_id>/<token>` — это и есть ключ. Кто угодно с URL может вызвать CRM API от имени того юзера
- **Не светить** в скриншотах, мессенджерах, скриншотах Loom'а
- Если утёк — в Bitrix → Other webhooks → удалить старый, создать новый
- Делегировать права отдельному техническому пользователю (не админу), чтобы ограничить blast radius

### 3. OPENAI_API_KEY / PERPLEXITY_API_KEY / YANDEX_GPT (AI Probe — расширение)

Опциональные — каждый ключ добавляет один движок к Probe:

```
OPENAI_API_KEY=sk-…
PERPLEXITY_API_KEY=pplx-…
YANDEX_GPT_API_KEY=AQVN…
YANDEX_GPT_FOLDER_ID=b1g…
```

Можно подключить любое подмножество. Если ключа нет — движок просто не опрашивается.

- **OpenAI**: [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- **Perplexity**: [perplexity.ai/settings/api](https://perplexity.ai/settings/api)
- **YandexGPT**: [console.yandex.cloud](https://console.yandex.cloud) → IAM → service account → API key. `FOLDER_ID` — это `b1g…` ID каталога, в котором живёт сервис

### 4. SNAPSHOT_TOKEN

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Это **только** твой bearer для `POST /api/snapshot` (защита от spoof'инга cron'а). Не подключается ни к каким внешним сервисам.

## Как обновить `.env` на проде

Прод — это Ubuntu-сервер с PM2 (см. `.github/workflows/deploy.yml`). Деплой через rsync **исключает** `.env` (`--exclude='.env'`) — поэтому файл живёт на сервере отдельно и его никогда не перезатирают.

```bash
# 1. SSH на сервер
ssh ubuntu@dominance.stanislav-sadovnikov.com

# 2. Открыть файл
cd /home/ubuntu/online-dominance-dashboard
$EDITOR .env

# 3. Добавить/изменить нужные строки

# 4. Рестарт без потери snapshot'ов в SQLite
pm2 restart dominance-dashboard --update-env
pm2 save

# 5. Проверка
curl -sI https://dominance.stanislav-sadovnikov.com/api/health | head -1
curl -s https://dominance.stanislav-sadovnikov.com/api/health | jq .sources
```

Не забудь про **`--update-env`** — без него PM2 переиспользует старое окружение.

## Что НИКОГДА не делать

- ❌ Не коммитить `.env`, `service-account.json`, `*.pem`, `*.key`
- ❌ Не вставлять ключи в commit message, PR description, Issue
- ❌ Не оставлять ключи в logs (если бы нужно было — лог редактирует сами строки на маске)
- ❌ Не использовать prod-ключи локально (если возможно — заведи sandbox/dev ключ для локалки)
- ❌ Не передавать ключи через мессенджер в plain text — используй [bitwarden send](https://send.bitwarden.com/) или 1Password shared item

## Что проверять перед коммитом

`.gitignore` уже исключает `.env`, `service-account.json`, `data/snapshots.db`. Если в будущем добавляешь файл с секретами — добавь его маску в `.gitignore` **до** `git add`.

Быстрый чек:

```bash
git status --short    # должен НЕ показывать .env
git diff --cached     # просмотри ВСЕ строки перед commit'ом
```

Если случайно закоммитил ключ:
1. Немедленно ревокни ключ у провайдера (ключ уже считается скомпрометированным навсегда — даже после `git revert`)
2. `git push --force-with-lease` чтобы переписать историю — но история уже клонирована другими, так что это не спасает
3. Создай новый ключ → обнови `.env` на проде

## Какие ENV какую секцию активируют

| ENV ключ | Секция дашборда | Источник в `/api/dashboard` |
|---|---|---|
| `GA4_PROPERTY_ID` + service-account | 01 Traffic Intelligence, 03 Acquisition | `ga4` |
| `GSC_SITE_URL` + service-account | 02 Search Position | `gsc` |
| `BITRIX_WEBHOOK_URL` | 05 Sales Pipeline | `bitrix` |
| `ANTHROPIC_API_KEY` | 06 Executive Brief + hero AI Visibility card | `aiProbe`, `aiClassifier`, `briefing` |
| `OPENAI_API_KEY` / `PERPLEXITY_API_KEY` / `YANDEX_GPT_*` | hero AI Visibility (доп. probe движки) | `aiProbe` engines |
| `SNAPSHOT_TOKEN` | — (cron auth) | — |

Web Dominance Index v2.2 объединяет 4 компоненты: non-brand growth (GSC) 40% · лиды (GA4) 25% · трафик (GA4) 20% · Bitrix pipeline 15%. AI Visibility — отдельный композит на probe-данных. Total Dominance = 0.7 × Web + 0.3 × AI (см. `server/score.js`).
