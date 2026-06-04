mod strip;

use serde::Serialize;
use serde_json::Value;
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

const MEDIA_EXTS: &[&str] = &[
    "jpg", "jpeg", "png", "webp", "heic", "heif", // images
    "mov", "mp4", "m4v", "qt", // video
];
const VIDEO_EXTS: &[&str] = &["mov", "mp4", "m4v", "qt"];

fn is_video(p: &str) -> bool {
    let l = p.to_lowercase();
    VIDEO_EXTS.iter().any(|e| l.ends_with(&format!(".{e}")))
}

/// Locate a CLI binary; GUI apps launched from Finder don't inherit a shell PATH,
/// so check the common Homebrew/system locations explicitly.
fn find_bin(name: &str) -> Option<String> {
    for dir in ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"] {
        let full = format!("{dir}/{name}");
        if Path::new(&full).is_file() {
            return Some(full);
        }
    }
    None
}

/// Expand any dropped folders into their media files (recursively).
fn expand_paths(paths: Vec<String>) -> Vec<String> {
    let mut out = Vec::new();
    for p in paths {
        let pb = PathBuf::from(&p);
        if pb.is_dir() {
            collect_media(&pb, &mut out);
        } else {
            out.push(p);
        }
    }
    out
}

fn collect_media(dir: &Path, out: &mut Vec<String>) {
    if let Ok(rd) = std::fs::read_dir(dir) {
        for entry in rd.flatten() {
            let path = entry.path();
            if path.is_dir() {
                collect_media(&path, out);
            } else if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                if MEDIA_EXTS.contains(&ext.to_lowercase().as_str()) {
                    out.push(path.to_string_lossy().to_string());
                }
            }
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FileInspection {
    path: String,
    name: String,
    inspection: Option<strip::Inspection>,
    error: Option<String>,
}

#[tauri::command]
fn inspect_files(paths: Vec<String>) -> Vec<FileInspection> {
    expand_paths(paths)
        .into_iter()
        .map(|p| {
            let name = file_name(&p);
            let result = if is_video(&p) {
                inspect_video(&p)
            } else {
                std::fs::read(&p)
                    .map_err(|e| format!("Couldn't read file: {}", e))
                    .and_then(|data| strip::inspect(&data))
            };
            match result {
                Ok(insp) => FileInspection { path: p, name, inspection: Some(insp), error: None },
                Err(e) => FileInspection { path: p, name, inspection: None, error: Some(e) },
            }
        })
        .collect()
}

// ---------------------------------------------------------------------------
// Video metadata (read via ffprobe)
// ---------------------------------------------------------------------------

fn parse_iso6709(s: &str) -> Option<(f64, f64)> {
    // e.g. "+34.6768+033.0240+020.000/" — first two signed numbers are lat, lon.
    let b = s.as_bytes();
    let mut nums = Vec::new();
    let mut i = 0;
    while i < b.len() && nums.len() < 2 {
        if b[i] == b'+' || b[i] == b'-' {
            let start = i;
            i += 1;
            while i < b.len() && (b[i].is_ascii_digit() || b[i] == b'.') {
                i += 1;
            }
            if let Ok(n) = s[start..i].parse::<f64>() {
                nums.push(n);
            }
        } else {
            i += 1;
        }
    }
    if nums.len() >= 2 {
        Some((nums[0], nums[1]))
    } else {
        None
    }
}

fn collect_tags(json: &Value, tags: &mut BTreeMap<String, String>) {
    let mut take = |obj: Option<&serde_json::Map<String, Value>>| {
        if let Some(o) = obj {
            for (k, v) in o {
                if let Some(s) = v.as_str() {
                    if !s.trim().is_empty() {
                        tags.entry(k.to_lowercase()).or_insert_with(|| s.trim().to_string());
                    }
                }
            }
        }
    };
    take(json.get("format").and_then(|f| f.get("tags")).and_then(|t| t.as_object()));
    if let Some(streams) = json.get("streams").and_then(|s| s.as_array()) {
        for s in streams {
            take(s.get("tags").and_then(|t| t.as_object()));
        }
    }
}

fn inspect_video(path: &str) -> Result<strip::Inspection, String> {
    let bin = ffprobe_bin()
        .ok_or_else(|| "ffmpeg not found — run `brew install ffmpeg` to handle video.".to_string())?;
    let out = std::process::Command::new(bin)
        .args(["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams"])
        .arg(path)
        .output()
        .map_err(|e| format!("Couldn't run ffprobe: {}", e))?;
    if !out.status.success() {
        return Err("Couldn't read video metadata.".to_string());
    }
    let json: Value = serde_json::from_slice(&out.stdout).map_err(|e| e.to_string())?;
    let total_bytes = std::fs::metadata(path).map(|m| m.len() as usize).unwrap_or(0);

    let mut tags = BTreeMap::new();
    collect_tags(&json, &mut tags);
    let get = |keys: &[&str]| -> Option<String> {
        keys.iter().find_map(|k| tags.get(*k).cloned())
    };

    let mut h = strip::ExifHighlights::default();
    if let Some(loc) = get(&["com.apple.quicktime.location.iso6709", "location", "location-eng"]) {
        if let Some((lat, lon)) = parse_iso6709(&loc) {
            h.gps = Some(format!("{:.6}, {:.6}", lat, lon));
            h.gps_maps_url = Some(format!("https://www.google.com/maps?q={:.6},{:.6}", lat, lon));
        }
    }
    let make = get(&["com.apple.quicktime.make", "make"]);
    let model = get(&["com.apple.quicktime.model", "model"]);
    h.camera = match (make, model) {
        (Some(a), Some(b)) => Some(format!("{} {}", a, b)),
        (Some(a), None) => Some(a),
        (None, Some(b)) => Some(b),
        _ => None,
    };
    h.date_time = get(&["com.apple.quicktime.creationdate", "creation_time", "date"]);
    h.software = get(&["com.apple.quicktime.software", "encoder"]);
    h.other_count = tags.len();

    let mut blocks = Vec::new();
    if h.gps.is_some() {
        blocks.push(strip::MetadataBlock { label: "Location".to_string(), bytes: 0 });
    }
    if h.camera.is_some() {
        blocks.push(strip::MetadataBlock { label: "Device".to_string(), bytes: 0 });
    }
    if h.date_time.is_some() {
        blocks.push(strip::MetadataBlock { label: "Creation date".to_string(), bytes: 0 });
    }

    Ok(strip::Inspection {
        format: strip::ImageFormat::Video,
        total_bytes,
        metadata_bytes: 0,
        has_metadata: !tags.is_empty(),
        blocks,
        highlights: h,
        note: Some("Video — scrubs to a clean copy (lossless remux)".to_string()),
    })
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
    note: Option<String>,
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
            note: None,
        }
    }
}

#[tauri::command]
fn scrub_files(paths: Vec<String>, overwrite: bool) -> Vec<ScrubResult> {
    expand_paths(paths)
        .into_iter()
        .map(|p| scrub_one(p, overwrite))
        .collect()
}

fn scrub_one(p: String, overwrite: bool) -> ScrubResult {
    let name = file_name(&p);
    let path = PathBuf::from(&p);

    if is_video(&p) {
        return scrub_video(p, &path, name, overwrite);
    }

    let original = match std::fs::read(&path) {
        Ok(d) => d,
        Err(e) => return ScrubResult::failed(p, name, 0, format!("Couldn't read file: {}", e)),
    };
    let original_bytes = original.len();

    // HEIC can't be stripped in place — convert to a clean JPEG via macOS `sips`.
    if strip::detect_format(&original) == Some(strip::ImageFormat::Heic) {
        return scrub_heic(p, &path, name, original_bytes);
    }

    let (out, removed, _fmt) = match strip::strip(&original) {
        Ok(r) => r,
        Err(e) => return ScrubResult::failed(p, name, original_bytes, e),
    };
    let bytes_removed: usize = removed.iter().map(|b| b.bytes).sum();

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
            note: None,
        };
    }

    let out_path = if overwrite { path.clone() } else { cleaned_path(&path) };
    match std::fs::write(&out_path, &out) {
        Ok(_) => ScrubResult {
            path: p,
            name,
            output_name: out_path.file_name().map(|s| s.to_string_lossy().to_string()),
            output_path: Some(out_path.to_string_lossy().to_string()),
            removed,
            bytes_removed,
            original_bytes,
            cleaned_bytes: out.len(),
            error: None,
            note: None,
        },
        Err(e) => ScrubResult::failed(p, name, original_bytes, format!("Couldn't write output: {}", e)),
    }
}

/// HEIC → convert to JPEG with `sips`, then strip the JPEG so nothing leaks through.
fn scrub_heic(p: String, path: &Path, name: String, original_bytes: usize) -> ScrubResult {
    let stem = path
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "image".to_string());
    let parent = path.parent().unwrap_or_else(|| Path::new("."));
    let out_path = parent.join(format!("{}-clean.jpg", stem));
    let tmp = std::env::temp_dir().join(format!("scrub-heic-{}-{}.jpg", std::process::id(), stem));

    match std::process::Command::new("sips")
        .args(["-s", "format", "jpeg"])
        .arg(path)
        .arg("--out")
        .arg(&tmp)
        .output()
    {
        Ok(o) if o.status.success() => {}
        Ok(o) => {
            let _ = std::fs::remove_file(&tmp);
            return ScrubResult::failed(
                p,
                name,
                original_bytes,
                format!("HEIC conversion failed: {}", String::from_utf8_lossy(&o.stderr).trim()),
            );
        }
        Err(e) => return ScrubResult::failed(p, name, original_bytes, format!("Couldn't run sips: {}", e)),
    }

    let jpeg = match std::fs::read(&tmp) {
        Ok(d) => d,
        Err(e) => {
            let _ = std::fs::remove_file(&tmp);
            return ScrubResult::failed(p, name, original_bytes, format!("Conversion read failed: {}", e));
        }
    };
    let (clean, mut removed, _f) = match strip::strip(&jpeg) {
        Ok(r) => r,
        Err(e) => {
            let _ = std::fs::remove_file(&tmp);
            return ScrubResult::failed(p, name, original_bytes, e);
        }
    };
    let _ = std::fs::remove_file(&tmp);

    if removed.is_empty() {
        removed.push(strip::MetadataBlock { label: "metadata".to_string(), bytes: 0 });
    }
    let bytes_removed: usize = removed.iter().map(|b| b.bytes).sum();

    match std::fs::write(&out_path, &clean) {
        Ok(_) => ScrubResult {
            path: p,
            name,
            output_name: out_path.file_name().map(|s| s.to_string_lossy().to_string()),
            output_path: Some(out_path.to_string_lossy().to_string()),
            removed,
            bytes_removed,
            original_bytes,
            cleaned_bytes: clean.len(),
            error: None,
            note: Some("Converted HEIC → clean JPEG".to_string()),
        },
        Err(e) => ScrubResult::failed(p, name, original_bytes, format!("Couldn't write output: {}", e)),
    }
}

/// Video → remux with ffmpeg, dropping all metadata while copying the streams (lossless).
fn scrub_video(p: String, path: &Path, name: String, overwrite: bool) -> ScrubResult {
    let original_bytes = std::fs::metadata(path).map(|m| m.len() as usize).unwrap_or(0);
    let bin = match ffmpeg_bin() {
        Some(b) => b,
        None => {
            return ScrubResult::failed(
                p,
                name,
                original_bytes,
                "ffmpeg not found — run `brew install ffmpeg` to scrub video.".to_string(),
            )
        }
    };
    let removed = inspect_video(&p).map(|i| i.blocks).unwrap_or_default();

    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("mp4").to_string();
    let stem = path
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "video".to_string());
    let parent = path.parent().unwrap_or_else(|| Path::new("."));

    let scratch = std::env::temp_dir().join(format!("scrub-vid-{}-{}.{}", std::process::id(), stem, ext));
    let final_path = if overwrite { path.to_path_buf() } else { parent.join(format!("{}-clean.{}", stem, ext)) };

    match std::process::Command::new(&bin)
        .args(["-y", "-i"])
        .arg(path)
        .args(["-map_metadata", "-1", "-c", "copy", "-movflags", "+faststart"])
        .arg(&scratch)
        .output()
    {
        Ok(o) if o.status.success() => {}
        Ok(o) => {
            let _ = std::fs::remove_file(&scratch);
            let tail = String::from_utf8_lossy(&o.stderr);
            return ScrubResult::failed(
                p,
                name,
                original_bytes,
                format!("ffmpeg failed: {}", tail.lines().last().unwrap_or("").trim()),
            );
        }
        Err(e) => return ScrubResult::failed(p, name, original_bytes, format!("Couldn't run ffmpeg: {}", e)),
    }

    // Move the remuxed file into place.
    if std::fs::rename(&scratch, &final_path).is_err() {
        if let Err(e) = std::fs::copy(&scratch, &final_path) {
            let _ = std::fs::remove_file(&scratch);
            return ScrubResult::failed(p, name, original_bytes, format!("Couldn't write output: {}", e));
        }
        let _ = std::fs::remove_file(&scratch);
    }

    let cleaned_bytes = std::fs::metadata(&final_path).map(|m| m.len() as usize).unwrap_or(0);
    ScrubResult {
        path: p,
        name,
        output_name: final_path.file_name().map(|s| s.to_string_lossy().to_string()),
        output_path: Some(final_path.to_string_lossy().to_string()),
        removed,
        bytes_removed: original_bytes.saturating_sub(cleaned_bytes),
        original_bytes,
        cleaned_bytes,
        error: None,
        note: Some("Remuxed without metadata (lossless, no re-encode)".to_string()),
    }
}

fn ffmpeg_bin() -> Option<String> {
    find_bin("ffmpeg")
}
fn ffprobe_bin() -> Option<String> {
    find_bin("ffprobe")
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

/// Open a URL (e.g. a Maps link for embedded GPS) in the default browser.
#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    std::process::Command::new("open")
        .arg(&url)
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
            reveal_in_finder,
            open_url
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
