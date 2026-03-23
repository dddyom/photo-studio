# Сборка Photo Studio на Windows

## 1. Установить необходимое

### Rust
Скачать и запустить: https://rustup.rs
При установке выбрать "Default" (установит MSVC toolchain).

### Node.js
Скачать LTS: https://nodejs.org
При установке поставить галочку "Add to PATH".

### pnpm
После установки Node.js открыть PowerShell и выполнить:
```
npm install -g pnpm
```

### Visual Studio Build Tools
Если при установке Rust не установились — скачать:
https://visualstudio.microsoft.com/visual-cpp-build-tools/

Выбрать "Desktop development with C++".

### WebView2
Обычно уже есть в Windows 10/11. Если нет:
https://developer.microsoft.com/microsoft-edge/webview2/

## 2. Распаковать исходники

Распаковать `photo-studio-src.tar.gz` в любую папку, например `C:\photo-studio`.

## 3. Установить зависимости

Открыть PowerShell в папке проекта:
```
cd C:\photo-studio
pnpm install
```

## 4. Собрать

```
pnpm tauri build
```

Сборка займёт несколько минут. Результат:
- `src-tauri\target\release\Photo Studio.exe` — бинарник
- `src-tauri\target\release\bundle\msi\*.msi` — установщик MSI
- `src-tauri\target\release\bundle\nsis\*.exe` — установщик NSIS

## 5. Готово

Установщик MSI или NSIS можно передать заказчику.
Бинарник `Photo Studio.exe` тоже работает без установки.
