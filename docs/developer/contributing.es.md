# Convenciones de desarrollo

Language: English | Español

## Flujo de trabajo básico

1. Confirmar que el cambio se alinea con la dirección de Team-first de aiyou-team.
2. Mantener los cambios enfocados y con un alcance claro.
3. Ejecutar verificaciones de tipos o de compilación después de los cambios.
4. Mantener la documentación, los modelos de contrato y la nomenclatura de directorios sincronizados para evitar desviaciones del framework.

## Principios

- Las reglas relacionadas con el Team deben ser explícitas y versionables.
- Preferir estructuras de contrato pequeñas y componibles sobre interfaces grandes y monolíticas.
- Mantener `src/core` independiente del anfitrión; no codificar comportamientos específicos de OpenCode allí de forma prematura.
- Las plantillas de Team basadas en archivos se encuentran bajo `templates/teams/`. Durante la instalación se copian en el directorio `teams/` de la raíz de configuración de OpenCode y se usan como fuentes de Team globales. Los registros de Team en tiempo de ejecución provienen tanto del `aiyou-team.json` global bajo la raíz de configuración de OpenCode como del `.aiyou-team/aiyou-team.json` del proyecto bajo el árbol de trabajo actual. Ambas fuentes deben usar la misma ruta de cargador/validación/proyección/parche de configuración de OpenCode; las fuentes de proyecto obtienen prioridad solo a través de mayor precedencia de fuente.
- La documentación bajo `docs/` debería tener versiones tanto en chino como en inglés para la comprensión humana y la continuidad del proyecto.
