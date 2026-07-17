import type {
  AgentTeamDefinition,
  TeamManifest,
  TeamPolicySpec,
} from "../../core";
import type { AiyouTeamLanguage } from "../constants";
import type { ManifestTranslationOverride } from "./coding-team/translations/types";
import {
  BUILTIN_CODING_TEAM_AGENT_MODELS,
  BUILTIN_CODING_TEAM_FALLBACK_TO_HOST_DEFAULT,
} from "../constants";

import { createCodingTeamAgents } from "./coding-team/agents";
import { codingTeamManifestEn } from "./coding-team/translations/en/manifest.js";
import { codingTeamManifestEs } from "./coding-team/translations/es/manifest.js";

const CODING_TEAM_RUNTIME_PROFILES: Record<string, { temperature: number; topP: number; variant?: string }> = {
  "coding-leader": { temperature: 0.2, topP: 0.85, variant: "long-context" },
  "coordination-leader": { temperature: 0.15, topP: 0.75 },
  "coding-executor": { temperature: 0.25, topP: 0.9 },
  "codebase-explorer": { temperature: 0.1, topP: 0.8 },
  "web-researcher": { temperature: 0.2, topP: 0.85 },
  reviewer: { temperature: 0.15, topP: 0.75 },
  "principal-advisor": { temperature: 0.15, topP: 0.75 },
  "multimodal-looker": { temperature: 0.2, topP: 0.85 },
};

const manifestTranslations: Record<AiyouTeamLanguage, ManifestTranslationOverride | undefined> = {
  en: codingTeamManifestEn,
  es: codingTeamManifestEs,
};

function loadManifestTranslation(lang: AiyouTeamLanguage): ManifestTranslationOverride | undefined {
  return manifestTranslations[lang];
}

function deepMerge(target: unknown, source: unknown): unknown {
  if (!isRecord(target) || !isRecord(source)) return source;
  const result: Record<string, unknown> = { ...target };
  for (const key of Object.keys(source)) {
    const targetVal = result[key];
    const sourceVal = source[key];
    if (Array.isArray(sourceVal) || typeof sourceVal !== "object" || sourceVal === null) {
      result[key] = sourceVal;
    } else if (isRecord(targetVal) && isRecord(sourceVal)) {
      result[key] = deepMerge(targetVal, sourceVal);
    } else {
      result[key] = sourceVal;
    }
  }
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createEmbeddedCodingTeam(language?: AiyouTeamLanguage): AgentTeamDefinition {
  const lang = language ?? "en";
  const runtime = Object.fromEntries(
    Object.entries(BUILTIN_CODING_TEAM_AGENT_MODELS).map(([agentId, model]) => [
      agentId,
      {
        model,
        ...CODING_TEAM_RUNTIME_PROFILES[agentId],
        fallbackToHostDefault: BUILTIN_CODING_TEAM_FALLBACK_TO_HOST_DEFAULT,
      },
    ]),
  );
  const manifest: TeamManifest = {
    id: "coding-team",
    version: "1.0.0",
    name: "CodingTeam",
    description: "Equipo de ingeniería de código con coding-leader como líder formal, centrado en el ejecutor principal, y respaldado bajo demanda por investigación, revisión y consultoría.",
    mission: {
      objective: "Completar el desarrollo, modificación, depuración, refactorización, validación y entrega de código de ingeniería con la estructura mínima pero suficiente.",
      successDefinition: [
        "La cadena principal de ejecución siempre es mantenida por un active owner único y avanza hasta el cierre de verificación",
        "Las capacidades de investigación en el repositorio, investigación externa, revisión independiente y consultoría experta apoyan bajo demanda",
        "Las tareas de ejecución con límites claros pueden delegarse a roles de pura ejecución para una implementación de alta calidad",
        "El resultado final es entregable, verificable y explicable",
      ],
    },
    scope: {
      inScope: [
        "Desarrollo y modificación de código",
        "Reparación de defectos (bugs) y depuración",
        "Refactorización local a mediana escala",
        "Validación y entrega de ingeniería",
        "Decisiones de arquitectura y tecnología clave relacionadas con codificación",
        "Investigación dentro del repositorio e investigación externa",
      ],
      outOfScope: ["Redacción de documentación puramente general", "Ejecución de asuntos generales no relacionados con código", "Gestión de proyectos a largo plazo y gestión de procesos no de ingeniería"],
    },
    leader: {
      agentRef: "coding-leader",
      responsibilities: [
        "Recibir tareas del usuario",
        "Mantener el contexto principal por defecto y liderar la ubicación de código, planes ligeros, rutas de implementación y requisitos de validación",
        "Decidir si auto-ejecutar, consultar, delegar o escalar",
        "Responsable de la implementación, revisión, validación y reporte final",
      ],
    },
    members: {
      "coding-leader": {
        responsibility: "Owner de ejecución principal por defecto; mantiene el contexto principal, avanza desde la ubicación e implementación hasta la revisión, validación y cierre.",
        delegateWhen: "La gran mayoría de tareas de codificación de complejidad media-alta; especialmente de múltiples archivos, entre módulos, y cuando se requiere continuidad de contexto y un cierre final.",
        delegateMode: "Establecer como el active owner actual; avanza la cadena principal por sí mismo, derivando solo investigación especializada, implementación hoja (final), revisión y consultoría experta, realizando la validación unificada y el reporte externo al final.",
      },
      "coordination-leader": {
        responsibility: "Owner de gestión inicial; responsable de aclarar intenciones, delimitar el alcance, formar rutas, desglosar tareas y orquestar la colaboración.",
        delegateWhen: "Requisitos de alta ambigüedad, múltiples restricciones y múltiples subtareas, o cuando se necesita determinar primero el alcance, plan, traspaso y estrategia de validación.",
        delegateMode: "Asignar primero como owner inicial; pedirle que organice la exploración e investigación, forme una ruta única y luego entregue la implementación de manera unificada al coding-executor, encargándose del cierre.",
      },
      "coding-executor": {
        responsibility: "Implementación hoja (final) con límites claros.",
        delegateWhen: "Cuando los objetivos, puntos de entrada y criterios de aceptación ya están claros.",
        delegateMode: "Delegación de implementación hoja; se deben detallar claramente los objetivos, alcance, contexto relevante, elementos prohibidos y criterios de validación; no se le exige tomar decisiones de enrutamiento ni se le permite seguir delegando la implementación.",
      },
      "codebase-explorer": {
        responsibility: "Localizar ubicaciones de implementación, cadenas de llamadas, puntos de entrada y patrones existentes.",
        delegateWhen: "Cuando la ubicación de implementación o la cadena de llamadas no está clara.",
        delegateMode: "Delegación consultiva de solo lectura; proporcionar objetivos claros de ubicación, exigir rutas absolutas, enlaces clave, patrones relevantes y próximos pasos ejecutables.",
      },
      "web-researcher": {
        responsibility: "Buscar documentación externa, diferencias de versiones y fundamentos en implementaciones de código abierto.",
        delegateWhen: "Cuando involucra el comportamiento de bibliotecas o frameworks externos.",
        delegateMode: "Delegación consultiva de solo lectura; proporcionar una pregunta de investigación clara y contexto de versión, exigir conclusiones, enlaces de evidencia y código fuente clave / enlaces permanentes; no permitir que escriba código.",
      },
      reviewer: {
        responsibility: "Revisión de calidad independiente.",
        delegateWhen: "Alto riesgo / alta incertidumbre / evidencia insuficiente / límites de finalización poco claros.",
        delegateMode: "Delegación de revisión; enviar el Plan / Implementation / Completion y evidencia clave, requiriendo solo que devuelva OKAY / REJECT y un máximo de 3 elementos bloqueantes.",
      },
      "principal-advisor": {
        responsibility: "Compensaciones (trade-offs) de alto costo en arquitectura, seguridad, rendimiento o complejidad.",
        delegateWhen: "Cuando se necesita un consejo principal.",
        delegateMode: "Delegación de consultoría de alto nivel; proporcionar el contexto actual del código, el problema, las rutas candidatas o puntos de riesgo, y exigir una sugerencia principal, la ruta de acción más corta y una estimación de esfuerzo.",
      },
      "multimodal-looker": {
        responsibility: "Interpretación de capturas de pantalla, PDFs, diagramas y materiales de interfaz.",
        delegateWhen: "Cuando la lectura de texto normal no es suficiente.",
        delegateMode: "Delegación de extracción; establecer claramente el objetivo de extracción, alcance de archivos y criterios de salida, requiriendo solo devolver el contenido relevante, relaciones y elementos faltantes.",
      },
    },
    workflow: {
      stages: ["Recepción de tarea", "Localización de código y recolección de evidencia", "Plan ligero o delegación bajo demanda", "Implementación", "Revisión", "Validación", "Resumen"],
    },
    governance: {
      instructionPrecedence: ["Reglas de plataforma", "Reglas del repositorio", "Reglas del equipo", "Reglas del Agent", "Reglas de la tarea"],
      approvalPolicy: {
        requiredFor: ["Operaciones destructivas", "Efectos secundarios externos", "Commits de código (commit)"],
        allowAssumeFor: ["Detalles de implementación de bajo riesgo"],
      },
      forbiddenActions: [
        "Falsificar evidencia",
        "Declarar finalización sin verificación",
        "Ignorar restricciones estrictas",
        "Fingir haber leído código que no se ha leído",
        "Suprimir errores de tipo sin aprobación explícita",
        "No está permitido usar as any / @ts-ignore / @ts-expect-error, usar bloques catch vacíos o eliminar pruebas fallidas a cambio de conseguir un 'pase'",
      ],
      qualityFloor: {
        requiredChecks: ["Comprobaciones de diagnóstico (diagnostics)", "Comprobaciones de compilación (build)", "Comprobaciones de pruebas (tests)"],
        evidenceRequired: true,
      },
      workingRules: [
        "El Leader es el punto de entrada principal",
        "Solo se permite que un active owner mantenga el contexto principal en el mismo momento",
        "Los Agents de soporte deben informar al Leader o al owner principal de ejecución actual",
        "Cualquier delegación o consulta debe definir claramente el objetivo, alcance, restricciones, entregables y criterios de validación",
        "El resumen final orientado al usuario debe ser dado por el rol que tiene la responsabilidad de cierre",
        "Las tareas no triviales deben evaluar si necesitan revisión antes de declararse completadas; si se activan las condiciones obligatorias, la revisión es forzosa",
        "Los ejecutores hoja deben validarse por sí mismos; el cierre final es completado de manera unificada por el owner",
        "La investigación dentro del repositorio y la investigación externa deben estar separadas",
      ],
    },
    agentRuntime: runtime,
    tags: ["Código", "Impulsado por leader", "Continuidad de contexto", "Centrado en el ejecutor principal", "Centrado en revisión", "Impulsado por evidencia"],
  };

  const manifestTranslation = loadManifestTranslation(lang);
  const finalManifest = manifestTranslation
    ? deepMerge(manifest, manifestTranslation) as TeamManifest
    : manifest;

  const agents = createCodingTeamAgents(lang);
  const policy: TeamPolicySpec = {
    instructionPrecedence: finalManifest.governance.instructionPrecedence,
    approvalPolicy: finalManifest.governance.approvalPolicy as unknown as TeamPolicySpec["approvalPolicy"],
    forbiddenActions: finalManifest.governance.forbiddenActions,
    qualityFloor: finalManifest.governance.qualityFloor as unknown as TeamPolicySpec["qualityFloor"],
    workingRules: finalManifest.governance.workingRules,
    promptProjection: {
      include: ["working_rules", "approval_safety"],
    },
  };

  return {
    manifest: finalManifest,
    policy,
    agents,
  };
}