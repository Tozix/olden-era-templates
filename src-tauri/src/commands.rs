use serde::Deserialize;

/// Запись бинарного файла по произвольному пути (диалог сохранения может
/// указать любую папку — scoped fs-плагин туда не пускает, поэтому пишем
/// нативной командой). Только явные вызовы из окна, без чтения.
#[derive(Deserialize)]
pub struct WriteBytesArgs {
    pub path: String,
    pub bytes: Vec<u8>,
}

#[tauri::command]
pub fn write_file_bytes(path: String, bytes: Vec<u8>) -> Result<(), String> {
    std::fs::write(&path, bytes).map_err(|e| format!("Не удалось записать файл: {e}"))
}

#[tauri::command]
pub fn reveal_in_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-R", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .args(["/select,", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        if let Some(parent) = std::path::Path::new(&path).parent() {
            std::process::Command::new("xdg-open")
                .arg(parent)
                .spawn()
                .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}
