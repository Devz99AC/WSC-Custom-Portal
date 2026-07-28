# Envío de correo vía Gmail API — runbook de configuración

> ## ⏸️ APARCADO (2026-07-24) — no es el camino activo
>
> **Producción usa Resend** (`EMAIL_SENDER=resend`, ver [`resend-setup.md`](resend-setup.md)).
> Esta vía se descartó porque el paso 3 exige **acceso de super administrador de Google
> Workspace**, que no estaba disponible.
>
> El adaptador **está implementado y funcionando** (`infrastructure/email/gmail-api-email-sender.ts`),
> así que si algún día se consigue ese acceso, retomarlo es seguir este runbook y cambiar
> `EMAIL_SENDER` a `gmail-api` — cero código nuevo. Se mantiene porque es la opción que mejor
> encaja con la regla del CEO de reusar herramientas ya pagadas: cero vendors nuevos.

> **Por qué esto y no SMTP.** Verificado en producción el 2026-07-24: **Railway bloquea la
> salida por SMTP**. Las conexiones TCP a `smtp.gmail.com` expiran (`ETIMEDOUT`) tanto en el
> puerto 587 como en el 465, mientras que la salida por HTTPS funciona perfecto (las llamadas
> a Salesforce nunca fallaron). No es un problema del App Password ni del código.
>
> La solución mantiene **el mismo buzón de Google Workspace que WSC ya paga** — cero
> proveedores nuevos, cero costo adicional — pero manda por **HTTPS** en vez de SMTP.
>
> El App Password que ya generaste **no se usa en este flujo**. Puedes revocarlo al terminar
> (myaccount.google.com → Seguridad → Contraseñas de aplicaciones).

## Lo que hace falta

1. Un **proyecto de Google Cloud** con la Gmail API habilitada.
2. Una **cuenta de servicio** con su llave privada.
3. **Delegación a nivel de dominio** en el Admin console de Workspace, autorizando esa cuenta
   de servicio a enviar como el buzón real.

> ⚠️ El paso 3 **requiere acceso de super administrador de Google Workspace**. Si no lo
> tienes, es lo único que hay que pedirle a quien administre el dominio — los pasos 1 y 2 los
> puedes hacer tú solo.

---

## Paso 1 — Proyecto de Google Cloud + Gmail API

1. Entra a [console.cloud.google.com](https://console.cloud.google.com) con una cuenta del
   dominio de WSC.
2. Arriba a la izquierda, selector de proyecto → **New Project**. Nombre sugerido:
   `wsc-client-portal`. → **Create**.
3. Con ese proyecto seleccionado, ve a **APIs & Services → Library**.
4. Busca **Gmail API** → ábrela → **Enable**.

## Paso 2 — Cuenta de servicio y llave privada

1. **APIs & Services → Credentials → Create Credentials → Service account**.
2. Nombre: `wsc-portal-mailer`. → **Create and continue**.
3. En "Grant this service account access to project": **no le des ningún rol**, dale
   **Continue** y luego **Done**. (Los permisos de Gmail no vienen de roles de GCP sino de la
   delegación del paso 3 — darle roles aquí solo ampliaría la superficie de ataque sin
   necesidad.)
4. Abre la cuenta de servicio recién creada → pestaña **Keys** → **Add key → Create new key**
   → tipo **JSON** → **Create**. Se descarga un archivo `.json`.
5. **Guarda dos datos de ese JSON** (ábrelo con el bloc de notas):
   - `client_email` → algo como `wsc-portal-mailer@wsc-client-portal.iam.gserviceaccount.com`
   - `private_key` → el bloque largo que empieza con `-----BEGIN PRIVATE KEY-----`
   - `client_id` → un número largo; **lo necesitas en el paso 3**

> 🔒 Ese archivo JSON es una credencial. No lo subas a git, no lo pegues en un chat. El repo
> ya ignora `.env.local`; si lo dejas en disco, guárdalo fuera del proyecto (por ejemplo junto
> a las llaves de Salesforce en `C:\Users\devin\.wsc-keys\`).

## Paso 3 — Delegación a nivel de dominio (requiere admin de Workspace)

1. Entra a [admin.google.com](https://admin.google.com) como super administrador.
2. **Seguridad → Control de acceso y datos → Controles de API → Delegación de todo el dominio**
   → **Añadir nueva**.
3. Rellena:
   - **ID de cliente**: el `client_id` numérico del paso 2.5
   - **Ámbitos de OAuth**: `https://www.googleapis.com/auth/gmail.send`
4. **Autorizar**.

> Ese ámbito es **solo enviar**. No da acceso a leer, borrar ni listar correo del buzón — es
> el permiso mínimo que hace falta.

## Paso 4 — Variables en Railway

Servicio `@wsc/bff` → **Variables**:

| Variable | Valor |
|---|---|
| `EMAIL_SENDER` | `gmail-api` |
| `GMAIL_SA_CLIENT_EMAIL` | el `client_email` del JSON |
| `GMAIL_SA_PRIVATE_KEY` | el `private_key` del JSON — **marcar Sensitive** |
| `GMAIL_IMPERSONATED_USER` | `support@wholesaleshelfcorporations.com` |
| `SMTP_FROM_EMAIL` | `support@wholesaleshelfcorporations.com` (ya la tienes puesta) |

`SMTP_FROM_NAME` ya tiene default correcto (`WSC Client Portal`). Las variables
`SMTP_USER`/`SMTP_PASSWORD`/`SMTP_HOST`/`SMTP_PORT` **dejan de usarse** en este modo — puedes
borrarlas o dejarlas, da igual.

### Sobre pegar la llave privada

El código **normaliza el PEM** antes de usarlo (`infrastructure/crypto/pem.ts`), así que
aguanta las tres formas en que las UIs de variables suelen destrozar una llave multilínea:
saltos de línea reales, `\n` literales, o incluso que se pierdan los marcadores
`-----BEGIN/END-----`. Es el mismo helper que resolvió este problema exacto con la llave de
Salesforce, así que no deberías pelearte con el formato.

Luego **Redeploy a mano** (Deployments → "..." → Redeploy) — Railway no siempre lo dispara solo
al cambiar variables.

## Paso 5 — Verificar

Pide un link de acceso para un email real de un cliente (`devinzond@gmail.com` ya está
configurado como el correo de Marcus Brown en Salesforce) y confirma que llega a la bandeja.

**Si algo falla**, el error exacto queda en los logs de Railway (nunca se le devuelve al
cliente, a propósito). Los tres típicos:

| Error en el log | Qué significa |
|---|---|
| `unauthorized_client` | La delegación del paso 3 no quedó bien: revisa que el `client_id` sea el numérico correcto y que el ámbito esté escrito exacto. |
| `invalid_grant` | El `GMAIL_IMPERSONATED_USER` no existe en el dominio, o no es un buzón real. |
| `Gmail send failed (403)` | La Gmail API no está habilitada en el proyecto (paso 1.4). |

## Nota de diseño

Todo esto vive detrás del puerto `EmailSender`, así que cambiar de transporte fue escribir un
adaptador nuevo y una línea en el composition root — el flujo de login, el template de marca y
las vistas no se tocaron. Si algún día se migra el BFF a un host que sí permita SMTP, basta con
volver a poner `EMAIL_SENDER=smtp`: ese adaptador sigue ahí y funcionando.
