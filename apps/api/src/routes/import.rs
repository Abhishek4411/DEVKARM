use axum::{
    extract::{Path, State},
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::process::Command;
use uuid::Uuid;
use walkdir::WalkDir;

#[derive(Deserialize)]
pub struct ImportRequest {
    pub import_type: String, // "local" or "github"
    pub payload: String,     // Absolute path or GitHub URL
}

#[derive(Serialize)]
pub struct ImportedFile {
    pub path: String,
    pub content: String,
}

#[derive(Serialize)]
pub struct ImportResponse {
    pub files: Vec<ImportedFile>,
}

pub async fn import_codebase(
    State(_pool): State<PgPool>,
    Path(project_id): Path<Uuid>,
    Json(payload): Json<ImportRequest>,
) -> Result<Json<ImportResponse>, (axum::http::StatusCode, String)> {
    let mut files = Vec::new();

    if payload.import_type == "github" {
        // Create a temporary directory securely
        let temp_dir = tempfile::Builder::new()
            .prefix("devkarm_import_")
            .tempdir()
            .map_err(|e| {
                (
                    axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Failed to create temp directory: {}", e),
                )
            })?;

        let clone_path = temp_dir.path().to_str().unwrap();

        // Run git clone --depth 1
        let status = Command::new("git")
            .arg("clone")
            .arg("--depth")
            .arg("1")
            .arg(&payload.payload)
            .arg(clone_path)
            .status()
            .map_err(|e| {
                (
                    axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Failed to execute git: {}", e),
                )
            })?;

        if !status.success() {
            return Err((
                axum::http::StatusCode::BAD_REQUEST,
                "Failed to clone repository. Make sure URL is accessible and git is installed."
                    .to_string(),
            ));
        }

        // Walk directory
        collect_supported_files(clone_path, clone_path, &mut files);

        // Tempdir gets automatically cleaned up here when `temp_dir` goes out of scope safely!
    } else if payload.import_type == "local" {
        // Read local directory payload directly
        let root_path = payload.payload.clone();
        
        let path = std::path::Path::new(&root_path);
        if !path.exists() || !path.is_dir() {
            return Err((
                axum::http::StatusCode::BAD_REQUEST,
                "Path does not exist or is not a directory".to_string(),
            ));
        }

        collect_supported_files(&root_path, &root_path, &mut files);
    } else {
        return Err((
            axum::http::StatusCode::BAD_REQUEST,
            "Invalid import_type. Use 'local' or 'github'.".to_string(),
        ));
    }

    Ok(Json(ImportResponse { files }))
}

fn collect_supported_files(root: &str, current_folder: &str, files: &mut Vec<ImportedFile>) {
    let supported_extensions = ["js", "ts", "jsx", "tsx", "py", "go"];
    let ignore_dirs = ["node_modules", "dist", "build", ".git", ".next", ".svx"];

    for entry in WalkDir::new(current_folder)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if entry.file_type().is_dir() {
            if let Some(dir_name) = entry.file_name().to_str() {
                if ignore_dirs.contains(&dir_name) || dir_name.starts_with('.') {
                    // Walkdir doesn't natively skip subtree without complex logic via filter_entry,
                    // but we can just skip yielding logic. Actually, skipping subtree is better for performance.
                    // Instead of full filter_entry, we'll just ignore matching files inside them by checking path components.
                }
            }
        }

        // Basic component check
        let path_str = entry.path().to_str().unwrap_or("");
        let mut should_ignore = false;
        for ignore in ignore_dirs.iter() {
            if path_str.contains(&format!("\\{}\\", ignore)) || path_str.contains(&format!("/{}/", ignore)) {
                should_ignore = true;
                break;
            }
        }

        if should_ignore {
            continue;
        }

        if entry.file_type().is_file() {
            let path = entry.path();
            if let Some(ext) = path.extension() {
                if let Some(ext_str) = ext.to_str() {
                    if supported_extensions.contains(&ext_str) {
                        // Read valid file
                        if let Ok(content) = std::fs::read_to_string(path) {
                            if content.lines().count() > 10000 {
                                continue; // Skip massive files
                            }
                            
                            // Make path relative to root
                            let mut relative_path = path_str.replace(root, "");
                            if relative_path.starts_with('/') || relative_path.starts_with('\\') {
                                relative_path = relative_path[1..].to_string();
                            }
                            // Normalize separators for frontend
                            let cleaned_path = relative_path.replace("\\", "/");

                            files.push(ImportedFile {
                                path: cleaned_path,
                                content,
                            });
                        }
                    }
                }
            }
        }
    }
}
