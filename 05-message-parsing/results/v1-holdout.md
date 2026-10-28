# Результаты: промпт v1, набор holdout

28.10.2026, 21:52:10 (МСК) · deepseek-chat, температура 0, JSON mode

Сообщений разобрано полностью верно: 7 из 14 (50%).

| Поле | Верно |
| --- | --- |
| intent | 13 из 14 (93%) |
| articles | 13 из 14 (93%) |
| brands | 8 из 14 (57%) |
| in_stock_only | 14 из 14 (100%) |
| order_number | 14 из 14 (100%) |
| vin | 14 из 14 (100%) |

## Ошибки

| Сообщение | Поле | Ожидалось | Получено |
| --- | --- | --- | --- |
| h-delphi-cyrillic: «дельфи LP1645 колодки есть сегодня?» | brands | ["DELPHI"] | ["дельфи"] |
| h-hengst-spaced: «hengst e 340 h d 246 аналог подешевле» | brands | ["HENGST"] | ["Hengst"] |
| h-toyota-oem: «Toyota 04465-33450 оригинал или аналог» | brands | ["TOYOTA"] | ["Toyota"] |
| h-wait-ok: «свечи бош FR7DCX+ можно под заказ, подожду» | brands | ["BOSCH"] | ["Bosch"] |
| h-change-order: «в заказе №Z-881 поменяйте адрес доставки» | intent | "order" | "other" |
| h-two-brands-cyrillic: «что лучше на замену: сваг 30 91 0001 или лукас LP1645» | articles | ["30910001","LP1645"] | ["30 91 0001","LP1645"] |
| h-two-brands-cyrillic: «что лучше на замену: сваг 30 91 0001 или лукас LP1645» | brands | ["SWAG","LUCAS"] | ["Swag","Lucas"] |
| h-oil-volume: «Castrol Edge 5W-40 4л в наличии?» | brands | ["CASTROL"] | ["Castrol"] |
