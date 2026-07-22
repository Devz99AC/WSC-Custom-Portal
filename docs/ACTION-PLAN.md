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
   `InMemoryMagicLinkStore` de siempre (dev sin Redis no se rompe). **Y provisionado**:
   Redis agregado en Railway con `REDIS_URL` seteada, confirmado healthy en producción
   (2026-07-22, ver #9). El **caché de
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
9. ~~**Revisar en un dispositivo/browser real**~~ ✅ **Confirmado (2026-07-22)**: login
   con `m.brown@acmeholdings.com` end-to-end en producción (Vercel + Railway + Redis +
   magic-link real, link recuperado de los logs de consola de Railway ya que
   `EMAIL_SENDER=console`) y las 5 vistas navegadas sin problemas visuales.

**🟢 Grupo A completo (2026-07-22).**

## 🟢 Pendiente suelto — SMTP real (Google Workspace)

Sigue sin requerir Salesforce; quedó deliberadamente pausado durante el Grupo A.

1. Entra a [myaccount.google.com/security](https://myaccount.google.com/security) con
   la cuenta que va a enviar (ej. `support@wholesaleshelfcorporations.com`).
2. Activa **2-Step Verification** si no está activa (los App Passwords lo requieren).
3. Busca **"App passwords"** → crea uno nuevo, nombre "WSC Portal" → copia el código
   de 16 caracteres (solo se muestra una vez).
4. En Railway → `@wsc/bff` → Variables, agrega/actualiza:
   - `EMAIL_SENDER=smtp`
   - `SMTP_USER=support@wholesaleshelfcorporations.com`
   - `SMTP_PASSWORD=<app password>` (marcar **Sensitive**)
   - `SMTP_FROM_EMAIL=support@wholesaleshelfcorporations.com`
   - (`SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM_NAME` ya tienen default correcto)
5. **Decisión pendiente**: en modo `mock`, el único correo que dispara un envío es el
   hardcodeado `m.brown@acmeholdings.com` (anti-enumeración silencia cualquier otro).
   Para probar recepción real hay que o bien cambiar temporalmente ese valor en
   `mock-portal-repository.ts` a un correo real controlado, o esperar a que G3 esté
   listo y probar con el correo real del `FU_User__c` sembrado.
6. Redeploy, pedir el link con ese correo, confirmar que llega (revisar spam la
   primera vez).

## 🟡 Grupo B — Necesitas Salesforce Setup, pero ya tienes el acceso (no es "el admin", eres tú)

Repetir el mismo runbook de hoy (documentado en `salesforce-sandbox-setup.md` §B-bis),
con un usuario nuevo en vez del admin:

10. **G3** — integration user de mínimo privilegio + Permission Set propio:
    1. **Setup → Users → New User**: crear "WSC Integration User", licencia
       **Salesforce Integration** (confirmar que queda alguna de las 5 disponibles).
    2. **Profile**: `Minimum Access - API Only Integrations` (o el más restrictivo
       disponible).
    3. **Permission Set nuevo**, solo objetos WSC (`FU_User__c`, `Online_Order__c`,
       `Online_Payment__c`, `SC_Corp__c`), Read-only, filtrado a `Brand__c='WSC'` —
       sin View/Modify All Data.
    4. Asignar ese Permission Set al nuevo usuario integration.
11. **External Client App nueva**, separada de la de hoy (la de hoy quedó ligada al
    admin y su Consumer Key ya se compartió en este chat — no reusar para nada
    público). Mismo runbook de `salesforce-sandbox-setup.md` §B-bis: subir el
    certificado nuevo, JWT Bearer Flow ON, Permitted Users = Admin approved,
    Policies → el Permission Set nuevo del paso 10.
12. **Nuevo par de llaves X.509** para esa app (no reusar `~/.wsc-keys/server.key`,
    que es del admin).
13. Probar:
    ```
    sf org login jwt --username <nuevo-usuario> --jwt-key-file <nueva-key> \
      --clientid <nuevo-consumer-key> --instance-url <login-url>
    ```
    `sf org list` debe mostrar `Connected` para el nuevo alias.
14. Verificar que este usuario **no ve otras marcas** (query de prueba contra un
    objeto compartido con `Brand__c≠'WSC'`, si existe alguno).

## 🔴 Grupo C — Depende de que A y B estén listos

15. Cargar las credenciales de G3 en Railway (`SF_CLIENT_ID`, `SF_JWT_PRIVATE_KEY`,
    `SF_INTEGRATION_USERNAME`, `SF_LOGIN_URL`) — nunca en el repo.
16. Cambiar `PORTAL_DATA_SOURCE=salesforce-jwt` en Railway y redeployar.
17. Probar `/api/dashboard` en producción — debe leer la orden real `UO1423102` vía
    JWT, no ya el mock.
18. Con esto, `findClientByEmail` también pasa a ser real (`FU_User__c`) — probar el
    magic-link con el correo real del cliente sembrado, ya no con
    `m.brown@acmeholdings.com`.
19. Decidir si el despliegue público final es el **mockup estático** (cero riesgo,
    ya listo) o la **app React + BFF real** (tiempos de carga reales; con G3 resuelto
    ya no depende de compartir credenciales admin, así que se vuelve la opción
    razonable) — ver la tabla comparativa que ya armamos.

---

## Más adelante — Fases 2–5 (`docs/STATUS.md` §5)

- **Fase 2**: contrato OpenAPI del BFF · endpoints reales (`orders/:id`, payments,
  documents, profile) mapeados a SF · caché Redis de lecturas + invalidación por
  CDC/Platform Events · realtime Pub/Sub → SSE · reserva atómica anti-doble-venta
  (invariante #1 del proyecto).
- **Fase 3**: Stripe (payment intents + webhook idempotente) · firma electrónica
  (DocuSign/PandaDoc) · vault de documentos en S3 (SSE-KMS, presigned URLs).
- **Fase 4**: sistema de diseño/componentes completo sobre `theme.css`.
- **Fase 5**: tests de integración contra sandbox real + e2e (Playwright) ·
  hardening de seguridad · go-live con feature flags.

---

## Por qué este orden

El Grupo A es donde vale la pena empezar: son tareas de puro código/infraestructura/
decisión que no requieren volver a tocar Salesforce ni esperar nada externo. El Grupo B
es Salesforce, pero es exactamente el mismo procedimiento que ya hiciste hoy — no hay
nada nuevo que aprender, solo repetirlo con un usuario distinto. El Grupo C es la
integración final entre ambos.

¿Por cuál del Grupo A seguimos?
