# WSC Portal — Notas de los pasos completados (rastro de razonamiento)

> **Este archivo guarda el "por qué" de cada paso ya terminado del roadmap.**
> El checklist visual vive en [`execution-roadmap.html`](execution-roadmap.html) y ahora muestra
> solo el **elemento clave** de cada paso hecho; el detalle de las decisiones, los hallazgos y las
> trampas está aquí. Movido del HTML el **2026-08-08** para que el roadmap quede limpio sin perder
> el rastro. La fuente de verdad del estado actual sigue siendo `CLAUDE.md` §0.5.

Estado al mover: **14/17** · portal vivo en `portal.wholesaleshelfcorporations.com` leyendo **producción**.

---

## Fase 1 — El portal contra el sandbox (pasos 1–10)

### 1 · Staff card (Advisor / Implementation Manager) — *hecho 2026-07-24*
Lee `advisorName` + `statusSf` de la orden y decide a quién mostrar. Helper `isPostPaymentStage(sfValue)` en `packages/shared/src/domain/order-stage.ts` (true cuando `statusSf` empieza por "Verified"). El Advisor era dato real desde el inicio; el Implementation Manager empezó como mock ("Lua", el nombre de ejemplo del propio stakeholder) con nota de "pending confirmation" — sin fabricar un teléfono falso — hasta que el paso 5 trajo los contactos reales.

### 2 · Documents — Notes & Attachments reales — *hecho 2026-07-28*
- **Regla del stakeholder:** los documentos **SIEMPRE cuelgan de `Online_Order__c`**, nunca del corp; el agrupador que ve el cliente es el nombre del producto, resuelto vía `Corp__c` de esa orden.
- Endpoints: `GET /api/documents` y `GET /api/documents/:id/download`. La descarga pasa por el BFF (el navegador nunca ve una URL ni un token de Salesforce) y **reautoriza en el servidor**: rederiva el set del cliente y rechaza cualquier id fuera de él — verificado en vivo (id adivinado / otro email → 404). Los archivos de una orden sin corp caen en un grupo aparte en vez de desaparecer.
- Datos de prueba sembrados vía Apex anónimo (estaba en 0 registros): 5 `Attachment` con PDFs válidos. El org tiene `AttachmentTrigger`/`NoteTrigger` propios y un validation rule *"Deletion is prohibited"* sobre `Attachment`.
- ⚠️ Los registros `Note` **no se muestran** — texto libre del staff, sin campo que marque cuáles son aptos para el cliente (Q6, luego cerrada: no se muestran).
- 🔴 **En producción esto no muestra nada:** prod usa Files (`ContentDocument`), no `Attachment` clásico. Reescribir el adaptador es trabajo pendiente (ver paso 11).

### 3 · Detalle de orden enriquecido — *hecho 2026-07-28*
- Del corp (`SC_Corp__c`): Corp #, Registration #, credit score, funding capacity, estado del registered agent, último annual report, próxima renovación. De la orden (`Online_Order__c`): forma de pago, fecha de pago total, última actualización de estado.
- **EIN:** originalmente enmascarado con botón «Show» y fuera del endpoint de lista (proyección aparte, PII). **El 2026-08-07 se quitó del todo** a pedido del stakeholder — el EIN ya no sale de Salesforce; se colapsó `ORDER_DETAIL_SELECT` y se borraron `formatEin()`/`EinValue`. Re-añadir `EIN__c` es decisión de PII, no de formato.
- Las filas sin dato no se pintan (nada de «—»). Quedan fuera a propósito los campos internos del corp (márgenes, payback, reseller, credenciales WP).
- **Bug real arreglado:** las fechas *date-only* de Salesforce se renderizaban **un día antes** al oeste de UTC (una orden del 2-may salía «May 1»). Estaba duplicado en 4 componentes; ahora vive en `lib/date.ts` con test de regresión.

### 4 · Pipeline corregido — mapping de display — *hecho 2026-07-28 · Q1 cerrado*
- Mapa final en `docs/pipeline-display-map.md`: **4 pasos** (Unpaid → Initial Onboarding Call → Work Started → Complete). Se eliminaron dos de la lista original: "Onboarding call" era duplicado del paso 2, y "Corp docs shipped" no va porque el envío ocurre el mismo día dentro de Work Started.
- 🔑 **Hallazgo que lo destrabó:** `Status__c` **se filtra por record type**. El describe global devuelve 16 valores, pero el record type WSC solo expone 12 — las 3 etapas de envío que se habían modelado **no pueden ocurrir en una orden WSC**. Segunda trampa: el *value* de `ON HOLD - Client's Unresponsive` lleva apóstrofo y el *label* no.
- Los `Cancelled - *` no se mapean (solo aviso, badge "Cancelled" a secas — los motivos son contabilidad interna). Los `ON HOLD - *` mantienen la barra; como pasar a ON HOLD **sobrescribe** la etapa, el progreso se re-deriva de timestamps (`TimeStamp_Verified_IC__c`, `TimeStamp_Verified_Complete__c`). Vive en `orderProgress()`.
- Los 3 campos nuevos necesitaron FLS en el Permission Set — detectado **antes** de desplegar, verificando con `-o wsc-integration`.

### 5 · Advisor / Soporte — contacto real (3 figuras) — *hecho 2026-07-28 · Q2 cerrado*
- El stakeholder definió **3 figuras**, las tres lookups al mismo objeto `SEOX3_Team_Member__c`: `Sales_Rep__c` (Advisor), `QC_Agent__c` (Support Manager), `Back_End_Worker__c` (Back-End Support). Cada una: nombre, e-mail, teléfono, WhatsApp.
- **Regla de traspaso:** antes del pago solo el Advisor; al verificarse el pago el Advisor desaparece y salen los dos de soporte, con nota de que la comunicación pasa a soporte.
- 🗑️ **Se eliminó el nombre inventado "Lua"** que estaba hardcodeado y se mostraba a clientes reales. Un rol sin asignar dice "not yet assigned".
- El e-mail sale de `WSC_EMail__c` con respaldo en `Corporate_E_Mail__c` — **nunca** del `QC_Agent_E_Mail__c` de la orden (fórmula que genera un buzón genérico `QC@dominio`). El nombre del Advisor cae de vuelta a `SR_Name__c`. WhatsApp con `wa.me` (solo dígitos).
- ⚠️ Requirió **lectura de un objeto nuevo** (`SEOX3_Team_Member__c`) en el Permission Set, no solo FLS. Sin `ViewAllRecords`: el sharing normal alcanza.

### 6 · Envío de correo real (Resend) — *hecho 2026-07-28*
- ⚠️ **Railway bloquea la salida SMTP** (verificado: TCP a `smtp.gmail.com` expira en 587 y 465; HTTPS funciona). El camino de Google Workspace App Password era un callejón sin salida → se implementó un **adaptador de API HTTPS (Resend)**. Runbook: `docs/resend-setup.md`.
- 4 transportes tras el puerto `EmailSender`: `console` (dev), `smtp`, `gmail-api` (implementado pero aparcado — necesita super-admin de Google Workspace), `resend` (activo en prod).
- **Fix de seguridad:** un fallo de envío ya no propaga un 500 con detalles internos; se loguea server-side y se devuelve la respuesta genérica (si no, filtraría el bit de existencia-de-cuenta que la anti-enumeración esconde).

### 7 · DNS — dominio propio + remitente real — *hecho 2026-08-06 · desbloqueó el go-live*
- Portal en `portal.wholesaleshelfcorporations.com`, correo desde `noreply@wholesaleshelfcorporations.com`. **DNS en CLOUDFLARE** (nameservers `gina/mark.ns.cloudflare.com`), no en Vercel ni el registrador. Runbook completo: `docs/dns-runbook.md`.
- 🔑 **El SPF nunca hizo falta fusionarlo:** Resend pide su SPF en el subdominio `send` y alinea el `From:` por DKIM, así que la raíz no se toca. Presupuesto SPF: 5/10 consultas.
- 🆕 **SendGrid descartado** pese a tener el dominio ya autenticado: sus listas de supresión son de **cuenta entera** y WSC mete ahí mucho marketing — un cliente que rebotó una campaña no recibiría su magic link, en silencio. La salida correcta (subusuario dedicado) exige upgrade de plan.
- 📧 **`noreply@` puro, sin Reply-To** — decisión del stakeholder: *"yo no quiero que respondan a eso, solo es para recibir el enlace"*. Se dejó `SMTP_REPLY_TO_EMAIL` como variable **opcional e inactiva** (interruptor sin desplegar código). El correo da salida al cliente atascado: *"Trouble signing in? Call us at (720) 534-2065"*.
- ⚠️ **Dos tropiezos:** (1) el SPF fusionado se añadió como registro *nuevo* → el dominio quedó unos minutos con **dos SPF** (invalida ambos, incluido el correo del equipo) — al indicar una fusión, decir siempre "EDITA el existente"; (2) `APP_BASE_URL` sin `https://` → `z.string().url()` lo rechaza → BFF en **bucle de reinicio** → portal colgado en "Loading your portal…". El síntoma del navegador no señalaba la causa; se vio en los logs de Railway.
- 🔎 **Trampa:** el dominio tiene un comodín `*`, así que cualquier subdominio inventado responde. Comprobar registros con un resolutor público (8.8.8.8) da falsos positivos → preguntar al autoritativo `gina.ns.cloudflare.com`.
- 🔴 **Cloudflare + Vercel:** el CNAME de Vercel debe quedar en **DNS only** (nube gris); Proxied (naranja) impide emitir el certificado.

### 8 · Sección de Soporte + WhatsApp deep link — *hecho 2026-07-29*
- Sexta sección del portal, en `/support`. El deep link `wa.me/<número>` ya existía desde el paso 5 dentro del detalle de una orden; faltaba el sitio donde el cliente pregunta "¿a quién le escribo?".
- 🔑 **Es una lista de personas, no de órdenes.** Cada persona sale una vez, con los productos que cubre debajo (nombrados por la corp). La línea de cobertura se oculta con una sola orden.
- 🆕 **A qué corresponde cada rol** (`STAFF_ROLE_PURPOSE`): todo entra por el Support Manager, toda la documentación va a Back-End. Salesforce guarda *quién* ocupa un rol pero no *qué* atiende — es lo único del contacto que no se lee del org. Indexado **por rol, nunca por persona**.
- 📇 Bloque de contacto de la empresa (`WSC_CONTACT` en `packages/shared`): teléfono, correo, oficina en Greenwood Village. El correo del BFF citaba el mismo teléfono a mano (dos copias = contradicción futura).
- 🚫 **Sin formulario de tickets a propósito** — eso escribe, y el objeto asumido (`Case`) no se usa en producción (Q5). Sin horarios ni SLA: no tenemos el dato y un SLA incumplido hace más daño que el silencio.

### 9 · Learning Center — *hecho 2026-07-29*
- Quinta sección, en `/learning`. **Patrón: índice que despliega el video en el sitio** (acordeón), no una página por video.
- 🔑 **El video abierto vive en la URL** (`/learning/<slug>`): soporte puede enlazar un video concreto y el botón atrás del navegador cierra el reproductor (con `replace`, para no expulsar a quien llegó por link directo). El `<iframe>` **solo se monta al abrir**; se usa `youtube-nocookie.com` + `rel=0`.
- ⚠️ **Falta el contenido real.** Los 3 videos son marcadores (2 reseñas + 1 caso), ninguno explica el proceso post-venta. Se editan en `apps/web/src/content/learning-center.ts`.
- 📌 **Decisión (2026-08-06): el contenido real se añade AL FINAL.** Para salir a producción antes, mostrar un *"Coming Soon…"* (cambio de una línea, justo antes del go-live). Hasta entonces no tocar nada.

### 10 · Errores de Salesforce tipados — *hecho 2026-07-28*
- Motivado por una caída ese día: el mensaje de un `INVALID_FIELD` **contiene el SOQL completo** y salía crudo en un 500.
- `salesforce-errors.ts` clasifica contra la forma real del error (`HttpApiError` con `errorCode`) → 422 validación · 409 duplicado · 403 sharing/FLS · 429 governor con `Retry-After` · 503 transitorio · 500 config nuestra. El texto de Salesforce vive solo en `detail`, que se loguea y **nunca** se serializa.
- Reintento con backoff en el adaptador para lo transitorio; **a propósito NO se reintenta `REQUEST_LIMIT_EXCEEDED`** (presupuesto de 24h). Primer test HTTP e2e del proyecto (`server.test.ts`): incluye que `/auth/request-link` devuelva lo mismo aunque el repositorio explote (anti-enumeración manda).

---

## Fase 2 — Camino a producción (pasos 11–12)

### 11 · Descubrimiento del modelo REAL de producción — *hecho 2026-08-07*
- El sandbox resultó ser **copia del mismo día de la última versión de prod** → los API names coinciden. Probado empíricamente: el change set del permission set (**44 field perms + 6 objetos**) **validó limpio en producción al primer intento**.
- 📊 **Volúmenes reales:** ~24.3k órdenes · ~18.3k pagos · ~31.9k clientes · ~31.4k corps · ~16.5k feature orders. Pero el universo visible es mucho menor (Brand=WSC + no-Cancelled ≈ **2,643 órdenes en total**) → **la paginación se descartó** (nadie se acerca al tope 50/100); el caché (paso 13) sigue por presupuesto de API compartido.
- 🔴 **Documents: producción usa Files (`ContentDocument`), NO `Attachment`** → el adaptador actual (`FROM Attachment`) no muestra nada en prod; reescribirlo es trabajo pendiente.
- `FU_User__c.E_Mail__c` confirmado poblado (el login real funcionó). Los IDs de record type difieren entre orgs, pero el código lee por `RecordType.Name`, así que no afecta.

### 12 · Separar entornos + credenciales de producción — *conexión hecha 2026-08-07*
- En prod se creó: **integration user** (`wsc.integration@wholesaleshelfcorporations.com`, licencia Salesforce Integration, API-only); una **External Client App `WSC Portal BFF`** (framework nuevo, NO Connected App; Type=Local, Enabled; Contact `support@wholesaleshelfcorporations.com`) con el cert JWT subido y OAuth Policies = "Admin approved users are pre-authorized"; el permission set `WSC_Portal_Read_Only` **desplegado por change set y asignado** al user.
- Railway (prod): `PORTAL_DATA_SOURCE=salesforce-jwt` · `SF_LOGIN_URL=https://login.salesforce.com` · `SF_CLIENT_ID` (85 chars) · `SF_INTEGRATION_USERNAME` · `SF_JWT_PRIVATE_KEY` (PEM; `normalizePem` en `crypto/pem.ts` lo reconstruye) · `SF_API_VERSION=v67.0`. **Verificado en vivo:** el stakeholder entró con su email real y vio su orden real.
- 🔧 **JWT/ECA troubleshooting:** `client identifier invalid` = consumer key mal/truncado (el correcto son **85 chars**); `user is not admin approved / app is not installed` = el permset seleccionado en App Policies no basta, el user tiene que **TENERLO asignado** (Manage Assignments).
- ⚠️ **Las ECA con cert no viajan en change set** — son manuales por org (por eso el admin Artur no vio la app en el change set; solo llevaba el permset). El `WSC_Customer_Portal_JWT_Access` del sandbox apunta a la app del sandbox y **no se migra**.
- 🟠 **Pendiente de este paso:** el **trim del EIN** (el user quedó assigned a un permset que aún concede `EIN__c` / `EIN_Date_Issued__c`, que el BFF ya no lee — foldear al próximo update del permset) y el defecto de `vercel.json` (ver 2ª mitad, abajo).

#### 12b · Separación de entornos: staging→sandbox + fix de `vercel.json` — *2ª mitad, hecho 2026-08-08*
- ✅ **Defecto de `vercel.json` ARREGLADO** (commit `4293cea`). `apps/web/middleware.ts` enruta `/api` y `/auth` según el entorno; la regla vive en `apps/web/src/lib/bff-routing.ts` con tests. **Deliberadamente asimétrico:** Production devuelve `inherit` y sigue por el rewrite literal de `vercel.json`, así que un `BFF_ORIGIN` ausente **no puede tumbar producción**; todo lo demás **falla cerrado** (503) en vez de heredar el backend real. Verificado: producción 401, preview 503→401 al configurar la variable.
- ✅ **Staging levantado:** entorno `development` en Railway (BFF + Redis propio) con credenciales del **sandbox** y `SESSION_JWT_SECRET` distinto, en `wscbff-development.up.railway.app`. En Vercel, `BFF_ORIGIN` apunta ahí **solo en Preview**; en Production sin poner. Rama permanente `staging`.
- 🧨 **Tres trampas:** (1) una variable marcada **`Sensitive` en Vercel no llega al build** — y ahí resuelven `process.env` las Edge Functions; `BFF_ORIGIN` no es secreto (hostname público). (2) **Vercel no reconstruye un commit ya construido** — una rama al mismo SHA que prod no genera preview; hace falta un commit propio. (3) el **"Development" de Vercel es `vercel dev` local**, no los previews (choca de nombre con el `development` de Railway); `BFF_ORIGIN` va en **Preview**.
- 📌 **Corrección:** los previews **no eran públicos** — Vercel tiene *Deployment Protection* (exige sesión con acceso al proyecto). El riesgo era real (alguien del equipo leyendo datos reales) pero menor de lo que se había dicho.
- **Queda:** `APP_BASE_URL` del entorno `development` apuntando al alias de `staging`; a futuro un dominio propio para el entorno.

---

## Fase 3 — Lanzamiento (paso 15)

### 15 · Quitar Basic Auth → público real — *hecho 2026-08-07, sin el checkpoint del CEO*
- Se borró `apps/web/middleware.ts` **por instrucción directa del stakeholder** ("quita el middleware"), más su entrada en `tsconfig.json` y el `globalPassThroughEnv` de `turbo.json`. El portal queda abierto a cualquiera con la URL.
- 🔴 **Marcado hecho porque la acción ocurrió, NO porque el lanzamiento esté aprobado.** El checkpoint del CEO no se hizo, el paso 14 sigue abierto. Como el portal ya lee **producción**, quien entra llega a **datos reales de clientes**. La prueba de humo se hizo (el stakeholder entró con su email y vio su orden); falta avisar a ventas y soporte.
- ⚠️ **Ya no existe el rollback de 30s** — se borró el archivo en vez de solo quitar las variables. Volver a tapar exige `git show 0cc87d9:apps/web/middleware.ts` + deploy.
- 🧹 Cabos: `BASIC_AUTH_USER`/`BASIC_AUTH_PASSWORD` siguen en Vercel sin usarse (ya se pueden borrar). **`@vercel/edge` hay que DEJARLO** — el `middleware.ts` nuevo (enrutado por entorno, 2026-08-08) lo usa otra vez.

---

## Fase 4 — Después de lanzar (paso 17)

### 17 · Responsividad móvil y pulido visual + logo real — *hecho 2026-08-06 / logo 2026-08-07*
- Todo dentro de `theme.css` y sus tokens — ninguna paleta, tipografía ni librería nueva. Verificado en Chrome headless a **375 / 768 / 1280**, con auditoría de desbordamiento horizontal por elemento: **0 desbordamientos en 24 combinaciones**, sin `overflow-x:hidden`.
- **Login:** la tarjeta ahora eleva (sombra); el `input` subió a **16px porque por debajo iOS Safari hace zoom** al enfocar; botón con `:disabled` visible y `min-height:46px`; teléfono como `tel:`. La clase `.err` estaba definida solo dentro de `.wsc-shell` → los errores del login salían en negro por defecto. La pantalla "Check your email" ahora tiene "Use a different email".
- **Tablas (5):** a 375px las cabeceras se fundían (`DATEPRODUCTORDER`). Cada fila pasa a tarjeta con etiqueta por celda (`data-label`) — no se oculta ninguna columna. Eso pisa `display`, lo que hace que el navegador **descarte los roles ARIA implícitos**, así que los componentes los declaran explícitos: **no quitarlos**.
- **Nav móvil:** `.side-foot` estaba en `display:none` → **en un teléfono no había forma de cerrar sesión**. Ahora cabecera con logo + botón arriba y enlaces como pastillas. `.shell` usa `grid-template-rows:auto 1fr` (antes repartía 100vh y la cabecera crecía media pantalla).
- **Tracker:** se recuperan los conectores entre los pasos. **Contactos:** un correo largo se salía de la tarjeta (una sola "palabra" para el saltador de línea).
- 🎨 **Logo real (2026-08-07):** hasta entonces la marca eran letras compuestas con Arial Black (el repo no tenía archivo de marca). Ahora en `apps/web/public/`: `wsc-logo.png` (lockup, login), `wsc-logo-letters.png` (favicon), `wsc-logo-letters-light.png` (**knockout** — el arte es navy+carmesí y la mitad azul desaparecería sobre la barra lateral azul, así que el azul pasa a blanco y se deja la C carmesí). Se añadió favicon (no había) y el logo al correo del magic link (con texto `alt`, porque los clientes de correo bloquean imágenes remotas). Todo en `WscLogo.tsx`.
- 📅 **Antigüedad de la empresa auto-calculada (2026-08-07):** el login decía *"Established 2010 — 16 Years"* a mano, mal dos veces (año incorrecto + un número a mano miente al pasar un aniversario). La fecha real es **Business Started: 12/8/2017** (8 de diciembre — el BBB escribe M/D/YYYY), confirmada en la ficha del **BBB** que además imprime *"Years in Business: 8"*. Ahora sale de `yearsInBusiness(now)` en `packages/shared/src/domain/company.ts`: función pura que **recibe el reloj** (CLAUDE.md §2), comparando campos de calendario (evita la trampa de medianoche UTC). Pasa a 9 solo el 8-dic-2026, con 4 tests fijando el límite. ⚠️ Si WSC dice "16 años" en otro material, ese texto contradice al portal y al BBB.

---

## Créditos-Ready Features (fuera de la secuencia numerada, commit `17e3d34`)
La card de "Credit-ready features" (los apartados hacia funding, "already paid") se alimenta del objeto **`WSC_Feature_Order__c`** (record type = nombre de la feature, 43 tipos), **no** del `Paid_Features_Selected__c` que se asumía. Construido, gates verdes, acceso del integration user concedido, y live-verified (4 records sembrados por CLI en la orden de Marcus Brown, leídos con la SOQL del adaptador). Solo muestra los creados, sin Feature Order #, sin campos sensibles.
