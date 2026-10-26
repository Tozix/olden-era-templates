use serde::Serialize;

/// Константы игры (источник: src/data — см. README; AppId Steam: 3105440).
const STEAM_APP_ID: &str = "3105440";
const STEAM_FOLDER_NAME: &str = "Heroes of Might and Magic Olden Era";
const TEMPLATES_SUBPATH: &str = "HeroesOldenEra_Data/StreamingAssets/map_templates";

#[derive(Serialize)]
pub struct DetectResult {
    /// Найденный каталог map_templates, если игра установлена.
    pub path: Option<String>,
    /// Как найден: "registry", "libraryfolders.vdf", "fallback" или "not_found".
    pub method: String,
}

#[tauri::command]
pub fn detect_game_templates_dir() -> DetectResult {
    #[cfg(target_os = "windows")]
    {
        if let Some(p) = detect_windows_registry() {
            return DetectResult { path: Some(p), method: "registry".into() };
        }
    }
    if let Some(p) = detect_via_library_folders() {
        return DetectResult { path: Some(p), method: "libraryfolders.vdf".into() };
    }
    if let Some(p) = detect_fallback_paths() {
        return DetectResult { path: Some(p), method: "fallback".into() };
    }
    DetectResult { path: None, method: "not_found".into() }
}

/// Windows: раздел реестра, который создаёт Steam при установке игры.
#[cfg(target_os = "windows")]
fn detect_windows_registry() -> Option<String> {
    use std::process::Command;
    for key in [
        format!(r"HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\Steam App {STEAM_APP_ID}"),
        format!(r"HKLM\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\Steam App {STEAM_APP_ID}"),
    ] {
        let out = Command::new("reg")
            .args(["query", &key, "/v", "InstallLocation"])
            .output()
            .ok()?;
        let text = String::from_utf8_lossy(&out.stdout);
        for line in text.lines() {
            if let Some(idx) = line.find("REG_SZ") {
                let dir = line[idx + "REG_SZ".len()..].trim();
                if dir.is_empty() {
                    continue;
                }
                let candidate = std::path::Path::new(dir).join(TEMPLATES_SUBPATH);
                if candidate.is_dir() {
                    return candidate.to_str().map(|s| s.to_string());
                }
            }
        }
    }
    None
}

/// Все ОС: парсим libraryfolders.vdf — Steam записывает туда все свои библиотеки.
fn detect_via_library_folders() -> Option<String> {
    for vdf in library_vdf_candidates() {
        if let Ok(text) = std::fs::read_to_string(&vdf) {
            for library in parse_vdf_paths(&text) {
                let candidate = std::path::Path::new(&library)
                    .join("steamapps/common")
                    .join(STEAM_FOLDER_NAME)
                    .join(TEMPLATES_SUBPATH);
                if candidate.is_dir() {
                    return candidate.to_str().map(|s| s.to_string());
                }
            }
        }
    }
    None
}

fn library_vdf_candidates() -> Vec<std::path::PathBuf> {
    let mut out = Vec::new();
    if let Some(home) = std::env::var_os("HOME") {
        let home = std::path::PathBuf::from(home);
        // Windows: %ProgramFiles(x86)%\Steam\steamapps\libraryfolders.vdf
        #[cfg(target_os = "windows")]
        {
            if let Ok(pf) = std::env::var("ProgramFiles(x86)") {
                out.push(std::path::PathBuf::from(pf).join(r"Steam\steamapps\libraryfolders.vdf"));
            }
            if let Ok(pf) = std::env::var("ProgramFiles") {
                out.push(std::path::PathBuf::from(pf).join(r"Steam\steamapps\libraryfolders.vdf"));
            }
        }
        // macOS
        out.push(home.join("Library/Application Support/Steam/steamapps/libraryfolders.vdf"));
        out.push(home.join("Library/Application Support/Steam/config/libraryfolders.vdf"));
        // Linux
        out.push(home.join(".steam/steam/steamapps/libraryfolders.vdf"));
        out.push(home.join(".local/share/Steam/steamapps/libraryfolders.vdf"));
        out.push(home.join(".steam/root/steamapps/libraryfolders.vdf"));
    }
    out
}

/// Резервные пути без vdf: стандартный Steam-каталог каждой ОС.
fn detect_fallback_paths() -> Option<String> {
    let roots: Vec<std::path::PathBuf> = {
        let mut roots = Vec::new();
        #[cfg(target_os = "windows")]
        {
            if let Ok(pf) = std::env::var("ProgramFiles(x86)") {
                roots.push(std::path::PathBuf::from(pf).join(r"Steam\steamapps\common"));
            }
            if let Ok(pf) = std::env::var("ProgramFiles") {
                roots.push(std::path::PathBuf::from(pf).join(r"Steam\steamapps\common"));
            }
        }
        if let Some(home) = std::env::var_os("HOME") {
            let home = std::path::PathBuf::from(home);
            roots.push(home.join("Library/Application Support/Steam/steamapps/common"));
            roots.push(home.join(".steam/steam/steamapps/common"));
            roots.push(home.join(".local/share/Steam/steamapps/common"));
        }
        roots
    };
    for root in roots {
        let candidate = root.join(STEAM_FOLDER_NAME).join(TEMPLATES_SUBPATH);
        if candidate.is_dir() {
            return candidate.to_str().map(|s| s.to_string());
        }
    }
    None
}

/// Минимальный парсер libraryfolders.vdf: вытаскивает значения ключа "path".
/// Структура файла — упрощённый Valve KeyValues; значения "path" — интересуют только они.
fn parse_vdf_paths(text: &str) -> Vec<String> {
    let mut paths = Vec::new();
    let mut lines = text.lines().peekable();
    while let Some(line) = lines.next() {
        let trimmed = line.trim();
        // Ключ "path" со значением на той же строке: "path"  "C:\\Program Files (x86)\\Steam"
        if is_path_key(trimmed) {
            if let Some(value) = extract_quoted_value_after_key(trimmed, "path") {
                paths.push(unescape_vdf(&value));
                continue;
            }
            // Значение на следующей строке
            if let Some(next) = lines.peek() {
                if let Some(value) = extract_quoted_value(next.trim()) {
                    paths.push(unescape_vdf(&value));
                    let _ = lines.next();
                }
            }
        }
    }
    paths
}

fn is_path_key(line: &str) -> bool {
    let t = line.trim();
    (t.starts_with("\"path\"") || t.starts_with("\"path\" ")) || t == "\"path\""
}

fn extract_quoted_value_after_key(line: &str, key: &str) -> Option<String> {
    let after_key = line.split_once(format!("\"{key}\"").as_str())?.1;
    extract_quoted_value(after_key.trim())
}

fn extract_quoted_value(line: &str) -> Option<String> {
    let start = line.find('"')?;
    let rest = &line[start + 1..];
    let end = rest.find('"')?;
    Some(rest[..end].to_string())
}

fn unescape_vdf(value: &str) -> String {
    value.replace("\\\\", "\\")
}
