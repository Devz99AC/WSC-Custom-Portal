# WSC Customer Portal — Próximos Pasos (post Grupo A+B+C)

> **Snapshot al 2026-07-22.** Este documento es una foto explicada del plan a partir de
> hoy — para el estado vivo y el detalle línea por línea, la fuente de verdad sigue siendo
> [`STATUS.md`](STATUS.md) (historial completo) y [`ACTION-PLAN.md`](ACTION-PLAN.md)
> (checklist accionable). Úsalo como briefing de arranque para retomar el trabajo, no como
> reemplazo de esos dos.

## Dónde estamos

Grupo A, B y C del `ACTION-PLAN.md` están **completos y verificados en producción**:

- Frontend en Vercel (`https://wsc-custom-portal-web.vercel.app`), backend en Railway
  (`https://wscbff-production.up.railway.app`), conectados vía rewrite, detrás de HTTP
  Basic Auth.
- Magic-link real (ADR-0005) funcionando de punta a punta.
- Redis en producción como magic-link store.
- Las 5 vistas del portal portadas a React real con navegación de verdad.
- **`PORTAL_DATA_SOURCE=salesforce-jwt` activo en producción** — el dashboard lee la
  orden real `UO1423102` desde Salesforce vía un usuario de integración de mínimo
  privilegio (G3), no el usuario admin.

> 🆕 **2026-07-22 (tarde) — feedback del stakeholder recibido y es el ALCANCE FINAL del
> producto (ADR-0006).** Cambia el plan de mediano plazo de este documento: el portal es
> **post-venta** (tracking multi-orden, soporte, referidos, learning center) —
> **Stripe/checkout, la reserva anti-doble-venta y el upload de documentos por el cliente
> QUEDAN FUERA**; la **e-firma SIGUE pero vía Formstack Documents** (no DocuSign/PandaDoc,
> condicional a la suscripción). La Fase 3 de abajo queda obsoleta en las partes de
> Stripe/upload. El plan vigente por fases (P1–P6, con los checkpoints de discusión con el
> jefe) está en [`ACTION-PLAN.md`](ACTION-PLAN.md). Los 4 "pendientes cortos" **siguen válidos**.

Lo que sigue no depende de resolver nada nuevo — son decisiones y configuración.

---

## 🟢 Pendientes cortos

### 1. SMTP real (Google Workspace)

**Por qué:** hoy el magic-link se imprime en los logs de Railway (`EMAIL_SENDER=console`)
en vez de llegar por correo de verdad. Esto es aceptable para pruebas internas, pero no
para un cliente real.

**Qué cambió hoy:** con `salesforce-jwt` ya en vivo, ya no hace falta tocar
`mock-portal-repository.ts` para probar con un correo controlado por ti — el flujo ahora
consulta `FU_User__c` real, así que **cualquier cliente real sembrado en el sandbox, con
un email que controles, sirve para la prueba** sin editar código.

**Pasos:**
1. Entra a [myaccount.google.com/security](https://myaccount.google.com/security) con la
   cuenta que va a enviar los correos (ej. `support@wholesaleshelfcorporations.com`).
2. Activa **2-Step Verification** si no está activa — los App Passwords lo exigen.
3. Busca **"App passwords"** → crea uno nuevo, nombre "WSC Portal" → copia el código de
   16 caracteres (solo se muestra una vez, no se puede recuperar después).
4. En Railway → `@wsc/bff` → **Variables**, agrega/actualiza:
   - `EMAIL_SENDER=smtp`
   - `SMTP_USER=support@wholesaleshelfcorporations.com`
   - `SMTP_PASSWORD=<el App Password>` (márcalo **Sensitive**)
   - `SMTP_FROM_EMAIL=support@wholesaleshelfcorporations.com`
   - (`SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_FROM_NAME` ya tienen default
     correcto, no hace falta tocarlos)
5. Redeploy (Railway lo dispara solo al guardar variables, o manualmente si no).
6. Pide el link de sign-in con un correo real de un `FU_User__c` existente → confirma que
   llega a la bandeja (revisa spam la primera vez — los correos nuevos desde un dominio
   sin historial de envío a veces caen ahí al principio).

**Cómo saber que funcionó:** el mensaje ya no aparece en los logs de Railway como texto
plano — llega como un correo real con el template de marca (navy/red/gold) que ya está
en `infrastructure/email/magic-link-template.ts`.

---

### 2. Dominio propio en Vercel

**Por qué:** hoy el sitio vive en el subdominio gratuito de Vercel
(`wsc-custom-portal-web.vercel.app`) — no es el dominio final para un cliente real.

**Pasos:**
1. Vercel → tu proyecto → **Settings → Domains** → agrega el dominio (o subdominio, ej.
   `portal.wholesaleshelfcorporations.com`).
2. Vercel te va a dar uno o más registros DNS (normalmente un `CNAME` para un subdominio,
   o un `A`/`ALIAS` para un dominio raíz) — agrégalos donde tengas el DNS de tu dominio
   hoy (no hace falta transferir el dominio a Vercel, solo apuntar el DNS).
3. Espera la propagación (minutos a un par de horas, según el TTL del registro) — Vercel
   provisiona el certificado SSL automáticamente en cuanto detecta el DNS correcto.

**Detalle importante que se te puede pasar:** una vez que el dominio nuevo esté activo,
actualiza `APP_BASE_URL` en Railway (`@wsc/bff` → Variables) al dominio nuevo — ese valor
es el que arma la URL del link de verificación del magic-link
(`${APP_BASE_URL}/auth/verify?...`). Si lo dejas apuntando al subdominio viejo de Vercel,
el login seguiría funcionando (Vercel no borra el subdominio `.vercel.app` al agregar uno
propio), pero los correos mostrarían la URL vieja — mejor dejarlo prolijo.

---

### 3. Decidir el despliegue público final: mockup estático vs app real

**Contexto:** desde el principio hubo dos caminos posibles para mostrar el portal
públicamente mientras se terminaba de construir:
- El **mockup estático** (`apps/web/public/prototype.html`, publicado como Artifact) —
  cero riesgo, cero dependencias, pero no es funcional (no hay login real, no lee datos
  reales).
- La **app real** (React + BFF + Salesforce) — con Grupo A+B+C completos, ya es
  100% funcional de punta a punta: login real, datos reales, todas las vistas.

**Recomendación:** con todo lo de hoy funcionando, la app real ya no tiene la desventaja
que tenía antes (dependía de compartir credenciales admin) — así que la balanza se
inclina hacia usarla como el despliegue público. La decisión sigue siendo tuya; los
factores a pesar son tiempos de carga reales (Railway no es instantáneo en cold start,
a diferencia de un HTML estático) contra tener algo genuinamente funcional para mostrar.

**Qué implica decidir por la app real:** completar los puntos #1 y #2 de esta lista
(SMTP + dominio), y el punto #4 (quitar el Basic Auth).

---

### 4. Quitar o ajustar el HTTP Basic Auth

**Por qué existe hoy:** `apps/web/middleware.ts` gatea todo el sitio con un
usuario/contraseña compartido (`BASIC_AUTH_USER`/`BASIC_AUTH_PASSWORD` en Vercel) para
que el staging no quedara abierto al público mientras se armaba todo.

**Cuándo quitarlo:** cuando decidas que el sitio está listo para tráfico público real
(post punto #3). Antes de quitarlo, vale la pena confirmar:
- SMTP real funcionando (punto #1) — si no, cualquier visitante ve el link de
  verificación solo si tiene acceso a los logs de Railway, lo cual obviamente no aplica
  a un cliente real.
- Dominio propio configurado (punto #2).
- Que el usuario de integración (G3) siga siendo de mínimo privilegio — no hay nada que
  revisar ahí, ya quedó bien desde el diseño.

**Cómo quitarlo:** borra `apps/web/middleware.ts` (o simplemente deja las variables
`BASIC_AUTH_USER`/`BASIC_AUTH_PASSWORD` sin setear en Vercel — el middleware falla
cerrado, así que si prefieres mantenerlo como interruptor de emergencia para volver a
gatear el sitio rápido, puedes dejarlo en el código y solo remover las variables cuando
quieras abrirlo, y volver a ponerlas si necesitas cerrarlo de nuevo sin tocar código).

---

## 🟡 Mediano/largo plazo — Fases 2 a 5

Esto es trabajo real de producto, no configuración — cada fase es semanas de trabajo, no
hay que abordarlas todas de una. El orden sugerido abajo es el orden de dependencia
lógica (cada fase se apoya en la anterior).

### Fase 2 — API de lectura completa + tiempo real

- **Contrato OpenAPI del BFF** — hoy los tipos del frontend vienen de `packages/shared`
  a mano; formalizar esto como contrato OpenAPI da generación de tipos + documentación
  automática y hace más fácil que el frontend y el backend no se desincronicen.
- **Endpoints reales restantes** — hoy solo existe `/api/dashboard` (todo-en-uno). Falta
  mapear `orders/:id`, `payments`, `documents`, `profile` como endpoints propios contra
  los objetos reales de Salesforce, cada uno con su propia autorización por fila.
- **Caché Redis de lecturas** — ahora que `salesforce-jwt` está en producción, cachear
  lecturas de Salesforce sí tiene valor real (antes, en modo mock, no había nada que
  cachear). Con invalidación por Platform Events/CDC cuando el dato cambia en Salesforce,
  para no servir datos viejos después de una actualización real.
- **Realtime**: Salesforce Pub/Sub API → Server-Sent Events (SSE) hacia el frontend, para
  que el cliente vea cambios de estado de su orden sin refrescar la página.
- **Reserva atómica anti-doble-venta** — la invariante #1 de correctness del proyecto
  (evitar que dos clientes reserven la misma corp shelf al mismo tiempo). Se aborda
  cuando se construya el flujo de compra en sí, todavía no iniciado.

### Fase 3 — Pagos, firma, documentos

- **Stripe**: payment intents + webhook idempotente (verificar firma → responder rápido
  → procesar async, según `docs/ARCHITECTURE.md` §4).
- **Firma electrónica** (DocuSign o PandaDoc) para los documentos de compra.
- **Vault de documentos en S3**: SSE-KMS, URLs prefirmadas, hash de integridad — para que
  Documents (hoy un estado vacío honesto) tenga contenido real que mostrar.

### Fase 4 — Sistema de diseño

Formalizar `theme.css` en una librería de componentes real y consistente, en vez de
clases CSS sueltas reutilizadas a mano en cada página nueva.

### Fase 5 — Calidad y lanzamiento

- Tests de integración contra un sandbox real (no solo unitarios con fakes).
- Tests end-to-end con Playwright.
- Hardening de seguridad (revisión completa antes de tráfico público real).
- Go-live con feature flags, para poder activar funcionalidad gradualmente sin
  desplegar código nuevo cada vez.

---

## Cómo retomar esto en una sesión nueva

1. Lee `docs/STATUS.md` (qué se hizo, qué se descubrió, por qué) y `docs/ACTION-PLAN.md`
   (checklist con el estado exacto de cada ítem, más detallado que este documento).
2. Este archivo (`NEXT-STEPS.md`) te da el panorama narrativo sin tener que releer todo
   el historial — pero si algo acá no coincide con `ACTION-PLAN.md`, ese último manda
   (es el que se actualiza en cada sesión de trabajo).
