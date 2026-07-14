mod parser;
mod types;
mod validator;

#[macro_use]
extern crate napi_derive;

use napi::bindgen_prelude::*;
use serde_json;

fn into_napi_error(e: parser::ParseError) -> Error {
    Error::from_reason(e.to_string())
}

fn validation_issues_to_js(issues: Vec<validator::ValidationIssue>) -> Vec<serde_json::Value> {
    issues.into_iter().map(|i| i.to_json()).collect()
}

/// Parse a single agent profile (`.agent.md`) and return the parsed structure as JSON.
#[napi]
pub fn parse_agent_file(file_path: String) -> Result<String> {
    parser::parse_agent_profile(&file_path)
        .map(|result| serde_json::to_string(&result).unwrap())
        .map_err(into_napi_error)
}

/// Parse a team manifest YAML file and return as JSON.
#[napi]
pub fn parse_team_manifest(file_path: String) -> Result<String> {
    parser::parse_team_manifest(&file_path)
        .map(|result| serde_json::to_string(&result).unwrap())
        .map_err(into_napi_error)
}

/// Parse a team policy YAML file and return as JSON.
#[napi]
pub fn parse_team_policy(file_path: String) -> Result<String> {
    parser::parse_team_policy(&file_path)
        .map(|result| serde_json::to_string(&result).unwrap())
        .map_err(into_napi_error)
}

/// Load and parse an entire team directory (manifest + policy + all `.agent.md` files).
#[napi]
pub fn load_team_directory(dir_path: String) -> Result<String> {
    parser::load_team_directory(&dir_path)
        .map(|result| serde_json::to_string(&result).unwrap())
        .map_err(into_napi_error)
}

/// Validate a single agent file.
#[napi]
pub fn validate_agent_file(file_path: String) -> Result<String> {
    match parser::parse_frontmatter(&file_path) {
        Ok(fr) => {
            let issues = validator::validate_agent_frontmatter(&file_path, &fr.data);
            Ok(serde_json::to_string(&validation_issues_to_js(issues)).unwrap())
        }
        Err(e) => {
            let issue = validator::ValidationIssue {
                level: validator::ValidationLevel::Error,
                message: e.to_string(),
                file: Some(file_path),
                field: None,
            };
            Ok(serde_json::to_string(&vec![issue.to_json()]).unwrap())
        }
    }
}

/// Validate a team directory (all agent files cross-referentially).
#[napi]
pub fn validate_team_directory(dir_path: String) -> Result<String> {
    let issues = validator::validate_team_directory(&dir_path);
    Ok(serde_json::to_string(&validation_issues_to_js(issues)).unwrap())
}

/// Validate a team manifest YAML file.
#[napi]
pub fn validate_team_manifest_file(file_path: String) -> Result<String> {
    let data: serde_yaml::Value = match parser::parse_yaml_file(&file_path) {
        Ok(d) => d,
        Err(e) => {
            let issue = validator::ValidationIssue {
                level: validator::ValidationLevel::Error,
                message: e.to_string(),
                file: Some(file_path),
                field: None,
            };
            return Ok(serde_json::to_string(&vec![issue.to_json()]).unwrap());
        }
    };
    let issues = validator::validate_team_manifest_frontmatter(&file_path, &data);
    Ok(serde_json::to_string(&validation_issues_to_js(issues)).unwrap())
}

/// Validate a team policy YAML file.
#[napi]
pub fn validate_team_policy_file(file_path: String) -> Result<String> {
    let data: serde_yaml::Value = match parser::parse_yaml_file(&file_path) {
        Ok(d) => d,
        Err(e) => {
            let issue = validator::ValidationIssue {
                level: validator::ValidationLevel::Error,
                message: e.to_string(),
                file: Some(file_path),
                field: None,
            };
            return Ok(serde_json::to_string(&vec![issue.to_json()]).unwrap());
        }
    };
    let issues = validator::validate_team_policy(&file_path, &data);
    Ok(serde_json::to_string(&validation_issues_to_js(issues)).unwrap())
}
