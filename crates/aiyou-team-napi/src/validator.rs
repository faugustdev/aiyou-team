use std::fs;
use std::collections::HashSet;

use serde_yaml::Value;

use crate::parser;

#[derive(Debug)]
pub enum ValidationLevel {
    Error,
    Warn,
    Info,
}

#[derive(Debug)]
pub struct ValidationIssue {
    pub level: ValidationLevel,
    pub message: String,
    pub file: Option<String>,
    pub field: Option<String>,
}

impl ValidationIssue {
    pub fn to_json(&self) -> serde_json::Value {
        let level = match self.level {
            ValidationLevel::Error => "error",
            ValidationLevel::Warn => "warn",
            ValidationLevel::Info => "info",
        };
        let mut map = serde_json::Map::new();
        map.insert("level".to_string(), serde_json::Value::String(level.to_string()));
        map.insert("message".to_string(), serde_json::Value::String(self.message.clone()));
        if let Some(ref file) = self.file {
            map.insert("file".to_string(), serde_json::Value::String(file.clone()));
        }
        if let Some(ref field) = self.field {
            map.insert("field".to_string(), serde_json::Value::String(field.clone()));
        }
        serde_json::Value::Object(map)
    }
}

/// Validate a parsed agent profile's frontmatter data.
pub fn validate_agent_frontmatter(
    file_path: &str,
    data: &Value,
) -> Vec<ValidationIssue> {
    let mut issues = Vec::new();

    let map = match data.as_mapping() {
        Some(m) => m,
        None => {
            issues.push(ValidationIssue {
                level: ValidationLevel::Error,
                message: "Frontmatter must be a YAML mapping".to_string(),
                file: Some(file_path.to_string()),
                field: None,
            });
            return issues;
        }
    };

    // Check required fields
    let required_fields = ["id", "name"];
    for field in &required_fields {
        let key = Value::String(field.to_string());
        if !map.contains_key(&key) {
            issues.push(ValidationIssue {
                level: ValidationLevel::Error,
                message: format!("Missing required field: {field}"),
                file: Some(file_path.to_string()),
                field: Some(field.to_string()),
            });
        } else if let Some(val) = map.get(&key) {
            if val.as_str().map_or(true, |s| s.is_empty()) {
                issues.push(ValidationIssue {
                    level: ValidationLevel::Error,
                    message: format!("Field '{field}' must not be empty"),
                    file: Some(file_path.to_string()),
                    field: Some(field.to_string()),
                });
            }
        }
    }

    // Check field types
    let string_fields = [
        "name", "archetype", "owner", "core_principle", "scope_control",
        "ambiguity_policy", "entry_point", "persistence_style",
    ];
    for field in &string_fields {
        let key = Value::String(field.to_string());
        if let Some(val) = map.get(&key) {
            if !val.is_string() {
                issues.push(ValidationIssue {
                    level: ValidationLevel::Warn,
                    message: format!("Field '{field}' should be a string, got {typ}",
                        typ = yaml_type(val)),
                    file: Some(file_path.to_string()),
                    field: Some(field.to_string()),
                });
            }
        }
    }

    let array_fields = [
        "tags", "heuristics", "anti_patterns", "support_triggers",
    ];
    for field in &array_fields {
        let key = Value::String(field.to_string());
        if let Some(val) = map.get(&key) {
            if !val.is_sequence() {
                issues.push(ValidationIssue {
                    level: ValidationLevel::Warn,
                    message: format!("Field '{field}' should be an array, got {typ}",
                        typ = yaml_type(val)),
                    file: Some(file_path.to_string()),
                    field: Some(field.to_string()),
                });
            }
        }
    }

    // Validate persona_core fields
    if let Some(pc) = map.get(&Value::String("persona_core".to_string())) {
        validate_struct_field(pc, file_path, "persona_core", &[
            "temperament", "cognitive_style", "risk_posture",
            "communication_style", "persistence_style",
        ], &mut issues);
    }

    // Validate responsibility_core fields
    if let Some(rc) = map.get(&Value::String("responsibility_core".to_string())) {
        validate_struct_field(rc, file_path, "responsibility_core", &[
            "description", "objective", "use_when", "avoid_when",
            "success_definition", "in_scope",
        ], &mut issues);
    }

    // Check snake_case conventions
    if let Some(mapping) = data.as_mapping() {
        for key in mapping.keys() {
            if let Some(key_str) = key.as_str() {
                if key_str.contains('-') {
                    issues.push(ValidationIssue {
                        level: ValidationLevel::Warn,
                        message: format!("Field '{key_str}' uses hyphens; prefer snake_case"),
                        file: Some(file_path.to_string()),
                        field: Some(key_str.to_string()),
                    });
                }
                if key_str.chars().any(|c| c.is_uppercase()) {
                    // Check if it's a known camelCase JS-facing field
                    let known_camel = [
                        "requestedTools", "outputContract",
                    ];
                    if !known_camel.contains(&key_str) {
                        issues.push(ValidationIssue {
                            level: ValidationLevel::Warn,
                            message: format!("Field '{key_str}' uses camelCase; prefer snake_case in YAML"),
                            file: Some(file_path.to_string()),
                            field: Some(key_str.to_string()),
                        });
                    }
                }
            }
        }
    }

    issues
}

fn validate_struct_field(
    value: &Value,
    file_path: &str,
    parent: &str,
    required_fields: &[&str],
    issues: &mut Vec<ValidationIssue>,
) {
    let map = match value.as_mapping() {
        Some(m) => m,
        None => {
            issues.push(ValidationIssue {
                level: ValidationLevel::Error,
                message: format!("'{parent}' must be an object"),
                file: Some(file_path.to_string()),
                field: Some(parent.to_string()),
            });
            return;
        }
    };

    for field in required_fields {
        let key = Value::String(field.to_string());
        if !map.contains_key(&key) {
            issues.push(ValidationIssue {
                level: ValidationLevel::Warn,
                message: format!("'{parent}.{field}' is recommended but missing"),
                file: Some(file_path.to_string()),
                field: Some(format!("{parent}.{field}")),
            });
        }
    }
}

/// Validate a team manifest YAML file's frontmatter structure.
pub fn validate_team_manifest_frontmatter(
    file_path: &str,
    data: &Value,
) -> Vec<ValidationIssue> {
    let mut issues = Vec::new();

    let map = match data.as_mapping() {
        Some(m) => m,
        None => {
            issues.push(ValidationIssue {
                level: ValidationLevel::Error,
                message: "Team manifest must be a YAML mapping".to_string(),
                file: Some(file_path.to_string()),
                field: None,
            });
            return issues;
        }
    };

    // Required top-level fields
    let required_fields = ["id", "name", "version", "description"];
    for field in &required_fields {
        let key = Value::String(field.to_string());
        if !map.contains_key(&key) {
            issues.push(ValidationIssue {
                level: ValidationLevel::Error,
                message: format!("Missing required manifest field: {field}"),
                file: Some(file_path.to_string()),
                field: Some(field.to_string()),
            });
        } else if let Some(val) = map.get(&key) {
            if val.as_str().map_or(true, |s| s.is_empty()) {
                issues.push(ValidationIssue {
                    level: ValidationLevel::Error,
                    message: format!("Manifest field '{field}' must not be empty"),
                    file: Some(file_path.to_string()),
                    field: Some(field.to_string()),
                });
            }
        }
    }

    // Validate mission sub-object
    if let Some(mission) = map.get(&Value::String("mission".to_string())) {
        validate_struct_field(mission, file_path, "mission", &[
            "objective", "success_definition",
        ], &mut issues);
    } else {
        issues.push(ValidationIssue {
            level: ValidationLevel::Error,
            message: "Missing required field: mission".to_string(),
            file: Some(file_path.to_string()),
            field: Some("mission".to_string()),
        });
    }

    // Validate scope
    if let Some(scope) = map.get(&Value::String("scope".to_string())) {
        validate_struct_field(scope, file_path, "scope", &[
            "in_scope", "out_of_scope",
        ], &mut issues);
    } else {
        issues.push(ValidationIssue {
            level: ValidationLevel::Error,
            message: "Missing required field: scope".to_string(),
            file: Some(file_path.to_string()),
            field: Some("scope".to_string()),
        });
    }

    // Validate leader
    if let Some(leader) = map.get(&Value::String("leader".to_string())) {
        validate_struct_field(leader, file_path, "leader", &[
            "agent_ref", "responsibilities",
        ], &mut issues);
    } else {
        issues.push(ValidationIssue {
            level: ValidationLevel::Error,
            message: "Missing required field: leader".to_string(),
            file: Some(file_path.to_string()),
            field: Some("leader".to_string()),
        });
    }

    // Validate workflow.stages is non-empty
    if let Some(workflow) = map.get(&Value::String("workflow".to_string())) {
        if let Some(wf_map) = workflow.as_mapping() {
            let stages_key = Value::String("stages".to_string());
            if !wf_map.contains_key(&stages_key) {
                issues.push(ValidationIssue {
                    level: ValidationLevel::Error,
                    message: "Manifest workflow must define stages".to_string(),
                    file: Some(file_path.to_string()),
                    field: Some("workflow.stages".to_string()),
                });
            } else if let Some(stages) = wf_map.get(&stages_key) {
                if !stages.is_sequence() || stages.as_sequence().map_or(true, |s| s.is_empty()) {
                    issues.push(ValidationIssue {
                        level: ValidationLevel::Error,
                        message: "workflow.stages must be a non-empty array".to_string(),
                        file: Some(file_path.to_string()),
                        field: Some("workflow.stages".to_string()),
                    });
                }
            }
        }
    } else {
        issues.push(ValidationIssue {
            level: ValidationLevel::Warn,
            message: "Manifest should define workflow.stages".to_string(),
            file: Some(file_path.to_string()),
            field: Some("workflow".to_string()),
        });
    }

    // Validate governance sub-fields
    if let Some(governance) = map.get(&Value::String("governance".to_string())) {
        validate_struct_field(governance, file_path, "governance", &[
            "instruction_precedence", "working_rules", "forbidden_actions",
        ], &mut issues);

        // Validate nested quality_floor
        if let Some(gov_map) = governance.as_mapping() {
            if let Some(qf) = gov_map.get(&Value::String("quality_floor".to_string())) {
                validate_struct_field(qf, file_path, "governance.quality_floor", &[
                    "required_checks", "evidence_required",
                ], &mut issues);
            }

            // Validate nested approval_policy
            if let Some(ap) = gov_map.get(&Value::String("approval_policy".to_string())) {
                validate_struct_field(ap, file_path, "governance.approval_policy", &[
                    "required_for",
                ], &mut issues);
            }
        }
    }

    // Check snake_case conventions
    for key in map.keys() {
        if let Some(key_str) = key.as_str() {
            if key_str.contains('-') {
                issues.push(ValidationIssue {
                    level: ValidationLevel::Warn,
                    message: format!("Manifest field '{key_str}' uses hyphens; prefer snake_case"),
                    file: Some(file_path.to_string()),
                    field: Some(key_str.to_string()),
                });
            }
        }
    }

    issues
}

/// Validate a team policy YAML file's structure.
pub fn validate_team_policy(
    file_path: &str,
    data: &Value,
) -> Vec<ValidationIssue> {
    let mut issues = Vec::new();

    let map = match data.as_mapping() {
        Some(m) => m,
        None => {
            issues.push(ValidationIssue {
                level: ValidationLevel::Error,
                message: "Team policy must be a YAML mapping".to_string(),
                file: Some(file_path.to_string()),
                field: None,
            });
            return issues;
        }
    };

    // Check kind field
    let kind_key = Value::String("kind".to_string());
    if let Some(kind_val) = map.get(&kind_key) {
        if kind_val.as_str() != Some("team-policy") {
            issues.push(ValidationIssue {
                level: ValidationLevel::Warn,
                message: "Policy 'kind' should be 'team-policy'".to_string(),
                file: Some(file_path.to_string()),
                field: Some("kind".to_string()),
            });
        }
    } else {
        issues.push(ValidationIssue {
            level: ValidationLevel::Info,
            message: "Policy missing 'kind' field (recommended)".to_string(),
            file: Some(file_path.to_string()),
            field: Some("kind".to_string()),
        });
    }

    // Check required policy fields
    let required_policy_fields = [
        ("instruction_precedence", "array"),
        ("working_rules", "array"),
        ("quality_floor", "object"),
    ];
    for &(field, expected_type) in &required_policy_fields {
        let key = Value::String(field.to_string());
        if let Some(val) = map.get(&key) {
            match expected_type {
                "array" => {
                    if !val.is_sequence() {
                        issues.push(ValidationIssue {
                            level: ValidationLevel::Error,
                            message: format!("Policy field '{field}' must be an array"),
                            file: Some(file_path.to_string()),
                            field: Some(field.to_string()),
                        });
                    } else if val.as_sequence().map_or(true, |s| s.is_empty()) {
                        issues.push(ValidationIssue {
                            level: ValidationLevel::Error,
                            message: format!("Policy field '{field}' must not be empty"),
                            file: Some(file_path.to_string()),
                            field: Some(field.to_string()),
                        });
                    }
                }
                "object" => {
                    if !val.is_mapping() {
                        issues.push(ValidationIssue {
                            level: ValidationLevel::Error,
                            message: format!("Policy field '{field}' must be an object"),
                            file: Some(file_path.to_string()),
                            field: Some(field.to_string()),
                        });
                    } else if let Some(qf_map) = val.as_mapping() {
                        let expected_sub = ["required_checks", "evidence_required"];
                        for sub in &expected_sub {
                            if !qf_map.contains_key(&Value::String(sub.to_string())) {
                                issues.push(ValidationIssue {
                                    level: ValidationLevel::Warn,
                                    message: format!("Policy 'quality_floor.{sub}' is recommended"),
                                    file: Some(file_path.to_string()),
                                    field: Some(format!("quality_floor.{sub}")),
                                });
                            }
                        }
                    }
                }
                _ => {}
            }
        } else {
            issues.push(ValidationIssue {
                level: ValidationLevel::Error,
                message: format!("Missing required policy field: {field}"),
                file: Some(file_path.to_string()),
                field: Some(field.to_string()),
            });
        }
    }

    // Check snake_case conventions
    for key in map.keys() {
        if let Some(key_str) = key.as_str() {
            if key_str.contains('-') {
                issues.push(ValidationIssue {
                    level: ValidationLevel::Warn,
                    message: format!("Policy field '{key_str}' uses hyphens; prefer snake_case"),
                    file: Some(file_path.to_string()),
                    field: Some(key_str.to_string()),
                });
            }
        }
    }

    issues
}

/// Cross-referentially validate a team directory.
/// Most cross-ref checks are best done in JS (team manifest has agent IDs, etc.)
pub fn validate_team_directory(dir: &str) -> Vec<ValidationIssue> {
    let mut issues = Vec::new();

    let dir_path = std::path::Path::new(dir);

    // Check manifest exists
    let manifest_path = dir_path.join("team.manifest.yaml");
    if !manifest_path.exists() {
        issues.push(ValidationIssue {
            level: ValidationLevel::Error,
            message: "Missing team.manifest.yaml".to_string(),
            file: Some(dir.to_string()),
            field: None,
        });
    }

    // Check policy exists
    let policy_path = dir_path.join("team.policy.yaml");
    if !policy_path.exists() {
        issues.push(ValidationIssue {
            level: ValidationLevel::Info,
            message: "Missing team.policy.yaml (optional)".to_string(),
            file: Some(dir.to_string()),
            field: None,
        });
    }

    // Validate each agent file
    let mut agent_ids = HashSet::new();
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries {
            if let Ok(entry) = entry {
                let path = entry.path();
                if let Some(ext) = path.extension() {
                    if ext == "md" && path.file_name()
                        .and_then(|n| n.to_str())
                        .map_or(false, |n| n.ends_with(".agent.md"))
                    {
                        let path_str = path.to_str().unwrap().to_string();
                        match parser::parse_frontmatter(&path_str) {
                            Ok(fr) => {
                                let front_issues = validate_agent_frontmatter(&path_str, &fr.data);
                                issues.extend(front_issues);

                                // Collect agent IDs
                                if let Some(map) = fr.data.as_mapping() {
                                    if let Some(id_val) = map.get(&Value::String("id".to_string())) {
                                        if let Some(id) = id_val.as_str() {
                                            if !agent_ids.insert(id.to_string()) {
                                                issues.push(ValidationIssue {
                                                    level: ValidationLevel::Error,
                                                    message: format!("Duplicate agent ID: '{id}'"),
                                                    file: Some(path_str),
                                                    field: Some("id".to_string()),
                                                });
                                            }
                                        }
                                    }
                                }
                            }
                            Err(e) => {
                                issues.push(ValidationIssue {
                                    level: ValidationLevel::Error,
                                    message: format!("Failed to parse: {e}"),
                                    file: Some(path_str),
                                    field: None,
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    issues
}

fn yaml_type(value: &Value) -> &'static str {
    match value {
        Value::Null => "null",
        Value::Bool(_) => "boolean",
        Value::Number(_) => "number",
        Value::String(_) => "string",
        Value::Sequence(_) => "array",
        Value::Mapping(_) => "object",
        Value::Tagged(_) => "tagged",
    }
}
