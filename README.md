# 1C RAS Enterprise Monitor

Современный веб-интерфейс для мониторинга кластера 1С:Предприятие RAS на порту 8080. Сервис построен на FastAPI и отображает ключевые показатели: инфобазы, сеансы, соединения, процессы и блокировки.

## Возможности

- Автоматический сбор данных через утилиту `rac`.
- Поддержка конфигурации через переменные окружения.
- Встроенный режим работы с тестовыми данными (fake data).
- Структурированный enterprise-дашборд: метрики и таблицы в одном экране.
- Адаптивный интерфейс на Tailwind CSS с кастомными тёмными стилями.

## Предварительные требования

- Debian 12.
- Установленный 1С:Enterprise 8.3.27.1719 (или совместимый) и запущенный сервис RAS.
- Утилита `rac` доступна по пути `/opt/1cv8/x86_64/8.3.27.1719/rac` или указанному в переменной окружения `RAC_PATH`.
- Python 3.11+

## Быстрый старт

1. Убедитесь, что сервис RAS запущен:
   ```bash
   systemctl start ras-8.3.27.1719.service
   systemctl enable ras-8.3.27.1719.service
   ```

2. Клонируйте репозиторий и установите зависимости:
   ```bash
   pip install -r requirements.txt
   ```

3. Запустите веб-сервис на порту 8080:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8080
   ```

4. Откройте браузер и перейдите на `http://<сервер>:8080`.

## Переменные окружения

| Переменная        | Значение по умолчанию                            | Описание                                |
|-------------------|--------------------------------------------------|-----------------------------------------|
| `RAC_PATH`        | `/opt/1cv8/x86_64/8.3.27.1719/rac`               | Путь к утилите `rac`                    |
| `RAS_HOST`        | `t03-1c11.fd.local`                              | Хост RAS                                |
| `RAS_PORT`        | `1545`                                           | Порт RAS                                 |
| `CLUSTER_UUID`    | Первый найденный кластер                         | UUID кластера                           |
| `RAC_TIMEOUT`     | `10`                                             | Таймаут вызова `rac` (сек.)             |
| `RAS_FAKE_DATA`   | –                                                | Путь к каталогу с тестовыми данными     |

### Режим тестовых данных

Для отладки без доступа к реальному кластеру установите переменную окружения `RAS_FAKE_DATA` на каталог `app/fake_data`:

```bash
export RAS_FAKE_DATA=$(pwd)/app/fake_data
uvicorn app.main:app --host 0.0.0.0 --port 8080
```

## API

- `GET /api/snapshot` — сводная информация о текущем состоянии кластера.
- `GET /api/settings` — активные настройки подключения к RAS.

## Тестирование интеграции с RAS

Команды для проверки соединения и получения данных напрямую через `rac`:

```bash
RAC=${RAC_PATH:-/opt/1cv8/x86_64/8.3.27.1719/rac}
RAS_HOST=${RAS_HOST:-t03-1c11.fd.local}
RAS_PORT=${RAS_PORT:-1545}
RAS="$RAS_HOST:$RAS_PORT"

$RAC cluster list "$RAS"
CL=$($RAC cluster list "$RAS" | awk '$1=="cluster"{print $3; exit}')
$RAC infobase summary list --cluster "$CL" "$RAS"
$RAC session list --cluster "$CL" "$RAS"
$RAC connection list --cluster "$CL" "$RAS"
$RAC process list --cluster "$CL" "$RAS"
$RAC lock list --cluster "$CL" "$RAS"
$RAC session list --cluster "$CL" --licenses "$RAS"
```

Эти же команды использует сервис для построения веб-интерфейса.
