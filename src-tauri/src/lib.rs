mod commands;
mod db;
mod error;
mod models;

use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            let pool = tauri::async_runtime::block_on(db::open(&dir.join("guild.db")))?;
            app.manage(db::Db(pool));
            if let Some(window) = app.get_webview_window("main") {
                window.show()?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::character::get_character,
            commands::character::rename_character,
            commands::settings::get_settings,
            commands::quests::list_quests,
            commands::quests::create_quest,
            commands::quests::update_quest,
            commands::quests::archive_quest,
            commands::days::list_days,
            commands::ledger::list_ledger_for_date,
            commands::rest_actions::list_rest_actions,
            commands::outcome::commit_outcome,
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|err| {
            eprintln!("Не удалось запустить приложение: {err}");
            std::process::exit(1);
        });
}
