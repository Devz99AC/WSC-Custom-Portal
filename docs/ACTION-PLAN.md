# WSC Customer Portal — Action Plan (actualizado 2026-07-22, post-feedback del stakeholder)

> Para el historial completo (qué se descubrió, qué falló, por qué) ver
> [`STATUS.md`](STATUS.md). Este doc es el checklist accionable, **priorizado por
> qué se puede hacer AHORA sin depender de Salesforce ni de acceso de admin**.

## Estado

- ✅ **Grupos A + B + C del plan anterior: COMPLETOS (2026-07-22).** Resumen: staging
  Vercel + Railway + Redis en vivo tras Basic Auth; magic-link real (ADR-0005); 5 vistas
  en React; integration user de mínimo privilegio (`WSC_Portal_Read_Only`); y
  **`PORTAL_DATA_SOURCE=salesforce-jwt` VIVO en producción** leyendo la orden real
  `UO1423102`. Detalle en `STATUS.md` y el historial de git de este archivo.
- 🆕 **2026-07-22: llegó el feedback del stakeholder** (revisión del portal desplegado).
  Veredicto general positivo ("está chévere") pero con **errores de concepto a corregir**
  y features nuevas. Este plan lo separa en **HACER YA** + fases.

---

## Feedback del stakeholder (2026-07-22) — resumen fiel

**Estructura:** un cliente puede tener **múltiples órdenes** — la vista actual es una
vista de orden, no un dashboard; falta una lista "My Orders". Navegación sugerida:
**Orders, Payments, Documents, Profile, Support, Refer a Friend, Learning Center**
(el dashboard general puede quedar como resumen o eliminarse). "My order" tal como está
es redundante frente al dashboard.

**Corrección del pipeline (pasos actuales incorrectos)** — reemplazar por:
1. Unpaid (pendiente de pago / verificación) · 2. Initial Onboarding · 3. Corp docs
shipped/sent (correo certificado + email) · 4. Onboarding call · 5. Credit ready
feature setup · 6. Complete, ready for funding.

**Personal:** mostrar el **Advisor/Sales rep** (solo compras/órdenes nuevas) y un
**Support Representative / Implementation Manager** asignado post-compra (ej. Lua o
Rinki) con datos de contacto directos.

**Features:** soporte multicanal (tickets, WhatsApp, agente AI, live chat) ·
**Refer a Friend / Affiliate** (enviar leads, rastrear estado y ganancias; **$500 por
match de "CPs"**, **10% del total en shelf corps**) · **Learning Center** (videos).

**Costos:** evitar herramientas de $25/mes si hay alternativa gratis con la
infraestructura ya pagada; aprobada solo como último recurso.

---

## Realidad de Salesforce verificada ANTES de planificar (describe 2026-07-22)

- **`Status__c` real (activos):** pipeline `To Verify Payment → Pending Balance →
  Verified - Initial Contact → Verified - Work Started → Verified - Waiting to Ship →
  Verified - Shipped → Verified - Delivered → Verified - Complete`, más 5 `Cancelled - *`
  y 3 `ON HOLD - *` (16 valores). **Los 6 pasos del stakeholder NO mapean 1:1** — ver
  pregunta Q1.
- **`Sales_Rep__c` ya existe** en `Online_Order__c` (lookup → `SEOX3_Team_Member__c`) con
  campos derivados de contacto (`Sales_Rep_E_Mail__c`, etc.). Candidato natural para el
  rol post-venta: **`QC_Agent__c`** (mismo objeto, con `QC_Agent_Name__c`/`_Telephone__c`/
  `_E_Mail__c`) — confirmar con el negocio (Q2).
- **El programa de referidos parece YA modelado**: `Supporting_Lead__c` (→
  `SEOX3_Client__c`), `Supporting_Lead_Allocation__c` (%), `Supporting_Lead_Allocation_Cur__c`
  ($), `Supporting_Lead_Expert__c`, `Supporting_Lead_Marketing_Source__c`. **Mapear, no
  crear** (patrón ya establecido del proyecto) — descubrimiento pendiente (F2).
- **La org ya tiene un agente AI** (`AI_Agent_Purchase_Link__c`) — investigar qué es
  antes de evaluar herramientas de chat/AI externas (F3, y conecta con la regla de costos).
- **Paquetes instalados relevantes** (Tooling API, 2026-07-22): **`LiveChat-Salesforce
  Integration`** y **`TwilioSalesforce`** ya están en la org — candidatos "ya
  integrados/pagados" para live chat y WhatsApp/SMS (F3) antes de pagar nada nuevo.
  **NO hay paquete de Formstack instalado** → la e-firma vía Formstack Documents iría
  por la API de Formstack desde el BFF (puerto `IESignProvider`), no por un paquete SF.

---

## 🔴 HACER YA — correcciones de concepto (cero SF admin, puro código)

Arreglan los "errores de concepto" señalados; todo es frontend + BFF + `packages/shared`:

1. **My Orders**: nueva ruta `/orders` con la lista de TODAS las órdenes del cliente
   (el SOQL ya filtra por `FU_User__c`; quitar el "primera orden" implícito, agregar
   `ORDER BY` + `LIMIT` con paginación keyset per CLAUDE.md §1). El detalle pasa a
   `/orders/:id`. El BFF gana `GET /api/orders` y `GET /api/orders/:id`.
2. **Navegación nueva** (7 secciones): Orders · Payments · Documents · Profile ·
   Support · Refer a Friend · Learning Center. Las 3 nuevas nacen como páginas con
   **estado vacío honesto** (precedente del Grupo A #8: nunca fabricar datos) para
   aterrizar la arquitectura de información ya. Decidir en el camino: dashboard como
   "Overview" resumido o eliminarlo (el stakeholder acepta ambas).
3. **Dashboard vs Order detail sin redundancia**: dashboard (si queda) = resumen
   agregado multi-orden (balance total, órdenes activas, próxima acción); TODO lo
   específico de una orden vive solo en `/orders/:id`. Mientras la discusión del
   pipeline (sección siguiente) no se resuelva, el tracker sigue mostrando los
   `Status__c` reales tal como hoy.

**Y las features nuevas, en su mitad SIN Salesforce** (corrección 2026-07-22: ser
features nuevas las hace MENOS dependientes de SF, no más — el mismo patrón hexagonal
de `PortalRepository`: UI + endpoint + puerto con adaptador mock YA, adaptador SF
cuando toque):

4. **Learning Center completo**: página de la nueva sección con grid de videos
   embebidos (YouTube unlisted/Vimeo = $0). Cero SF — lo único externo es el contenido,
   que produce WSC (placeholder honesto mientras llega).
5. **WhatsApp**: deep link `wa.me/<número de soporte>` como botón en la sección Support
   (y donde hoy dice "Contact advisor"). Gratis, inmediato, cero SF.
6. **Support — UI + puerto**: página de Support con formulario de ticket +
   `POST /api/support/tickets` tras un puerto `SupportTicketRepository`. Adaptador
   inicial **email** (reusa el sender SMTP que ya construimos: el ticket llega a
   `support@…`) o mock — funcional para el cliente desde el día 1. El adaptador SF
   (Case u objeto propio de la org) llega en F1 tras Q2.
7. **Refer a Friend — UI + puerto**: formulario "enviar lead" + lista "mis referidos"
   (estado + ganancias) tras un puerto `ReferralRepository` con adaptador mock cuya
   forma anticipa lo descubierto (`Supporting_Lead_*`: lead + allocation % y $). El
   adaptador SF real llega en F2.
8. **Componente de staff** (Advisor / Support rep): card con nombre + contacto directo,
   alimentada por el mock (que ya modela un advisor). La regla de transición
   (pre-pago = Sales rep, post-pago = Implementation Manager) se implementa contra el
   mock; los campos reales (`Sales_Rep__c`/`QC_Agent__c`) llegan en F1.

## ⏸️ Pipeline de 6 pasos — REQUIERE discusión preliminar con el jefe (NO va en "YA")

**Por qué está bloqueado:** los 6 pasos que pidió **no existen en Salesforce** hoy.
Hay que decírselo antes de implementar nada — la conversación define si es (a) un
**mapping de display** (el portal agrupa los `Status__c` existentes bajo los 6 nombres
nuevos, SF no cambia) o (b) un **cambio del pipeline real en SF** (nuevos valores de
picklist — no trivial: `Online_Order__c` tiene 126 validation rules + triggers Apex que
dependen de los valores actuales).

**Material para esa conversación** (esto es lo que existe vs. lo que pidió):

| Paso que pidió | `Status__c` real que le correspondería |
|---|---|
| 1. Unpaid | `To Verify Payment`, `Pending Balance` |
| 2. Initial Onboarding | `Verified - Initial Contact` |
| 3. Corp docs shipped | `Verified - Waiting to Ship`, `Verified - Shipped`, `Verified - Delivered` |
| 4. Onboarding call | ❌ **no existe ningún status para esto** |
| 5. Credit ready feature setup | `Verified - Work Started` ⚠️ (en SF ocurre **antes** del envío de docs, no después) |
| 6. Complete, ready for funding | `Verified - Complete` |

Más los estados fuera del happy path que su lista no contempla: 5 `Cancelled - *` y
3 `ON HOLD - *` (propuesta: badge excepcional sobre el tracker, no pasos).

**Recomendación a llevar:** opción (a) — mapping de display, sin tocar el SSOT. Cubre
4 de los 6 pasos ya; los dos conflictos ("Onboarding call" inexistente, orden invertido
del paso 5) son justamente lo que el jefe tiene que decidir: o ajusta su lista, o
aprueba agregar status nuevos en SF (con su admin/proceso).

**Cuando se resuelva:** implementar como mapping table en `packages/shared` (labels =
data, no constantes en componentes — CLAUDE.md §1).

## 🟡 Fase F1 — Personal y soporte básico (SF Setup — lo haces tú, con Q1/Q2 respondidas)

5. **Advisor visible con contacto real**: agregar `Sales_Rep__c` (+ campos de contacto)
   al SOQL y al Permission Set `WSC_Portal_Read_Only` (FLS campo por campo, como en G3).
   Regla de transición: pre-pago (Unpaid) se muestra el Sales Rep; post-pago se muestra
   el Support/Implementation Manager.
6. **Identificar el campo del Implementation Manager** (¿`QC_Agent__c`? ¿campo nuevo?) —
   depende de Q2. Mismo tratamiento FLS + SOQL.
7. **Tickets de soporte**: descubrir qué usa la org (¿`Case` estándar? ¿objeto propio?)
   y diseñar `POST /api/support/tickets` (primera escritura del portal → aplica
   idempotencia CLAUDE.md §1).

## 🟠 Fase F2 — Refer a Friend / Affiliate (descubrimiento SF primero)

8. **Descubrir el modelo existente** de referidos (`Supporting_Lead_*`, `SEOX3_Client__c`,
   allocations) antes de diseñar nada — es muy probable que el negocio YA rastree esto.
9. UI: enviar lead + lista con estado y ganancias. Reglas de bono: **$500 por match (CP)**,
   **10% del total (shelf corp)** — confirmar Q3 y dónde vive el cálculo (¿fórmula SF?).

## 🟠 Fase F3 — Learning Center y soporte multicanal

10. **Learning Center**: página de videos embebidos (YouTube unlisted/Vimeo = $0);
    el contenido lo produce WSC. Puro frontend cuando haya videos.
11. **WhatsApp**: deep link `wa.me` al número de soporte = gratis e inmediato (puede
    adelantarse al grupo YA si se quiere). WhatsApp Business API = evaluar después.
12. **Live chat / agente AI**: primero investigar el agente AI que la org ya tiene
    (`AI_Agent_Purchase_Link__c`) y alternativas gratis (p.ej. Tawk.to); la herramienta
    de $25/mes queda **aprobada solo si no hay alternativa viable** (palabras del
    stakeholder).

## ❓ Preguntas abiertas al stakeholder (bloquean lo marcado)

- **Q1 — pipeline de 6 pasos:** es la **discusión preliminar con el jefe** de la sección
  "⏸️" de arriba: informarle que esos pasos **no existen en Salesforce aún** y decidir
  display-mapping (recomendado) vs cambio del picklist real. La tabla de esa sección es
  el material para la conversación.
- **Q2:** ¿el Support Representative / Implementation Manager es el `QC_Agent__c`
  existente, u otro campo/rol? ¿"Lua" y "Rinki" existen como `SEOX3_Team_Member__c`?
- **Q3:** ¿"CP" = Credit Partner? ¿El programa de referidos del feedback es el mismo
  "Supporting Lead" que ya existe en SF?
- **Q4:** ¿cuál es la herramienta de $25/mes mencionada? (para evaluar la alternativa
  gratis con conocimiento de causa — nota: la org ya tiene LiveChat y Twilio instalados)
- **Q5 — Formstack (condición de la e-firma):** ¿la suscripción de Formstack de WSC
  incluye firma electrónica (Formstack Sign / delivery a e-sign) y qué documentos se
  firman en el flujo del cliente? No hay paquete Formstack en la org — la integración
  sería vía API de Formstack.

## Pendientes previos que siguen vivos

- **SMTP real (Google Workspace)** — runbook: App Password en
  myaccount.google.com/security → Railway `EMAIL_SENDER=smtp`, `SMTP_USER`,
  `SMTP_PASSWORD` (Sensitive), `SMTP_FROM_EMAIL`. Nota: con `salesforce-jwt` vivo, el
  caveat del `DEMO_EMAIL` de mock ya no aplica en producción — se prueba directo con el
  email real del `FU_User__c`.
- **Deuda de tests**: DoD de ROADMAP 1.6 (re-mint forzado + token nunca sale del server)
  y tests HTTP de auth (destraban 1.7/1.8).
- **Decidir el deploy público final** (dominio propio; quitar/ajustar Basic Auth).
- **Fases técnicas — RE-ALCANCE (2026-07-22, ADR-0006):** el feedback del stakeholder
  es el **alcance final** del producto. **Quedan FUERA**: Stripe/checkout en el portal,
  la **reserva anti-doble-venta** (era parte del flujo de compra self-service, que ya
  no existe — las compras nuevas pasan por el Sales rep humano) y el **upload de
  documentos por el cliente** (Documents = ver/descargar/firmar, nunca subir). La
  **e-firma SIGUE** (corrección del mismo día): vía **Formstack Documents** — nunca
  DocuSign/PandaDoc — **condicionada** a confirmar que la suscripción de WSC cubre
  firma (Q5). **Siguen vivas**: contrato OpenAPI, endpoints de lectura, caché Redis +
  invalidación CDC, realtime SSE (opcional), tests/hardening/observabilidad/go-live.
  "Payments" del nav es **historial + balance**, sin botón de pago. Plan completo por
  fases: P1–P6 (ver ROADMAP/mensaje de planificación 2026-07-22).

---

## Por qué este orden

El grupo **YA** corrige los errores de concepto señalados por el stakeholder sin tocar
Salesforce ni esperar respuestas — puro código sobre lo que ya está vivo. F1–F3 dependen
de las preguntas Q1–Q4 y de descubrimiento en la org (que puedes hacer tú mismo, como
todo el Grupo B anterior). Las preguntas están listadas para resolverlas en una sola
conversación con el stakeholder en vez de bloquear pieza por pieza.

¿Arrancamos con el grupo YA (#1 My Orders es el primero natural)?
