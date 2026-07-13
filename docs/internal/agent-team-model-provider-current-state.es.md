Language: English | Español

# Estado actual de la configuración de Agent Team y Provider/Model en aiyou-team

> Propósito: Proporcionar los hechos de ingeniería actuales para diseñar en el futuro el "provider/model por defecto del Coding Team integrado y los esquemas de adaptación/fallback por entorno". Este documento solo describe el estado actual y no propone soluciones de implementación finales.

## 1. Resumen del sistema de configuración actual

La cadena de configuración actual de Team en aiyou-team es:

```text
aiyou-team.json
  -> Team Registration Source
  -> Team Registration
  -> AgentTeamDefinition
  -> TeamLibrary
  -> TeamLibraryProjection
  -> OpenCode Agent Config Patch
  -> OpenCode cfg.agent / cfg.default_agent
```

Ubicaciones de la implementación central:

- `src/agent-teams/filesystem.ts`: Lee el `aiyou-team.json` global/de proyecto, normaliza los registros de Team, carga Teams basados en archivos.
- `src/agent-teams/library.ts`: Carga Teams integrados y basados en archivos, ordena, elimina duplicados, maneja sombras, valida y genera `TeamLibrary`.
- `src/runtime/team-library-projection.ts`: Proyecta `TeamLibrary` en `ProjectedTeam` / `ProjectedAgent`.
- `src/adapters/opencode/projection.ts`: Proyecta `ProjectedAgent` en definiciones de Agent de OpenCode, incluyendo `model`, `temperature`, `top_p`, `variant`.
- `src/adapters/opencode/bootstrap.ts` y `src/adapters/opencode/config-hook.ts`: Genera y escribe de vuelta `cfg.agent` y el Agent por defecto en el config hook de OpenCode.

Actualmente no existe un resolvedor de model independiente, detección de disponibilidad de provider, cadena de fallback ni fallback por errores de API en tiempo de ejecución. El provider/model proviene principalmente del `agent_runtime` del manifest del Team.

## 2. Métodos de configuración de Agent Team

### 2.1 Configuración de Team integrado

Los Teams integrados se referencian por `id` en `aiyou-team.json`:

```json
{
  "teams": [
    { "id": "coding-team", "enabled": true, "priority": 0 }
  ]
}
```

Lógica de carga:

- `src/agent-teams/filesystem.ts` normaliza `{ "id": "coding-team" }` en `ConfiguredEmbeddedTeamSource`.
- `loadEmbeddedTeam()` en `src/agent-teams/library.ts` solo reconoce `BUILTIN_CODING_TEAM_ID` y llama a `createEmbeddedCodingTeam()`.
- El manifest, policy y lista de agents completos del Coding Team integrado están definidos en `src/agent-teams/embedded/coding-team.ts` y `src/agent-teams/embedded/coding-team/agents/*`.

Cuando falta la configuración global o durante la reparación de instalación, aiyou-team añade el `coding-team` integrado por defecto:

- `createDefaultConfig()` retorna `teams: [{ id: "coding-team", enabled: true, priority: 0 }]` por defecto.
- La plantilla empaquetada `templates/aiyou-team.json` también habilita `coding-team` por defecto; otros Teams plantilla están deshabilitados por defecto.
- Cuando falta la configuración del source global, `listConfiguredTeamSourcesFromDescriptor()` recurre a `createDefaultCodingTeamSource()`.

### 2.2 Teams basados en archivos: Directorio de plantillas + configuración YAML/Markdown

Un Team basado en archivos es un directorio; actualmente solo se leen los archivos raíz:

```text
<TeamDir>/
  team.manifest.yaml
  team.policy.yaml
  <agent-1>.agent.md
  <agent-2>.agent.md
  TEAM.md        # optional
  README.md      # optional
```

Archivos requeridos:

- `team.manifest.yaml`
- `team.policy.yaml`
- Al menos un `*.agent.md`

La implementación actual no escanea archivos de Agent en subdirectorios como `agents/` o `docs/`. La implementación correspondiente es `loadTeamDefinitionFromDirectoryWithIssues()`: lee el manifest, policy y enumera `*.agent.md` en el directorio raíz del Team.

Los Teams basados en archivos se referencian por `path` en `aiyou-team.json`:

```json
{
  "teams": [
    { "path": "@teams/general-team", "enabled": false, "priority": 1 }
  ]
}
```

Las plantillas incluidas se encuentran en:

```text
templates/
  aiyou-team.json
  teams/
    general-team/
    template-team/
    wukong-team/
```

Durante la instalación / reparación, las plantillas de Team se copian al directorio `teams/` bajo la raíz de configuración de OpenCode.

### 2.3 `team.manifest.yaml`

`team.manifest.yaml` define el Team en sí:

- `id` / `version` / `name` / `description`
- `mission`
- `scope`
- `leader.agent_ref`
- `members`
- `workflow.stages`
- `governance`
- `agent_runtime`
- `tags`
- `prompt_projection`

La implementación del parsing es `mapTeamManifest()` en `src/agent-teams/parsers.ts`. El `agent_runtime` se parsea en `TeamManifest.agentRuntime`.

### 2.4 `team.policy.yaml`

`team.policy.yaml` define las reglas compartidas del Team, actualmente usadas para Team Contract / prompt projection:

- `instruction_precedence`
- `approval_policy`
- `forbidden_actions`
- `quality_floor`
- `working_rules`
- `prompt_projection`

La implementación del parsing es `mapTeamPolicy()` en `src/agent-teams/parsers.ts`.

### 2.5 `*.agent.md`

Los archivos de Agent usan definiciones estilo Markdown + frontmatter. Los campos principales incluyen:

- metadata: `id`, `kind`, `version`, `name`
- `persona_core`
- `responsibility_core`
- semántica de ejecución: `core_principle`, `scope_control`, `ambiguity_policy`, `support_triggers`, `task_triage`, `delegation_review`, `completion_gate`, `failure_recovery`
- `collaboration`
- `runtime_config`
- `output_contract`
- `entry_point`
- `prompt_projection`

Nota: El `runtime_config` del Agent gestiona herramientas, permisos, skills, instrucciones, MCP, memoria, hooks y otras capacidades de ejecución; no incluye provider/model. El provider/model se configura centralizadamente en el `agent_runtime` del manifest del Team.

## 3. Configuración global, de proyecto y diferentes Teams para diferentes proyectos

### 3.1 Ubicaciones de los archivos de configuración

aiyou-team actualmente soporta dos fuentes de configuración isomórficas:

| Ámbito | Archivo de configuración | Base de resolución de rutas | Precedencia del source |
| --- | --- | --- | --- |
| global | `<OpenCodeConfigRoot>/aiyou-team.json` | Raíz de configuración de OpenCode | Baja |
| project | `<project-worktree>/.aiyou-team/aiyou-team.json` | `<project-worktree>/.aiyou-team` | Alta |

Rutas globales comunes:

```text
~/.config/opencode/aiyou-team.json
```

Rutas comunes en Windows:

```text
C:\Users\<user>\.config\opencode\aiyou-team.json
```

Rutas a nivel de proyecto:

```text
<project-worktree>/.aiyou-team/aiyou-team.json
```

### 3.2 Esquema actual de `aiyou-team.json`

Los campos actualmente válidos para entradas de Team en `aiyou-team.json` son únicamente:

| Campo | Descripción |
| --- | --- |
| `id` | Referencia un Team integrado, ej. `coding-team` |
| `path` | Referencia un directorio de Team basado en archivos |
| `enabled` | Si está habilitado, por defecto `true` |
| `priority` | Valor de ordenamiento dentro del mismo source; menor número = mayor prioridad |

Restricción: Una entrada solo puede tener `id` o `path`, no ambos.

Actualmente `aiyou-team.json` no soporta override de provider/model, override de Team, override de Agent, extends, include ni parches de runtime por agent.

### 3.3 Reglas de resolución de rutas

`path` soporta:

```json
{ "path": "@teams/ProjectCodingTeam" }
{ "path": "teams/ProjectCodingTeam" }
{ "path": "~/aiyouTeams/ProjectCodingTeam" }
{ "path": "E:/aiyouTeams/ProjectCodingTeam" }
```

Reglas:

- `@teams/xxx`: Después de eliminar `@`, se resuelve relativo al directorio que contiene el `aiyou-team.json` actual.
- `teams/xxx`: Se resuelve relativo al directorio que contiene el `aiyou-team.json` actual.
- `~/xxx`: Se resuelve relativo al directorio home del usuario.
- Rutas absolutas: Se usan tal cual.

Por lo tanto, el mismo `@teams/foo` se resuelve a diferentes directorios en configuración global vs. de proyecto:

```text
global  @teams/foo -> <OpenCodeConfigRoot>/teams/foo
project @teams/foo -> <project-worktree>/.aiyou-team/teams/foo
```

### 3.4 Diferentes Teams para diferentes proyectos

Los diferentes proyectos configuran diferentes Teams mediante el `.aiyou-team/aiyou-team.json` de su respectivo worktree. Por ejemplo:

```json
{
  "teams": [
    { "path": "@teams/project-coding-team", "enabled": true, "priority": 0 },
    { "id": "coding-team", "enabled": true, "priority": 1 }
  ]
}
```

Estructura de directorios correspondiente:

```text
<project-worktree>/
  .aiyou-team/
    aiyou-team.json
    teams/
      project-coding-team/
        team.manifest.yaml
        team.policy.yaml
        project-leader.agent.md
```

Reglas de ordenamiento de carga:

1. El source de proyecto tiene precedencia sobre el source global.
2. Dentro del mismo source, se ordena por `priority` de menor a mayor.
3. Dentro del mismo source con la misma prioridad, se ordena por el orden de declaración en `aiyou-team.json`.

Cuando hay conflicto de IDs de Team, el Team cargado primero gana. Un escenario típico: cuando un Team a nivel de proyecto usa el mismo ID de manifest que un Team global, sombrea al Team global. La implementación está en la lógica de `usedTeamIds` en `src/agent-teams/library.ts`.

## 4. Dónde se configura actualmente el Provider/Model

### 4.1 Definiciones de tipos

El tipo central para provider/model es `AgentRuntimeModelConfig`:

```ts
export interface AgentRuntimeModelConfig {
  provider: string;
  model: string;
  temperature?: number;
  topP?: number;
  variant?: string;
  options?: Record<string, unknown>;
}
```

Está adjunto a `TeamManifest.agentRuntime?: Record<string, AgentRuntimeModelConfig>`.

### 4.2 Campos de configuración de Team basado en archivos

Los Teams basados en archivos configuran `agent_runtime` en `team.manifest.yaml`:

```yaml
agent_runtime:
  leader:
    provider: openai
    model: gpt-5.5
    temperature: 0.25
    top_p: 0.9
    variant: generalist-orchestrator
    options:
      reasoning_effort: high
```

Reglas de parsing:

- `provider` es requerido.
- `model` es requerido.
- `temperature` es opcional, convertido directamente con `Number(...)`.
- `top_p` o `topP` es opcional, mapeado a `topP`.
- `variant` es opcional.
- `options` es opcional, copiado superficialmente como objeto.

Implementación: `mapAgentRuntime()` en `src/agent-teams/parsers.ts`.

Reglas de validación: Actualmente solo valida si las claves de `agent_runtime` apuntan a Agents existentes dentro del Team; genera una advertencia si no se encuentran. No valida si el provider/model existe, es conectable o si los parámetros son soportados por el provider.

### 4.3 Ubicación de la configuración de Provider/Model del Coding Team integrado

El provider/model del Coding Team integrado está directamente hardcodeado en:

```text
src/agent-teams/embedded/coding-team.ts
```

Actualmente ubicado en `manifest.agentRuntime` de `createEmbeddedCodingTeam()`:

```ts
agentRuntime: {
  "coding-leader": { provider: "openai", model: "gpt-5.5", temperature: 0.2, topP: 0.85, variant: "long-context" },
  "coordination-leader": { provider: "openai", model: "gpt-5.5", temperature: 0.15, topP: 0.75 },
  "coding-executor": { provider: "openai", model: "gpt-5.5", temperature: 0.25, topP: 0.9 },
  "codebase-explorer": { provider: "openai", model: "gpt-5.5", temperature: 0.1, topP: 0.8 },
  "web-researcher": { provider: "openai", model: "gpt-5.5", temperature: 0.2, topP: 0.85 },
  reviewer: { provider: "openai", model: "gpt-5.5", temperature: 0.15, topP: 0.75 },
  "principal-advisor": { provider: "openai", model: "gpt-5.5", temperature: 0.15, topP: 0.75 },
  "multimodal-looker": { provider: "openai", model: "gpt-5.5", temperature: 0.2, topP: 0.85 },
}
```

Esto significa que el Coding Team integrado actualmente tiene una dependencia dura en `openai/gpt-5.5` vía proyección: siempre que se habilite el `coding-team` integrado, estos campos de modelo se escriben en la configuración de agent de OpenCode.

### 4.4 Configuración de Provider/Model de otros Teams plantilla

Los Teams plantilla incluidos también configuran provider/model en el `agent_runtime` de su respectivo `team.manifest.yaml`. Por ejemplo:

- `templates/teams/general-team/team.manifest.yaml`
- `templates/teams/template-team/team.manifest.yaml`

Actualmente también usan por defecto `provider: openai`, `model: gpt-5.5`.

## 5. Cómo se proyecta el Provider/Model a OpenCode

### 5.1 Impacto de la normalización de IDs de Agent en `agent_runtime`

Después de cargar el Team, se ejecuta `normalizeTeamAgentIds()`. Normaliza los IDs fuente de Agent a IDs canónicos y reescribe sincronizadamente:

- `manifest.leader.agentRef`
- `manifest.members`
- `manifest.agentRuntime`
- Metadatos del Agent / referencias de colaboración

Por lo tanto, la etapa de proyección usa IDs canónicos de agent:

```ts
const runtimeOverride = agent.sourceTeam.manifest.agentRuntime?.[agent.canonicalAgentId];
```

Para el `coding-team` integrado, IDs como `coding-leader` ya coinciden con el resultado canónico y permanecen sin cambios. Para Teams basados en archivos, si se añade el prefijo del ID del Team a los IDs de Agent, las claves de `agent_runtime` también se reescriben accordingly.

### 5.2 resolvedModel en la configuración de Agent de OpenCode

`createOpenCodeAgentConfig()` en `src/adapters/opencode/projection.ts` lee:

```ts
agent.sourceTeam.manifest.agentRuntime?.[agent.canonicalAgentId]
```

Si existe un override de runtime, genera:

```ts
resolvedModel: {
  providerID: runtimeOverride.provider,
  modelID: runtimeOverride.model,
  temperature: runtimeOverride.temperature,
  topP: runtimeOverride.topP,
  variant: runtimeOverride.variant,
  options: runtimeOverride.options,
  source: "team-manifest",
}
```

Si no existe, no se genera `resolvedModel`.

### 5.3 Escritura en la definición de Agent de OpenCode

`createOpenCodeAgentDefinition()` escribe `resolvedModel` como campos de la definición de agent de OpenCode:

```ts
model: agent.resolvedModel
  ? `${agent.resolvedModel.providerID}/${agent.resolvedModel.modelID}`
  : undefined,
temperature: agent.resolvedModel?.temperature,
top_p: agent.resolvedModel?.topP,
variant: agent.resolvedModel?.variant,
options: createManagedAgentOptions({
  teamId: agent.teamId,
  canonicalAgentId: agent.canonicalAgentId,
  existingOptions: agent.resolvedModel?.options,
}),
```

Comportamiento actual importante:

- Si `agent_runtime` existe, la definición de agent de OpenCode siempre escribe `model: "provider/model"`.
- Si `agent_runtime` no existe, `model`, `temperature`, `top_p` y `variant` son todos `undefined`, y OpenCode usa el modelo por defecto del host.
- aiyou-team actualmente no verifica si el provider/model está disponible en el entorno de OpenCode del usuario.

- aiyou-team actualmente no reescribe dinámicamente los modelos del Team basándose en el modelo seleccionado por UI o el modelo por defecto del usuario en OpenCode.

### 5.4 Config Hook escribiendo de vuelta a OpenCode

Cadena del config hook de OpenCode:

```text
createConfigHook()
  -> createOpenCodeBootstrap()
  -> createOpenCodeAgentConfigs()
  -> createOpenCodeAgentConfigPatch()
  -> applyOpenCodeAgentConfigPatch()
  -> cfg.agent = merged agents
  -> current.default_agent = merged default_agent
```

`applyOpenCodeAgentConfigPatch()` hará:

- Eliminar claves de agents gestionados antiguos de aiyou-team que ya no existen.
- Insertar nuevos agents de aiyou-team.
- Actualizar agents existentes gestionados por aiyou-team.
- Omitir al encontrar agents externos con el mismo nombre, para evitar sobrescribir agents que no son de aiyou-team.

El Agent por defecto es seleccionado por `bootstrap.ts`: prioriza el agent host seleccionado / team-agent seleccionado explícitamente; de lo contrario selecciona el leader seleccionable por el usuario del Team por defecto basándose en el orden de clasificación de TeamLibrary.

## 6. Cómo pueden influir actualmente los usuarios en el Provider/Model del Coding Team integrado

Los usuarios pueden influir indirectamente, pero no hay un mecanismo directo de override.

### 6.1 Enfoque viable A: Deshabilitar el Coding Team integrado y usar una alternativa basada en archivos

Los usuarios pueden habilitar su propio Team basado en archivos en el `.aiyou-team/aiyou-team.json` del proyecto o en el `aiyou-team.json` global con mayor prioridad. Sin embargo, si el `coding-team` integrado sigue habilitado, seguirá siendo proyectado, aunque el punto de entrada por defecto puede no ser él.

Ejemplo de proyecto:

```json
{
  "teams": [
    { "path": "@teams/project-coding-team", "enabled": true, "priority": 0 },
    { "id": "coding-team", "enabled": false, "priority": 1 }
  ]
}
```

Limitación: Esto no es "configurar el provider/model del Coding Team integrado" sino reemplazarlo con un Team basado en archivos diferente. Los usuarios necesitan copiar / mantener toda la definición del Team.

### 6.2 Enfoque viable B: Un Team de proyecto sombrea un Team global con el mismo nombre

Un Team a nivel de proyecto basado en archivos puede usar el ID de manifest `coding-team` para sombrear al `coding-team` global / integrado. Durante la carga, el source de proyecto tiene mayor precedencia, y el Team global cargado con el mismo ID se omite.

Ejemplo de proyecto:

```json
{
  "teams": [
    { "path": "@teams/coding-team", "enabled": true, "priority": 0 }
  ]
}
```

Donde:

```text
<project-worktree>/.aiyou-team/teams/coding-team/team.manifest.yaml
```

tiene su `id` configurado a:

```yaml
id: coding-team
```

Limitación: Aún requiere copiar todos los archivos de manifest, policy y agent del Coding Team integrado; no es un override ligero.

### 6.3 Actualmente no soportado: Sobrescribir el modelo del Coding Team integrado en `aiyou-team.json`

El esquema actual de entradas en `aiyou-team.json` no soporta:

```json
{
  "id": "coding-team",
  "agent_runtime": {
    "coding-leader": { "provider": "anthropic", "model": "claude-sonnet" }
  }
}
```

Tampoco soporta:

```json
{
  "models": { ... },
  "teams": { ... }
}
```

Estos campos serían ignorados por el cargador actual o tratados como configuración desconocida y no entrarían en `AgentTeamDefinition`.

## 7. Restricciones actuales relevantes para el diseño del esquema de fallback

### 7.1 El Provider/Model es actualmente un campo estático en el manifest del Team

El diseño actual trata el provider/model como parte de la definición del Team, no como una capa independiente de adaptación del entorno del usuario. En la implementación, `OpenCodeResolvedModelConfig.source` es únicamente `"team-manifest"`.

Si se necesita soportar fallback en el futuro, se debe decidir en qué capa insertar el resolvedor:

```text
Team manifest agentRuntime
  -> model resolver / override / fallback
  -> OpenCodeResolvedModelConfig
  -> OpenCode Agent Definition
```

### 7.2 Omitir el campo de modelo recurre al Host Default

El código de proyección actual ya soporta naturalmente "no escribir model cuando no hay resolvedModel". Esto proporciona un punto de implementación de baja invasión para el fallback a Host Default: siempre que el resolvedor retorne `undefined` cuando no pueda confirmar un modelo disponible, la definición de agent de OpenCode no incluirá el campo `model`.

### 7.3 El Coding Team integrado actualmente no puede configurarse ligeramente

El `agentRuntime` del Coding Team integrado está hardcodeado directamente en TypeScript. Los usuarios no pueden parchear modelos individuales de Agents del Team integrado mediante `aiyou-team.json`; solo pueden reemplazar todo el Team o deshabilitarlo.

Este es exactamente el punto clave que el diseño de funcionalidad futura necesita abordar: permitir a los usuarios configurar el provider/model del `coding-team` integrado evitando convertir los modelos recomendados integrados en dependencias duras.

### 7.4 No existe actualmente una fuente de disponibilidad de provider

El código actual no lee el registro de provider/model de OpenCode, el estado de autenticación del usuario, variables de entorno ni metadata de models.dev. Tampoco hay salida de doctor para "ruta de resolución de modelo".

Si se necesita "resolución por entorno" para esquemas de fallback futuros, se deben agregar nuevas fuentes de disponibilidad o adoptar una estrategia conservadora: cuando no se pueda confirmar la disponibilidad, omitir el modelo y delegar al Host Default.

### 7.5 Los parámetros actualmente no se normalizan por capacidades

`temperature`, `top_p`, `variant` y `options` actualmente se proyectan tal cual del manifest del Team. No hay lógica para eliminar campos no soportados basándose en las capacidades del provider/model.

Si se introduce fallback entre providers más adelante, se debe considerar la compatibilidad de parámetros: por ejemplo, algunos providers no soportan `variant` y algunos modelos no soportan `options.reasoning_effort` específico.

## 8. Puntos de inserción mínimos disponibles para el diseño futuro

Basándose en el estado actual, se pueden considerar los siguientes puntos de inserción para las funcionalidades futuras de provider/model por defecto y adaptación:

1. **Capa de esquema de configuración**: Extender `aiyou-team.json` para soportar configuración de modelo global / a nivel de proyecto, override de Team, override de Agent.
2. **Capa de carga de Team**: Después de `loadDefaultTeamLibrary()` o cargar Teams integrados, aplicar parches de override a `manifest.agentRuntime`.
3. **Capa de proyección**: En `createOpenCodeAgentConfig()`, pasar `runtimeOverride` al resolvedor de modelo, produciendo `resolvedModel | undefined`.
4. **Capa de Doctor / diagnósticos**: Extender `doctor` y los logs del config hook para producir el perfil esperado, modelo real y razón de fallback/host-default de cada Agent.

La capa de Proyección es la más cercana a la decisión de "si escribir o no en el campo de modelo de OpenCode"; la capa de esquema de configuración es la más cercana a la necesidad de "cómo los usuarios pueden sobrescribir el Coding Team integrado".

## 9. Índice de archivos clave

| Tema | Archivo |
| --- | --- |
| Manifest / agentRuntime del Coding Team integrado | `src/agent-teams/embedded/coding-team.ts` |
| Agents del Coding Team integrado | `src/agent-teams/embedded/coding-team/agents/*` |
| Tipos centrales de Team / Agent | `src/core/index.ts` |
| Lectura de `aiyou-team.json` y normalización de Team source | `src/agent-teams/filesystem.ts` |
| Carga, ordenamiento y sombreado de TeamLibrary | `src/agent-teams/library.ts` |
| Parsing de YAML / Agent MD | `src/agent-teams/parsers.ts` |
| Validación de Team | `src/agent-teams/validation.ts` |
| ID canónico de Agent y reescritura de claves de `agentRuntime` | `src/agent-teams/canonical-agent-id.ts` |
| Proyección en tiempo de ejecución | `src/runtime/team-library-projection.ts` |
| Proyección de agent OpenCode / escritura de campo de modelo | `src/adapters/opencode/projection.ts` |
| Bootstrap de OpenCode / Agent por defecto | `src/adapters/opencode/bootstrap.ts` |
| Config hook de OpenCode | `src/adapters/opencode/config-hook.ts` |
| Merge de configuración de OpenCode | `src/adapters/opencode/config-merge.ts` |
| `aiyou-team.json` empaquetado | `templates/aiyou-team.json` |
| Teams plantilla | `templates/teams/*` |
| Guía de Team personalizado | `docs/guide/custom-agent-team.md` |
| Guía de configuración de Team a nivel de proyecto | `docs/guide/project-team-config.md` |
