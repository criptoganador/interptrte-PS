use tauri::{Manager, WindowBuilder, WindowUrl};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      WindowBuilder::new(
        app,
        "main",
        WindowUrl::External("https://interptrte-ps.onrender.com".parse().unwrap()),
      )
      .title("InterptrtePS")
      .inner_size(1280.0, 820.0)
      .resizable(true)
      .build()?;

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
    .expect("error while running tauri application");
}
