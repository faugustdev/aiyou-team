# Configuración de Team a nivel de proyecto en aiyou-team

Language: English | Español

Público: **autores y usuarios de Team** configurando Teams globales y a nivel de proyecto. Los flujos de liberación y CI/CD del repositorio se cubren en la [Guía de Liberación y CI/CD](../developer/release.md).

> Estado: implementado y publicado en `aiyou-team@0.1.9`. Este documento describe el modelo actual de configuración de Team global/proyecto y las restricciones arquitectónicas que mantienen ambas fuentes en la misma ruta de ensamblaje.

## 1. Conclusión de diseño

El objetivo P0 es que aiyou-team soporte tanto **Teams globales** como **Teams de proyecto**, con los Teams de proyecto tomando naturalmente precedencia en el árbol de trabajo actual.

Este diseño **no** introduce un segundo sistema de Team específico para proyectos.

> **Los Teams de proyecto y los Teams globales son el mismo tipo de registro de Team a nivel de framework.**

Solo difieren por los metadatos de la fuente de configuración:

| Dimensión | Team global | Team de proyecto |
| --- | --- | --- |
| Archivo de configuración | `aiyou-team.json` bajo la raíz de configuración de OpenCode | `.aiyou-team/aiyou-team.json` bajo el árbol de trabajo del proyecto |
| Base de rutas | Raíz de configuración de OpenCode | Directorio `.aiyou-team` del proyecto |
| Semántica de ámbito | `global` | `project` |
| Precedencia de fuente | menor que proyecto | mayor que global |
| Esquema `teams` | igual | igual |
| Estructura de directorio de Team | igual | igual |
| Lógica de ensamblaje | igual | igual |
| Temporización de ensamblaje | igual | igual |

Regla central:

> Durante la inicialización/configuración de OpenCode, aiyou-team recopila todas las fuentes de `aiyou-team.json`, normaliza sus entradas `teams` en el mismo modelo de Registro de Team, y luego usa un único pipeline compartido de descubrimiento, análisis, validación, ensamblaje, proyección y selección de Agent predeterminado. La configuración de proyecto no es un nuevo flujo; es una fuente con mayor precedencia.

---

## 2. Relación con el modelo de configuración de plantillas

aiyou-team ya incluye activos de configuración de plantillas:

```text
templates/
  aiyou-team.json
  teams/
    general-team/
    template-team/
    wukong-team/
```

Durante la instalación, estos se copian en la raíz de configuración de OpenCode:

```text
<OpenCodeConfigRoot>/
  aiyou-team.json
  teams/
    general-team/
    template-team/
    wukong-team/
```

Este diseño de configuración a nivel de proyecto se construye sobre ese modelo:

1. La configuración global continúa usando `<OpenCodeConfigRoot>/aiyou-team.json`.
2. La configuración de proyecto se agrega en `<worktree>/.aiyou-team/aiyou-team.json`.
3. Ambas usan el mismo esquema `teams`.
4. `@teams/...` significa: eliminar `@`, luego resolver relativo al directorio que contiene el `aiyou-team.json` actual.

Ejemplos:

```text
global  @teams/general-team
  -> <OpenCodeConfigRoot>/teams/general-team

project @teams/project-coding-team
  -> <worktree>/.aiyou-team/teams/project-coding-team
```

El soporte de Team a nivel de proyecto no requiere una nueva estructura de directorios, formato de plantilla, cargador, validador, proyección ni constructor de prompts.

---

## 3. Ubicaciones de los archivos de configuración

### 3.1 Configuración global

La configuración global se encuentra bajo la raíz de configuración de OpenCode:

```text
~/.config/opencode/aiyou-team.json
```

Windows generalmente usa:

```text
C:\Users\<your-user>\.config\opencode\aiyou-team.json
```

Ejemplo:

```json
{
  "teams": [
    { "id": "coding-team", "enabled": true, "priority": 0 },
    { "path": "@teams/general-team", "enabled": false, "priority": 1 }
  ]
}
```

### 3.2 Configuración de proyecto

La configuración de proyecto se encuentra bajo el árbol de trabajo actual de OpenCode:

```text
<project-worktree>/.aiyou-team/aiyou-team.json
```

Ejemplo:

```json
{
  "teams": [
    { "path": "@teams/project-coding-team", "enabled": true, "priority": 0 },
    { "path": "@teams/project-research-team", "enabled": true, "priority": 1 }
  ]
}
```

Directorio:

```text
<project-worktree>/
  .aiyou-team/
    aiyou-team.json
    teams/
      project-coding-team/
        team.manifest.yaml
        team.policy.yaml
        project-leader.agent.md
        project-executor.agent.md
        project-reviewer.agent.md
        TEAM.md
```

---

## 4. La estructura de directorio del Team permanece igual

Tanto los Teams globales como los de proyecto basados en archivos son directorios de Team ordinarios:

```text
ProjectCodingTeam/
  team.manifest.yaml
  team.policy.yaml
  project-leader.agent.md
  project-executor.agent.md
  project-reviewer.agent.md
  TEAM.md
```

Requeridos:

- `team.manifest.yaml`
- `team.policy.yaml`
- al menos un `*.agent.md`

Opcionales:

- `TEAM.md`
- `README.md`

Restricción:

> Los archivos `*.agent.md` deben estar en el mismo directorio que `team.manifest.yaml` y `team.policy.yaml`. P0 no escanea subdirectorios `agents/` ni `docs/`.

---

## 5. El esquema de `aiyou-team.json` es compartido

El `aiyou-team.json` global y el `.aiyou-team/aiyou-team.json` de proyecto usan el mismo esquema.

Forma mínima:

```json
{
  "teams": [
    { "id": "coding-team", "enabled": true, "priority": 0 },
    { "path": "@teams/ResearchOpsTeam", "enabled": true, "priority": 1 }
  ]
}
```

Campos de entrada de Team:

| Campo | Requerido | Significado |
| --- | ---: | --- |
| `id` | `id` o `path` | carga un Team integrado |
| `path` | `id` o `path` | carga un directorio de Team basado en archivos |
| `enabled` | no | por defecto es `true` |
| `priority` | no | número más bajo se ordena primero dentro de la misma fuente |

Restricción:

```text
Cada entrada debe declarar exactamente uno de id o path.
```

P0 no agrega campos de autor `scope`, `source`, `extends` ni `include`. `scope` se deriva de la fuente del archivo de configuración en tiempo de ejecución.

---

## 6. Resolución de rutas

El comportamiento de `path` permanece igual, pero el directorio base es siempre el directorio que contiene el `aiyou-team.json` actual.

Ejemplo global:

```text
~/.config/opencode/aiyou-team.json
{ "path": "@teams/ResearchOpsTeam" }
-> ~/.config/opencode/teams/ResearchOpsTeam
```

Ejemplo de proyecto:

```text
<project-worktree>/.aiyou-team/aiyou-team.json
{ "path": "@teams/ProjectCodingTeam" }
-> <project-worktree>/.aiyou-team/teams/ProjectCodingTeam
```

Formas soportadas:

```json
{ "path": "@teams/ProjectCodingTeam" }
{ "path": "teams/ProjectCodingTeam" }
{ "path": "~/aiyou-teams/ProjectCodingTeam" }
{ "path": "E:/aiyou-teams/ProjectCodingTeam" }
```

| Forma | Significado |
| --- | --- |
| `@teams/xxx` | eliminar `@`, resolver relativo al directorio del `aiyou-team.json` actual |
| `teams/xxx` | resolver relativo al directorio del `aiyou-team.json` actual |
| `~/xxx` | resolver relativo al home del usuario |
| ruta absoluta | usar tal cual |

---

## 7. Flujo de ensamblaje unificado

**No** implementar esto como:

```text
load global TeamLibrary
load project TeamLibrary
merge two TeamLibraries
```

El flujo requerido es:

```text
collect config sources
  -> normalize into Team Registrations
  -> discover Team directories
  -> parse Team Packages
  -> validate
  -> resolve conflicts
  -> build Effective TeamLibrary
  -> Runtime Projection
  -> OpenCode Config Patch
```

Modelo conceptual:

```text
aiyou-team.json
  -> Team Registration Source
  -> Team Registration
  -> Team Package
  -> Effective TeamLibrary
  -> Projected Teams / Projected Agents
  -> OpenCode Agents
```

La configuración global y de proyecto difieren solo en los metadatos de la fuente.

---

## 8. Semántica de fuente

Cada `aiyou-team.json` es una fuente de configuración.

Fuente global:

```text
scope: global
baseDir: <OpenCodeConfigRoot>
configPath: <OpenCodeConfigRoot>/aiyou-team.json
precedence: lower than project
```

Fuente de proyecto:

```text
scope: project
baseDir: <project-worktree>/.aiyou-team
configPath: <project-worktree>/.aiyou-team/aiyou-team.json
precedence: higher than global
```

`scope` se usa para:

- diagnóstico de rutas
- manejo de conflictos
- selección de Agent predeterminado
- salida de doctor
- visualización de estado en tiempo de ejecución

No debe introducir nueva lógica de análisis de Team, análisis de Agent, generación de prompts ni proyección de OpenCode.

---

## 9. Reglas de prioridad

La semántica de `priority` existente permanece:

> número más bajo significa mayor prioridad.

Dentro de una fuente:

```json
{
  "teams": [
    { "path": "@teams/A", "priority": 0 },
    { "path": "@teams/B", "priority": 1 }
  ]
}
```

`A` tiene precedencia sobre `B`.

Entre fuentes:

```text
1. fuente de proyecto > fuente global
2. dentro de la misma fuente, prioridad más baja primero
3. dentro de la misma fuente y prioridad, orden de declaración primero
4. orden de id estable solo como último recurso cuando sea necesario
```

Por lo tanto:

```text
project priority 1
global priority 0
```

el resultado sigue siendo que el Team de proyecto tiene precedencia, porque la precedencia de fuente se compara primero.

---

## 10. Selección de Agent predeterminado

La selección del Agent predeterminado no es lógica específica de proyecto. Se calcula a partir de la TeamLibrary efectiva.

Orden de candidatos de Team predeterminado:

1. Teams de proyecto habilitados
2. Teams globales habilitados
3. dentro de la misma fuente, prioridad más baja primero
4. dentro de la misma prioridad, orden de declaración en configuración
5. respaldo de id estable cuando sea necesario

Selección del Agent predeterminado:

1. Preferir al líder formal del Team.
2. Si el líder formal no puede ser un punto de entrada de OpenCode, usar el Agent proyectado por defecto.
3. Si aún no está disponible, usar el primer Agent seleccionable por el usuario.
4. Si el Team no tiene una entrada usable, omitirlo e intentar el siguiente Team.

La selección manual del usuario no se sobrescribe. El Agent predeterminado de proyecto solo afecta la inicialización de OpenCode y los valores predeterminados de nueva sesión; aiyou-team no debería volver a cambiar durante `chat.message` después de que un usuario haya elegido explícitamente otro Agent.

---

## 11. Conflictos de id de Team

### 11.1 Mismo id de Team en global y proyecto

Si ambas fuentes definen el mismo manifest id:

```text
project coding-team wins
```

OpenCode ve solo un `coding-team` efectivo.

El mensaje de diagnóstico debería explicar:

```text
project team "coding-team" shadows global team "coding-team"
```

### 11.2 Id de Team duplicado dentro de la misma fuente

La entrada con mayor prioridad gana. Si la prioridad es igual, la declaración más antigua gana. El Team omitido emite una advertencia.

### 11.3 Conflictos de id de Agent proyectado

El manejo de conflictos de id de Agent continúa usando el mecanismo existente de normalización y validación de id canónico. Las fuentes de proyecto no obtienen un sistema de colisiones separado. Si un Team de proyecto inválido muta el seguimiento de id canónico durante la normalización pero falla posteriormente en la validación, esa mutación debe revertirse para que los Teams globales de respaldo no se contaminen.

---

## 12. Teams integrados

Esto sigue siendo válido:

```json
{ "id": "coding-team", "enabled": true, "priority": 0 }
```

La configuración global puede habilitar el Coding Team integrado globalmente.

La configuración de proyecto también puede referenciar el Coding Team integrado:

```json
{
  "teams": [
    { "id": "coding-team", "enabled": true, "priority": 0 }
  ]
}
```

Esto no copia la definición del Team ni agrega ensamblaje específico de proyecto. La misma definición de Team integrado entra en la ruta de ensamblaje unificada con metadatos de fuente de proyecto, por lo que tiene precedencia sobre la fuente global.

---

## 13. Disposiciones recomendadas

Team global:

```text
~/.config/opencode/
  aiyou-team.json
  teams/
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
MyProject/
  .aiyou-team/
    aiyou-team.json
    teams/
      ProjectCodingTeam/
        team.manifest.yaml
        team.policy.yaml
        project-leader.agent.md
        project-executor.agent.md
        project-reviewer.agent.md
        TEAM.md
```

Cuando ambos están presentes, el orden efectivo es:

```text
project:
  ProjectCodingTeam

global:
  coding-team
  ResearchOpsTeam
```

Agent predeterminado:

```text
ProjectCodingTeam formal leader
```

---

## 14. Ciclo de vida del plugin de OpenCode

Los Teams de proyecto participan durante la configuración/inicialización del plugin de OpenCode:

```text
OpenCode plugin config/bootstrap
  -> read ctx.worktree
  -> collect global aiyou-team.json
  -> collect project .aiyou-team/aiyou-team.json
  -> assemble one TeamLibrary
  -> generate one OpenCode agent config
```

No pospongas la inyección del Team de proyecto a `chat.message`, porque la lista de agents, el Agent predeterminado, los alias, los ids proyectados, el enlace de delegación y el enlace de sesión todos dependen de un único resultado de proyección.

`ctx.worktree` se usa solo para ubicar:

```text
<ctx.worktree>/.aiyou-team/aiyou-team.json
```

No debería filtrarse al análisis de Team, generación de prompts o proyección de OpenCode.

La caché, si se agrega más adelante, debe tener como clave:

```text
OpenCode config root + worktree
```

P0 no requiere recarga en caliente. Los usuarios deberían reiniciar OpenCode después de cambiar `.aiyou-team/aiyou-team.json`, `team.manifest.yaml`, `team.policy.yaml` o `*.agent.md`.

---

## 15. Manejo de errores y respaldo

### 15.1 Falta la configuración de proyecto

Cargar solo el `aiyou-team.json` global. Mantener el comportamiento existente.

### 15.2 JSON de proyecto inválido

Omitir la configuración de proyecto, emitir una advertencia, continuar con los Teams globales. OpenCode debería seguir iniciándose.

Los errores de configuración de proyecto no deben activar la autorreparación de la configuración global ni crear automáticamente archivos de proyecto.

### 15.3 Falta la ruta del Team de proyecto

Omitir esa entrada de Team, emitir una advertencia y continuar.

### 15.4 Paquete de Team de proyecto inválido

Ejemplos:

- falta `team.manifest.yaml`
- falta `team.policy.yaml`
- no hay `*.agent.md`
- la referencia del líder no existe

Comportamiento: omitir ese Team, emitir advertencias de validación y continuar.

### 15.5 Todos los Teams de proyecto fallan

Retroceder a los Teams globales. OpenCode permanece utilizable.

### 15.6 Falta o es inválida la configuración global

La configuración global mantiene el comportamiento existente de autorreparación durante instalación/inicio:

```text
use packaged templates/aiyou-team.json to create or repair <OpenCodeConfigRoot>/aiyou-team.json
copy templates/teams to <OpenCodeConfigRoot>/teams when needed
```

La configuración de proyecto no se crea automáticamente para evitar efectos secundarios ocultos en los proyectos de los usuarios.

---

## 16. Diagnósticos y salida de doctor

La salida de doctor/debug eventualmente debería mostrar la configuración efectiva:

```text
aiyou-team Effective Team Configuration

OpenCode config root:
  ~/.config/opencode

Worktree:
  /Users/yong/work/MyProject

Global config:
  ~/.config/opencode/aiyou-team.json

Project config:
  /Users/yong/work/MyProject/.aiyou-team/aiyou-team.json

Loaded sources:
  [project] /Users/yong/work/MyProject/.aiyou-team/aiyou-team.json
  [global]  ~/.config/opencode/aiyou-team.json

Effective teams:
  1. [project] project-coding-team priority=0
  2. [global]  coding-team priority=0
  3. [global]  researchops-team priority=1

Default agent:
  [project-coding-team] project-leader

Warnings:
  none
```

Comando potencial futuro:

```text
aiyou-team doctor --project .
```

Debería reportar el árbol de trabajo, la validez de la configuración de proyecto, la validez de las rutas de Team, la validación de paquetes de Team, la inclusión de la TeamLibrary efectiva, el Agent predeterminado, sombras, colisiones y respaldos.

---

## 17. Escenarios

### 17.1 Solo configuración global

El proyecto no tiene `.aiyou-team/aiyou-team.json`. Resultado: solo se cargan los Teams globales; el Agent predeterminado proviene del líder del Team global con mayor prioridad.

### 17.2 La configuración de proyecto tiene un Team de proyecto

```json
{
  "teams": [
    { "path": "@teams/ProjectCodingTeam", "enabled": true, "priority": 0 }
  ]
}
```

Resultado: los Teams globales siguen disponibles, `ProjectCodingTeam` tiene precedencia sobre ellos, y su líder formal se convierte en el Agent predeterminado.

### 17.3 La configuración de proyecto referencia el Coding Team integrado

```json
{
  "teams": [
    { "id": "coding-team", "enabled": true, "priority": 0 }
  ]
}
```

Resultado: el `coding-team` integrado entra como fuente de proyecto y tiene precedencia sobre las fuentes globales.

### 17.4 El Team de proyecto sobreescribe al Team global con el mismo id

Si tanto el manifest del Team global como el del Team de proyecto usan `id: coding-team`, el Team de proyecto gana y el Team global queda oculto.

---

## 18. Requisitos de compatibilidad

- Los archivos globales existentes de `aiyou-team.json` continúan funcionando sin cambios.
- Si falta el `.aiyou-team/aiyou-team.json` de proyecto, el comportamiento permanece compatible con versiones anteriores.
- La estructura de archivos del Team permanece sin cambios.
- No se introducen directorios `agents/`, `docs/`, `routing-map.yaml` ni `handoff.contract.yaml` en P0.
- `priority` sigue significando que número más bajo es mayor prioridad; solo se agrega la precedencia de fuente por encima.

---

## 19. Orden de implementación

Orden mínimo de implementación:

1. Mantener el esquema existente de `teams` en `aiyou-team.json`.
2. Leer `ctx.worktree` durante la inicialización de OpenCode.
3. Agregar el candidato de configuración de proyecto `<worktree>/.aiyou-team/aiyou-team.json`.
4. Analizar los `aiyou-team.json` global y de proyecto en el mismo modelo de Registro de Team.
5. Adjuntar ámbito de fuente, baseDir de fuente, precedencia de fuente y orden de declaración.
6. Usar el mismo cargador de paquetes para entradas `id` y `path`.
7. Usar la misma validación.
8. Resolver conflictos por precedencia de fuente y prioridad.
9. Generar una TeamLibrary efectiva.
10. Reutilizar la Proyección en tiempo de ejecución.
11. Reutilizar el Parche de configuración de OpenCode.
12. Seleccionar el Agent predeterminado a partir del orden efectivo.
13. Agregar diagnósticos / salida de doctor.

Restricciones críticas:

```text
no project-only loader
no project-only projection
no project-only prompt builder
no project-only OpenCode patch
```

---

## 20. Criterios de aceptación

Compatibilidad de configuración:

- el `aiyou-team.json` global antiguo sigue funcionando
- sin configuración de proyecto significa comportamiento sin cambios
- la configuración de proyecto usa el mismo esquema `teams`

Ensamblaje unificado:

- los Teams globales y de proyecto usan el mismo analizador
- los Teams globales y de proyecto usan la misma validación
- ambos entran en la misma TeamLibrary efectiva
- ambos usan la misma Proyección en tiempo de ejecución
- ambos usan el mismo Parche de configuración de OpenCode

Corrección de prioridad:

- los Teams de proyecto tienen precedencia sobre los Teams globales
- dentro de una fuente, la prioridad más baja gana
- un Team de proyecto con el mismo id oculta al Team global
- el líder del Team de proyecto con mayor prioridad se convierte en el Agent predeterminado cuando es usable

Respaldo confiable:

- la falta de configuración de proyecto no es un error
- la configuración de proyecto inválida retrocede a los Teams globales
- un Team de proyecto inválido se omite
- OpenCode permanece utilizable

Experiencia de usuario:

- los usuarios aprenden un solo esquema de `aiyou-team.json`
- las estructuras de directorio de Team de proyecto y global son idénticas
- doctor puede explicar el orden de Team efectivo y el Agent predeterminado

---

## 21. Posicionamiento final

Este diseño implementa el soporte de Team a nivel de proyecto como una segunda fuente de `aiyou-team.json` con el mismo esquema, no como un subsistema de Team específico para proyectos separado.

Flujo final:

```text
global aiyou-team.json
project .aiyou-team/aiyou-team.json
        ↓
unified Team Registration
        ↓
unified Team assembly
        ↓
unified Runtime Projection
        ↓
unified OpenCode Agent injection
```

Los Teams de proyecto difieren solo por:

```text
different path source
higher source precedence
```

Todo lo demás es igual que los Teams globales.
