mod commands;
mod steam_detect;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            steam_detect::detect_game_templates_dir,
            commands::write_file_bytes,
            commands::reveal_in_folder
        ])
        .run(tauri::generate_context!())
        .expect("ошибка запуска приложения Olden Era Templates");
}
