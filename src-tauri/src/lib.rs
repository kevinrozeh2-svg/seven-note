#[tauri::command]
fn fetch_ical_url(url: String) -> Result<String, String> {
    let trimmed = url.trim();
    if !trimmed.starts_with("https://") && !trimmed.starts_with("http://") {
        return Err("Solo se permiten URLs https:// o http:// para iCal.".to_string());
    }

    let curl_bin = if cfg!(target_os = "windows") { "curl.exe" } else { "curl" };
    let mut cmd = std::process::Command::new(curl_bin);
    cmd.args([
        "-fsSL",
        "--max-time",
        "15",
        "--max-filesize",
        "8388608",
        "-A",
        "SevenNote-Calendar/1.0",
        trimmed,
    ]);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let output = cmd
        .output()
        .map_err(|e| format!("No se pudo ejecutar curl: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Error al descargar iCal ({}): {}", output.status, stderr.trim()));
    }

    String::from_utf8(output.stdout)
        .map_err(|e| format!("El feed iCal no está codificado en UTF-8 válido: {}", e))
}

#[tauri::command]
fn post_calendar_webhook(url: String, payload: String) -> Result<String, String> {
    let trimmed = url.trim();
    if !trimmed.starts_with("https://script.google.com/") && !trimmed.starts_with("https://") {
        return Err("La URL del webhook debe empezar por https://".to_string());
    }

    let curl_bin = if cfg!(target_os = "windows") { "curl.exe" } else { "curl" };
    let mut cmd = std::process::Command::new(curl_bin);
    cmd.args([
        "-fsSL",
        "--max-time",
        "15",
        "-H",
        "Content-Type: application/json",
        "-d",
        &payload,
        trimmed,
    ]);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let output = cmd
        .output()
        .map_err(|e| format!("No se pudo ejecutar curl: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Error al enviar webhook ({}): {}", output.status, stderr.trim()));
    }

    String::from_utf8(output.stdout)
        .map_err(|e| format!("Respuesta no válida en UTF-8: {}", e))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![fetch_ical_url, post_calendar_webhook])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}
