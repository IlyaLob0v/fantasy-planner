mod commands;
mod db;
mod error;
mod models;
mod sync;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            let pool = tauri::async_runtime::block_on(db::open(&dir.join("guild.db")))?;
            app.manage(db::Db(pool));
            app.manage(sync::SyncGate::default());
            // На ПК окно создаётся скрытым и показывается после миграций; на телефоне окно одно и видно сразу.
            #[cfg(desktop)]
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
            commands::ledger::list_ledger_since,
            commands::ledger::ledger_tally,
            commands::achievements::list_achievements,
            commands::gear::list_gear,
            commands::gear::list_equipment,
            commands::gear::set_equipment,
            commands::week::list_week_goals,
            commands::week::create_week_goals,
            commands::week::update_week_goal,
            commands::week::list_crest_parts,
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
            sync::sync_status,
            sync::sync_sign_in,
            sync::sync_link,
            sync::sync_now,
            sync::sync_sign_out,
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|err| {
            eprintln!("Не удалось запустить приложение: {err}");
            std::process::exit(1);
        });
}
