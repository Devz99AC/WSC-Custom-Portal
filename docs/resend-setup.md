# Envío de correo vía Resend — runbook de configuración

> **Por qué un API HTTP y no SMTP.** Verificado en producción el 2026-07-24: **Railway
> bloquea la salida por SMTP**. Las conexiones TCP a `smtp.gmail.com` expiran (`ETIMEDOUT`)
> tanto en el puerto 587 como en el 465, mientras que la salida por HTTPS funciona perfecto
> (las llamadas a Salesforce nunca fallaron). No es problema del App Password ni del código.
>
> El **App Password de Google que generaste ya no se usa** — conviene revocarlo
> (myaccount.google.com → Seguridad → Contraseñas de aplicaciones).
>
> La alternativa sin vendor nuevo (Gmail API) quedó aparcada porque exige super admin de
> Workspace: ver [`gmail-api-setup.md`](gmail-api-setup.md).

**Costo:** capa gratuita de 3.000 correos/mes (100/día). Para links de acceso de un portal de
clientes sobra — no hay que pagar nada.

---

## Paso 1 — Cuenta y API key

1. Crea una cuenta en [resend.com](https://resend.com).
2. **API Keys → Create API Key**. Nombre: `wsc-portal`. Permiso: **Sending access** (no hace
   falta full access).
3. Copia la key (empieza con `re_`). **Solo se muestra una vez.**

## Paso 2 — Remitente

### 🟢 Ahora (decisión 2026-07-24): `onboarding@resend.dev`, sin verificar dominio

Se trabaja con el remitente de pruebas que da Resend, para no depender del acceso al DNS.

> ⚠️ **Restricción de este modo: Resend solo entrega al correo dueño de la cuenta.** Por eso
> la cuenta de Resend debe registrarse con **`devinzond@gmail.com`** — que es justamente el
> correo que ya tiene el cliente Marcus Brown en Salesforce, así que la prueba de punta a
> punta funciona. Si la cuenta se crea con otro correo, el envío se acepta con `200` pero
> nunca llega a la bandeja.

### 🔜 Antes del go-live: verificar el dominio

Obligatorio para enviarle a clientes reales desde `support@wholesaleshelfcorporations.com`
(y es lo que evita que caiga en spam):

1. **Domains → Add Domain** → `wholesaleshelfcorporations.com`.
2. Resend te da unos registros DNS (SPF y DKIM, normalmente 3 registros `TXT`/`MX`).
3. Agrégalos donde tengas el DNS del dominio.
4. Espera la propagación y dale **Verify** (minutos, a veces hasta una hora).
5. Cambia `SMTP_FROM_EMAIL` a `support@wholesaleshelfcorporations.com` en Railway.

Este paso queda enganchado al checkpoint de luz verde final del roadmap, junto con el dominio
propio en Vercel — ambos son cambios de DNS.

## Paso 3 — Variables en Railway

Servicio `@wsc/bff` → **Variables**:

| Variable | Valor |
|---|---|
| `EMAIL_SENDER` | `resend` |
| `RESEND_API_KEY` | la key `re_...` del paso 1 — **marcar Sensitive** |
| `SMTP_FROM_EMAIL` | `onboarding@resend.dev` (cambiar al dominio propio cuando se verifique) |

`SMTP_FROM_NAME` ya tiene el default correcto (`WSC Client Portal`).

> El prefijo `SMTP_` en esas dos es histórico — son la identidad del remitente y las comparten
> todos los transportes, así que cambiar de proveedor no obliga a reescribir la dirección.
>
> `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_HOST` y `SMTP_PORT` **dejan de usarse** en este modo.
> Puedes borrarlas (recomendado, ya que `SMTP_PASSWORD` guarda el App Password que vas a
> revocar) o dejarlas, es indiferente para el funcionamiento.

Luego **Redeploy a mano** (Deployments → "..." → Redeploy) — Railway no siempre lo dispara solo
al cambiar variables, y la tarjeta del servicio puede seguir en verde mientras el build nuevo
está en cola.

## Paso 4 — Verificar

Pide un link de acceso con un email real de cliente (`devinzond@gmail.com` ya está configurado
como el correo de Marcus Brown en Salesforce) y confirma que llega.

**Si algo falla**, el error exacto queda en los logs de Railway — nunca se le devuelve al
cliente, a propósito (ver la nota de seguridad abajo). Los típicos:

| Error en el log | Qué significa |
|---|---|
| `Resend send failed (401)` | La API key está mal o fue revocada. |
| `Resend send failed (403)` | El dominio del remitente no está verificado todavía (paso 2). |
| `Resend send failed (422)` | La dirección `from` no coincide con ningún dominio verificado de la cuenta. |

## Nota de seguridad — por qué el error no se le muestra al cliente

`/auth/request-link` devuelve **siempre** la misma respuesta genérica, falle o no el envío.
Podría parecer más amable devolver "no pudimos enviar el correo", pero eso filtraría si la
cuenta existe: solo intentamos enviar cuando el email **sí** corresponde a un cliente, así que
una respuesta distinta delataría exactamente el dato que ese endpoint existe para ocultar. El
error se registra en el log del servidor para el operador y el cliente ve siempre lo mismo.

## Nota de diseño

Todo esto vive detrás del puerto `EmailSender`, así que cambiar de transporte fue escribir un
adaptador nuevo y una línea en el composition root — el flujo de login, el template de marca y
las vistas no se tocaron. Los adaptadores de SMTP y Gmail API siguen ahí y funcionando: si el
BFF se mueve a un host que permita SMTP, o si algún día hay acceso de admin de Workspace, es
cambiar `EMAIL_SENDER` y ya.
