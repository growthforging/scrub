mod strip;

use serde::Serialize;
use std::path::{Path, PathBuf};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FileInspection {
    path: String,
    name: String,
    inspection: Option<strip::Inspection>,
    error: Option<String>,
}

/// Read each file and report what metadata it carries — without modifying it.
#[tauri::command]
fn inspect_files(paths: Vec<String>) -> Vec<FileInspection> {
    paths
        .into_iter()
        .map(|p| {
            let name = file_name(&p);
            match std::fs::read(&p) {
                Ok(data) => match strip::inspect(&data) {
                    Ok(insp) => FileInspection {
                        path: p,
                        name,
                        inspection: Some(insp),
                        error: None,
                    },
                    Err(e) => FileInspection {
                        path: p,
                        name,
                        inspection: None,
                        error: Some(e),
                    },
                },
                Err(e) => FileInspection {
                    path: p,
                    name,
                    inspection: None,
                    error: Some(format!("Couldn't read file: {}", e)),
                },
            }
        })
        .collect()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ScrubResult {
    path: String,
    name: String,
    output_path: Option<String>,
    output_name: Option<String>,
    removed: Vec<strip::MetadataBlock>,
    bytes_removed: usize,
    original_bytes: usize,
    cleaned_bytes: usize,
    error: Option<String>,
}

impl ScrubResult {
    fn failed(path: String, name: String, original_bytes: usize, error: String) -> Self {
        ScrubResult {
            path,
            name,
            output_path: None,
            output_name: None,
            removed: Vec::new(),
            bytes_removed: 0,
            original_bytes,
            cleaned_bytes: 0,
            error: Some(error),
        }
    }
}

/// Strip metadata from each file, writing a cleaned copy (or overwriting).
#[tauri::command]
fn scrub_files(paths: Vec<String>, overwrite: bool) -> Vec<ScrubResult> {
    paths.into_iter().map(|p| scrub_one(p, overwrite)).collect()
}

fn scrub_one(p: String, overwrite: bool) -> ScrubResult {
    let name = file_name(&p);
    let path = PathBuf::from(&p);

    let original = match std::fs::read(&path) {
        Ok(d) => d,
        Err(e) => return ScrubResult::failed(p, name, 0, format!("Couldn't read file: {}", e)),
    };
    let original_bytes = original.len();

    let (out, removed, _fmt) = match strip::strip(&original) {
        Ok(r) => r,
        Err(e) => return ScrubResult::failed(p, name, original_bytes, e),
    };
    let bytes_removed: usize = removed.iter().map(|b| b.bytes).sum();

    // Already clean — don't litter the folder with an identical copy.
    if removed.is_empty() {
        return ScrubResult {
            path: p,
            name,
            output_path: None,
            output_name: None,
            removed,
            bytes_removed: 0,
            original_bytes,
            cleaned_bytes: original_bytes,
            error: None,
        };
    }

    let out_path = if overwrite {
        path.clone()
    } else {
        cleaned_path(&path)
    };

    match std::fs::write(&out_path, &out) {
        Ok(_) => ScrubResult {
            path: p,
            name,
            output_name: out_path
                .file_name()
                .map(|s| s.to_string_lossy().to_string()),
            output_path: Some(out_path.to_string_lossy().to_string()),
            removed,
            bytes_removed,
            original_bytes,
            cleaned_bytes: out.len(),
            error: None,
        },
        Err(e) => ScrubResult::failed(
            p,
            name,
            original_bytes,
            format!("Couldn't write output: {}", e),
        ),
    }
}

/// Reveal a file in Finder (macOS).
#[tauri::command]
fn reveal_in_finder(path: String) -> Result<(), String> {
    std::process::Command::new("open")
        .arg("-R")
        .arg(&path)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

fn file_name(p: &str) -> String {
    Path::new(p)
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| p.to_string())
}

fn cleaned_path(p: &Path) -> PathBuf {
    let stem = p
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "image".to_string());
    let parent = p.parent().unwrap_or_else(|| Path::new("."));
    let filename = match p.extension() {
        Some(ext) => format!("{}-clean.{}", stem, ext.to_string_lossy()),
        None => format!("{}-clean", stem),
    };
    parent.join(filename)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            inspect_files,
            scrub_files,
            reveal_in_finder
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
