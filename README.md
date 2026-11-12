# DuckBot v1 (legacy)

Малоизвестный, но полезный бот живущий на пару-тройке серверов. Ныне заброшен создателем и на аппарате жизнеобеспечения

## Стек

- **Node.js 22** + [discord.js](https://discord.js.org/) v14
- **MongoDB 5** (через [mongoose](https://mongoosejs.com/) + [agenda](https://github.com/agenda/agenda) для задач по расписанию)
- **Docker Compose** для воспроизводимого окружения

## Быстрый старт

```sh
cp app/.env.default app/.env   # затем заполните TOKEN и прочее
docker compose up -d --build
```

Или через make:

```sh
make up        # создать app/.env (если нужно) и поднять контейнеры
make logs      # смотреть логи бота
make restart   # пересобрать и перезапустить только бота
make shell     # шелл внутри контейнера
make down      # остановить
make help      # список команд
```

Бот подключается к базе `mongo_db` из compose-файла. Строка подключения
собирается из `MONGO_INITDB_ROOT_USERNAME`/`MONGO_INITDB_ROOT_PASSWORD`, либо
задаётся целиком через `MONGO_URL`.

## Переменные окружения (`app/.env`)

| Переменная                   | Назначение                                                       |
| ---------------------------- | ---------------------------------------------------------------- |
| `TOKEN`                      | Токен бота (обязательно).                                        |
| `GUILD_ID`                   | Гильдия для регистрации слэш-команд. Пусто — команды глобальные. |
| `DEV_ID`                     | Ваш Discord ID. Открывает доступ к команде `/eval`.              |
| `MONGO_INITDB_ROOT_USERNAME` | Логин root-пользователя MongoDB.                                 |
| `MONGO_INITDB_ROOT_PASSWORD` | Пароль root-пользователя MongoDB.                                |
| `MONGO_URL`                  | (Опционально) Полная строка подключения к MongoDB.               |

## Локальная разработка без Docker

Если удобнее запускать код на хосте:

```sh
docker compose up -d mongo_db   # только база
cd app
npm ci
npm run dev                     # node --watch, автоперезапуск при изменениях
```

В этом случае укажите в `app/.env` строку `MONGO_URL`, доступную с хоста, например
`mongodb://root:admin@localhost:27017/?authMechanism=DEFAULT` (порт базы нужно
опубликовать на хост — раскомментируйте `ports` у сервиса `mongo_db` в compose).

## Обновление

```sh
git pull
docker compose up -d --build
```

## Структура

```
app/
  index.js            точка входа: загрузка команд, событий и взаимодействий
  deploy-commands.js  регистрация слэш-команд в Discord
  mongodb.js          подключение к Mongo и планировщик agenda
  commands/           слэш-команды (moderation, roleplay, stats, utility)
  events/             обработчики событий discord.js
  interactions/       обработчики компонентов (кнопки, меню)
  models/             схемы mongoose
  utils/              общая логика
```
