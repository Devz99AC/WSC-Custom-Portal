# WSC Customer Portal — Estado del proyecto y plan de acción

> **Actualizado:** 2026-07-22 (corrección de staleness: el código JWT del BFF ya estaba
> implementado y los pagos ya estaban sembrados; estado del sandbox **re-verificado en vivo**
> vía `sf data query` con el alias `wsc-jwt`) · **Rama:** todo mergeado a `main` (fast-forward limpio
> desde `phase-0-foundations`, pusheado a origin). `phase-0-foundations` sigue existiendo
> en el mismo commit; el próximo bloque de trabajo puede seguir en `main` o abrir una
> rama nueva. Ver [`ACTION-PLAN.md`](ACTION-PLAN.md) para el plan priorizado por lo que
> se puede hacer ya sin depender de Salesforce/admin.
> **Resumen:** Fase 0 **completa y verificada**. Se construyó, adelantándose al plan, un
> **demo funcional** (Login + Dashboard) que ya lee **datos reales de Salesforce** vía un
> adaptador de solo-lectura. **El auth servidor→SF (JWT Bearer) quedó resuelto, probado e
> IMPLEMENTADO en el BFF** (`PORTAL_DATA_SOURCE=salesforce-jwt`) vía una **External Client App**
> (G2 — cerrado). **Grupos A+B+C del ACTION-PLAN completos (2026-07-22):** G1 cerrado (ADR-0005 +
> magic-link real verificado e2e), las **5 vistas portadas** a React, **staging público en vivo**
> (Vercel + Railway + Redis tras Basic Auth) y **`salesforce-jwt` VIVO en producción** con el
> integration user de mínimo privilegio (G3 ✅) — el portal lee la orden real `UO1423102`.
> **2026-07-22 (tarde): feedback del stakeholder** — es el **alcance final** del producto: plan
> nuevo por fases en [`ACTION-PLAN.md`](ACTION-PLAN.md) (multi-orden, nav de 7 secciones,
> support/referidos/learning center) con **re-alcance**: Stripe/checkout en el portal, la
> reserva anti-doble-venta y la e-firma **quedan fuera** (portal post-venta; las compras pasan
> por el Sales rep). Falta: G4 (datos realistas), G5 (resto de la API de lectura) y las fases
> P1–P6 del plan nuevo.

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
  con **tres modos de datos** (`PORTAL_DATA_SOURCE`) — `mock` (datos con forma real),
  `salesforce` (lee la org en vivo reusando la sesión del CLI vía `@salesforce/core`, solo dev) y
  `salesforce-jwt` (**JWT Bearer real**, ver más abajo).
- **Web** (`apps/web`): Login + Dashboard reales (React + TanStack Query + tema WSC), consumiendo el BFF.
- **1 orden WSC real sembrada** (`Online_Order__c` UO1423102) → el demo la lee **en vivo**.
- Par X.509 generado (`~/.wsc-keys/`) y `ConnectedApp` como metadata escrita (deploy bloqueado, ver §4).
- **JWT Bearer flow probado end-to-end (2026-07-19)** vía **External Client App** (nombre real
  `WSC Customer - Devin Sandbox`, detalle en §4 G2): certificado X.509 subido, **JWT Bearer Flow**
  habilitado, Permission Set `WSC Customer Portal - JWT Access` pre-autoriza al usuario vía
  "OAuth Policies → Permitted Users = Admin approved" + "App Policies → Select Permission Sets".
  `sf org login jwt` → *"Successfully authorized"*; `sf org list` → alias `wsc-jwt` en estado
  `Connected` (re-verificado en vivo 2026-07-22). **Y el código del BFF ya lo implementa** (§5 B.5 ✅):
  `salesforce-jwt-auth.ts` firma la assertion RS256 (`iss`=Consumer Key / `sub`=username /
  `aud`=login URL, exp 3 min), la canjea en `/services/oauth2/token`, cachea el token (10 min,
  in-memory hasta que llegue Redis/G6) y lo invalida en `INVALID_SESSION_ID`; se activa con
  `PORTAL_DATA_SOURCE=salesforce-jwt`. Falta solo repetir la pre-autorización con un
  integration user real en vez del admin (G3).
- **Orden `UO1423102` con el flujo de negocio COMPLETO** (sembrado 2026-07-19, re-verificado en
  vivo 2026-07-22): `Corp__c` → `SC_Corp__c` "Devin LLC" en **`Sold`**, y **2 `Online_Payment__c`
  sembrados** ($2,000 + $6,750 = $8,750, ambos `Status__c='Cleared'`, Wire Transfer). El bloqueo
  de `Merchant_Account__c` se resolvió con un registro placeholder (G8 ✅, ver §4); al insertar el
  2º pago, el trigger Apex real (`Online_PaymentTrigger`) avanzó la orden **solo** a
  `Status__c='Verified - Initial Contact'`. La corp NO es un aged corp real (Incorporation_Date
  2026-07-19, age=0) — es placeholder para destrabar el flujo.

---

## 2. Cómo correrlo hoy

```powershell
# Demo con datos de muestra (forma real de SF):
corepack pnpm dev                     # web :5173 + bff :8080  →  http://localhost:5173

# Demo leyendo Salesforce EN VIVO (tu orden real):
$env:PORTAL_DATA_SOURCE="salesforce"; $env:SF_TARGET_USERNAME="sf_admin@utopia6.com.devinzonde"
corepack pnpm --filter @wsc/bff dev   # terminal 1
corepack pnpm --filter @wsc/web dev   # terminal 2  →  login m.brown@acmeholdings.com

# Demo vía JWT Bearer real (External Client App, sin sesión CLI):
$env:PORTAL_DATA_SOURCE="salesforce-jwt"
# + SF_CLIENT_ID / SF_JWT_PRIVATE_KEY (PEM o ruta) / SF_INTEGRATION_USERNAME / SF_LOGIN_URL

corepack pnpm test | typecheck | lint # calidad
```
Login demo: `m.brown@acmeholdings.com`. Nota de entorno: pnpm corre vía `corepack pnpm`
(shim en `AppData\Local\corepack-shims`); Vite dev bindea IPv6 → abrir con `localhost`, no `127.0.0.1`.
Nota CLI (2026-07-22): el alias `wsc-sandbox` **ya no existe** en el CLI; queda `wsc-jwt`
(mismo username, `Connected`). `SF_TARGET_USERNAME` sigue funcionando igual — `@salesforce/core`
resuelve la auth por username, no por alias.

**Staging público (2026-07-22):** frontend `https://wsc-custom-portal-web.vercel.app` (gate de
HTTP Basic Auth en el borde) → BFF `https://wscbff-production.up.railway.app` vía rewrites de
`vercel.json` (`/api/*`, `/auth/*`). Corre con `PORTAL_DATA_SOURCE=mock` y `EMAIL_SENDER=console`
(el magic-link se lee en los logs de Railway); Redis de Railway como magic-link store.

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
| G1 | ~~Decisión de auth del cliente~~ | 🟢 Resuelto | [ADR-0005](adr/0005-customer-identity-magic-link.md): magic-link nativo del BFF. **Código también implementado y verificado** (2026-07-22): `/auth/request-link`, `/auth/verify`, `/auth/logout`, cookie de sesión protegiendo `/api/dashboard`, email vía SMTP (Google Workspace) o consola en dev. Las 5 vistas ya están portadas con rutas reales (`AppShell` + Order/Payments/Documents/Profile). Falta un test de integración HTTP del flujo auth. |
| G2 | **Auth servidor→SF de producción (JWT Bearer)** | 🟢 Resuelto | La org **prohíbe Connected Apps clásicas**, pero **sí permite External Client Apps** — se creó `WSC Customer - Devin Sandbox`, se probó el flujo completo (`sf org login jwt` ✅, 2026-07-19) **y el BFF ya lo implementa** (`salesforce-jwt-auth.ts` + `createJwtSalesforceQuery()`, `PORTAL_DATA_SOURCE=salesforce-jwt`, en `main` — ROADMAP 1.6: código ✅, faltan sus tests de DoD). **Cerrado del todo (2026-07-22):** credenciales nuevas creadas con el integration user (G3 ✅) y cargadas en Railway — `salesforce-jwt` corre en producción con ellas. |
| G3 | ~~Integration user + permission set mínimo~~ | 🟢 Resuelto | **Hecho (2026-07-22)**: usuario `WSC Integration` (licencia Salesforce Integration, perfil Minimum Access - API Only Integrations) + Permission Set `WSC_Portal_Read_Only` (solo los 4 objetos WSC, FLS campo a campo calcada del SOQL real — `Online_Order__c` tiene ~698 campos, no se dio acceso blanket). Verificado positivo (lee la orden real) y negativo (`Account` denegado). External Client App nueva + credenciales en Railway → **`salesforce-jwt` corre en producción con ellas**. |
| G4 | **Datos realistas** en un entorno | 🟠 Media | Developer sandbox vacío. Evaluar Partial/Full sandbox. |
| G5 | **API de lectura real** (catálogo, orders, payments, documents, profile) | 🟡 | Solo existe `/api/dashboard`. Falta el resto mapeado a los objetos reales + OpenAPI. |
| G6 | **Infra**: S3 (vault) + Redis (caché) | 🟡 | **Redis ✅ provisionado en Railway** (2026-07-22) como magic-link store (`REDIS_URL`); el caché de lecturas SF queda diferido hasta que G3 active `salesforce-jwt` en prod (nada que cachear en modo `mock`). **S3 sigue pendiente** (ROADMAP 1.9). |
| G7 | **Fases futuras — RE-ALCANCE (2026-07-22, ADR-0006)**: realtime (Pub/Sub+SSE) opcional, tests integración/e2e, hardening. **Stripe, reserva atómica y upload-vault quedan FUERA**; la **e-firma SIGUE pero vía Formstack Documents** (condicional a la suscripción — Q5), no DocuSign/PandaDoc. Portal post-venta: las compras pasan por el Sales rep | 🟡 | Plan por fases P1–P6 en `ACTION-PLAN.md`. Las vistas se reestructuran según el feedback (multi-orden + nav de 7 secciones). |
| G8 | ~~**`Merchant_Account__c` vacío** bloquea sembrar `Online_Payment__c`~~ | 🟢 Resuelto | Se creó un `Merchant_Account__c` **placeholder** (2026-07-19; `Provider__c` explicita que no es un gateway real, sin credenciales) llenando los campos de "Limits and Supports" que exige su validación — fórmula exacta obtenida vía Tooling API `ValidationRule.Metadata`, no adivinada. Con eso se sembraron los 2 pagos y el trigger `Online_PaymentTrigger` avanzó la orden (ver §1). En un Partial/Full sandbox (G4) existirían registros reales de este objeto. |

---

## 5. Plan de acción actualizado

> ⚠️ **Superseded (2026-07-22):** el plan vivo está en [`ACTION-PLAN.md`](ACTION-PLAN.md)
> (post-feedback del stakeholder, con re-alcance: Stripe/reserva/e-firma fuera). Lo de
> abajo se conserva solo como registro de lo que se completó de este plan.

### A. Decisiones primero (requieren humano/admin — desbloquean todo)
1. ~~Elegir el modelo de auth del cliente~~ → **[ADR-0005](adr/0005-customer-identity-magic-link.md)
   escrito y aceptado (2026-07-19)**: magic-link nativo. *(G1 — decisión y código resueltos:
   implementado y verificado e2e en producción, 2026-07-22.)*
2. ~~Resolver el auth SF de producción~~ *(G2 — RESUELTO 2026-07-19)*: se creó una **External Client
   App** y se probó el **JWT Bearer Flow** real (certificado + Consumer Key + Permission Set).
   El código del BFF ya lo implementa (**B.5 ✅**); solo queda **G3**: repetir la pre-autorización
   con un integration user de mínimo privilegio en vez del admin.
3. **Crear el integration user + permission set de mínimo privilegio** (licencia Salesforce Integration,
   solo objetos WSC, `Brand__c='WSC'`) *(G3)*. Verificar que no ve otras marcas.
4. **Definir entorno de datos**: ¿Partial/Full sandbox para pruebas realistas? *(G4)*

### B. Completar Fase 1 (infra + auth)
5. ~~Implementar el **JWT Bearer flow real** en el BFF~~ — ✅ **HECHO** (en `main`):
   `apps/bff/src/infrastructure/salesforce/salesforce-jwt-auth.ts` firma la assertion
   (`jsonwebtoken`, RS256, claims `iss`=Consumer Key/`sub`=username/`aud`=login URL) y la canjea
   en `/services/oauth2/token` (`grant_type urn:ietf:params:oauth:grant-type:jwt-bearer`), con
   caché del token e invalidación reactiva en `INVALID_SESSION_ID`. Activable con
   `PORTAL_DATA_SOURCE=salesforce-jwt`. Para producción solo faltan las credenciales nuevas de
   G3 (las actuales son del admin y su Consumer Key se compartió en chat).
6. **Middleware de identidad de cliente** (magic-link) → ✅ base hecha (2026-07-22: cookie de
   sesión, `/api/dashboard` ya no acepta `?email=`); **extender la authz por fila a cada
   endpoint nuevo de G5** al mapear `email → FU_User__c`.
7. Provisionar **S3** (SSE-KMS, Object Lock) — *pendiente*; ~~Redis~~ ✅ en Railway
   (magic-link store; el caché de lecturas SF espera a G3) *(G6)*.

### C. Fase 2 (API de lectura tipada + realtime)
8. **Contrato OpenAPI** del BFF (fuente de tipos del frontend).
9. Endpoints de lectura mapeados a objetos reales: catálogo, `orders/:id`, payments, documents, profile.
10. **Caché Redis** + invalidación por **CDC**; **realtime** Pub/Sub API → **SSE**.
11. **Reserva atómica** (anti-doble-venta) — cuando se aborde el flujo de compra (invariante #1).

### D. Fases 3–5
12. Stripe (pagos + webhook idempotente), firma (DocuSign/PandaDoc), vault S3 (presigned + hash).
13. ~~Portar las **5 vistas** del prototipo a React~~ ✅ (2026-07-22, con rutas reales; hoy sobre
    datos del dashboard — se enriquecen con los endpoints de G5).
14. Tests de integración (sandbox) + e2e (Playwright); hardening de seguridad; go-live con feature flags.

---

## 6. Qué NO se tocó (a propósito)

`CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/ARCHITECTURE-AND-ROADMAP.md`, los **ADRs** (0001–0004) y el
template son el **contrato/reglas congelados** — no cambian con el progreso, así que se dejan como están.
Este `STATUS.md` es el documento vivo del estado; el `ROADMAP.md` lleva los marcadores de tareas.
