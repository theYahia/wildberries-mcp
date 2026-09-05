> ## 🗄 Репозиторий заархивирован
>
> Разработка переехала в **[theYahia/WWmcp](https://github.com/theYahia/WWmcp)** — монорепозиторий MCP-серверов для незападных API: СНГ, MENA, Африка, LATAM, Юго-Восточная Азия. Общее ядро `@theyahia/mcp-core`, единый CI, единый релизный конвейер.
>
> Актуальная версия того, что лежало здесь: [`servers/wildberries/`](https://github.com/theYahia/WWmcp/tree/main/servers/wildberries)
>
> Пакет в npm прежний — [`@theyahia/wildberries-mcp`](https://www.npmjs.com/package/@theyahia/wildberries-mcp), ставится и работает как раньше.
> Здесь больше ничего не обновляется. Задачи и pull request'ы — в WWmcp.
>
> **Archived — development moved to [theYahia/WWmcp](https://github.com/theYahia/WWmcp),** a monorepo of MCP servers for non-Western APIs.
> The current version of this package now lives at [`servers/wildberries/`](https://github.com/theYahia/WWmcp/tree/main/servers/wildberries).
> The npm package [`@theyahia/wildberries-mcp`](https://www.npmjs.com/package/@theyahia/wildberries-mcp) is unchanged.
> Please open issues and pull requests there.

# MCP-сервер для Wildberries Seller API — 30 инструментов для ИИ-агента

Если вы искали, как подключить кабинет продавца Wildberries к Claude или другому ИИ-агенту, — этот сервер даёт агенту прямой доступ к Seller API: остатки и цены, заказы и продажи, поставки FBS, аналитика, отзывы, вопросы, возвраты и реклама. Спрашиваете обычными словами — «какие товары кончаются на складе Коледино», «подними цену на SW-4410 до 3490 ₽» — и получаете готовый ответ таблицей, а не выгрузку, которую ещё надо разбирать. Маршрутизация по хостам категорий, соблюдение лимитов запросов и защита от 409-штрафа — на стороне сервера.

[![npm](https://img.shields.io/npm/v/@theyahia/wildberries-mcp)](https://www.npmjs.com/package/@theyahia/wildberries-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

![Демонстрация: вопрос «какие товары кончаются на складе Коледино» — агент вызывает get_fbw_stocks и отвечает таблицей остатков](https://raw.githubusercontent.com/theYahia/WWmcp/main/servers/wildberries/assets/demo.svg)

## Быстрый старт

```bash
npm install -g @theyahia/wildberries-mcp

# транспорт stdio (для Claude Desktop, Cursor и других)
WB_API_TOKEN=your_token wildberries-mcp

# транспорт Streamable HTTP
WB_API_TOKEN=your_token wildberries-mcp --http
```

### Claude Desktop

Добавьте в `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "wildberries": {
      "command": "npx",
      "args": ["-y", "@theyahia/wildberries-mcp"],
      "env": { "WB_API_TOKEN": "your_token_here" }
    }
  }
}
```

Cursor, Windsurf и VS Code (Copilot) используют тот же блок `mcpServers` в своих настройках MCP.

### Smithery

```bash
npx @smithery/cli install @theyahia/wildberries-mcp
```

## Авторизация и категории токена

`Authorization: Bearer {WB_API_TOKEN}` (JWT, срок жизни 180 дней). Токен выдаётся в
[кабинете продавца](https://seller.wildberries.ru/supplier-settings/access-to-api) в разделе
**Настройки → Доступ к API**.

Один токен может нести сразу несколько **категорий доступа**. Поскольку каждый инструмент ходит
на свой хост API, при отсутствующей категории `401` вернёт именно *этот* хост, а остальные
инструменты продолжат работать. Включайте нужные категории:

| Категория | Какие инструменты питает |
|-------|--------------|
| Контент | `list_products`, `get_product` |
| Цены и скидки | `update_prices` |
| Маркетплейс | `update_stocks`, `get_stocks`, `get_orders`, `get_new_orders`, `get_warehouses`, `get_supply`, `create_supply`, `add_orders_to_supply`, `deliver_supply`, `get_supply_barcode` |
| Статистика | `get_sales`, `get_incomes`, `get_fbw_stocks`, `get_statistics`, `get_abc_analysis` |
| Аналитика | `get_funnel`, `get_paid_storage` |
| Тарифы (Общее) | `get_commission`, `get_tariffs` |
| Отзывы и вопросы | `get_feedbacks`, `reply_feedback`, `get_questions`, `reply_question` |
| Возвраты | `get_returns` |
| Реклама | `get_balance`, `list_campaigns`, `get_campaign_stats` |

Когда вызов падает, в тексте ошибки указан хост и `requestId` от WB, поэтому недостающая категория
или ошибка с хостом видны сразу (например, `WB API GET advert-api.wildberries.ru/adv/v1/balance → 401: ...`).

## Архитектура — хост на каждую категорию

Seller API Wildberries — это **не** единый шлюз. `seller.wildberries.ru` — это веб-кабинет,
а API разнесён по хостам категорий. Каждый запрос маршрутизируется на нужный:

| Категория | Хост |
|----------|------|
| Контент | `content-api.wildberries.ru` |
| Цены и скидки | `discounts-prices-api.wildberries.ru` |
| Маркетплейс (FBS) | `marketplace-api.wildberries.ru` |
| Статистика | `statistics-api.wildberries.ru` |
| Аналитика | `seller-analytics-api.wildberries.ru` |
| Общее / Тарифы | `common-api.wildberries.ru` |
| Отзывы и вопросы | `feedbacks-api.wildberries.ru` |
| Возвраты | `returns-api.wildberries.ru` |
| Реклама | `advert-api.wildberries.ru` |

## Инструменты (30)

### Товары и контент
| Инструмент | Метод | Хост · Эндпоинт |
|------|--------|-----------------|
| `list_products` | POST | content · `/content/v2/get/cards/list` |
| `get_product` | POST | content · `/content/v2/get/cards/detail` |
| `update_prices` | POST | prices · `/api/v2/upload/task` |
| `update_stocks` | PUT | marketplace · `/api/v3/stocks/{warehouseId}` |
| `get_stocks` | POST | marketplace · `/api/v3/stocks/{warehouseId}` |

### Заказы и продажи
| Инструмент | Метод | Хост · Эндпоинт |
|------|--------|-----------------|
| `get_orders` | GET | marketplace · `/api/v3/orders` |
| `get_new_orders` | GET | marketplace · `/api/v3/orders/new` |
| `get_sales` | GET | statistics · `/api/v1/supplier/sales` |
| `get_incomes` | GET | statistics · `/api/v1/supplier/incomes` |
| `get_fbw_stocks` | GET | statistics · `/api/v1/supplier/stocks` |

### Склады и поставки FBS
| Инструмент | Метод | Хост · Эндпоинт |
|------|--------|-----------------|
| `get_warehouses` | GET | marketplace · `/api/v3/offices` |
| `get_supply` | GET | marketplace · `/api/v3/supplies` |
| `create_supply` | POST | marketplace · `/api/v3/supplies` |
| `add_orders_to_supply` | PATCH | marketplace · `/api/v3/supplies/{id}/orders/{orderId}` |
| `deliver_supply` | PATCH | marketplace · `/api/v3/supplies/{id}/deliver` |
| `get_supply_barcode` | GET | marketplace · `/api/v3/supplies/{id}/barcode` |

### Аналитика
| Инструмент | Метод | Хост · Эндпоинт |
|------|--------|-----------------|
| `get_statistics` | GET | statistics · `/api/v5/supplier/reportDetailByPeriod` |
| `get_abc_analysis` | GET | statistics · `reportDetailByPeriod` (Парето считается на месте) |
| `get_funnel` | POST | analytics · `/api/v2/nm-report/detail` |
| `get_paid_storage` | GET | analytics · `/api/v1/paid_storage` (асинхронный отчёт) |

### Справочники по ценообразованию
| Инструмент | Метод | Хост · Эндпоинт |
|------|--------|-----------------|
| `get_commission` | GET | common · `/api/v1/tariffs/commission` |
| `get_tariffs` | GET | common · `/api/v1/tariffs/box` |

### Отзывы и вопросы
| Инструмент | Метод | Хост · Эндпоинт |
|------|--------|-----------------|
| `get_feedbacks` | GET | feedbacks · `/api/v1/feedbacks` |
| `reply_feedback` | PATCH | feedbacks · `/api/v1/feedbacks` |
| `get_questions` | GET | feedbacks · `/api/v1/questions` |
| `reply_question` | PATCH | feedbacks · `/api/v1/questions` |

### Возвраты и реклама
| Инструмент | Метод | Хост · Эндпоинт |
|------|--------|-----------------|
| `get_returns` | GET | returns · `/api/v1/claims` |
| `get_balance` | GET | advert · `/adv/v1/balance` |
| `list_campaigns` | GET | advert · `/adv/v1/promotion/count` |
| `get_campaign_stats` | POST | advert · `/adv/v2/fullstats` |

## Ограничение частоты запросов

Wildberries считает запросы **по каждой категории API отдельно**, а не одним общим пулом, и
возвращает `409` как штраф за всплески. Клиент держит по одному token-bucket лимитеру **на хост**
плюс более узкие корзины для самых строгих эндпоинтов:

- Token-bucket на каждый хост с минимальным интервалом между запросами.
- Обработка штрафа `409`: читает `X-Ratelimit-Retry-After` / `X-Ratelimit-Remaining`,
  списывает штрафные токены и ждёт указанное время перед повтором — штраф остаётся
  изолированным внутри провинившейся категории.
- Жёсткие лимиты по эндпоинтам (создание и скачивание платного хранения 1/мин, статус 1/5 с; цены ~10/6 с).

Значения по умолчанию сознательно консервативны — их безопасно поднять, когда вы увидите реальные
лимиты своего аккаунта. Настраивать ничего не нужно.

## Конфигурация

| Переменная | Обяз. | Описание |
|----------|----------|-------------|
| `WB_API_TOKEN` | да | Токен Wildberries Seller API (JWT). |
| `WB_TIMEOUT_MS` | нет | Таймаут запроса в мс (по умолчанию 30000). |
| `PORT` | нет | HTTP-порт при запуске с `--http` (по умолчанию 3000). |

HTTP-эндпоинты (`--http`): `POST /mcp` (запросы), `GET /health` (`{ status, version, tools }`).

## Демо-промпты

> «Покажи первые 50 товаров каталога с текущими ценами.»
> «Сделай ABC-анализ за последние 30 дней — какие товары дают 80% выручки?»
> «Создай поставку FBS „Утро 2026-06-23“, добавь заказы 1001 и 1002, закрой её на отгрузку и дай штрихкод.»
> «Покажи неотвеченные вопросы и набросай ответ на первый.»
> «Какой у меня рекламный баланс и какие кампании активны?»

## Разработка

```bash
git clone https://github.com/theYahia/wildberries-mcp.git
cd wildberries-mcp
npm install
npm run build
npm test
```

## Лицензия

MIT — см. [LICENSE](./LICENSE).

---

Часть [WWmcp](https://github.com/theYahia/WWmcp) · Telegram: [@vhodvai](https://t.me/vhodvai)
