Language: English | Español

# Material del paquete de notas de release de aiyou-team 0.1.12

> Propósito: Para uso de ChatGPT / redactores al componer notas de release de aiyou-team 0.1.12, artículos promocionales, anuncios de actualización o publicaciones técnicas de blog.
> Línea base de comparación: Desde `aiyou-team@0.1.10` hasta el `aiyou-team@0.1.12` actualmente preparado.
> Principio de redacción: Basado en las funciones más recientes; procesos intermedios, materiales de mantenimiento de contexto interno e implementaciones obsoletas no se incluyen como funciones públicas.
> Nota de release: El número de versión de la fuente puede seguir mostrando `0.1.11` al momento de escribir; debe ser incrementado a `0.1.12` antes del release oficial.

---

## 1. Resumen en una línea

aiyou-team 0.1.12 es una iteración que avanza de "se puede instalar y usar" a "más fácil de instalar, más transparente y más configurable": productiza la experiencia de instalación para usuarios de OpenCode, actualiza la configuración de modelo del Coding Team integrado de valores por defecto hardcodeados a un sistema visible, modificable, con fallback y diagnóstico, y mejora further el doctor, Teams a nivel de proyecto, seguridad de configuración y mantenibilidad de ingeniería.

---

## 2. Direcciones de títulos principales recomendadas

Títulos opcionales:

1. **aiyou-team 0.1.12: Instalación de OpenCode más fácil, configuración de modelo del Coding Team más robusta**
2. **aiyou-team 0.1.12 lanzado: Un comando para completar la instalación, Coding Team soporta model fallback**
3. **De la instalación a la selección de modelo: aiyou-team 0.1.12 hace los Agent Teams más usables y transparentes**
4. **aiyou-team 0.1.12: El framework de Agent Team para OpenCode continúa evolucionando**

Subtítulo recomendado:

> Nuevo flujo de setup productizado, detección e instalación opcional de OpenCode, backup de configuración y verificaciones de doctor, configuración de modelo por agent del Coding Team integrado, fallback en tiempo de proyección y fallback a host-default.

---

## 3. Cambios centrales orientados al usuario

### 3.1 Experiencia de instalación: De comando install a flujo de setup

Antes de 0.1.10, los usuarios estaban más cerca de usar un comando de instalación de bajo nivel. A partir de 0.1.12, la ruta recomendada se convierte en:

```bash
npx aiyou-team@latest setup --with-opencode
```

Este comando representa un flujo completo de onboarding, no una sola acción de instalación. Hace lo siguiente:

- Verifica si OpenCode ya está instalado en la máquina.
- Si el usuario pasa `--with-opencode`, intenta instalar OpenCode cuando sea necesario.
- Instala aiyou-team desde el registro npm.
- Escribe la configuración del plugin de OpenCode.
- Crea o repara el `aiyou-team.json` de aiyou-team.
- Ejecuta doctor por defecto después de la instalación.
- Produce consejos de uso para los próximos pasos.

Esto puede explicarse públicamente como:

> aiyou-team ahora combina "instalar el plugin de OpenCode, configurar aiyou-team y verificar el estado de salud" en un flujo de setup más productizado. Los usuarios nuevos no necesitan entender rutas internas de plugins ni modificar manualmente la configuración de OpenCode.

### 3.2 Experiencia de actualización: Nuevo punto de actualización

Los usuarios pueden actualizar usando:

```bash
aiyou-team update
```

Su semántica: obtener la versión más reciente de aiyou-team desde el registro usando el enfoque de setup y refrescar forzadamente la instalación actual. Para los usuarios, la ruta de actualización es más directa:

```text
Instalar: npx aiyou-team@latest setup --with-opencode
Actualizar: aiyou-team update
Verificar: aiyou-team doctor
```

### 3.3 Seguridad: Backup antes de escribir configuración, rollback en caso de fallo

aiyou-team ahora es más cauteloso al escribir la configuración de OpenCode:

- Primero lee la configuración existente de OpenCode.
- Identifica y migra entradas de plugin antiguas de aiyou-team.
- Escribe una entrada de plugin canónica estable: `aiyou-team`.
- Crea un backup antes de escribir la configuración.
- Restaura el backup cuando los pasos posteriores fallan.
- El modo dry-run solo produce el plan, no modifica archivos.

Esto puede enfatizarse públicamente:

> aiyou-team ya no requiere que los usuarios editen manualmente la configuración de OpenCode, y retiene backups antes de escribir la configuración, reduciendo el riesgo de corrupción de configuración por instalaciones fallidas.

### 3.4 No contamina los proyectos de negocio

El objetivo de instalación de aiyou-team es el workspace de paquete a nivel de usuario de OpenCode, no el directorio del proyecto de negocio. Para los usuarios:

- No es necesario instalar aiyou-team en el `node_modules` del proyecto de negocio.
- No se requiere modificar el repositorio de negocio.
- La entrada del plugin se mantiene simple: `aiyou-team`.
- Los objetivos de instalación, actualización y desinstalación son más predecibles.

Esto puede expresarse como:

> aiyou-team es más como una extensión de capacidades a nivel de usuario para OpenCode, en lugar de una dependencia de un proyecto de negocio específico.

---

## 4. Mejoras en la integración con OpenCode

### 4.1 Detección de OpenCode

Setup y doctor ambos detectan si OpenCode está disponible:

```text
opencode --version
```

Si la detección es exitosa, doctor muestra si OpenCode existe, su ruta y versión. Cuando OpenCode no existe, doctor marca el entorno como unhealthy.

### 4.2 Instalación opcional de OpenCode

Cuando los usuarios ejecutan:

```bash
npx aiyou-team@latest setup --with-opencode
```

aiyou-team intentará ejecutar un comando similar cuando falta OpenCode:

```bash
npm install -g opencode-ai --no-audit --no-fund
```

Si el comando de instalación tiene éxito pero la terminal actual aún no puede reconocer `opencode`, aiyou-team sugiere al usuario abrir una nueva terminal y verificar `opencode --version`.

Esto resuelve un problema común: después de instalar un paquete npm global, el PATH puede requerir reabrir la terminal para tener efecto.

---

## 5. Actualización mayor de la configuración de modelo del Coding Team integrado

Esta es una de las funciones más destacables de 0.1.12.

### 5.1 Problema anterior

El Coding Team integrado previamente tenía provider/model por defecto, pero estaba más cerca de valores hardcodeados. Los problemas eran:

- Los usuarios pueden no haber configurado el provider correspondiente.
- Los usuarios pueden no tener permiso para acceder a ciertos modelos.
- Hardcodear los mismos modelos por defecto en todos los entornos no es robusto.
- Los usuarios que querían cambiar los modelos del Coding Team integrado tenían que copiar o sombrear todo el Team, a alto costo.
- Los resultados de la configuración de modelo no eran suficientemente transparentes; los usuarios no sabían qué modelo usaba finalmente el agente de OpenCode.

### 5.2 Diseño actual

aiyou-team 0.1.12 permite que el Coding Team integrado expanda explícitamente el modelo por defecto de cada Agent en `aiyou-team.json`:

```jsonc
{
  "id": "coding-team",
  "enabled": true,
  "priority": 0,
  "model_preset": "sota-2026-05",
  "fallback": "builtin-role-chain",
  "fallback_to_host_default": true,
  "agents": {
    "coding-leader": {
      "model": "openai/gpt-5.5"
    },
    "coordination-leader": {
      "model": "openai/gpt-5.5"
    },
    "coding-executor": {
      "model": "openai/gpt-5.5"
    },
    "codebase-explorer": {
      "model": "openai/gpt-5.4-mini"
    },
    "web-researcher": {
      "model": "google/gemini-3.1-pro-preview"
    },
    "reviewer": {
      "model": "anthropic/claude-opus-4-7"
    },
    "principal-advisor": {
      "model": "anthropic/claude-opus-4-7"
    },
    "multimodal-looker": {
      "model": "google/gemini-3.1-pro-preview"
    }
  }
}
```

Esta configuración tiene varias implicaciones importantes:

- `model_preset` indica que este es un conjunto versionado de modelos recomendados por aiyou-team.
- `fallback` habilita la cadena de fallback por roles integrada.
- `fallback_to_host_default` permite volver al modelo por defecto de OpenCode al final.
- `agents` hace que el modelo de cada Agent sea directamente visible y modificable.

### 5.3 Modelos por defecto asignados por rol

El Coding Team integrado ya no usa "el mismo modelo por defecto para todos los roles". Selecciona diferentes modelos por rol:

| Agent | Modelo por defecto | Tarea objetivo |
| --- | --- | --- |
| `coding-leader` | `openai/gpt-5.5` | Owner principal, tareas de código complejas, poseedor de contexto, convergencia final |
| `coordination-leader` | `openai/gpt-5.5` | Tareas de alta ambigüedad, convergencia de alcance, planificación y coordinación |
| `coding-executor` | `openai/gpt-5.5` | Implementación clara, correcciones, depuración, refactorización local |
| `codebase-explorer` | `openai/gpt-5.4-mini` | Ubicación rápida de puntos de entrada de código, cadenas de llamadas, implementaciones similares |
| `web-researcher` | `google/gemini-3.1-pro-preview` | Documentación oficial, recursos externos, investigación de diferencias de versión |
| `reviewer` | `anthropic/claude-opus-4-7` | Revisión independiente, identificación de riesgos, verificación de criterios de completitud |
| `principal-advisor` | `anthropic/claude-opus-4-7` | Juicio arquitectónico, compensaciones complejas, recomendaciones avanzadas |
| `multimodal-looker` | `google/gemini-3.1-pro-preview` | Imágenes, PDFs, capturas de pantalla, diagramas de arquitectura, comprensión multimodal |

Esto puede expresarse públicamente:

> El Coding Team de aiyou-team no es solo un conjunto de prompts, sino un grupo de Agentes de colaboración de ingeniería con asignación de roles. A partir de 0.1.12, la configuración de modelo también está diseñada por rol.

### 5.4 Los usuarios pueden modificar directamente modelos individuales de Agent

Por ejemplo, si un usuario quiere que el reviewer use OpenAI en lugar de Claude:

```jsonc
"agents": {
  "reviewer": {
    "model": "openai/gpt-5.5"
  }
}
```

Si un usuario quiere que el leader use Claude:

```jsonc
"agents": {
  "coding-leader": {
    "model": "anthropic/claude-opus-4-7"
  }
}
```

Esto es más simple que antes: no es necesario copiar el Team integrado ni mantener un conjunto bifurcado de archivos de Team.

### 5.5 `host-default`: Delegando de vuelta al modelo por defecto de OpenCode

Si un usuario quiere que un Agent en particular use completamente el modelo por defecto de OpenCode, puede escribir:

```jsonc
"agents": {
  "reviewer": {
    "model": "host-default"
  }
}
```

Esto significa:

```text
aiyou-team no escribe el campo model para este agente de OpenCode.
OpenCode usa su propio modelo por defecto o el modelo actualmente seleccionado por el usuario.
```

Esto es importante porque los entornos de OpenCode de diferentes usuarios pueden diferir. Algunos usuarios ya han configurado su propio provider/model por defecto, y aiyou-team no debería forzar una sobreescritura.

---

## 6. Model Resolver: La selección de modelo ya no es una caja negra

### 6.1 Lógica central

aiyou-team 0.1.12 añade resolución de modelo en tiempo de proyección. No llama a LLMs, sino que decide antes de generar la configuración de agent de OpenCode:

```text
¿Qué modelo debe escribirse para este Agent?
¿O no debe escribirse modelo, dejando que OpenCode use el Host Default?
```

Orden de decisión central:

```text
Override por agent en aiyou-team.json
  -> agent_runtime.<agent> en el manifest del Team
  -> agent_runtime.$default en el manifest del Team
  -> Cadena de fallback por roles del Coding Team integrado, o fallback_models del Team personalizado
  -> host-default
```

Pseudocódigo simplificado:

```ts
resolveModel(agent) {
  candidates = []

  candidates.add(userConfiguredModel)
  candidates.add(teamManifestAgentModel)
  candidates.add(teamManifestDefaultModel)
  candidates.add(roleFallbackModels)

  for (candidate of candidates) {
    if (candidate === "host-default") return omitOpenCodeModelField()
    if (candidate is available) return writeOpenCodeModel(candidate)
  }

  return omitOpenCodeModelField()
}
```

### 6.2 Significado del fallback

Este fallback es **fallback en tiempo de proyección / tiempo de configuración**.

Lo que puede hacer:

- Seleccionar un modelo basándose en la configuración y listas de candidatos.
- Saltar modelos no disponibles cuando se proporciona una lista de modelos disponibles.
- Volver a host-default al final.
- Generar trazas de doctor explicando el proceso de selección.

Lo que no hace:

- Reintento automático en tiempo de ejecución después de fallos de API LLM.
- Descubrimiento automático de todos los providers/modelos realmente disponibles para el usuario.
- Tomar control de la lógica de llamada de modelo en tiempo de ejecución de OpenCode.

Al escribir artículos, se puede decir:

> aiyou-team 0.1.12 primero aborda la "robustez durante la generación de configuración": no conviertas los modelos recomendados integrados en dependencias duras para el entorno del usuario. Si no puede confirmar o seleccionar un modelo apropiado, aiyou-team puede omitir el campo de modelo, dejando que OpenCode use su propio modelo por defecto.

No decir:

> aiyou-team ya ha implementado cambio automático de modelo en tiempo de ejecución después de errores de API.

### 6.3 Observabilidad en Doctor

Doctor ahora puede mostrar el resultado de resolución de modelo para cada Agent, por ejemplo:

```text
Model Resolution:
- coding-team/coding-leader: openai/gpt-5.5
  configured: openai/gpt-5.5
  source: aiyou-team-json
  fallback: builtin-role-chain
  fallback_to_host_default: true

- coding-team/reviewer: host-default
  configured: host-default
  source: host-default
  fallback: builtin-role-chain
  fallback_to_host_default: true
  reason: host-default selected explicitly
```

Esto permite a los usuarios saber:

- De dónde viene el modelo.
- Si el fallback está habilitado.
- Si finalmente se escribió el campo de modelo de OpenCode.
- Por qué se omitieron ciertos candidatos.

---

## 7. Fallback de modelo para Teams personalizados

0.1.12 no solo mejora el Coding Team integrado sino que también mejora la configuración de modelo para Teams personalizados basados en archivos.

### 7.1 La sintaxis antigua sigue funcionando

Los Teams existentes pueden seguir usando:

```yaml
agent_runtime:
  leader:
    provider: openai
    model: gpt-5.5
```

Esto significa que el modelo final es:

```text
openai/gpt-5.5
```

### 7.2 La nueva sintaxis soporta cadenas provider/model

También se puede escribir directamente:

```yaml
agent_runtime:
  leader:
    model: openai/gpt-5.5
```

Esta sintaxis está más cerca de la representación de modelo de OpenCode.

### 7.3 Soporte de `$default`

Se puede establecer un modelo por defecto para todo el Team:

```yaml
agent_runtime:
  $default:
    model: host-default
    fallback_to_host_default: true

  researcher:
    model: google/gemini-3.1-pro-preview
```

Significado:

- `researcher` usa su propio modelo.
- Otros Agents sin configuración explícita usan `$default`.
- `$default` puede ser un modelo específico o `host-default`.

### 7.4 Soporte de `fallback_models`

Los autores de Teams personalizados pueden proporcionar una cadena de fallback para un Agent específico:

```yaml
agent_runtime:
  research-leader:
    model: openai/gpt-5.5
    fallback_models:
      - anthropic/claude-opus-4-7
      - google/gemini-3.1-pro-preview
    fallback_to_host_default: true
```

Orden de resolución:

```text
modelo primario
  -> fallback_models intentados en orden
  -> host-default
```

### 7.5 Overrides de usuario para Teams personalizados

Los usuarios también pueden sobrescribir modelos de Agent para Teams basados en archivos en `aiyou-team.json`:

```jsonc
{
  "teams": [
    {
      "path": "@teams/research-team",
      "enabled": true,
      "priority": 0,
      "agents": {
        "research-leader": {
          "model": "anthropic/claude-opus-4-7"
        }
      }
    }
  ]
}
```

Esto puede resumirse públicamente:

> Los autores de Teams pueden definir modelos recomendados y fallback, y los usuarios pueden sobrescribir modelos en su propia configuración de entorno. Las definiciones de Team y la adaptación del entorno del usuario ahora están separadas.

---

## 8. Mejoras en Doctor y Validate

### 8.1 Doctor ahora verifica más

`aiyou-team doctor` se ha actualizado de "si la instalación está presente" a "si la configuración actual de OpenCode + aiyou-team + Team es saludable". Muestra:

- Si OpenCode está disponible.
- Ruta y versión de OpenCode.
- Estado del archivo de configuración de aiyou-team.
- Estado de la raíz de instalación.
- Si el workspace de paquete existe.
- Si el paquete de aiyou-team está instalado.
- Si el archivo del plugin existe.
- Si hay residuos de paquetes legacy.
- Si la entrada del plugin de OpenCode es canónica.
- Entradas actuales del plugin de aiyou-team.
- Worktree del proyecto actual.
- Cuántos Teams se cargaron.
- Si las definiciones de Team son saludables.
- Problemas de validación de Team.
- Trazas de resolución de modelo.

Que OpenCode no exista cause que doctor retorne unhealthy, ayudando a los usuarios a detectar problemas de entorno tempranamente.

### 8.2 Diagnóstico de Team a nivel de proyecto

aiyou-team soporta configuración de Team global y a nivel de proyecto. La configuración a nivel de proyecto típicamente se encuentra en el directorio `.aiyou-team` del proyecto actual.

Los usuarios pueden verificar el estado de Team de un proyecto específico:

```bash
aiyou-team doctor --project-worktree /path/to/project
aiyou-team validate --project-worktree /path/to/project
```

Esto es importante para usuarios que usan diferentes Agent Teams en múltiples proyectos.

---

## 9. Documentación y presentación del proyecto

El ciclo 0.1.12 también actualizó una gran cantidad de documentación:

- README en inglés.
- README en chino.
- Guía de instalación en inglés.
- Guía de instalación en chino.
- Guía de configuración de Team a nivel de proyecto.
- Guía de Team personalizado.
- Documentación de diseño del Coding Team integrado.

La documentación en general enfatiza:

```text
aiyou-team = Framework de definición de Agent Team + Capa de proyección en tiempo de ejecución + Adaptador de host para OpenCode
```

Para artículos, esto puede expresarse como:

> aiyou-team no es simplemente un conjunto de prompts, ni otro runtime de agent pesado. Es más como la capa de definición, capa de proyección y capa de adaptador de host para Agent Teams. El host actual de enfoque es OpenCode.

---

## 10. Mejoras en calidad de ingeniería y mantenibilidad

Esta sección puede escribirse brevemente en las notas de release pero expandirse en artículos técnicos.

### 10.1 Separación de responsabilidades en la capa de instalación

La lógica relacionada con la instalación se ha dividido en responsabilidades más claras:

- Lectura/escritura, backup y restauración de la configuración de OpenCode.
- Migración de entradas de plugin de aiyou-team y generación de entradas canónicas.
- Instalación, desinstalación y limpieza legacy de paquetes npm.
- Detección e instalación opcional de la CLI de OpenCode.
- Diferentes puntos de entrada para setup / install / update / uninstall / doctor.

Beneficios de este enfoque:

- Más fácil de probar.
- Más fácil de diagnosticar problemas de instalación.
- Más fácil de mantener compatibilidad con entradas anteriores.
- Más adecuado para futuras expansiones con más adaptadores de host o estrategias de instalación.

### 10.2 Límites más claros del Adaptador de OpenCode

La lógica relacionada con OpenCode se stratifica further:

- Bootstrap maneja la proyección general y selección de agent por defecto.
- Projection maneja la generación de definiciones de agent de OpenCode.
- Model resolver maneja la selección de modelo.
- Config hook maneja la escritura de resultados en la configuración de OpenCode.
- Doctor maneja la visualización de resultados y estado de salud.

Esto puede expresarse públicamente:

> aiyou-team no metió la lógica de fallback de modelo en prompts ni la dispersó por hooks; en cambio, la colocó en una capa dedicada de resolución de modelo, manteniendo la proyección de OpenCode simple.

### 10.3 La definición del Coding Team integrado es más mantenible

La construcción de perfiles de Agent, parámetros de ejecución, valores por defecto de modelo y otros elementos del Coding Team integrado se han vuelto further explícitos. Esto significa que al actualizar las responsabilidades, permisos de herramientas, selección de modelo o cadena de fallback de un Agent en el futuro, no es necesario buscar en múltiples ubicaciones de lógica implícita.

### 10.4 Flujo de trabajo de actualización automática de dependencias

Nuevo flujo de trabajo de GitHub para actualizar automáticamente las dependencias del plugin de OpenCode:

- Verifica periódicamente la versión más reciente de `@opencode-ai/plugin`.
- Actualiza las dependencias cuando se detectan cambios.
- Ejecuta automáticamente typecheck, build y tests.
- Crea un PR.

Esto demuestra que el proyecto continúa siguiendo los cambios en el ecosistema de OpenCode.

---

## 11. Mejoras en cobertura de tests

El ciclo 0.1.12 fortaleció estos escenarios de prueba:

- Parsing de parámetros de setup.
- Salida de dry-run de setup.
- Salida de doctor.
- Doctor unhealthy cuando OpenCode falta.
- Rutas de instalación registry / local.
- Workspace de paquete a nivel de usuario.
- Detección de residuos de paquetes legacy.
- Backup / restauración de configuración de OpenCode.
- Migración de entradas de plugin.
- Plantilla por defecto de `aiyou-team.json`.
- Plantillas de Team empaquetadas.
- Creación / reparación automática de config al iniciar el plugin.
- Prioridad de Team de proyecto.
- Team de proyecto sombreando Team global.
- Config de proyecto inválido cayendo back a Team global.
- Override de modelo por agent del Coding Team integrado.
- `host-default` sin escribir campo de modelo de OpenCode.
- Cadena de fallback por roles integrada.
- `fallback_models` de Team basado en archivos.

Registro de verificación conocido más reciente:

```text
npm run typecheck aprobado
npm test aprobado, 90 passed / 0 failed
```

Antes del release oficial, se recomienda re-ejecutar:

```bash
npm run typecheck
npm run build
npm test
```

---

## 12. Borrador de notas de release listo para usar

### 12.1 Versión corta en inglés

```md
## aiyou-team 0.1.12

aiyou-team 0.1.12 se enfoca en un onboarding más fluido de OpenCode y una historia de configuración de modelo más transparente para el Coding Team integrado.

### Destacados

- Nuevo flujo de setup recomendado: `npx aiyou-team@latest setup --with-opencode`.
- Detección e instalación opcional de OpenCode durante el setup.
- Actualizaciones más seguras de la configuración de OpenCode con backup y rollback.
- Nuevo punto de entrada `aiyou-team update` para actualizaciones basadas en registro.
- El Coding Team integrado ahora incluye valores por defecto de modelo por agent visibles en `aiyou-team.json`.
- Los usuarios pueden sobrescribir cada modelo de agent del Coding Team directamente en `aiyou-team.json`.
- `host-default` permite que OpenCode mantenga el control del modelo cuando se desea.
- Fallback de modelo en tiempo de proyección soporta cadenas integradas por roles y `fallback_models` de team basado en archivos.
- `aiyou-team doctor` ahora reporta trazas de resolución de modelo.
- Documentación bilingüe actualizada y mayor cobertura de tests de instalación / doctor / fallback de modelo.

Nota: el fallback de modelo en esta release ocurre durante la proyección de configuración de agent de OpenCode. No es reintento en tiempo de ejecución por errores de API del provider.
```
---

## 13. Estructura para artículos promocionales

### Título

aiyou-team 0.1.12: Haciendo los Agent Teams de OpenCode más fáciles de instalar, configurar y diagnosticar

### Apertura

aiyou-team es un framework de Agent Team para OpenCode. Su objetivo no es meter todo en un prompt cada vez más largo, sino dar a diferentes tareas diferentes Agent Teams, asignación de roles, reglas de colaboración y criterios de completitud.

0.1.12 es una edición concentrada del trabajo reciente: la experiencia de instalación ha sido productizada, la configuración de modelo del Coding Team integrado ha sido explicitada, y fallback y doctor hacen la selección de modelo más robusta y transparente.

### Parte 1: La instalación pasa de "comando" a "flujo"

Introducir `setup --with-opencode`, explicar que verifica OpenCode, instala aiyou-team, escribe la configuración, crea `aiyou-team.json` y ejecuta doctor.

### Parte 2: Configuración más segura

Introducir backup / rollback / dry-run / entrada de plugin canónica.

### Parte 3: Actualización de configuración de modelo del Coding Team

Explicar que cada Agent tiene diferentes modelos por defecto y por qué reviewer, explorer, leader y multimodal-looker no deberían usar todos el mismo modelo.

### Parte 4: Los usuarios tienen el control

Mostrar cómo modificar el modelo de un Agent individual en `aiyou-team.json`, y `host-default`.

### Parte 5: Fallback y doctor

Explicar el fallback en tiempo de proyección, mostrar ejemplos de trazas de doctor.

### Parte 6: Los Teams personalizados también se benefician

Mostrar `agent_runtime.$default` y `fallback_models`.

### Parte 7: El proyecto continúa iterando rápidamente

Mencionar documentación bilingüe, cobertura de tests, flujo de trabajo de actualización automática de dependencias de OpenCode y límites de ingeniería más claros.

### Cierre

aiyou-team 0.1.12 lleva los Agent Teams de "pueden ser definidos y proyectados" further hacia "pueden ser instalados, configurados, diagnosticados y usados a largo plazo por usuarios comunes". Este es un paso importante a medida que aiyou-team continúa construyendo el ecosistema de Agent Team alrededor de OpenCode.

---

## 14. Límites a observar en comunicaciones públicas

No decir:

```text
aiyou-team ahora soporta reintento automático en tiempo de ejecución después de errores de API de modelo.
aiyou-team ha descubierto automáticamente todos los providers/modelos disponibles para el usuario.
aiyou-team se ha integrado completamente con el catálogo de Models.dev para enrutamiento de providers.
```

En su lugar, decir:

```text
aiyou-team soporta fallback de modelo en tiempo de proyección / tiempo de configuración.
aiyou-team puede decidir si escribir un modelo o volver a host-default al generar la configuración de agent de OpenCode.
El resolvedor de aiyou-team ha reservado la capacidad de filtrado availableModels, pero la integración real con catálogo de providers es trabajo futuro.
```

No promover procesos internos como funciones para el usuario:

- Materiales de mantenimiento de contexto interno.
- Documentos de investigación internos.
- Cachés temporales o actualizaciones de contexto.
- Commits intermedios de release.

Estos pueden categorizarse como mantenimiento de ingeniería interno y omitirse de las notas de release para usuarios.

---

## 15. Lista de verificación previa al release

- [ ] Confirmar que el número de versión ha sido incrementado a `0.1.12`.
- [ ] Ejecutar `npm run typecheck`.
- [ ] Ejecutar `npm run build`.
- [ ] Ejecutar `npm test`.
- [ ] Confirmar que el dist-tag de npm está destinado a `latest`.
- [ ] Confirmar que las notas de release no reclaman fallback por errores de API en tiempo de ejecución.
- [ ] Confirmar que las notas de release no reclaman descubrimiento automático de catálogo real de providers.
- [ ] Después del release, consultar el registro npm para confirmar que `aiyou-team@0.1.12` ha sido publicado.

---

## 16. Prompt sugerido para ChatGPT

Si quieres entregar esto a ChatGPT para escribir un artículo, puedes usar:

```text
Basado en los siguientes materiales, escribe un artículo de release en chino para aiyou-team 0.1.12.

Requisitos:
1. Audiencia objetivo: Usuarios de OpenCode y desarrolladores interesados en Agent Teams.
2. Puntos destacados: setup --with-opencode, instalación all-in-one, backup de configuración y doctor, configuración de modelo por agent del Coding Team integrado, host-default, fallback en tiempo de proyección, fallback_models de Team personalizado.
3. No promocionar reintento automático por errores de API en tiempo de ejecución ni descubrimiento automático de catálogo real de providers.
4. Estilo de escritura: técnico pero legible, con estructura clara, títulos, secciones, fragmentos de código y un resumen.
5. No incluir rutas internas de archivos ni mencionar scaffolding interno.
```
