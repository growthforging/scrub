//! Lossless image metadata stripping.
//!
//! We parse the container format (JPEG marker segments / PNG chunks) and drop
//! only the metadata blocks — EXIF/GPS, XMP, IPTC, comments, text chunks,
//! timestamps. Pixel data, color profiles (ICC) and rendering chunks are kept
//! byte-for-byte, so the image is never re-encoded and never degraded.

use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ImageFormat {
    Jpeg,
    Png,
}

/// A single block of metadata that was (or would be) removed.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MetadataBlock {
    pub label: String,
    pub bytes: usize,
}

/// Human-readable highlights decoded from EXIF — the scary stuff.
#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExifHighlights {
    pub gps: Option<String>,
    pub gps_maps_url: Option<String>,
    pub camera: Option<String>,
    pub date_time: Option<String>,
    pub software: Option<String>,
    pub other_count: usize,
}

/// Result of inspecting a file without modifying it.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Inspection {
    pub format: ImageFormat,
    pub total_bytes: usize,
    pub metadata_bytes: usize,
    pub blocks: Vec<MetadataBlock>,
    pub highlights: ExifHighlights,
    pub has_metadata: bool,
}

pub fn detect_format(data: &[u8]) -> Option<ImageFormat> {
    const PNG_SIG: [u8; 8] = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    if data.len() >= 3 && data[0] == 0xFF && data[1] == 0xD8 && data[2] == 0xFF {
        Some(ImageFormat::Jpeg)
    } else if data.starts_with(&PNG_SIG) {
        Some(ImageFormat::Png)
    } else {
        None
    }
}

/// Inspect bytes: report format, metadata blocks present, and EXIF highlights.
pub fn inspect(data: &[u8]) -> Result<Inspection, String> {
    let format = detect_format(data).ok_or_else(|| {
        "Unsupported file type — Scrub handles JPEG and PNG for now.".to_string()
    })?;
    let (_, blocks) = walk(format, data)?;
    let metadata_bytes = blocks.iter().map(|b| b.bytes).sum();
    Ok(Inspection {
        format,
        total_bytes: data.len(),
        metadata_bytes,
        has_metadata: !blocks.is_empty(),
        blocks,
        highlights: exif_highlights(data),
    })
}

/// Strip bytes: return cleaned image + the blocks that were removed.
pub fn strip(data: &[u8]) -> Result<(Vec<u8>, Vec<MetadataBlock>, ImageFormat), String> {
    let format = detect_format(data).ok_or_else(|| {
        "Unsupported file type — Scrub handles JPEG and PNG for now.".to_string()
    })?;
    let (out, blocks) = walk(format, data)?;
    Ok((out, blocks, format))
}

fn walk(format: ImageFormat, data: &[u8]) -> Result<(Vec<u8>, Vec<MetadataBlock>), String> {
    match format {
        ImageFormat::Jpeg => strip_jpeg(data),
        ImageFormat::Png => strip_png(data),
    }
}

// ---------------------------------------------------------------------------
// JPEG
// ---------------------------------------------------------------------------

fn strip_jpeg(data: &[u8]) -> Result<(Vec<u8>, Vec<MetadataBlock>), String> {
    if data.len() < 2 || data[0] != 0xFF || data[1] != 0xD8 {
        return Err("Not a valid JPEG file.".to_string());
    }
    let mut out = Vec::with_capacity(data.len());
    let mut removed = Vec::new();
    out.extend_from_slice(&data[0..2]); // SOI
    let mut i = 2usize;

    while i + 1 < data.len() {
        if data[i] != 0xFF {
            // Misaligned — copy the remainder verbatim and stop.
            out.extend_from_slice(&data[i..]);
            break;
        }
        let seg_start = i;
        // Skip any 0xFF fill bytes to reach the marker code.
        let mut marker_pos = i;
        while marker_pos < data.len() && data[marker_pos] == 0xFF {
            marker_pos += 1;
        }
        if marker_pos >= data.len() {
            out.extend_from_slice(&data[seg_start..]);
            break;
        }
        let marker = data[marker_pos];

        // Start of Scan: entropy-coded data follows with no length field.
        // Copy everything from here to the end of the file unchanged.
        if marker == 0xDA {
            out.extend_from_slice(&data[seg_start..]);
            break;
        }
        // Markers with no payload.
        if marker == 0xD9 || (0xD0..=0xD7).contains(&marker) || marker == 0x01 {
            out.extend_from_slice(&data[seg_start..=marker_pos]);
            i = marker_pos + 1;
            continue;
        }

        // Length-bearing segment: 2-byte big-endian length (includes the 2 bytes).
        let len_pos = marker_pos + 1;
        if len_pos + 1 >= data.len() {
            out.extend_from_slice(&data[seg_start..]);
            break;
        }
        let seg_len = ((data[len_pos] as usize) << 8) | (data[len_pos + 1] as usize);
        let seg_end = len_pos + seg_len;
        if seg_len < 2 || seg_end > data.len() {
            out.extend_from_slice(&data[seg_start..]);
            break;
        }
        let payload = &data[len_pos + 2..seg_end];

        let drop_label: Option<String> = match marker {
            0xE0 => None, // APP0 (JFIF) — keep
            0xE1 => {
                if payload.starts_with(b"Exif\x00\x00") {
                    Some("EXIF".to_string())
                } else if payload.starts_with(b"http://ns.adobe.com/xap/1.0/\x00") {
                    Some("XMP".to_string())
                } else {
                    Some("APP1 metadata".to_string())
                }
            }
            0xE2 => {
                // APP2 may carry the ICC color profile — keep that for fidelity.
                if payload.starts_with(b"ICC_PROFILE\x00") {
                    None
                } else {
                    Some("APP2 metadata".to_string())
                }
            }
            0xED => Some("IPTC / Photoshop".to_string()), // APP13
            0xEE => {
                // APP14 "Adobe" controls the color transform — keep it.
                if payload.starts_with(b"Adobe") {
                    None
                } else {
                    Some("APP14 metadata".to_string())
                }
            }
            0xE3..=0xEF => Some(format!("APP{} metadata", marker - 0xE0)),
            0xFE => Some("Comment".to_string()), // COM
            _ => None,                           // DQT/DHT/SOF/etc — keep
        };

        match drop_label {
            Some(label) => removed.push(MetadataBlock {
                label,
                bytes: seg_end - seg_start,
            }),
            None => out.extend_from_slice(&data[seg_start..seg_end]),
        }
        i = seg_end;
    }

    Ok((out, removed))
}

// ---------------------------------------------------------------------------
// PNG
// ---------------------------------------------------------------------------

fn strip_png(data: &[u8]) -> Result<(Vec<u8>, Vec<MetadataBlock>), String> {
    const SIG: [u8; 8] = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    if !data.starts_with(&SIG) {
        return Err("Not a valid PNG file.".to_string());
    }
    let mut out = Vec::with_capacity(data.len());
    out.extend_from_slice(&SIG);
    let mut removed = Vec::new();
    let mut i = 8usize;

    while i + 8 <= data.len() {
        let len = u32::from_be_bytes([data[i], data[i + 1], data[i + 2], data[i + 3]]) as usize;
        let kind = [data[i + 4], data[i + 5], data[i + 6], data[i + 7]];
        let chunk_end = i + 12 + len; // len(4) + type(4) + data(len) + crc(4)
        if chunk_end > data.len() {
            // Truncated/malformed — copy remainder verbatim and stop.
            out.extend_from_slice(&data[i..]);
            break;
        }

        let drop_label: Option<String> = match &kind {
            b"tEXt" | b"zTXt" | b"iTXt" => {
                let kw = png_text_keyword(&data[i + 8..i + 8 + len]);
                Some(match kw {
                    Some(k) => format!("Text: {}", k),
                    None => "Text".to_string(),
                })
            }
            b"eXIf" => Some("EXIF".to_string()),
            b"tIME" => Some("Timestamp".to_string()),
            _ => None, // IHDR/PLTE/IDAT/IEND/iCCP/gAMA/etc — keep
        };

        match drop_label {
            Some(label) => removed.push(MetadataBlock {
                label,
                bytes: chunk_end - i,
            }),
            None => out.extend_from_slice(&data[i..chunk_end]),
        }

        i = chunk_end;
        if &kind == b"IEND" {
            break;
        }
    }

    Ok((out, removed))
}

fn png_text_keyword(chunk_data: &[u8]) -> Option<String> {
    let nul = chunk_data.iter().position(|&b| b == 0)?;
    let kw = &chunk_data[..nul];
    if kw.is_empty() {
        return None;
    }
    Some(String::from_utf8_lossy(kw).to_string())
}

// ---------------------------------------------------------------------------
// EXIF highlights (read-only, best effort)
// ---------------------------------------------------------------------------

fn trim_quotes(s: &str) -> String {
    s.trim().trim_matches('"').trim().to_string()
}

fn exif_highlights(data: &[u8]) -> ExifHighlights {
    use exif::{In, Reader, Tag};

    let mut h = ExifHighlights::default();
    let mut cursor = std::io::Cursor::new(data);
    let exif = match Reader::new().read_from_container(&mut cursor) {
        Ok(e) => e,
        Err(_) => return h, // no EXIF present
    };

    let make = exif
        .get_field(Tag::Make, In::PRIMARY)
        .map(|f| trim_quotes(&f.display_value().to_string()));
    let model = exif
        .get_field(Tag::Model, In::PRIMARY)
        .map(|f| trim_quotes(&f.display_value().to_string()));
    h.camera = match (make, model) {
        (Some(mk), Some(md)) if !mk.is_empty() && !md.is_empty() => Some(format!("{} {}", mk, md)),
        (Some(mk), _) if !mk.is_empty() => Some(mk),
        (_, Some(md)) if !md.is_empty() => Some(md),
        _ => None,
    };

    h.date_time = exif
        .get_field(Tag::DateTimeOriginal, In::PRIMARY)
        .or_else(|| exif.get_field(Tag::DateTime, In::PRIMARY))
        .map(|f| trim_quotes(&f.display_value().to_string()));

    h.software = exif
        .get_field(Tag::Software, In::PRIMARY)
        .map(|f| trim_quotes(&f.display_value().to_string()))
        .filter(|s| !s.is_empty());

    let lat = gps_decimal(&exif, Tag::GPSLatitude, Tag::GPSLatitudeRef);
    let lon = gps_decimal(&exif, Tag::GPSLongitude, Tag::GPSLongitudeRef);
    if let (Some(lat), Some(lon)) = (lat, lon) {
        h.gps = Some(format!("{:.6}, {:.6}", lat, lon));
        h.gps_maps_url = Some(format!("https://www.google.com/maps?q={:.6},{:.6}", lat, lon));
    }

    h.other_count = exif.fields().count();
    h
}

fn gps_decimal(exif: &exif::Exif, coord: exif::Tag, refr: exif::Tag) -> Option<f64> {
    use exif::{In, Value};
    let field = exif.get_field(coord, In::PRIMARY)?;
    let dms = match &field.value {
        Value::Rational(v) if v.len() >= 3 => {
            v[0].to_f64() + v[1].to_f64() / 60.0 + v[2].to_f64() / 3600.0
        }
        _ => return None,
    };
    let refv = exif
        .get_field(refr, In::PRIMARY)
        .map(|f| f.display_value().to_string())
        .unwrap_or_default();
    let negative = refv.contains('S') || refv.contains('W');
    Some(if negative { -dms } else { dms })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn contains(hay: &[u8], needle: &[u8]) -> bool {
        !needle.is_empty()
            && needle.len() <= hay.len()
            && hay.windows(needle.len()).any(|w| w == needle)
    }

    fn sample_jpeg() -> Vec<u8> {
        let mut d = Vec::new();
        d.extend_from_slice(&[0xFF, 0xD8]); // SOI
        // APP0 JFIF (keep): length 0x0010 = 16
        d.extend_from_slice(&[0xFF, 0xE0, 0x00, 0x10]);
        d.extend_from_slice(b"JFIF\x00");
        d.extend_from_slice(&[0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]);
        // APP1 EXIF (drop): length 0x000C = 12
        d.extend_from_slice(&[0xFF, 0xE1, 0x00, 0x0C]);
        d.extend_from_slice(b"Exif\x00\x00");
        d.extend_from_slice(&[0xAA, 0xBB, 0xCC, 0xDD]);
        // COM (drop): length 0x0009 = 9
        d.extend_from_slice(&[0xFF, 0xFE, 0x00, 0x09]);
        d.extend_from_slice(b"secret!");
        // SOS (keep + scan data to end)
        d.extend_from_slice(&[0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x3F, 0x00, 0x00]);
        d.extend_from_slice(&[0x12, 0x34, 0x56]); // entropy
        d.extend_from_slice(&[0xFF, 0xD9]); // EOI
        d
    }

    fn png_chunk(out: &mut Vec<u8>, kind: &[u8; 4], data: &[u8]) {
        out.extend_from_slice(&(data.len() as u32).to_be_bytes());
        out.extend_from_slice(kind);
        out.extend_from_slice(data);
        out.extend_from_slice(&[0xDE, 0xAD, 0xBE, 0xEF]); // fake CRC (we never validate it)
    }

    fn sample_png() -> Vec<u8> {
        let mut d = Vec::new();
        d.extend_from_slice(&[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
        png_chunk(&mut d, b"IHDR", &[0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]);
        let mut text = Vec::new();
        text.extend_from_slice(b"Software");
        text.push(0);
        text.extend_from_slice(b"EvilApp");
        png_chunk(&mut d, b"tEXt", &text);
        png_chunk(&mut d, b"eXIf", &[1, 2, 3, 4, 5, 6]);
        png_chunk(&mut d, b"IDAT", &[0x08, 0x1D]);
        png_chunk(&mut d, b"IEND", &[]);
        d
    }

    #[test]
    fn detects_formats() {
        assert_eq!(detect_format(&sample_jpeg()), Some(ImageFormat::Jpeg));
        assert_eq!(detect_format(&sample_png()), Some(ImageFormat::Png));
        assert_eq!(detect_format(b"not an image"), None);
    }

    #[test]
    fn jpeg_strips_metadata_losslessly() {
        let input = sample_jpeg();
        let (out, removed) = strip_jpeg(&input).unwrap();

        // Two blocks removed: EXIF + Comment.
        assert_eq!(removed.len(), 2, "expected EXIF + Comment");
        assert!(removed.iter().any(|b| b.label == "EXIF"));
        assert!(removed.iter().any(|b| b.label == "Comment"));

        // APP1 (14 bytes) + COM (11 bytes) = 25 bytes removed.
        let removed_bytes: usize = removed.iter().map(|b| b.bytes).sum();
        assert_eq!(removed_bytes, 25);
        assert_eq!(out.len(), input.len() - 25);

        // Structure preserved.
        assert_eq!(&out[0..2], &[0xFF, 0xD8]); // SOI
        assert_eq!(&out[out.len() - 2..], &[0xFF, 0xD9]); // EOI
        assert!(contains(&out, b"JFIF"), "kept APP0/JFIF");

        // Secrets gone.
        assert!(!contains(&out, b"Exif"), "EXIF removed");
        assert!(!contains(&out, b"secret!"), "comment removed");
    }

    #[test]
    fn png_strips_metadata_losslessly() {
        let input = sample_png();
        let (out, removed) = strip_png(&input).unwrap();

        assert_eq!(removed.len(), 2, "expected text + eXIf");
        assert!(removed.iter().any(|b| b.label == "Text: Software"));
        assert!(removed.iter().any(|b| b.label == "EXIF"));

        // tEXt (28 bytes) + eXIf (18 bytes) = 46 bytes removed.
        let removed_bytes: usize = removed.iter().map(|b| b.bytes).sum();
        assert_eq!(removed_bytes, 46);

        // Critical chunks kept.
        assert!(contains(&out, b"IHDR"));
        assert!(contains(&out, b"IDAT"));
        assert!(contains(&out, b"IEND"));

        // Metadata gone.
        assert!(!contains(&out, b"EvilApp"));
        assert!(!contains(&out, b"tEXt"));
        assert!(!contains(&out, b"eXIf"));
    }

    #[test]
    fn inspect_reports_metadata() {
        let insp = inspect(&sample_jpeg()).unwrap();
        assert_eq!(insp.format, ImageFormat::Jpeg);
        assert!(insp.has_metadata);
        assert_eq!(insp.metadata_bytes, 25);
        assert_eq!(insp.blocks.len(), 2);
    }

    #[test]
    fn clean_image_reports_nothing() {
        // SOI + APP0 + SOS + EOI, no metadata.
        let mut d = Vec::new();
        d.extend_from_slice(&[0xFF, 0xD8]);
        d.extend_from_slice(&[0xFF, 0xE0, 0x00, 0x10]);
        d.extend_from_slice(b"JFIF\x00");
        d.extend_from_slice(&[0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]);
        d.extend_from_slice(&[0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x3F, 0x00, 0x00]);
        d.extend_from_slice(&[0x12, 0x34, 0xFF, 0xD9]);
        let insp = inspect(&d).unwrap();
        assert!(!insp.has_metadata);
        assert_eq!(insp.metadata_bytes, 0);
    }
}
