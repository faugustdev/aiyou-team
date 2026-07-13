# Diseñando un Agent Team personalizado (Mejores prácticas)

Language: English | Español

Público: **autores y creadores de Team** definiendo activos de Agent Team. Los flujos de liberación y CI/CD del repositorio se cubren en la [Guía de Liberación y CI/CD](../developer/release.md).

## 0. Las dos cosas que hay que decidir primero: dónde ponerlo y cómo registrarlo

Al definir un Agent Team personalizado, las dos decisiones operativas son:

1. **Poner todos los archivos de definición del Team en un solo directorio de Team.**
2. **Registrar ese directorio de Team en un archivo `aiyou-team.json` global o a nivel de proyecto.**

### 0.1 Estructura del directorio de Team

Un Team basado en archivos es un directorio. La implementación actual solo lee archivos en la raíz del directorio de Team. No escanea `agents/`, `docs/`, ni otros subdirectorios:

```text
ResearchOpsTeam/
  team.manifest.yaml
  team.policy.yaml
  researchops-leader.agent.md
  evidence-researcher.agent.md
  report-writer.agent.md
  TEAM.md              # opcional, documentación para usuarios
```

Archivos requeridos:

- `team.manifest.yaml`
- `team.policy.yaml`
- al menos un `*.agent.md`

Archivos opcionales:

- `TEAM.md`
- `README.md`

> Restricción clave: los archivos `*.agent.md` deben estar en el mismo directorio que `team.manifest.yaml` y `team.policy.yaml`. aiyou-team no carga agents desde un subdirectorio `agents/`.

### 0.2 Dónde configurar `aiyou-team.json`

aiyou-team admite dos fuentes de configuración isomorfas:

| Ámbito | Archivo de configuración | Caso de uso |
| --- | --- | --- |
| global | `aiyou-team.json` bajo la raíz de configuración de OpenCode | Teams disponibles por defecto en todos los proyectos |
| proyecto | `.aiyou-team/aiyou-team.json` bajo el árbol de trabajo actual | Teams específicos del proyecto actual |

La ubicación global común es:

```text
~/.config/opencode/aiyou-team.json
```

En Windows esto generalmente se corresponde con:

```text
C:\Users\<your-user>\.config\opencode\aiyou-team.json
```

Si OpenCode usa una raíz de configuración diferente, usa esa raíz de configuración real.

La configuración a nivel de proyecto se encuentra en el árbol de trabajo actual de OpenCode:

```text
<project-worktree>/.aiyou-team/aiyou-team.json
```

La configuración de proyecto y global usan el mismo esquema, estructura de directorio de Team, cargador, validador, proyección y parche de configuración de OpenCode. Las únicas diferencias son la ruta de origen, la base de resolución de rutas, el ámbito de ejecución (`project` / `global`) y la precedencia de origen.

### 0.3 `aiyou-team.json` mínimo

```json
{
  "teams": [
    { "id": "coding-team", "enabled": true, "priority": 0 },
    { "path": "@teams/ResearchOpsTeam", "enabled": true, "priority": 1 }
  ]
}
```

Significado:

- `{ "id": "coding-team" }`: carga el Coding Team integrado.
- `{ "path": "..." }`: carga un Team basado en archivos; la ruta apunta al directorio del Team, no a un archivo específico.
- `enabled`: opcional; por defecto es `true`.
- `priority`: opcional; números más bajos se ordenan primero dentro de la misma fuente. Entre fuentes, la fuente de proyecto tiene precedencia sobre la fuente global. El líder de Team con la prioridad más alta usable se convierte en el Agent por defecto de OpenCode.
- Cada entrada debe usar `id` o `path`, no ambos.

Formas de `path` soportadas:

```json
{ "path": "@teams/ResearchOpsTeam" }
{ "path": "teams/ResearchOpsTeam" }
{ "path": "~/aiyou-teams/ResearchOpsTeam" }
{ "path": "E:/aiyou-teams/ResearchOpsTeam" }
```

Reglas de rutas:

- `@teams/ResearchOpsTeam`: eliminar `@`, luego resolver relativo al directorio que contiene el `aiyou-team.json` actual.
- `teams/ResearchOpsTeam`: resolver relativo al directorio que contiene el `aiyou-team.json` actual.
- `~/...`: resolver relativo al directorio home del usuario.
- Rutas absolutas: usar tal cual.

Ejemplo global:

```text
~/.config/opencode/teams/ResearchOpsTeam/
```

Ejemplo de proyecto:

```text
<project-worktree>/.aiyou-team/teams/ResearchOpsTeam/
```

### 0.4 Camino más corto para empezar a funcionar

1. Elegir el ámbito del Team: los Teams globales viven bajo la raíz de configuración de OpenCode; los Teams de proyecto viven bajo el directorio `.aiyou-team` del proyecto actual.
2. Crear el directorio del Team:
   - global: `<OpenCodeConfigRoot>/teams/ResearchOpsTeam/`
   - proyecto: `<project-worktree>/.aiyou-team/teams/ResearchOpsTeam/`
3. Poner `team.manifest.yaml`, `team.policy.yaml` y todos los archivos `*.agent.md` en la raíz del directorio del Team.
4. Agregar esta entrada al `aiyou-team.json` correspondiente:

```json
{ "path": "@teams/ResearchOpsTeam", "enabled": true, "priority": 1 }
```

5. Reiniciar OpenCode o el servidor de OpenCode para que aiyou-team recargue la configuración.

---

## 1. Público y objetivo

Esta guía es para:

1. Personas que quieran agregar un Team a aiyou-team.
2. Personas que quieran codificar su propio flujo de trabajo como un Agent Team.

El objetivo es práctico:

> Ayudarte a diseñar y crear un Team funcional que se ajuste a la implementación actual de aiyou-team.

---

## 2. Qué es un Team en aiyou-team

Un Team es un directorio que contiene cuatro categorías de archivos:

```text
<YourTeamDir>/
  team.manifest.yaml
  team.policy.yaml
  <agent-1>.agent.md
  <agent-2>.agent.md
  <agent-3>.agent.md
  TEAM.md      # opcional
```

- `team.manifest.yaml`: identifica el Team, líder formal, miembros, misión, alcance y flujo de trabajo.
- `team.policy.yaml`: define reglas compartidas de gobernanza, seguridad y calidad.
- `*.agent.md`: define el perfil de cada Agent.
- `TEAM.md`: explicación opcional para usuarios.

Registrar el Team en `aiyou-team.json`:

```json
{
  "teams": [
    { "id": "coding-team", "enabled": true, "priority": 0 },
    { "path": "@teams/ResearchOpsTeam", "enabled": true, "priority": 1 }
  ]
}
```

Notas:

- `coding-team` está integrado y no necesita una `path`.
- Las rutas de Team basados en archivos apuntan al directorio del Team.
- `@...` es relativo al directorio del `aiyou-team.json` actual.
- Los Teams de proyecto tienen precedencia sobre los Teams globales por fuente.
- Si un Team de proyecto y un Team global usan el mismo manifest id, el Team de proyecto oculta al Team global.

---

## 3. Cinco preguntas antes de escribir archivos

### 3.1 ¿Qué problema resuelve este Team?

Ejemplos:

- desarrollo de software y corrección de errores
- documentación e investigación
- análisis de producto
- coordinación de tareas complejas
- gestión de proyectos

Esto define la `mission` del Team, su `scope`, las responsabilidades de los Agents y el flujo de trabajo.

### 3.2 ¿Quién es el líder formal?

Todo Team debería tener un líder formal. El líder es:

- el punto de entrada predeterminado
- el propietario del cierre
- el Agent más natural para interacción con el usuario

No hagas del líder un rol simbólico que los usuarios normalmente no deberían seleccionar.

### 3.3 ¿Qué miembros se necesitan?

Empieza pequeño. Usualmente el Team mínimo útil es:

- 1 líder
- 1 a 3 Agents de soporte especializado

Ejemplos:

- Coding Team: `leader`, `executor`, `reviewer`
- General Team: `leader`, `researcher`, `writer`

### 3.4 ¿Cuáles son las reglas compartidas?

Las reglas compartidas van en `team.policy.yaml`, no duplicadas entre Agents:

- precedencia de instrucciones
- política de aprobación
- acciones prohibidas
- mínimo de calidad
- reglas de trabajo compartidas

### 3.5 ¿Cuáles son los menús de decisión de los Agents?

El comportamiento de alto valor de un Agent debería expresarse como secciones de primer nivel, no oculto dentro de un gran bloque genérico:

- `core_principle`
- `scope_control`
- `ambiguity_policy`
- `support_triggers`
- `task_triage`
- `delegation_review`
- `completion_gate`
- `failure_recovery`

---

## 4. Principios de mejores prácticas

### 4.1 Empieza pequeño, luego expande

No empieces con diez Agents. Comienza con un líder y unos pocos Agents de soporte enfocados.

### 4.2 Haz que el Team sea claro antes de hacerlo elaborado

Prioriza:

- quién es el líder
- los límites de los miembros
- el flujo de trabajo predeterminado
- la política del Team

### 4.3 Las diferencias entre Agents deben provenir del perfil

No dependas del framework para inferir si un Agent es un planificador, revisor o ejecutor. Define:

- quién es
- qué es responsable
- cómo actúa por defecto
- cómo colabora

### 4.4 La Prompt Projection solo recorta; no debería convertirse en la fuente de diseño

`prompt_projection` controla qué secciones aparecen y cómo se etiquetan. No debería reemplazar las definiciones del Team o del Agent.

### 4.5 La colaboración debería escribirse para la delegación

aiyou-team combina las entradas de colaboración de Agents con los metadatos de miembros del Team Manifest para generar descripciones de delegación útiles. Haz que `members.responsibility`, `delegate_when` y `delegate_mode` sean concretos.

---

## 5. Crear el directorio del Team

Team global:

```text
<OpenCodeConfigRoot>/teams/
  ResearchOpsTeam/
    team.manifest.yaml
    team.policy.yaml
    researchops-leader.agent.md
    evidence-researcher.agent.md
    report-writer.agent.md
    TEAM.md
```

Team de proyecto:

```text
<project-worktree>/.aiyou-team/teams/
  ResearchOpsTeam/
    team.manifest.yaml
    team.policy.yaml
    researchops-leader.agent.md
    evidence-researcher.agent.md
    report-writer.agent.md
    TEAM.md
```

Recomendaciones:

- Usa nombres de directorio estables, usualmente `PascalCase` o kebab-case según la convención del entorno.
- Usa `kebab-case.agent.md` para archivos de Agent.
- Usa `snake_case` para claves de YAML y frontmatter.

---

## 6. Escribir `team.manifest.yaml`

`team.manifest.yaml` define la estructura principal del Team.

Campos importantes:

| Campo | Propósito |
| --- | --- |
| `id` | Identificador estable del Team |
| `version` | Versión de la definición |
| `name` | Nombre para mostrar legible por humanos |
| `description` | Descripción del Team en una línea |
| `mission` | Objetivo del Team y definición de éxito |
| `scope` | Trabajo dentro y fuera del alcance |
| `leader` | Referencia al líder formal |
| `members` | Mapa de miembros y metadatos de delegación |
| `workflow` | Etapas del flujo de trabajo predeterminado |
| `governance` | Metadatos estáticos de gobernanza |
| `tags` | Etiquetas opcionales |

Forma mínima:

```yaml
id: researchops-team
version: 1.0.0
name: ResearchOpsTeam
description: Team for research, evidence synthesis, and structured reports

mission:
  objective: Deliver clear, evidence-backed, directly usable research outputs
  success_definition:
    - conclusions are clear
    - evidence is sufficient
    - output is directly usable

scope:
  in_scope:
    - research
    - analysis
    - writing
  out_of_scope:
    - large-scale coding implementation

leader:
  agent_ref: researchops-leader
  responsibilities:
    - receive user tasks
    - decide the research path
    - delegate specialist work when useful
    - own final closure

members:
  researchops-leader:
    responsibility: Default owner for research and synthesis tasks.
    delegate_when: Most research, analysis, and report tasks.
    delegate_mode: Keeps ownership and delegates only focused support work.

  evidence-researcher:
    responsibility: Finds sources, verifies facts, and extracts evidence.
    delegate_when: External evidence or fact checking is required.
    delegate_mode: Read-only research delegation with evidence and limits.

  report-writer:
    responsibility: Turns established conclusions into structured writing.
    delegate_when: Conclusions are ready and need formatting or prose.
    delegate_mode: Drafting delegation aligned to the required structure.

workflow:
  stages:
    - intake
    - clarification
    - evidence collection
    - synthesis
    - draft output
    - final check

governance:
  instruction_precedence:
    - platform rules
    - repository rules
    - team rules
    - agent rules
    - task rules
  approval_policy:
    required_for:
      - destructive actions
      - external side effects
      - commit
    allow_assume_for:
      - low-risk local decisions
  forbidden_actions:
    - fabricate evidence
    - claim done without verification
  quality_floor:
    required_checks:
      - evidence
      - consistency
    evidence_required: true
  working_rules:
    - leader is the primary interface
    - support agents report back to the active owner

tags:
  - research
  - analysis
  - writing
```

---

## 7. Escribir `team.policy.yaml`

Este archivo define reglas compartidas a nivel de Team y afecta directamente el Team Contract que se renderiza en los prompts.

Forma mínima:

```yaml
kind: team-policy
version: 1.0.0

instruction_precedence:
  - platform rules
  - repository rules
  - team rules
  - agent rules
  - task rules

approval_policy:
  required_for:
    - destructive actions
    - external side effects
    - commit
  allow_assume_for:
    - low-risk local decisions

forbidden_actions:
  - fabricate evidence
  - claim done without verification
  - ignore hard constraints

quality_floor:
  required_checks:
    - evidence
    - consistency
  evidence_required: true

working_rules:
  - leader is the primary interface
  - support agents report back to the active owner
  - final user-facing summary comes from the role holding closure responsibility

prompt_projection:
  include:
    - working_rules
    - approval_safety
```

Escribe los límites mínimos compartidos aquí; no codifiques el estilo personal de un Agent en la política del Team.

---

## 8. Diseña el líder Agent primero

El líder debería responder seis preguntas:

1. ¿Quién soy?
2. ¿De qué soy responsable?
3. ¿Cómo actúo por defecto?
4. ¿Cuándo delego, reviso, pregunto o me detengo?
5. ¿Qué cuenta como finalización?
6. ¿Cómo me recupero de un fallo?

Secciones recomendadas:

- `metadata`
- `persona_core`
- `responsibility_core`
- secciones de comportamiento de primer nivel como `core_principle`, `ambiguity_policy`, `support_triggers`, `task_triage`, `completion_gate` y `failure_recovery`
- `collaboration`
- `runtime_config`
- `output_contract`
- `entry_point`
- `prompt_projection`

Establece `entry_point.exposure: user-selectable` para el líder si los usuarios deberían poder seleccionarlo directamente.

---

## 9. Agregar Agents de soporte

Una vez que el líder esté claro, agrega Agents de soporte uno a la vez.

Principios:

- Cada Agent de soporte debería ser responsable de una clase clara de trabajo.
- Evita roles de soporte vagos que puedan hacer todo.
- No crees demasiados Agents al principio.
- Da a cada Agent de soporte `use_when`, `avoid_when` concretos y expectativas de salida.

---

## 10. Escribir `TEAM.md`

`TEAM.md` es para humanos, no para el analizador. Es recomendado pero no requerido.

Plantilla:

```md
# ResearchOpsTeam

## Mission
Research, evidence synthesis, report writing, and lightweight coordination.

## Leader
- researchops-leader: default entry point and owner

## Members
- evidence-researcher: source search and evidence extraction
- report-writer: structured final writing

## Default Workflow
1. User gives a task to the leader
2. Leader clarifies and chooses the path
3. Leader decides whether to self-execute, consult, or delegate
4. Support Agents report back to leader
5. Leader synthesizes and returns the final result

## Design Notes
- Team Contract uses Working Rules / Approval & Safety
- Agent Profiles use top-level semantic sections
- Collaboration produces directly delegable Agent descriptions
```

---

## 11. Validar el Team

Lista de verificación mínima:

- `team.manifest.yaml` existe
- `team.policy.yaml` existe
- al menos un `*.agent.md` existe
- `leader.agent_ref` apunta a un id de Agent real
- todas las entradas de `members` referencian Agents reales
- las claves de YAML usan `snake_case`
- no hay `projection_schema` heredado

Autoverificación recomendada:

- ¿La misión del Team es clara?
- ¿El líder formal es obvio?
- ¿Las responsabilidades de los miembros son concretas?
- ¿El líder puede liderar la ruta principal?
- ¿Los Agents de soporte están enfocados?
- ¿`prompt_projection` solo recorta, no reemplaza las definiciones de origen?

---

## 12. Errores comunes

1. Diseñar un grupo plano de Agents sin un líder claro.
2. Ocultar comportamiento importante en un gran campo genérico.
3. Listar miembros sin responsabilidades y tiempos de delegación.
4. Crear demasiados Agents de soporte vagos.
5. Tratar `README.md` o `TEAM.md` como la fuente de verdad en tiempo de ejecución.

Los archivos de origen en tiempo de ejecución son:

- `team.manifest.yaml`
- `team.policy.yaml`
- `*.agent.md`

---

## 13. Resumen

Proceso recomendado:

1. Decidir qué problema resuelve el Team.
2. Elegir el líder formal.
3. Escribir `team.manifest.yaml`.
4. Escribir `team.policy.yaml`.
5. Diseñar el líder Agent primero.
6. Agregar Agents de soporte gradualmente.
7. Hacer que `members.responsibility / delegate_when / delegate_mode` sean específicos.
8. Agregar `TEAM.md` para humanos.
9. Empezar con un Team pequeño funcional, luego expandir.

Regla más importante:

> Diseña la estructura del Team, el líder, los límites de los miembros y la semántica clave de ejecución antes de ajustar la redacción de los prompts.
