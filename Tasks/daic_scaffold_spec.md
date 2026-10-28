# DAIC — специфікація каркаса та пакетів PREP-03

Дата: 28.10.2026. Статус: специфікацію підготовлено; вимоги Node і розв’язання залежностей перевірено. Компіляція, запуск і пакування ще не перевірені.

Основа: [MVP](daic_mvp.md), [технічні рішення](daic_technical_decisions.md), [середовище](daic_environment_check.md).

## Межі кроку

- **Джерело правди:** MVP визначає поведінку; цей документ — точні прямі залежності й конфігурацію майбутнього каркаса. Остаточне дерево транзитивних залежностей зафіксує lockfile каркаса.
- **Backend-контракт:** без змін; один головний процес керує станом, renderer показує локальний ресурс, зовнішнього API немає.
- **Done:** обрані точні версії, перевірені engines/peers і npm resolution, визначені команди, TypeScript, ресурси та правила Git.
- **Не робимо:** створення проєкту, встановлення node_modules, запуск lifecycle-скриптів, прикладний код, UI, збірку та інсталятор.

## 1. Генератор і зміна синтаксису Forge 8

Вибрано `create-electron-app@8.0.1` та `@electron-forge/template-webpack@8.0.1` із параметром TypeScript.

Під час перевірки registry з’ясовано: окремого `@electron-forge/template-webpack-typescript@8.0.1` немає (404). У Forge 8 TypeScript є опцією спільного шаблону Webpack. Це уточнення попереднього запису `webpack-typescript`, а не зміна стеку або перехід до UI-first.

У вихідному коді опублікованого генератора `8.0.1` перевірено підтримку `--template`, `--typescript`, `--electron-version`, `--package-manager`, `--skip-git`. Команда для майбутньої генерації в новій порожній папці:

```powershell
npx.cmd --yes create-electron-app@8.0.1 init <new-empty-directory> --template=webpack --typescript --electron-version=45.1.0 --package-manager=npm@11.19.0 --skip-git
```

`<new-empty-directory>` — позначення майбутнього унікального шляху; не запускати команду з цим буквальним текстом. Генератор у цьому кроці не запускався. Версії в його стартовому шаблоні містять діапазони: після генерації привести прямі залежності до таблиці нижче, видалити зайві пакети й лише потім створити остаточний lockfile.

## 2. Точні прямі залежності

Середовище: Node.js `24.20.0`, npm `11.19.0`, Windows x64.

| Пакет | Версія | Категорія / роль |
| --- | --- | --- |
| `electron-squirrel-startup` | `1.0.1` | Єдина прикладна `dependency`; службові запуски інсталятора |
| `electron` | `45.1.0` | `devDependency`; runtime |
| `@electron-forge/cli` | `8.0.1` | `devDependency`; команди Forge |
| `@electron-forge/shared-types` | `8.0.1` | `devDependency`; типи конфігурації |
| `@electron-forge/plugin-webpack` | `8.0.1` | `devDependency`; збирання main/renderer |
| `@electron-forge/maker-squirrel` | `8.0.1` | `devDependency`; єдиний maker |
| `@electron-forge/plugin-fuses` | `8.0.1` | `devDependency`; захисні налаштування шаблону при пакуванні |
| `@electron/fuses` | `2.1.3` | `devDependency`; peer для plugin-fuses |
| `typescript` | `6.0.3` | `devDependency`; перевірка та компіляція TS |
| `@types/node` | `24.19.2` | `devDependency`; типи Node API |
| `@types/electron-squirrel-startup` | `1.0.2` | `devDependency`; типи startup-пакета |
| `webpack` | `5.112.2` | `devDependency`; типи й інструмент збірки |
| `ts-loader` | `9.6.2` | `devDependency`; TypeScript loader |
| `loader-utils` | `3.3.1` | `devDependency`; явне виконання peer-вимоги ts-loader |
| `css-loader` | `6.11.0` | `devDependency`; обробка CSS, гілка офіційного шаблону |
| `style-loader` | `3.3.4` | `devDependency`; підключення CSS, гілка офіційного шаблону |

У майбутньому `package.json` версії записати без `^` і `~`; `package-lock.json` зберігати в Git. Для повторного встановлення використовувати `npm.cmd ci`.

TypeScript обрано з гілки `^6.0.0`, яку використовує шаблон Forge 8, хоча registry вже пропонує новішу major 7. CSS/style loaders залишені в гілках шаблону. Electron `45.1.0` є стабільним релізом із Node `24.22.1`; `@types/node` обрані з тієї самої major-гілки 24, а не за номером системного Node лише за збігом. У коді не використовувати Node API, яких немає у вбудованому runtime.

## 3. Що перевірено

1. Через `npm view` прочитано version, engines і peerDependencies пакетів. У Forge `8.0.1` вимога Node `>=22.13.0`, в Electron `45.1.0` і fuses `2.1.3` — `>=22.12.0`. Наявний Node `24.20.0` підходить.
2. `ts-loader@9.6.2` допускає Webpack 4/5, TypeScript `*`, вимагає `loader-utils`; CSS/style loaders допускають Webpack 5; plugin-fuses вимагає `@electron/fuses ^2.1.3`.
3. Прочитано архіви опублікованих генератора й Webpack-шаблону `8.0.1`: package metadata, CLI source, Forge/TS/Webpack-конфігурації. Архіви завантажено у тимчасовий каталог; код із них не виконувався.
4. Для точної таблиці створено тимчасовий manifest за межами репозиторію й виконано:

```powershell
npm.cmd install --prefix <temporary-resolution-directory> --package-lock-only --ignore-scripts --strict-peer-deps --engine-strict --no-audit --no-fund
```

Результат npm: `up to date in 20s`, exit code 0. Lockfile v3 містить 515 записів `packages`, включно з коренем; `node_modules` відсутній. Engines і peers розв’язалися без конфліктів. Перший післяпроцесний розбір lockfile через PowerShell 5 не підтримав порожній ключ кореневого пакета; читання через Node підтвердило коректний JSON.

Тимчасовий lockfile є лише доказом перевірки. Він не замінює lockfile реального проєкту після генерації та налаштування. `npm audit` тут не виконувався. Успішне resolution не доводить, що TypeScript loader, runtime і інсталятор працюють: це перевірки наступного етапу каркаса.

## 4. Конфігурація каркаса

### Forge та Webpack

- Використати `forge.config.mts`, як у шаблоні Forge 8; `package.json.main`: `.webpack/main/index.cjs`.
- Main entry: `src/main/index.ts`. Renderer entry: `src/renderer/index.ts` та `src/renderer/index.html`. Main Webpack output — `index.cjs`; не замінювати цей шлях старим прикладом із документації іншої версії.
- Залишити один `MakerSquirrel` з `name: DAIC` і обмеженням `win32`; `executableName: DAIC`, metadata — з PREP-01.
- Видалити MakerZIP/Deb/Rpm та їхні imports і залежності. Publishers, CI-файли й publish-команду не додавати.
- Залишити `asar: true` та plugin-fuses з налаштуваннями офіційного шаблону: RunAsNode/NodeOptions/NodeCliInspect вимкнені, cookie encryption/ASAR integrity/OnlyLoadAppFromAsar увімкнені. Перевірити packaged exe з цими налаштуваннями на етапі каркаса.
- Видалити auto-unpack-natives plugin, node-loader і asset-relocator-loader та відповідні правила: власних native-модулів немає.
- Для TS використовувати `ts-loader` із `transpileOnly: false`; окремий fork-ts-checker plugin не потрібен. Повна команда typecheck залишається окремим обов’язковим кроком.
- `webpack-cli` не додавати: Webpack запускає Forge plugin. Лінтери/форматери oxlint/oxfmt зі стартового шаблону й пов’язані scripts поки прибрати; вони не є умовою цього MVP.
- PNG/ICO обробляти штатним Webpack 5 `asset/resource` там, де потрібен імпорт. Окремі file/url loaders не додавати.
- Renderer завантажувати через визначений Forge `MAIN_WINDOW_WEBPACK_ENTRY`, із явною TS-декларацією. Preload та IPC не включати до першого каркаса без потреби, визначеної PREP-04.

### TypeScript

- `strict: true`, `noEmit` тільки в команді typecheck, `target: ES2022`, `module: preserve`, `moduleResolution: bundler`, `esModuleInterop: true`, `resolveJsonModule: true`, `sourceMap: true`.
- `allowJs: false`; `skipLibCheck: true` допустимий для типів залежностей і не вимикає strict-перевірку власного коду.
- Включити `src/**/*.ts`, декларації модулів ресурсів, кореневі `*.ts` і `*.mts` конфігурації; виключити `node_modules`, `.webpack`, `out`.
- Типи renderer обмежити DOM і потрібними деклараціями; відсутність Node-доступу в renderer гарантується також Electron webPreferences, не лише TS-конфігурацією.

### Команди майбутнього package.json

| Script | Значення | Перевірка |
| --- | --- | --- |
| `start` | `electron-forge start` | Dev-запуск |
| `typecheck` | `tsc --noEmit` | Власний код і конфігурації без помилок типів |
| `package` | `electron-forge package --platform=win32 --arch=x64` | Запуск packaged exe |
| `make` | `electron-forge make --platform=win32 --arch=x64` | Встановлення й запуск установленої версії |

З PowerShell: `npm.cmd run typecheck`, `npm.cmd start`, `npm.cmd run package`, `npm.cmd run make`. Повторне встановлення: `npm.cmd ci`. Збірка без помилок не замінює сценарії запуску.

## 5. Ресурси в dev та встановленій програмі

- Фінальні оригінали зберігати в `assets/yi.png`, `assets/tray.ico`, `assets/app.ico`; `img/` не перейменовувати й не переносити автоматично — його вміст ще належить оцінити в PREP-05.
- Для renderer PNG імпортувати як Webpack asset/resource з одного модуля конфігурації персонажа; Webpack формує URL під dev server і локальну збірку. Не прописувати абсолютний шлях `L:\daic` чи localhost у прикладному коді.
- Висота 128 логічних px та відступ 24 — єдині конфігураційні значення для main/renderer, узгодити розміщення конфігурації в PREP-04. Розмір і шлях PNG не дублювати в HTML/CSS/TS.
- Для native API трея копіювати `assets/` через `packagerConfig.extraResource` до `resources/assets`. У dev шукати від кореня застосунку, у packaged — від `process.resourcesPath`; вибір режиму робить main через `app.isPackaged`.
- Таким чином renderer отримує PNG як bundled asset, а Tray — реальний файл поза ASAR. Невелике дублювання PNG у пакеті допустиме; додаткові copy-плагіни не потрібні.
- `assets/app.ico` задати як build-time icon пакувальника й Squirrel setupIcon; `assets/tray.ico` залишити окремим ресурсом для читабельності малого значка.
- Відсутні фінальні ресурси не видавати за готові. До make мають існувати коректні ICO; тестові ресурси каркаса, якщо знадобляться раніше PREP-05, позначати як тимчасові.

## 6. Git і чисте відтворення

Майбутній `.gitignore`: `node_modules/`, `.webpack/`, `out/`, `*.log`, `.npm-cache/`, локальні тимчасові папки каркаса, `.env`/локальні секрети, сертифікати `*.pfx`/`*.p12`/приватні ключі. Якщо додаватиметься `.env.example`, він має залишатися відстежуваним.

У Git зберігати `package.json`, `package-lock.json`, конфігурації, код, фінальні PNG/ICO та документацію. `assets/` й `img/` не ігнорувати загальним правилом. Інсталятори з `out/` не комітити.

При створенні каркаса: перевірити Git-стан і зберегти сторонні файли → генерація в новій тимчасовій папці → приведення до специфікації → перенесення без перезапису `.git/`, `Tasks/`, `img/` → створення остаточного lockfile → чисте `npm.cmd ci` → typecheck/start/package/make з фактичними сценаріями.

## Завершення кроку

PREP-03 завершено як підготовку специфікації й перевірку metadata/resolution. Каркас не створювався; runtime та інсталятор не перевірені. Наступний крок — PREP-04, контракт головного процесу.

**Перезбірка:** не потрібна. **Перезапуск:** не потрібний. **Що перевірити зараз:** точні версії та межі видалених шаблонних пакетів у цьому документі. **Що перевірити після каркаса:** `npm ci`, typecheck, dev-запуск, packaged exe, встановлену програму.

## Джерела

- [Офіційний release Electron 45.1.0, вбудований Node](https://releases.electronjs.org/release/v45.1.0).
- [Registry metadata генератора 8.0.1](https://registry.npmjs.org/create-electron-app/8.0.1).
- [Registry metadata офіційного Webpack-шаблону 8.0.1](https://registry.npmjs.org/@electron-forge/template-webpack/8.0.1); CLI та конфігурації прочитані з tarball, указаного в metadata.
- [Forge Webpack plugin: entry points і ресурси](https://www.electronforge.io/config/plugins/webpack). За розбіжностей прикладів із кодом версії 8.0.1 враховувати перевірений versioned template.
- [Forge Squirrel.Windows](https://www.electronforge.io/config/makers/squirrel.windows).
