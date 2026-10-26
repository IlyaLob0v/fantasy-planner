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
            commands::rest_actions::create_rest_action,
            commands::rest_actions::archive_rest_action,
            commands::rituals::list_rituals,
            commands::rituals::create_ritual,
            commands::rituals::update_ritual,
            commands::rituals::archive_ritual,
            commands::rituals::list_ritual_completions,
            commands::rewards::list_rewards,
            commands::rewards::create_reward,
            commands::rewards::update_reward,
            commands::rewards::archive_reward,
            commands::inventory::list_inventory,
            commands::inventory::redeem_item,
            commands::settings::set_setting,
            commands::outcome::commit_outcome,
            commands::chronicle::list_chronicle,
            commands::chronicle::save_chronicle,
            commands::locations::list_locations,
            commands::locations::set_home,
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|err| {
            eprintln!("Не удалось запустить приложение: {err}");
            std::process::exit(1);
        });
}
