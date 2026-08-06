# Runbook — DNS, dominio propio y separación producción / desarrollo

> **Escrito el 2026-08-06.** Todo lo de la sección 0 está **verificado en vivo** ese día, no
> supuesto. Si vuelves a esto meses después, re-verifica antes de tocar nada.
>
> Cubre el **paso 9 del roadmap** ([`execution-roadmap.html`](execution-roadmap.html)), que es el
> único bloqueante real del go-live, y a continuación la separación de entornos.

---

## 0. Estado real, comprobado hoy

| Dato | Valor verificado |
| --- | --- |
| **Dónde se administra el DNS** | **Cloudflare** — los nameservers son `gina.ns.cloudflare.com` y `mark.ns.cloudflare.com` |
| **SPF actual del dominio** | `v=spf1 include:_spf.google.com include:_spf.salesforce.com include:formstack.com -all` |
| **Presupuesto de SPF consumido** | **5 de 10** consultas DNS (ver §1.3) |
| Frontend | Vercel, proyecto `wsc-custom-portal-web` → `wsc-custom-portal-web.vercel.app` |
| Backend | Railway → `wscbff-production.up.railway.app` |
| Remitente hoy | `onboarding@resend.dev` — **solo entrega al dueño de la cuenta de Resend** |

**El DNS NO se toca en Vercel ni en el registrador.** Aunque compres el dominio en otro sitio y
Vercel te ofrezca gestionarlo, los nameservers apuntan a Cloudflare: **el único sitio donde un
cambio surte efecto es el panel de Cloudflare.** Añadir registros en Vercel no haría nada.

---

## 0.5 Por qué Resend y no SendGrid (investigado y cerrado el 2026-08-06)

WSC **ya tiene SendGrid**, con el dominio **completamente autenticado** — comprobado en el DNS
público y en el panel: `em8901.wholesaleshelfcorporations.com → u106817605.wl106.sendgrid.net`,
más los DKIM `s1/s2._domainkey` y el DMARC, los cuatro en *Verified*. Usarlo habría eliminado el
paso A entero. Se descartó igualmente, por este orden de hallazgos:

1. **Las listas de supresión son de toda la cuenta, no por tipo de correo.** WSC gestiona muchas
   cuentas ahí y las supresiones están muy pobladas. Un cliente que rebotó o marcó como spam una
   campaña de marketing **no recibiría su magic link**, y el fallo es **silencioso**: no hay error
   en ninguna parte, el cliente dice "no me llega" y en el portal todo se ve correcto. Es el único
   correo por el que se entra al portal; no puede depender de la higiene de una lista de campañas.
2. **La salida correcta dentro de SendGrid era un subusuario dedicado** (listas de supresión
   propias, reutilizando la autenticación de dominio ya publicada). **El plan actual no lo
   permite** — pide upgrade. La cuenta además aparece marcada como *Trial*.
3. **Resend no cuesta código.** El adaptador ya está escrito, probado y desplegado desde el
   2026-07-28. Ir a SendGrid habría exigido escribir uno nuevo **y** quedarse con el problema 1.

**Los registros de ambos conviven sin chocar** — SendGrid usa `em8901` + `s1/s2._domainkey`,
Resend usa `send` + `resend._domainkey`. Y ninguno de los dos toca el SPF de la raíz: SendGrid lo
tiene aislado en `em8901` (`v=spf1 include:sendgrid.net ~all`), que es exactamente el patrón que
se espera de Resend. **No hay que desmontar nada de SendGrid**; sigue sirviendo para marketing.

---

## 1. Antes de tocar nada — lo que hay que entender

### 1.1 Por qué esto es el bloqueante

El portal entra por **magic link**: el cliente escribe su correo y recibe un enlace. Hoy ese
correo sale desde `onboarding@resend.dev`, el remitente de pruebas de Resend, que **solo entrega
al correo dueño de la cuenta**. Da igual lo bien que funcione el resto: ningún cliente real puede
iniciar sesión hasta que el dominio esté verificado en Resend.

### 1.2 El riesgo del SPF, y por qué es MENOR de lo que parecía

Un dominio puede tener **un solo registro SPF**. Dos registros invalidan ambos y el correo del
dominio entero —incluido el normal del equipo por Google Workspace— empieza a rebotar o a caer en
spam. Por eso el aviso.

**Pero Resend normalmente NO pide tocar el SPF de la raíz.** Su diseño (heredado de Amazon SES)
pone el SPF y el MX de retorno en un **subdominio** `send.tudominio.com`, y la alineación con
`From: support@tudominio.com` la consigue por **DKIM**, no por SPF. Si es así, no hay conflicto
posible y no hay que fusionar nada.

> ### ⚠️ REGLA DE DECISIÓN — aplícala mirando la pantalla de Resend
>
> Cuando Resend te muestre la tabla de registros, **mira la columna `Name` / `Host` de la fila
> del TXT que empieza por `v=spf1`**:
>
> - **Dice `send` o `send.wholesaleshelfcorporations.com`** → añádelo tal cual como registro
>   nuevo. **No hay conflicto.** El SPF de la raíz no se toca.
> - **Dice `@`, vacío, o el dominio raíz** → 🛑 **PARA. No lo añadas como registro nuevo.**
>   Hay que **fusionarlo** con el que ya existe (§1.4).

### 1.3 Presupuesto de SPF (por si toca fusionar)

SPF permite **máximo 10 consultas DNS**; pasarse produce `permerror` y rompe la entregabilidad
igual que tener dos registros. Contado hoy:

| Include | Consultas | Por qué |
| --- | --- | --- |
| `_spf.google.com` | 1 | termina en ip4/ip6, no anida |
| `_spf.salesforce.com` | 2 | contiene un `exists:` que cuenta como otra |
| `formstack.com` | 2 | anida `include:_spf.formstack_com._d.easydmarc.pro` |
| **Total actual** | **5 / 10** | |
| `+ amazonses.com` (Resend) | +1 | termina en ip4, no anida |
| **Total si se fusiona** | **6 / 10** | ✅ margen cómodo |

### 1.4 El valor fusionado exacto (SOLO si la regla de §1.2 lo pide)

```
v=spf1 include:_spf.google.com include:_spf.salesforce.com include:formstack.com include:amazonses.com -all
```

Se **edita el registro existente** y se pega esto encima. **Nunca se crea un segundo TXT con
`v=spf1`.** El `include` nuevo va antes del `-all`, que siempre cierra.

---

## 2. Orden de ejecución

El orden no es arbitrario: **cada paso queda verificable por separado y nada se rompe en medio.**
Si se hiciera al revés (dominio de Vercel primero, o cambiando `APP_BASE_URL` antes de tiempo),
habría una ventana en la que los enlaces de acceso apuntan a un dominio que todavía no responde.

```
A. Verificar el dominio en Resend        → habilita enviar desde support@
B. Cambiar SMTP_FROM_EMAIL en Railway    → los correos ya salen del dominio propio
      (aquí ya se puede probar: el login funciona, con la URL .vercel.app de siempre)
C. Añadir el dominio propio en Vercel    → la web responde en la URL bonita
D. Cambiar APP_BASE_URL en Railway       → los enlaces del correo apuntan al dominio propio
E. Verificación final
```

---

## PASO A — Verificar el dominio en Resend

1. Entra en **resend.com** → menú lateral **Domains** → botón **Add Domain**.
2. Escribe **`wholesaleshelfcorporations.com`** (la **raíz**, sin `www` y sin `send.`).
   - Tiene que ser la raíz porque el objetivo es enviar desde `support@wholesaleshelfcorporations.com`.
     Si verificas solo un subdominio, únicamente podrás enviar desde `algo@ese-subdominio`.
3. Región: deja la que sale por defecto (`us-east-1`) salvo que tengas motivo para otra.
4. Resend te muestra una **tabla de registros DNS**. Habrá 3 o 4 filas: un `MX`, un `TXT` de SPF,
   un `TXT` de DKIM (el nombre empieza por `resend._domainkey`) y opcionalmente un `TXT` de DMARC.
   **Deja esa pestaña abierta**, la vas copiando.
5. 👉 **Aplica ahora la REGLA DE DECISIÓN de §1.2** sobre la fila del SPF.

### Añadir los registros en Cloudflare

6. Entra en **dash.cloudflare.com** → haz clic en el dominio **wholesaleshelfcorporations.com**.
7. Menú lateral: **DNS** → **Records**.
8. Por cada fila de la tabla de Resend, botón **Add record** y copia:
   - **Type**: el que diga Resend (`MX` / `TXT`)
   - **Name**: exactamente lo que diga Resend. Ojo: Cloudflare **añade el dominio solo**, así que
     si Resend dice `send.wholesaleshelfcorporations.com`, en Cloudflare escribes solo **`send`**.
     Si Resend dice el dominio raíz, escribes **`@`**.
   - **Content / Value**: copiar y pegar tal cual, sin comillas añadidas ni espacios al final.
   - **Priority** (solo en el MX): el número que diga Resend, normalmente `10`.
   - **TTL**: `Auto`.
9. **Si tocó fusionar el SPF:** no crees registro nuevo. Busca el TXT que ya empieza por `v=spf1`,
   dale a **Edit**, y sustituye su contenido por el valor de §1.4. Guarda.
10. Vuelve a Resend y pulsa **Verify DNS Records**.
    - Suele tardar entre 1 minuto y 1 hora. Cloudflare propaga rápido.
    - Si falla, casi siempre es el `Name`: revisa que no hayas escrito el dominio dos veces
      (`send.wholesaleshelfcorporations.com.wholesaleshelfcorporations.com` es el error clásico).

### ✅ Checklist paso A

- [ ] Resend muestra el dominio en estado **Verified** (verde)
- [ ] En Cloudflare hay **exactamente un** registro TXT que empieza por `v=spf1` — cuéntalos
- [ ] El registro DKIM (`resend._domainkey`) existe y está en **DNS only** si tiene nube
- [ ] El correo normal del equipo sigue funcionando: **mándate un correo desde Gmail y recíbelo**

---

## PASO B — Que los correos salgan del dominio propio

11. Entra en **railway.app** → tu proyecto → servicio del **BFF** (`@wsc/bff`) → pestaña
    **Variables**.
12. Edita `SMTP_FROM_EMAIL` → **`noreply@wholesaleshelfcorporations.com`**
    - No hace falta verificar esa dirección en ningún sitio: la autenticación de dominio cubre
      **cualquier** buzón de `@wholesaleshelfcorporations.com`. (Verificar direcciones sueltas es
      *Single Sender Verification*, un mecanismo distinto que no se usa aquí.)
13. Añade `SMTP_REPLY_TO_EMAIL` → **`support@wholesaleshelfcorporations.com`**
    - Enviar como `noreply@` deja el remitente impersonal pero **tira todas las respuestas a la
      basura**, y un cliente al que le falló el acceso pulsa Responder, no busca un teléfono. Con
      esta variable el From sigue siendo `noreply@` y las respuestas llegan a soporte.
    - Es **opcional**: si no la pones, no se manda cabecera `Reply-To` y todo funciona igual.
14. Revisa que `SMTP_FROM_NAME` diga algo presentable (ej. `Wholesale Shelf Corporations`) — es el
    nombre que ve el cliente en su bandeja.
15. Railway **redespliega solo** al guardar una variable. Espera a que el deploy quede verde.

### ✅ Checklist paso B

- [ ] **Prueba real y decisiva:** pide un magic link **con un correo que NO sea el dueño de la
      cuenta de Resend** (el tuyo personal, por ejemplo). Antes de este paso era imposible que
      llegara; ahora tiene que llegar. **Esto es lo que desbloquea el go-live.**
- [ ] El correo llega a **bandeja de entrada**, no a spam
- [ ] El remitente se ve como `Wholesale Shelf Corporations <noreply@…>`
- [ ] **Dale a Responder** en ese correo: el destinatario que se rellena solo debe ser
      `support@wholesaleshelfcorporations.com`, no `noreply@`
- [ ] El enlace del correo funciona y entra al portal

---

## PASO C — Dominio propio en Vercel

> **Recomendación: usa un subdominio, `portal.wholesaleshelfcorporations.com`, no la raíz.** La
> raíz casi con seguridad sirve la web comercial de WSC; apuntarla a Vercel la tumbaría. Un
> subdominio es un registro nuevo que no toca nada de lo existente.

15. Entra en **vercel.com** → selecciona el equipo → proyecto **`wsc-custom-portal-web`**.
16. Pestaña **Settings** (arriba) → **Domains** (menú lateral izquierdo).
17. Botón **Add** / **Add Domain** → escribe `portal.wholesaleshelfcorporations.com` → **Add**.
18. Vercel te dirá qué registro hace falta. Para un subdominio será:
    - **Type** `CNAME` · **Name** `portal` · **Value** `cname.vercel-dns.com`
    - (Si algún día usaras la raíz sería un `A` a `76.76.21.21`.)
19. En **Cloudflare** → **DNS → Records → Add record**, con esos valores.
20. 🔴 **CRÍTICO — la nube naranja.** Cloudflare pone los CNAME como **Proxied** (nube naranja)
    por defecto. **Cámbialo a `DNS only` (nube gris).** Si lo dejas proxied:
    - Vercel no puede emitir el certificado SSL y se queda en "Invalid Configuration"
    - Y si llega a emitirlo, dos proxies encadenados dan bucles de redirección
21. Vuelve a Vercel y espera a que el dominio muestre **Valid Configuration** con el candado.

### ✅ Checklist paso C

- [ ] Vercel muestra el dominio en verde, **Valid Configuration**
- [ ] El CNAME en Cloudflare está en **DNS only** (nube **gris**)
- [ ] `https://portal.wholesaleshelfcorporations.com` abre el portal y **pide el Basic Auth**
- [ ] El candado del navegador es válido (certificado emitido)

---

## PASO D — Que los enlaces del correo apunten al dominio nuevo

22. **railway.app** → servicio del BFF → **Variables**.
23. Edita `APP_BASE_URL` → **`https://portal.wholesaleshelfcorporations.com`**
    - ⚠️ **Sin barra final.** El código construye `${APP_BASE_URL}/auth/verify`; con barra
      saldría `//auth/verify` y el enlace no funcionaría.
24. Espera el redeploy.

### ✅ Checklist paso D

- [ ] Pide un magic link nuevo. El enlace del correo apunta a `portal.wholesaleshelf…`, **no** a
      `wsc-custom-portal-web.vercel.app`
- [ ] El enlace entra correctamente al portal
- [ ] La URL vieja de `.vercel.app` sigue funcionando (no se rompe nada, solo deja de usarse)

---

## PASO E — Verificación final

- [ ] Login completo desde cero **con un correo que no sea el tuyo de Resend**
- [ ] Se ven las órdenes, los pagos y los documentos
- [ ] Descarga un documento y ábrelo
- [ ] Repite **desde el móvil**, con datos móviles (no wifi) — valida DNS público y responsive
- [ ] Manda un correo normal del equipo (Gmail) y confirma que llega: **el SPF sigue sano**
- [ ] Marca el **paso 9** como `done` en `execution-roadmap.html` **y** actualiza la línea
      fechada de `CLAUDE.md` §0.5, y regenera `.cursorrules` (`cp CLAUDE.md .cursorrules`)

---

# 2ª PARTE — Separar producción de desarrollo

## El problema real, hoy

`apps/web/vercel.json` tiene la URL de Railway **escrita a fuego**:

```json
{ "source": "/api/:path*", "destination": "https://wscbff-production.up.railway.app/api/:path*" }
```

Vercel crea un **Preview Deployment** por cada rama y cada PR, automáticamente. Como la URL está
fija en el JSON, **todos esos previews hablan con el backend de producción**, que a su vez habla
con Salesforce. Es decir: hoy **cualquier rama experimental golpea los datos reales**. Eso es lo
primero que hay que cortar, antes que ninguna otra cosa de "entornos".

## Por qué no se arregla en `vercel.json`

**`vercel.json` no puede leer variables de entorno.** No existe forma de escribir
`"destination": "$BFF_ORIGIN"`. Es una limitación de Vercel, no un descuido.

La salida limpia es mover ese redirigido al **Edge Middleware**, que sí lee `process.env` — y ya
tienes uno funcionando (`apps/web/middleware.ts`, el del Basic Auth). Pasaría a hacer las dos
cosas: exigir la contraseña y decidir a qué backend hablar según el entorno.

## Plan

### 1. Railway — dos servicios

Duplicar el servicio del BFF en uno de **staging**, con variables propias:

| Variable | Producción | Staging |
| --- | --- | --- |
| `PORTAL_DATA_SOURCE` | `salesforce-jwt` | `mock` (o credenciales del sandbox) |
| `SESSION_JWT_SECRET` | uno | **otro distinto** — si se comparte, una sesión de staging vale en producción |
| `REDIS_URL` | su Redis | otro Redis (o distinto prefijo) |
| `APP_BASE_URL` | dominio propio | la URL de preview |
| `SMTP_FROM_EMAIL` | `support@…` | mismo, o `EMAIL_SENDER=console` para no mandar correo de verdad |

### 2. Vercel — variables por entorno

**Settings → Environment Variables.** Cada variable tiene tres casillas: **Production**,
**Preview**, **Development**. Se puede poner el *mismo nombre* con *distinto valor* en cada una —
ahí está toda la separación.

| Variable | Production | Preview |
| --- | --- | --- |
| `BFF_ORIGIN` | `https://wscbff-production.up.railway.app` | la URL del servicio de staging |
| `BASIC_AUTH_USER` / `_PASSWORD` | quitar en el go-live | **dejar siempre** |

### 3. Código — un cambio pequeño

Mover los dos rewrites de `/api` y `/auth` de `vercel.json` al middleware, leyendo
`process.env.BFF_ORIGIN`. Son unas 10 líneas y **está pendiente de hacer** — no está hecho.

### 4. Regla de ramas

- `main` → despliegue de **Production**
- cualquier otra rama → **Preview**, contra el backend de staging, con Basic Auth siempre puesto

## Orden recomendado

Haz **primero el DNS completo** (partes A–E) y déjalo verificado. La separación de entornos es
importante pero no bloquea a nadie; el DNS sí. Además, separar entornos con el dominio a medio
configurar mezcla dos fuentes de fallo y complica el diagnóstico si algo no funciona.
