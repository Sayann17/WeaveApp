# Инструкция по деплою бэкенда в Яндекс Облако

Вы успешно перенесли код приложения на работу с Яндекс.Авторизацией. Теперь нужно запустить "серверную" часть.

### Шаг 1: Создание таблиц в Базе Данных (YDB)
1.  Откройте консоль Yandex Cloud -> **YDB**.
2.  Выберите вашу базу данных.
3.  Перейдите во вкладку **Навигация** (SQL).
4.  Скопируйте содержимое файла `schema.sql` (лежит в папке `backend`) и выполните, нажав **Выполнить**.
    *   *Это создаст таблицу `users`.*

### Шаг 2: Создание Cloud Function
1.  Перейдите в сервис **Cloud Functions**.
2.  Нажмите **Создать функцию**. Назовите её `auth-function`.
3.  Выберите среду выполнения: **Node.js 18** (или новее).
4.  **Способ загрузки кода:** ZIP-архив.
5.  Заархивируйте содержимое папки `backend` (файлы `index.js`, `db.js`, `package.json`).
    *   *Важно: не архивируйте саму папку backend, а выделите файлы внутри неё и добавьте в архив.*
6.  Загрузите архив.
7.  **Точка входа:** `index.handler`.
8.  **Сервисный аккаунт:** Выберите тот, который создавали ранее (с ролью `ydb.editor`).
9.  **Переменные окружения:**
    *   Добавьте переменную `JWT_SECRET` со случайным длинным значением (например, `my-super-secret-key-12345`).
10. Нажмите **Создать версию**.

### Шаг 3: Настройка API Gateway
1.  Перейдите в сервис **API Gateway**.
2.  Откройте ваш шлюз (домен которого вы мне присылали).
3.  Нажмите **Редактировать спецификацию** (YAML/OpenAPI).
4.  Замените содержимое на следующее (подставьте ID вашей функции):

```yaml
openapi: 3.0.0
info:
  title: Dating App API
  version: 1.0.0
paths:
  /register:
    post:
      x-yc-apigateway-integration:
        type: cloud_functions
        function_id: <ID_ВАШЕЙ_ФУНКЦИИ_AUTH>
      operationId: register
  /login:
    post:
      x-yc-apigateway-integration:
        type: cloud_functions
        function_id: <ID_ВАШЕЙ_ФУНКЦИИ_AUTH>
      operationId: login
  /me:
    get:
      x-yc-apigateway-integration:
        type: cloud_functions
        function_id: <ID_ВАШЕЙ_ФУНКЦИИ_AUTH>
      operationId: me
  /profile:
    post:
      x-yc-apigateway-integration:
        type: cloud_functions
        function_id: <ID_ВАШЕЙ_ФУНКЦИИ_AUTH>
      operationId: updateProfile
```
5.  Нажмите **Сохранить**.

### Готово!
Теперь приложение при нажатии "Войти" или "Регистрация" будет обращаться к вашему API Gateway, который вызовет Функцию, а она запишет данные в YDB.
