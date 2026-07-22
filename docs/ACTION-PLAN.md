# WSC Customer Portal — Action Plan (actualizado 2026-07-22, deploy Vercel+Railway en vivo)

> Para el historial completo (qué se descubrió, qué falló, por qué) ver
> [`STATUS.md`](STATUS.md). Este doc es el checklist accionable, **priorizado por
> qué se puede hacer AHORA sin depender de Salesforce ni de acceso de admin**, que es
> justo lo que pediste.

## Estado

- ✅ Todo mergeado a **`main`** (fast-forward limpio, sin conflictos) y pusheado a origin.
  `main` ya tiene: Fase 0 completa, demo con datos reales de Salesforce, JWT Bearer
  real implementado en el BFF, mockup rediseñado y sincronizado con la orden real
  `UO1423102`, y ahora el **magic-link real** (login funcional de punta a punta).
- La rama `phase-0-foundations` sigue existiendo en el mismo commit — puedes seguir
  trabajando directo en `main` o abrir una rama nueva para el próximo bloque.
- ✅ **Deploy público de staging en vivo (2026-07-22)**: frontend en Vercel
  (`https://wsc-custom-portal-web.vercel.app`) + backend en Railway
  (`https://wscbff-production.up.railway.app`), conectados vía rewrite, detrás de
  un gate de HTTP Basic Auth en el borde. Corre con `PORTAL_DATA_SOURCE=mock` y
  `EMAIL_SENDER=console` — ver Grupo A #3–6 más abajo para el detalle exacto.

---

## 🟢 Grupo A — Se puede hacer YA, cero dependencia de Salesforce/admin

Nada de esto requiere volver a Setup de Salesforce ni esperar a nadie. Orden sugerido:

1. ~~**ADR-0005**~~ ✅ Escrito y aceptado: magic-link nativo del BFF, no Auth0/Cognito.
2. ~~**Código del magic-link**~~ ✅ Implementado y verificado end-to-end (2026-07-22):
   `/auth/request-link`, `/auth/verify`, `/auth/logout`, cookie de sesión protegiendo
   `/api/dashboard` (ya no acepta `?email=`), envío por SMTP (Google Workspace, cero
   costo nuevo) o consola en dev. Frontend actualizado (`Login.tsx` pide el link de
   verdad y muestra "revisa tu email"; `App.tsx` decide login/dashboard por la cookie
   de sesión). 12/12 tests, lint/typecheck/build verdes, probado a mano con curl
   (link → token → cookie → dashboard → reuso rechazado → logout → 401).
3. ~~**Deploy del frontend en Vercel**~~ ✅ **HECHO (2026-07-22)**:
   `https://wsc-custom-portal-web.vercel.app` (`Root Directory = apps/web`, build vía
   `pnpm turbo run build --filter=@wsc/web`). Dominio propio aún no agregado (queda para
   cuando se decida el target final de despliegue, ver Grupo C #14).
4. ~~**Deploy del backend en Railway**~~ ✅ **HECHO (2026-07-22)**:
   `https://wscbff-production.up.railway.app` (`/health` verificado), corriendo con
   `PORTAL_DATA_SOURCE=mock` (aún sin credenciales G3) y `EMAIL_SENDER=console` (el
   magic-link se imprime en los logs de Railway — falta configurar SMTP real con
   Google Workspace cuando se quiera probar recepción de correo de verdad).
5. ~~**`vercel.json` con rewrite**~~ ✅ **HECHO**: `/api/*` y `/auth/*` → Railway,
   en `apps/web/vercel.json` (mismo dominio desde el browser, sin CORS).
6. ~~**HTTP Basic Auth en el borde**~~ ✅ **HECHO**: `apps/web/middleware.ts`
   (Vercel Edge Middleware framework-agnóstico, `@vercel/edge`), leyendo
   `BASIC_AUTH_USER`/`BASIC_AUTH_PASSWORD` desde las env vars del proyecto en Vercel
   (marcadas Sensitive). Gate confirmado funcionando (prompt nativo del browser).
7. ~~**Redis para el magic-link store**~~ ✅ **Código hecho (2026-07-22)**:
   `RedisMagicLinkStore` (mismo puerto `MagicLinkStore`, `GETDEL` atómico para el
   single-use) — se activa solo con `REDIS_URL` seteada, si no sigue cayendo al
   `InMemoryMagicLinkStore` de siempre (dev sin Redis no se rompe). **Falta**:
   provisionar el Redis de verdad en Railway y setear `REDIS_URL` ahí (sin eso el
   código ya existe pero no se está usando en el deploy actual). El **caché de
   lecturas de Salesforce** (la otra mitad de ROADMAP 1.9) queda deliberadamente
   fuera de alcance por ahora: no tiene nada que cachear mientras el deploy corra en
   `PORTAL_DATA_SOURCE=mock` — retomar cuando G3 esté resuelto y `salesforce-jwt`
   sea el adaptador activo en producción.
8. ~~**Portar el resto de las vistas del prototipo a React real**~~ ✅ **Hecho (2026-07-22)**:
   `AppShell` (sidebar con navegación real vía `react-router-dom`, extraído de
   `Dashboard`) + `OrderPage`/`PaymentsPage`/`DocumentsPage`/`ProfilePage`. Rutas reales
   (`/`, `/order`, `/payments`, `/documents`, `/profile`) con fallback SPA agregado a
   `vercel.json`. **Decisión de producto tomada al portar**: a diferencia del prototipo
   estático, estas vistas NO fabrican datos que no existen todavía — Documents muestra
   un estado vacío honesto (no hay backend de documentos real aún, Fase 3), Profile
   describe el sign-in real por magic-link en vez de un toggle de 2FA falso, y el
   historial de "My Order" solo muestra lo que el dashboard realmente devuelve (stage
   actual + fecha de la orden), no un timeline inventado. Tests: `AppShell.test.tsx`
   nuevo, `Dashboard.test.tsx` actualizado al refactor. Typecheck/lint/tests/build
   verdes — falta revisión visual en browser real (no pude verificarlo yo mismo).
9. Revisar el mockup pulido en dispositivos reales (ya está publicado y sincronizado
   con la orden real) e iterar si algo no calza visualmente.

## 🟡 Grupo B — Necesitas Salesforce Setup, pero ya tienes el acceso (no es "el admin", eres tú)

Repetir el mismo runbook de hoy (documentado en `salesforce-sandbox-setup.md` §B-bis),
con un usuario nuevo en vez del admin:

10. **G3** — integration user de mínimo privilegio + Permission Set propio (solo
    objetos WSC, `Brand__c='WSC'`).
11. **External Client App nueva**, separada de la de hoy (la de hoy quedó ligada al
    admin y su Consumer Key ya se compartió en este chat — no reusar para nada público).
12. **Nuevo par de llaves X.509** para esa app (no reusar `~/.wsc-keys/server.key`,
    que es del admin).

## 🔴 Grupo C — Depende de que A y B estén listos

13. Probar `PORTAL_DATA_SOURCE=salesforce-jwt` en producción con las credenciales
    nuevas del Grupo B, cargadas como variables de entorno en Railway (nunca en el repo).
14. Decidir si el despliegue público final es el **mockup estático** (cero riesgo,
    ya listo) o la **app React + BFF real** (tiempos de carga reales, requiere A+B
    completos) — ver la tabla comparativa que ya armamos.

---

## Por qué este orden

El Grupo A es donde vale la pena empezar: son tareas de puro código/infraestructura/
decisión que no requieren volver a tocar Salesforce ni esperar nada externo. El Grupo B
es Salesforce, pero es exactamente el mismo procedimiento que ya hiciste hoy — no hay
nada nuevo que aprender, solo repetirlo con un usuario distinto. El Grupo C es la
integración final entre ambos.

¿Por cuál del Grupo A seguimos?
