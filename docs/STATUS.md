# WSC Customer Portal — Estado del proyecto y plan de acción

> **Actualizado:** 2026-07-19 · **Rama:** todo mergeado a `main` (fast-forward limpio
> desde `phase-0-foundations`, pusheado a origin). `phase-0-foundations` sigue existiendo
> en el mismo commit; el próximo bloque de trabajo puede seguir en `main` o abrir una
> rama nueva. Ver [`ACTION-PLAN.md`](ACTION-PLAN.md) para el plan priorizado por lo que
> se puede hacer ya sin depender de Salesforce/admin.
> **Resumen:** Fase 0 **completa y verificada**. Se construyó, adelantándose al plan, un
> **demo funcional** (Login + Dashboard) que ya lee **datos reales de Salesforce** vía un
> adaptador de solo-lectura. **El auth servidor→SF (JWT Bearer) ya quedó resuelto y probado**
> en el sandbox vía una **External Client App** (G2 — mecanismo verificado). Falta una decisión
> clave (auth del cliente, G1), migrar el código del BFF al JWT real (hoy sigue en modo
> CLI-session de dev), el integration user de mínimo privilegio (G3), y el grueso de las
> Fases 1–5.

---

## 1. Qué está HECHO y verificado

### Fase 0 (0.1–0.6) — ✅ COMPLETA
| # | Tarea | Estado |
|---|---|---|
| 0.1 | ADRs (`docs/adr/` 0001–0004 + template + índice) | ✅ |
| 0.2 | Monorepo pnpm+turbo (`apps/web`, `apps/bff` hexagonal, `packages/shared`) | ✅ |
| 0.3 | Tooling: ESLint flat + Prettier + `tsconfig` estricto (`noUncheckedIndexedAccess`) | ✅ |
| 0.4 | CI GitHub Actions (install→lint→typecheck→test→build) | ✅ |
| 0.5 | `.env.example` completo (§5.1 superset + bloque IdP alternativo) | ✅ |
| 0.6 | Proyecto SFDX + **sandbox provisionado y autorizado** en el CLI | ✅ |

**Gates verdes:** `lint` · `typecheck` (4/4) · `test` (6 tests) · `build` (3/3) · e2e SPA→BFF.

### Adelanto de Fase 1/2 y demo (más allá del alcance de Fase 0)
- **Modelo real de SF descubierto y documentado** → [`salesforce-data-model.md`](salesforce-data-model.md).
  Los objetos del portal **ya existen** en la org: `FU_User__c` (cliente) ─ `Online_Order__c`
  (orden) ─ `SC_Corp__c` (producto) · `Online_Payment__c` (pagos), marca `Brand__c='WSC'`.
- **`packages/shared`** alineado a los valores reales (pipeline `Verified - *`, métodos/estados de pago).
- **BFF** (`apps/bff`): endpoints `/health` y `/api/dashboard`, tras el puerto `PortalRepository`
  con **dos adaptadores** — `MockPortalRepository` (datos con forma real) y
  `SalesforcePortalRepository` (lee la org en vivo, reusando la sesión del CLI vía `@salesforce/core`).
- **Web** (`apps/web`): Login + Dashboard reales (React + TanStack Query + tema WSC), consumiendo el BFF.
- **1 orden WSC real sembrada** (`Online_Order__c` UO1423102) → el demo la lee **en vivo**.
- Par X.509 generado (`~/.wsc-keys/`) y `ConnectedApp` como metadata escrita (deploy bloqueado, ver §4).
- **JWT Bearer flow probado end-to-end (2026-07-19)** vía **External Client App** (nombre real
  `WSC Customer - Devin Sandbox`, detalle en §4 G2): certificado X.509 subido, **JWT Bearer Flow**
  habilitado, Permission Set `WSC Customer Portal - JWT Access` pre-autoriza al usuario vía
  "OAuth Policies → Permitted Users = Admin approved" + "App Policies → Select Permission Sets".
  `sf org login jwt` → *"Successfully authorized"*; `sf org list` → alias `wsc-jwt` en estado
  `Connected`. **El mecanismo está listo**; falta (a) implementarlo en el código del BFF — sigue
  con auth-CLI de dev, ver §5 B.5 — y (b) repetirlo con un integration user real en vez del admin (G3).
- **Orden `UO1423102` ahora tiene producto real vinculado**: `Corp__c` → `SC_Corp__c` "Devin LLC"
  (creada por el usuario, con sus Investment Batches). Falta sembrar `Online_Payment__c` —
  bloqueado por una validación que exige un `Merchant_Account__c` válido, objeto sin registros en
  todo el sandbox (ver G8 en §4).

---

## 2. Cómo correrlo hoy

```powershell
# Demo con datos de muestra (forma real de SF):
corepack pnpm dev                     # web :5173 + bff :8080  →  http://localhost:5173

# Demo leyendo Salesforce EN VIVO (tu orden real):
$env:PORTAL_DATA_SOURCE="salesforce"; $env:SF_TARGET_USERNAME="sf_admin@utopia6.com.devinzonde"
corepack pnpm --filter @wsc/bff dev   # terminal 1
corepack pnpm --filter @wsc/web dev   # terminal 2  →  login m.brown@acmeholdings.com

corepack pnpm test | typecheck | lint # calidad
```
Login demo: `m.brown@acmeholdings.com`. Nota de entorno: pnpm corre vía `corepack pnpm`
(shim en `AppData\Local\corepack-shims`); Vite dev bindea IPv6 → abrir con `localhost`, no `127.0.0.1`.

---

## 3. Descubrimientos que CAMBIAN el plan original

1. **Los objetos ya existen** → ROADMAP **1.1 pasa de "crear objetos" a "mapear a los existentes"**
   (+ agregar solo los campos de portal que falten). Coordinar con el admin qué campos son canónicos.
2. **Org fuertemente gobernada** → `Online_Order__c` tiene **126 validation rules**, `SC_Corp__c` **12**.
   Sembrar datos a mano es difícil; **crear la orden en el status inicial "To Verify Payment"** evade
   casi todas las reglas (se hizo así). El `SC_Corp__c` exige lookups de Investment Batch (no sembrable fácil).
3. **Sandbox Developer = vacío por diseño** (solo metadata). Para datos realistas se necesita un
   **Partial Copy / Full sandbox** (traen datos) — ahí el adaptador live lee órdenes reales sin sembrar.
4. **Licencias:** 0 `Salesforce` libres, **5 `Salesforce Integration`** → el integration user (1.5)
   debe usar esa licencia + perfil `Minimum Access - API Only Integrations`.

---

## 4. Qué FALTA (gaps y bloqueadores)

| # | Falta | Severidad | Nota |
|---|---|:--:|---|
| G1 | **Decisión de auth del cliente** (Auth0/Cognito vs magic-link nativo del BFF) | 🔴 Bloqueante | ADR abierto (ver `docs/adr/README.md`). Bloquea login real (ROADMAP 1.7/1.8). |
| G2 | **Auth servidor→SF de producción (JWT Bearer)** | 🟢 Resuelto (mecanismo) | La org **prohíbe Connected Apps clásicas**, pero **sí permite External Client Apps** — se creó `WSC Customer - Devin Sandbox` y se probó el JWT Bearer Flow completo (`sf org login jwt` ✅, 2026-07-19). **Pendiente real:** (1) el **código** del BFF todavía no usa este flujo, sigue con auth-CLI de dev (ROADMAP 1.6); (2) la prueba usó el usuario **admin**, no un integration user de mínimo privilegio (eso es G3, separado). |
| G3 | **Integration user + permission set mínimo** (1.5, licencia Salesforce Integration) | 🟠 Alta | Requiere admin. Hoy el demo usa el usuario admin (no es mínimo privilegio). |
| G4 | **Datos realistas** en un entorno | 🟠 Media | Developer sandbox vacío. Evaluar Partial/Full sandbox. |
| G5 | **API de lectura real** (catálogo, orders, payments, documents, profile) | 🟡 | Solo existe `/api/dashboard`. Falta el resto mapeado a los objetos reales + OpenAPI. |
| G6 | **Infra**: S3 (vault) + Redis (caché) | 🟡 | No provisionados (ROADMAP 1.9/1.10). |
| G7 | **Fases 2–5**: reserva atómica, realtime (Pub/Sub+SSE), Stripe, firma, vault, 5 vistas UI, tests integración/e2e, hardening | 🟡 | No iniciadas. |
| G8 | **`Merchant_Account__c` vacío** bloquea sembrar `Online_Payment__c` | 🟡 Media | Objeto de configuración de gateway de pago (credenciales, límites) con **0 registros en todo el org** (no solo WSC) — consistente con el hallazgo #3 (sandbox Developer = solo metadata). Tiene validaciones propias no triviales ("Fill in the empty fields in the sections of Limits and Supports"), no visibles vía API describe. Probablemente sí existan registros en producción. Opciones: crearlo a mano vía Setup UI (la página muestra las secciones "Limits"/"Supports" con labels, más fácil que adivinar por API) o esperar a un Partial/Full sandbox con datos reales (G4). |

---

## 5. Plan de acción actualizado

### A. Decisiones primero (requieren humano/admin — desbloquean todo)
1. **Elegir el modelo de auth del cliente** → escribir **ADR-0005** (Auth0/Cognito vs magic-link BFF). *(G1)*
2. ~~Resolver el auth SF de producción~~ *(G2 — RESUELTO 2026-07-19)*: se creó una **External Client
   App** y se probó el **JWT Bearer Flow** real (certificado + Consumer Key + Permission Set). Sigue
   pendiente en **B.5** escribir el código en el BFF que reemplace el adaptador dev-CLI, y en **G3**
   repetir la pre-autorización con un integration user de mínimo privilegio en vez del admin.
3. **Crear el integration user + permission set de mínimo privilegio** (licencia Salesforce Integration,
   solo objetos WSC, `Brand__c='WSC'`) *(G3)*. Verificar que no ve otras marcas.
4. **Definir entorno de datos**: ¿Partial/Full sandbox para pruebas realistas? *(G4)*

### B. Completar Fase 1 (infra + auth)
5. Implementar el **JWT Bearer flow real** en el BFF (reemplaza el adaptador dev) — **G2 ya
   desbloqueado**: existe la External Client App + Consumer Key + par de llaves en `~/.wsc-keys/`.
   Falta el código: firmar un JWT (`jsonwebtoken`, claims `iss`=Consumer Key/`sub`=username/`aud`=login
   URL) y canjearlo en `/services/oauth2/token` (grant_type `urn:ietf:params:oauth:grant-type:jwt-bearer`).
6. **Middleware de identidad de cliente** (magic-link) → resolver `email → FU_User__c`, **authz por fila**.
7. Provisionar **S3** (SSE-KMS, Object Lock) y **Redis** (caché) *(G6)*.

### C. Fase 2 (API de lectura tipada + realtime)
8. **Contrato OpenAPI** del BFF (fuente de tipos del frontend).
9. Endpoints de lectura mapeados a objetos reales: catálogo, `orders/:id`, payments, documents, profile.
10. **Caché Redis** + invalidación por **CDC**; **realtime** Pub/Sub API → **SSE**.
11. **Reserva atómica** (anti-doble-venta) — cuando se aborde el flujo de compra (invariante #1).

### D. Fases 3–5
12. Stripe (pagos + webhook idempotente), firma (DocuSign/PandaDoc), vault S3 (presigned + hash).
13. Portar las **5 vistas** del prototipo a React sobre datos reales.
14. Tests de integración (sandbox) + e2e (Playwright); hardening de seguridad; go-live con feature flags.

---

## 6. Qué NO se tocó (a propósito)

`CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/ARCHITECTURE-AND-ROADMAP.md`, los **ADRs** (0001–0004) y el
template son el **contrato/reglas congelados** — no cambian con el progreso, así que se dejan como están.
Este `STATUS.md` es el documento vivo del estado; el `ROADMAP.md` lleva los marcadores de tareas.
