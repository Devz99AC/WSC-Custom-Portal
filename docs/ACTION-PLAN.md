# WSC Customer Portal — Action Plan (a partir de 2026-07-19)

> Plan hacia adelante desde el estado actual. Para el historial completo (qué se
> descubrió, qué se intentó, qué falló) ver [`STATUS.md`](STATUS.md) — este doc
> es el checklist de "qué sigue", no repite el diagnóstico completo.

## Dónde estamos (resumen de una línea por hito)

- ✅ Fase 0 completa; demo funcional (Login + Dashboard) leyendo Salesforce real.
- ✅ Orden `UO1423102` con flujo de negocio **completo**: corp "Devin LLC" (Sold),
  2 pagos `Cleared` ($2,000 + $6,750 = $8,750), la orden avanzó **sola** (trigger real
  de SF) a `Verified - Initial Contact`.
- ✅ G2 (auth servidor→SF) resuelto: External Client App + JWT Bearer probado a mano
  (`sf org login jwt`).
- ✅ **Código real del JWT Bearer ya implementado** en el BFF (no solo probado a mano) —
  `PORTAL_DATA_SOURCE=salesforce-jwt` (ver §"Código nuevo" abajo).
- ✅ Mockup estático (`apps/web/public/prototype.html`) rediseñado: sin frame de
  navegador/Mac, ancho fluido, responsive real en tablet y phone.
- ❌ G1 (decisión auth del cliente), G3 (integration user de mínimo privilegio),
  despliegue público — todavía no.

## Código nuevo esta sesión

- `apps/bff/src/infrastructure/salesforce/salesforce-jwt-auth.ts` — firma el JWT
  (RS256) y lo canjea en `/services/oauth2/token`; cache en memoria + invalidación
  reactiva en `INVALID_SESSION_ID`.
- `createJwtSalesforceQuery()` en `salesforce-query.ts` — mismo puerto
  `SalesforceQuery` que ya usan `SalesforcePortalRepository` y el adaptador dev; el
  resto de la app no cambia.
- `main.ts` / `env.ts`: nuevo modo `PORTAL_DATA_SOURCE=salesforce-jwt`, junto a
  `SF_CLIENT_ID` / `SF_JWT_PRIVATE_KEY` (PEM o ruta a archivo) / `SF_INTEGRATION_USERNAME`
  / `SF_LOGIN_URL` / `SF_API_VERSION` en `.env.example`.
- Typecheck + lint del BFF, verdes.
- Dependencias agregadas: `jsonwebtoken`, `@jsforce/jsforce-node`.

**Por qué esto y no "ofuscar" el Consumer Key:** ofuscar un string en código no es un
control de seguridad real (es "seguridad por oscuridad"). Lo correcto — y lo que ya
implementamos — es que el secreto **nunca viva en código**: solo en `.env.local`
(git-ignorado) en local, y en el gestor de variables de la plataforma de hosting en
producción. Falta que tú mismo pongas los valores reales en tu `.env.local` (no lo
hice yo para no duplicar la exposición del Consumer Key que ya pegaste en el chat).

## Pendiente — en orden recomendado

### Paso 1 — Seguridad, antes de cualquier despliegue público (no negociable)
- [ ] **G3**: crear un integration user de mínimo privilegio + Permission Set propio
  (solo objetos WSC, filtrado `Brand__c='WSC'`, sin "View/Modify All Data").
- [ ] Crear una **External Client App nueva**, separada de la de hoy, ligada a ese
  integration user. La de hoy quedó pre-autorizada para el **admin** y su Consumer
  Key se compartió en este chat — trátala como no apta para uso público.
- [ ] Generar un **nuevo par de llaves X.509** para esa app nueva (no reusar
  `~/.wsc-keys/server.key`, que es del admin).
- [ ] Esos valores nuevos van **solo** en env vars: `.env.local` en local, gestor de
  secretos de Railway (o el host que uses) en producción. Nunca en el repo.

### Paso 2 — Despliegue del demo
- [ ] **Frontend → Vercel** (Root Directory = `apps/web`). Tu dominio **no necesita
  estar comprado/gestionado en Vercel** — se agrega en Project → Settings → Domains
  y apuntas los registros DNS desde donde ya lo tengas (Namecheap, GoDaddy, el que
  sea). Vercel te da los registros exactos a crear.
- [ ] **Backend → Railway** (Root Directory = `apps/bff`), variables de entorno del
  Paso 1 + `PORTAL_DATA_SOURCE=salesforce-jwt`.
- [ ] `vercel.json` con `rewrite` de `/api/*` → la URL del servicio en Railway (un
  solo dominio visible, sin CORS).
- [ ] **Muro de acceso**: HTTP Basic Auth (Vercel Edge Middleware, o "Password
  Protection" nativo en plan Pro) — no dejar el demo abierto al público.
- [ ] Probar `PORTAL_DATA_SOURCE=salesforce-jwt` en local primero (con las llaves del
  Paso 1) antes de desplegar.

### Paso 3 — Qué demo se despliega (decisión abierta, ver nota abajo)
- [ ] Confirmar si el despliegue público es (a) el **mockup estático** rediseñado
  (`prototype.html` — cero backend, cero riesgo, no refleja tiempos de carga reales)
  o (b) la **app React + BFF real** (sí refleja tiempos de carga reales, requiere
  todo el Paso 1). Ver nota.
- [ ] Revisar visualmente el mockup rediseñado en desktop/tablet/phone reales —
  iterar si algo no calza.
- [ ] Si se elige (b): portar el resto de las 5 vistas del prototipo a React (Fase 4).

### Paso 4 — Resto de Fase 1 (cuando el demo esté validado)
- [ ] **ADR-0005** — decisión de auth del cliente (magic-link nativo vs Auth0/Cognito), G1.
- [ ] Redis para caché de lecturas.
- [ ] Middleware de identidad/sesión del cliente (una vez resuelto G1).

## Nota — dos caminos de despliegue, distinto riesgo y propósito

| | Mockup estático (`prototype.html`) | App React + BFF real |
|---|---|---|
| Backend | Ninguno | Fastify + Salesforce vía JWT |
| Riesgo de seguridad | Ninguno (no hay secretos, no hay conexión a SF) | Requiere Paso 1 completo |
| Tiempos de carga reales | No (todo es HTML/CSS estático, instantáneo) | Sí — es justo lo que pediste |
| Costo/tiempo | Minutos, cualquier host estático gratis | ~$5-25/mes, medio día de trabajo |
| Sirve para | Mostrar diseño/look-and-feel | Probar experiencia completa con datos "reales" |

Como pediste explícitamente **tiempos de carga realistas hasta trasladar a admin**,
el camino (b) es el que responde a eso — pero exige el Paso 1 de seguridad primero,
no es opcional dado que toca un CRM compartido real.
