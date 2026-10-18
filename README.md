# 🏭 Agentic Software Factory

[![Spec-Kit](https://img.shields.io/badge/Spec--Kit-v1.2-blue.svg)](https://github.com/github/spec-kit)
[![Methodology](https://img.shields.io/badge/Methodology-Spec--Driven%20Development%20(SDD)-success.svg)](https://github.com/github/spec-kit)
[![Architecture](https://img.shields.io/badge/Architecture-Harness%20Engineering-orange.svg)]()
[![DoD](https://img.shields.io/badge/DoD-Deterministic%20Verification-purple.svg)]()
[![License](https://img.shields.io/badge/License-Apache%202.0-green.svg)]()

Repositorio plantilla y arnés de gobernanza para una **Fábrica de Software Agéntica** basada en **Spec-Driven Development (SDD)** con **GitHub Spec-Kit (`specify-cli`)** e **Ingeniería de Arneses (*Harness Engineering*)**.

---

## 🏛️ Principios de Arquitectura

La fábrica erradica la generación de código no estructurada (*vibe coding*) separando estrictamente la intención humana de la ejecución autónoma:

$$\text{Agente Autónomo} = \text{Modelo Fundacional} + \text{Harness (Arnés)}$$

1. **Gobernanza Constitucional**: Ningún agente escribe código sin una especificación previa validada en `.specify/memory/constitution.md`.
2. **Entrevista de Intención**: El esfuerzo humano se concentra al inicio mediante `/speckit.clarify` (máximo 5 preguntas de opción múltiple).
3. **Memoria Arquitectónica Inmutable**: Las decisiones técnicas se documentan como ADRs bajo `history/adr/` (formato MADR).
4. **TDD Estricto Red/Green**: Aislamiento de contexto entre el agente que redacta pruebas y el que implementa código. Cobertura obligatoria $\ge 85\%$.
5. **Convergencia Autónoma**: `/speckit.converge` audita en modo *append-only* sobre `tasks.md` hasta que el código satisface la especificación.
6. **Definition of Done (DoD) Determinista**: Sensores que no negocian (Git hooks locales con Husky y GitHub Actions CI) bloquean regresiones y vulnerabilidades antes de la fusión a `main`.

---

## 📂 Estructura del Repositorio

```text
├── .agents/skills/              # Skills de Spec-Kit instaladas para agentes de codificación
│   ├── speckit-init/            # Inicialización y entrevista de descubrimiento constitucional
│   ├── speckit-specify/         # Generación de especificación funcional (spec.md)
│   ├── speckit-clarify/         # Entrevista estructurada de reducción de ambigüedad
│   ├── speckit-plan/            # Plan técnico, contratos y modelo de datos
│   ├── speckit-checklist/       # Checklists de calidad de requisitos
│   ├── speckit-tasks/           # Desglose en tareas dependientes
│   ├── speckit-analyze/         # Auditoría cruzada en solo lectura
│   ├── speckit-implement/       # Construcción TDD por etapas acotadas
│   ├── speckit-converge/        # Bucle de convergencia append-only
│   └── speckit-feedback/        # Captura de fricciones y mejoras para la plantilla
├── .github/workflows/           # Tuberías CI/CD de verificación de DoD y StepSecurity
├── .specify/                    # Motor de Spec-Kit
│   ├── memory/                  # Constitución inmutable (constitution.md)
│   ├── templates/               # Moldes personalizables de especificaciones y planes
│   └── scripts/                 # Automatizaciones locales en Bash
├── feedback/                    # Canal de retroalimentación hacia el template maestro
│   ├── README.md                # Guía de portabilidad de mejoras
│   └── TEMPLATE_IMPROVEMENTS.md # Bitácora estructurada de fricciones y parches
├── history/
│   ├── adr/                     # Registros de Decisiones de Arquitectura (MADR)
│   └── prompts/                 # Pista de auditoría forense de prompts (PHRs)
├── specs/                       # Ramas de funcionalidades (ej. specs/001-feature/)
├── AGENTS.md                    # Reglas de contexto raíz para agentes autónomos
└── GEMINI.md                    # Directivas para Google Gemini / Antigravity
```

---

## 🚀 Flujo Operativo en 4 Fases

```text
[Humano: Intención] 
        │
        ▼
1. /speckit.specify  ──► Crea rama 'specs/001-feature/spec.md'
        │
        ▼
2. /speckit.clarify  ──► Entrevista interactiva (≤ 5 preguntas de opción múltiple)
        │
        ▼
3. /speckit.plan     ──► Genera 'plan.md', contratos y ADRs en 'history/adr/'
        │
        ▼
4. /speckit.analyze  ──► Auditoría de consistencia en SOLO LECTURA (bloquea si hay fallos)
        │
        ▼
[0% Humano: Construcción Autónoma]
        │
        ├─► Agente TDD Red: Redacta pruebas que fallan obligatoriamente
        ├─► /speckit.implement: Codifica en Verde en fases acotadas
        └─► /speckit.converge: Auditoría append-only hasta dictamen ✅ Converged
        │
        ▼
5. Verificación E2E  ──► Validación en navegador real (Playwright MCP / Shiplight)
        │
        ▼
[1 Clic Humano: Veto y Aprobación]
        │
        ▼
6. GitHub PR         ──► CI ejecuta el DoD determinista ──► Merge a 'main'
```

---

## ⚡ Inicio Rápido para Nuevas Aplicaciones

Para desarrollar un nuevo software o aplicación utilizando este repositorio como plantilla:

```bash
# 1. Crear tu nuevo repositorio a partir de la plantilla y clonarlo en tu PC
gh repo create mi-nueva-app --template Zer0x25/agentic-software-factory --private --clone
cd mi-nueva-app

# 2. Ejecutar el asistente de inicialización
# (Instala los git hooks locales, muestra los principios de la Constitución y te asiste en el primer $speckit-specify)
./setup.sh
```

---

## 🔄 Bucle de Retroalimentación y Mejora Continua de la Plantilla

Si durante el desarrollo de una aplicación encuentras fricciones, inconsistencias del arnés o ideas para mejorar la plantilla maestra, no las dejes en el olvido. Puedes registrarlas directamente en el chat con tu agente:

```bash
$speckit-feedback "Descripción del problema, hook rígido o mejora deseada para el template"
```

El agente documentará automáticamente el hallazgo y la propuesta de parche en [`feedback/TEMPLATE_IMPROVEMENTS.md`](feedback/TEMPLATE_IMPROVEMENTS.md), permitiéndote reportarlo como Issue o Pull Request hacia [Zer0x25/agentic-software-factory](https://github.com/Zer0x25/agentic-software-factory).

---

## 🛠️ Requisitos del Entorno

### Requisitos Locales
- **Linux / macOS / Windows (WSL)**
- [uv](https://github.com/astral-sh/uv) (Gestor de herramientas y Python)
- [GitHub Spec-Kit (`specify-cli`)](https://github.com/github/spec-kit)
- Git & [GitHub CLI (`gh`)](https://cli.github.com/)

```bash
# Instalar uv y specify-cli (si no los tienes instalados)
curl -LsSf https://astral.sh/uv/install.sh | sh
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git
```

## Desarrollo local de Smart Parking

Esta aplicación corre como PWA React/Vite y Worker Hono con D1 local. Prepara credenciales propias en un archivo ignorado por Git:

```bash
cp .dev.vars.example .dev.vars
```

Completa `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `OPERATOR_USERNAME`, `OPERATOR_PASSWORD` y `JWT_SECRET` en `.dev.vars`, luego inicializa la base local y el catálogo de desarrollo:

```bash
npm run db:local:init
```

Inicia el Worker y la PWA en terminales separadas:

```bash
npm run worker:dev
npm run dev
```

Abre `http://localhost:5173`. Las contraseñas se validan desde `.dev.vars`; D1 local conserva los usuarios, roles, configuración, sesiones y auditoría. Este procedimiento no aplica migraciones ni realiza despliegues en producción. Consulta [la guía de persistencia local](specs/009-d1-persistence/quickstart.md) para verificar los flujos.

## Preparación para despliegue en Cloudflare

El trabajo se prioriza así: (1) aislar desarrollo, staging y producción con preflight de release; (2) completar las compuertas CI y el runbook de migraciones/recuperación; (3) cerrar errores internos y habilitar telemetría segura. El backlog ejecutable está en [tasks.md](specs/012-cloudflare-production-readiness/tasks.md), los pasos operativos están en la [guía de despliegue y recuperación](docs/cloudflare-deployment.md), y el estado de cada prerrequisito se registra en la [lista de preparación del release](docs/cloudflare-release-checklist.md).

Los preflight de staging y producción siguen bloqueados hasta configurar IDs D1 reales. El despliegue también requiere crear los Workers y D1 en la cuenta, cargar sus secretos y completar la prueba de staging. La CI verifica y empaqueta el Worker, pero no despliega recursos Cloudflare.

---

## 📄 Licencia

Distribuido bajo la licencia [Apache 2.0](LICENSE).
