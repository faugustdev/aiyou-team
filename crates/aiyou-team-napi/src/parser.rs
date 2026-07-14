#![allow(dead_code)]

use std::collections::HashMap;
use std::fs;
use std::path::Path;

use regex::Regex;
use serde_yaml::Value;

use crate::types::*;

#[derive(Debug, thiserror::Error)]
pub enum ParseError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("YAML error: {0}")]
    Yaml(#[from] serde_yaml::Error),
    #[error("{0} is missing YAML frontmatter")]
    MissingFrontmatter(String),
    #[error("Removed field '{field}' in {file}: {message}")]
    RemovedField { field: String, file: String, message: String },
    #[error("{0}")]
    Validation(String),
}

/// Split a `.agent.md` file into frontmatter YAML and body markdown.
pub fn parse_frontmatter(file_path: &str) -> Result<FrontmatterResult, ParseError> {
    let text = fs::read_to_string(file_path)
        .map_err(|e| ParseError::Io(e))?;
    let re = Regex::new(r"^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$")
        .expect("invalid frontmatter regex");
    let caps = re.captures(&text)
        .ok_or_else(|| ParseError::MissingFrontmatter(file_path.to_string()))?;
    let yaml_str = caps.get(1).unwrap().as_str();
    let body = caps.get(2).map(|m| m.as_str()).unwrap_or("");
    let data: Value = serde_yaml::from_str(yaml_str)
        .map_err(|e| ParseError::Yaml(e))?;
    Ok(FrontmatterResult { data, body: body.to_string() })
}

/// Parse a pure YAML file (team manifest, policy).
pub fn parse_yaml_file<T: serde::de::DeserializeOwned>(file_path: &str) -> Result<T, ParseError> {
    let text = fs::read_to_string(file_path)
        .map_err(|e| ParseError::Io(e))?;
    let value: T = serde_yaml::from_str(&text)
        .map_err(|e| ParseError::Yaml(e))?;
    Ok(value)
}

/// Extract a `## <title>` section from markdown body using line parsing (avoids regex backtracking).
pub fn extract_section(body: &str, title: &str) -> Option<String> {
    let target_lower = title.to_lowercase();
    let mut collecting = false;
    let mut lines = Vec::new();
    for line in body.lines() {
        let trimmed = line.trim();
        if collecting {
            if trimmed.starts_with("## ") || trimmed.starts_with("##\t") {
                break;
            }
            lines.push(line);
        } else if trimmed.to_lowercase().starts_with("## ")
            && trimmed[3..].trim().to_lowercase() == target_lower
        {
            collecting = true;
        }
    }
    let content = lines.join("\n").trim().to_string();
    if content.is_empty() { None } else { Some(content) }
}

/// Extract bullet points (`- ` lines) from a section.
pub fn extract_bullets(section: Option<&str>) -> Vec<String> {
    section
        .map(|s| {
            s.lines()
                .map(|l| l.trim())
                .filter(|l| l.starts_with("- "))
                .map(|l| l[2..].trim().to_string())
                .filter(|l| !l.is_empty())
                .collect()
        })
        .unwrap_or_default()
}

/// Convert a `Value` to a string, or return ParseError.
fn as_string(value: &Value, label: &str) -> Result<String, ParseError> {
    match value {
        Value::String(s) => Ok(s.clone()),
        _ => Err(ParseError::Validation(format!("{label} must be a string"))),
    }
}

/// Convert a `Value` to an optional string.
fn as_optional_string(value: &Value) -> Option<String> {
    match value {
        Value::String(s) => Some(s.clone()),
        _ => None,
    }
}

/// Convert a `Value` to a string array.
fn as_string_array(value: &Value, label: &str) -> Result<Vec<String>, ParseError> {
    match value {
        Value::Sequence(seq) => {
            seq.iter().enumerate().map(|(i, v)| {
                as_string(v, &format!("{label}[{i}]"))
            }).collect()
        }
        _ => Err(ParseError::Validation(format!("{label} must be an array"))),
    }
}

/// Convert a `Value` to an optional string array.
fn as_optional_string_array(value: &Value) -> Option<Vec<String>> {
    match value {
        Value::Sequence(seq) => {
            let result: Vec<String> = seq.iter()
                .filter_map(|v| match v { Value::String(s) => Some(s.clone()), _ => None })
                .collect();
            if result.is_empty() { None } else { Some(result) }
        }
        _ => None,
    }
}

/// Check for removed fields in a YAML mapping.
pub fn reject_removed_fields(
    data: &Value,
    file_path: &str,
    removed_fields: &[&str],
    message: &str,
) -> Result<(), ParseError> {
    if let Value::Mapping(map) = data {
        for field in removed_fields {
            if map.contains_key(&Value::String(field.to_string())) {
                return Err(ParseError::RemovedField {
                    field: field.to_string(),
                    file: file_path.to_string(),
                    message: message.to_string(),
                });
            }
        }
    }
    Ok(())
}

/// Parse a `persona_core` Value into structured fields.
pub fn parse_persona_core(value: &Value) -> Result<PersonaCore, ParseError> {
    let map = value.as_mapping()
        .ok_or_else(|| ParseError::Validation("persona_core must be an object".to_string()))?;

    Ok(PersonaCore {
        temperament: get_map_string(map, "temperament", "persona_core.temperament")?,
        cognitive_style: get_map_string(map, "cognitive_style", "persona_core.cognitive_style")?,
        risk_posture: get_map_string(map, "risk_posture", "persona_core.risk_posture")?,
        communication_style: get_map_string(map, "communication_style", "persona_core.communication_style")?,
        persistence_style: get_map_string(map, "persistence_style", "persona_core.persistence_style")?,
        conflict_style: get_map_opt_string(map, "conflict_style"),
        decision_priorities: get_map_array(map, "decision_priorities", "persona_core.decision_priorities")?,
    })
}

/// Parse a `responsibility_core` Value into structured fields.
pub fn parse_responsibility_core(value: &Value) -> Result<ResponsibilityCore, ParseError> {
    let map = value.as_mapping()
        .ok_or_else(|| ParseError::Validation("responsibility_core must be an object".to_string()))?;

    Ok(ResponsibilityCore {
        description: get_map_string(map, "description", "responsibility_core.description")?,
        use_when: get_map_array(map, "use_when", "responsibility_core.use_when")?,
        avoid_when: get_map_array(map, "avoid_when", "responsibility_core.avoid_when")?,
        objective: get_map_string(map, "objective", "responsibility_core.objective")?,
        success_definition: get_map_array(map, "success_definition", "responsibility_core.success_definition")?,
        non_goals: get_map_array(map, "non_goals", "responsibility_core.non_goals")?,
        in_scope: get_map_array(map, "in_scope", "responsibility_core.in_scope")?,
        out_of_scope: get_map_array(map, "out_of_scope", "responsibility_core.out_of_scope")?,
        authority: get_map_opt_string(map, "authority"),
        output_preference: get_map_opt_array(map, "output_preference"),
    })
}

// ── Helper to get typed values from a YAML mapping ───────────────

fn get_key<'a>(map: &'a serde_yaml::Mapping, key: &str) -> Option<&'a Value> {
    map.get(&Value::String(key.to_string()))
}

fn get_map_string(map: &serde_yaml::Mapping, key: &str, label: &str) -> Result<String, ParseError> {
    get_key(map, key)
        .map(|v| as_string(v, label))
        .unwrap_or_else(|| Err(ParseError::Validation(format!("{label} is required"))))
}

fn get_map_opt_string(map: &serde_yaml::Mapping, key: &str) -> Option<String> {
    get_key(map, key).and_then(|v| as_optional_string(v))
}

fn get_map_array(map: &serde_yaml::Mapping, key: &str, label: &str) -> Result<Vec<String>, ParseError> {
    get_key(map, key)
        .map(|v| as_string_array(v, label))
        .unwrap_or_else(|| Err(ParseError::Validation(format!("{label} is required"))))
}

fn get_map_opt_array(map: &serde_yaml::Mapping, key: &str) -> Option<Vec<String>> {
    get_key(map, key).and_then(|v| as_optional_string_array(v))
}

/// Parse an agent profile into a JSON-serializable map.
pub fn parse_agent_profile(file_path: &str) -> Result<HashMap<String, serde_json::Value>, ParseError> {
    let FrontmatterResult { data, body } = parse_frontmatter(file_path)?;

    let map = data.as_mapping()
        .ok_or_else(|| ParseError::Validation("frontmatter must be a mapping".to_string()))?;

    reject_removed_fields(&data, file_path, REMOVED_AGENT_FIELDS,
        "Remove legacy agent-structure fields from the profile.")?;

    // Build the result as a JSON map for napi serialization
    let mut result: HashMap<String, serde_json::Value> = HashMap::new();

    // Metadata
    let mut metadata = serde_json::Map::new();
    metadata.insert("id".to_string(), serde_json::Value::String(get_map_string(map, "id", "id")?));
    metadata.insert("name".to_string(), serde_json::Value::String(get_map_string(map, "name", "name")?));
    if let Some(v) = get_map_opt_string(map, "archetype") {
        metadata.insert("archetype".to_string(), serde_json::Value::String(v));
    }
    if let Some(v) = get_map_opt_string(map, "owner") {
        metadata.insert("owner".to_string(), serde_json::Value::String(v));
    }
    if let Some(v) = get_map_opt_array(map, "tags") {
        metadata.insert("tags".to_string(), serde_json::Value::Array(v.into_iter().map(serde_json::Value::String).collect()));
    }

    result.insert("metadata".to_string(), serde_json::Value::Object(metadata));

    // PersonaCore
    if let Some(pc) = get_key(map, "persona_core") {
        let parsed = parse_persona_core(pc)?;
        result.insert("personaCore".to_string(), serde_json::to_value(&parsed).unwrap());
    }

    // ResponsibilityCore
    if let Some(rc) = get_key(map, "responsibility_core") {
        let parsed = parse_responsibility_core(rc)?;
        result.insert("responsibilityCore".to_string(), serde_json::to_value(&parsed).unwrap());
    }

    // Direct passthrough fields
    for key in &["core_principle", "scope_control", "ambiguity_policy",
        "support_triggers", "repository_assessment", "task_triage",
        "delegation_review", "todo_discipline", "completion_gate", "failure_recovery"] {
        if let Some(v) = get_key(map, key) {
            let camel = to_camel_case(key);
            result.insert(camel, to_json_value(v));
        }
    }

    // Collaboration
    if let Some(collab) = get_key(map, "collaboration") {
        result.insert("collaboration".to_string(), to_json_value(collab));
    }

    // Runtime config — pass through the whole block
    if let Some(rc) = get_key(map, "runtime_config") {
        let val = to_json_value(rc);
        // Normalize requested_tools to requestedTools for JS
        if let Some(obj) = val.as_object() {
            let mut runtime = obj.clone();
            if let Some(tools) = runtime.remove("requested_tools") {
                runtime.insert("requestedTools".to_string(), tools);
            }
            if let Some(permission) = runtime.get("permission") {
                // Keep permission as-is (camelCase not needed here)
                runtime.insert("permission".to_string(), permission.clone());
            }
            result.insert("runtimeConfig".to_string(), serde_json::Value::Object(runtime));
        } else {
            result.insert("runtimeConfig".to_string(), val);
        }
    }

    // Output contract
    if let Some(oc) = get_key(map, "output_contract") {
        result.insert("outputContract".to_string(), to_json_value(oc));
    }

    // Body-derived fields (heuristics, anti_patterns)
    let heuristics: Option<Vec<String>> = get_key(map, "heuristics")
        .and_then(|v| as_optional_string_array(v))
        .or_else(|| {
            let s = extract_section(&body, "Unique Heuristics");
            let b = extract_bullets(s.as_deref());
            if b.is_empty() { None } else { Some(b) }
        });
    if let Some(h) = heuristics {
        result.insert("heuristics".to_string(), serde_json::Value::Array(h.into_iter().map(serde_json::Value::String).collect()));
    }

    let anti_patterns: Option<Vec<String>> = get_key(map, "anti_patterns")
        .and_then(|v| as_optional_string_array(v))
        .or_else(|| {
            let s = extract_section(&body, "Agent-Specific Anti-patterns");
            let b = extract_bullets(s.as_deref());
            if b.is_empty() { None } else { Some(b) }
        });
    if let Some(a) = anti_patterns {
        result.insert("antiPatterns".to_string(), serde_json::Value::Array(a.into_iter().map(serde_json::Value::String).collect()));
    }

    // Examples
    if let Some(ex) = get_key(map, "examples") {
        result.insert("examples".to_string(), to_json_value(ex));
    } else {
        let s = extract_section(&body, "Examples");
        if let Some(section) = s {
            let good: Vec<String> = section.lines()
                .map(|l| l.trim())
                .filter(|l| l.starts_with("- Good fit:"))
                .map(|l| l["- Good fit:".len()..].trim().to_string())
                .filter(|l| !l.is_empty())
                .collect();
            let bad: Vec<String> = section.lines()
                .map(|l| l.trim())
                .filter(|l| l.starts_with("- Bad fit:"))
                .map(|l| l["- Bad fit:".len()..].trim().to_string())
                .filter(|l| !l.is_empty())
                .collect();
            if !good.is_empty() || !bad.is_empty() {
                let mut examples = HashMap::new();
                let mut fit = HashMap::new();
                fit.insert("goodFit".to_string(), serde_json::Value::Array(good.into_iter().map(serde_json::Value::String).collect()));
                fit.insert("badFit".to_string(), serde_json::Value::Array(bad.into_iter().map(serde_json::Value::String).collect()));
                examples.insert("fit".to_string(), serde_json::to_value(&fit).unwrap());
                result.insert("examples".to_string(), serde_json::to_value(&examples).unwrap());
            }
        }
    }

    // Tool skill strategy
    if let Some(tss) = get_key(map, "tool_skill_strategy") {
        result.insert("toolSkillStrategy".to_string(), to_json_value(tss));
    }

    // Entry point
    if let Some(ep) = get_key(map, "entry_point") {
        result.insert("entryPoint".to_string(), to_json_value(ep));
    }

    // Prompt projection
    if let Some(pp) = get_key(map, "prompt_projection") {
        result.insert("promptProjection".to_string(), to_json_value(pp));
    }

    // Extra sections (body sections not in known keys)
    let known_set: std::collections::HashSet<&str> = KNOWN_AGENT_TOP_LEVEL_KEYS.iter().copied().collect();
    for (key, value) in map {
        if let Value::String(k) = key {
            if !known_set.contains(k.as_str()) {
                result.insert(k.clone(), to_json_value(value));
            }
        }
    }

    // Parse body sections
    let section_re = Regex::new(r"(?m)^##\s+(.+)$").expect("invalid section regex");
    let body_section_titles: Vec<String> = section_re.captures_iter(&body)
        .filter_map(|c| c.get(1).map(|m| m.as_str().to_string()))
        .collect();
    for title in &body_section_titles {
        let snake = to_snake_case(title);
        if known_set.contains(snake.as_str()) {
            continue;
        }
        if result.contains_key(&snake) {
            continue;
        }
        if let Some(content) = extract_section(&body, title) {
            result.insert(snake, serde_json::Value::String(content));
        }
    }

    Ok(result)
}

/// Parse a team manifest file into a JSON-serializable map.
pub fn parse_team_manifest(file_path: &str) -> Result<HashMap<String, serde_json::Value>, ParseError> {
    let data: Value = parse_yaml_file(file_path)?;

    let map = data.as_mapping()
        .ok_or_else(|| ParseError::Validation("manifest must be a mapping".to_string()))?;

    reject_removed_fields(&data, file_path, REMOVED_TEAM_FIELDS,
        "Remove legacy team-only structure fields from the manifest.")?;

    Ok(map_to_json(map))
}

/// Parse a team policy file into a JSON-serializable map.
pub fn parse_team_policy(file_path: &str) -> Result<HashMap<String, serde_json::Value>, ParseError> {
    let data: Value = parse_yaml_file(file_path)?;
    let map = data.as_mapping()
        .ok_or_else(|| ParseError::Validation("policy must be a mapping".to_string()))?;
    Ok(map_to_json(map))
}

/// Load a team directory (manifest + policy + all agent files).
pub fn load_team_directory(dir: &str) -> Result<HashMap<String, serde_json::Value>, ParseError> {
    let dir_path = Path::new(dir);
    let mut result = HashMap::new();

    // Manifest
    let manifest_path = dir_path.join("team.manifest.yaml");
    if manifest_path.exists() {
        let manifest = parse_team_manifest(manifest_path.to_str().unwrap())?;
        result.insert("manifest".to_string(), serde_json::to_value(&manifest).unwrap());
    }

    // Policy
    let policy_path = dir_path.join("team.policy.yaml");
    if policy_path.exists() {
        let policy = parse_team_policy(policy_path.to_str().unwrap())?;
        result.insert("policy".to_string(), serde_json::to_value(&policy).unwrap());
    }

    // Agent files
    let mut agents = Vec::new();
    let mut issues = Vec::new();
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries {
            if let Ok(entry) = entry {
                let path = entry.path();
                if let Some(ext) = path.extension() {
                    if ext == "md" && path.file_name()
                        .and_then(|n| n.to_str())
                        .map_or(false, |n| n.ends_with(".agent.md"))
                    {
                        match parse_agent_profile(path.to_str().unwrap()) {
                            Ok(agent) => agents.push(serde_json::to_value(&agent).unwrap()),
                            Err(e) => {
                                issues.push(serde_json::json!({
                                    "level": "error",
                                    "message": e.to_string(),
                                    "filePath": path.to_str().unwrap(),
                                }));
                            }
                        }
                    }
                }
            }
        }
    }

    result.insert("agents".to_string(), serde_json::Value::Array(agents));
    result.insert("loadIssues".to_string(), serde_json::Value::Array(issues));

    Ok(result)
}

// ── Helpers ──────────────────────────────────────────────────────

fn to_camel_case(s: &str) -> String {
    let mut result = String::new();
    let mut upper = false;
    for ch in s.chars() {
        if ch == '_' {
            upper = true;
        } else if upper {
            result.push(ch.to_ascii_uppercase());
            upper = false;
        } else {
            result.push(ch);
        }
    }
    result
}

fn to_snake_case(s: &str) -> String {
    s.to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() || c == '_' { c } else { '_' })
        .collect::<String>()
        .chars()
        .fold((String::new(), false), |(mut acc, prev_was_us), c| {
            if c == '_' {
                if !prev_was_us {
                    acc.push('_');
                }
                (acc, true)
            } else {
                acc.push(c);
                (acc, false)
            }
        })
        .0
        .trim_matches('_')
        .to_string()
}

fn to_json_value(value: &Value) -> serde_json::Value {
    match value {
        Value::Null => serde_json::Value::Null,
        Value::Bool(b) => serde_json::Value::Bool(*b),
        Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                serde_json::Value::Number(i.into())
            } else if let Some(f) = n.as_f64() {
                serde_json::Number::from_f64(f)
                    .map(serde_json::Value::Number)
                    .unwrap_or(serde_json::Value::Null)
            } else {
                serde_json::Value::Null
            }
        }
        Value::String(s) => serde_json::Value::String(s.clone()),
        Value::Sequence(seq) => {
            serde_json::Value::Array(seq.iter().map(to_json_value).collect())
        }
        Value::Mapping(map) => {
            let mut json_map = serde_json::Map::new();
            for (k, v) in map {
                if let Value::String(key) = k {
                    json_map.insert(key.clone(), to_json_value(v));
                }
            }
            serde_json::Value::Object(json_map)
        }
        Value::Tagged(t) => to_json_value(&t.value),
    }
}

fn map_to_json(map: &serde_yaml::Mapping) -> HashMap<String, serde_json::Value> {
    let mut result = HashMap::new();
    for (k, v) in map {
        if let Value::String(key) = k {
            result.insert(key.clone(), to_json_value(v));
        }
    }
    result
}
