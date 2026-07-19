# Salesforce — Provisión de sandbox + JWT Bearer (runbook por rol)

> **Alcance:** prepara el plano **servidor↔Salesforce** (OAuth 2.0 JWT Bearer) sobre un
> org de desarrollo. NO cubre la identidad del cliente (magic-link / Auth0) — esa es una
> **decisión abierta** (ver `docs/adr/0001` y `docs/adr/README.md`) y NO se toca aquí.
> Complementa `sfdx/README.md` (quickstart de CLI). Referencias: ROADMAP 0.6, 1.4–1.6;
> docs/ARCHITECTURE.md §3.1, §5.2.

> ✅ **Status (2026-07-19):** sandbox `wsc-sandbox` conectado; el BFF ya lee la org en dev
> reusando la sesión del CLI (`@salesforce/core`, sin Connected App). ⛔ **Crear una Connected App
> clásica sigue BLOQUEADO por la org**, pero ✅ **el flujo JWT Bearer ya se probó y funciona vía una
> External Client App** — ver el paso a paso real en **§1.B-bis** (reemplaza §1.B en este sandbox).
> Smoke test exitoso: `sf org login jwt` → alias `wsc-jwt`, estado `Connected`. Pendiente: el código
> del BFF (§1.6 ROADMAP) y el integration user de mínimo privilegio (§1.C, hoy se probó con el
> admin). Estado completo y plan: [`STATUS.md`](STATUS.md).

## 0. Decisión previa (la tomas tú antes de pedir nada)

Hay dos formas de tener un org de dev, y conviene usar **ambas**:

| | Scratch org | Developer sandbox |
|---|---|---|
| Qué es | Org efímera (≤30 días), source-driven, se crea/destruye por CLI | Copia de metadata de producción, persistente |
| Requiere | **Dev Hub** habilitado + allocation de scratch orgs | Un **org de producción** con licencias de sandbox libres |
| Datos | Vacía (los siembras tú) | Metadata de prod, sin datos (Developer) |
| Connected App JWT | Hay que recrearla en cada org (se despliega como metadata) | **Estable** — se crea una vez |
| Ideal para | Dev local + **CI** (crear→deploy→test→borrar) | **Staging** compartido / integración estable |
| Coste | Barato, dentro del límite del Dev Hub | Consume 1 slot de sandbox |

**Recomendación:** `scratch org` para dev individual y CI (ya tienes
`sfdx/config/project-scratch-def.json`), y **un Developer (o Developer Pro) sandbox** como
entorno `dev/staging` estable donde vivan la Connected App + el integration user. Esto
calza con el modelo `local → staging → prod` de ARCHITECTURE.md §5.2 (cada entorno con su
**propia** Connected App + integration user + par de llaves).

> **Punto a confirmar contigo:** ¿WSC ya tiene un org de **producción** de Salesforce? (Casi
> seguro sí, porque SF es la SSOT.) Si sí → sandbox desde prod. Si es solo un Developer
> Edition → ese es tu Dev Hub y usas scratch orgs. El resto del runbook es igual.

---

## 1. LO QUE LE PIDES AL ADMIN (necesita permisos de producción)

Mándale este bloque tal cual. Todo esto requiere rol de admin en el org de prod.

### A. Provisionar el org
- [ ] **Sandbox:** Setup → **Sandboxes** → *New Sandbox* → tipo **Developer** (o Developer
      Pro si necesitas más storage), nombre p. ej. `wscdev`. Devolverte la **URL de login**
      del sandbox (`https://<midominio>--wscdev.sandbox.my.salesforce.com`) y el **Org ID**.
- [ ] **(o) Scratch:** habilitar **Dev Hub** (Setup → *Dev Hub* → Enable) y confirmar cuántas
      scratch orgs activas/diarias hay disponibles. Autorizarte el Dev Hub o darte acceso.
- [ ] Confirmar que **My Domain** está desplegado (obligatorio para Connected App + JWT).
- [ ] Crearte un **usuario** en el sandbox con perfil **System Administrator** (para dev), o
      SSO, para que puedas desplegar/retrieve metadata.

### B. Connected App para JWT Bearer (esto es lo central)
- [ ] Crear una **Connected App** (Setup → App Manager → New Connected App):
      - *Enable OAuth Settings* = ON; Callback URL = `http://localhost:1717/OauthRedirect`
        (campo obligatorio aunque JWT no lo use).
      - **Use digital signatures** = ON → subir el **certificado público** (`server.crt`)
        que tú le entregas (ver §2).
      - OAuth Scopes: **`api`**, **`refresh_token, offline_access`** (aunque no uses refresh).
- [ ] En la Connected App → *Manage* → **Policies**:
      - **Permitted Users = *Admin approved users are pre-authorized***. (Sin esto, el JWT
        falla con `user hasn't approved this consumer`.)
      - **IP Relaxation = *Relax IP restrictions*** (el servidor no tiene IP de login fija).
- [ ] **Pre-autorizar** al integration user: asignar la Connected App al **Permission Set**
      (recomendado) o al perfil del integration user.
- [ ] Devolverte el **Consumer Key** (= `SF_CLIENT_ID`). El Consumer Secret no se usa en JWT.

> ⚠️ La Connected App puede tardar **2–10 min** en propagar; el primer `login jwt` puede
> fallar de forma transitoria — reintentar.

### B-bis. Lo que REALMENTE funcionó en este sandbox: External Client App

Este sandbox bloquea Connected Apps clásicas (`Setup → App Manager → New Connected App` no
aparece), pero **sí permite External Client Apps** — cubren el mismo flujo JWT Bearer. Pasos
reales verificados el 2026-07-19:

1. **Setup → Quick Find → "External Client Apps" → New External Client App.**
2. **Basic Information**: Name (p. ej. `WSC Customer - Devin Sandbox`), Contact Email,
   Distribution State = **Local** → **Create**.
3. Dentro de la app ya creada → **Settings → OAuth Settings → Edit**: Enable OAuth = ON,
   Callback URL = `http://localhost:1717/OauthRedirect`, Selected OAuth Scopes = `api` +
   `refresh_token, offline_access` → **Save**.
4. **Settings → Flow Enablement**: marcar **"Enable JWT Bearer Flow"** → aparece el campo
   para subir el **certificado** (`server.crt`, el público del par de `sfdx/README.md` §2) → guardar.
5. **Policies → OAuth Policies → Plugin Policies → Permitted Users**: cambiar de *"All users
   can self-authorize"* a **"Admin approved users are pre-authorized"**.
6. **Policies → App Authorization → IP Relaxation** = **"Relax IP restrictions"**.
7. **Policies → App Policies → Select Permission Sets**: agregar un Permission Set dedicado
   (creado aparte en `Setup → Permission Sets → New`, License = `--None--`) a "Selected
   Permission Sets" → **Save**. *(Ojo: "Assigned Connected Apps" dentro del Permission Set es
   para visibilidad en el App Launcher, **no** para esta pre-autorización — es un campo distinto.)*
8. En ese mismo Permission Set → **Manage Assignments → Add Assignment** → asignarlo al
   usuario que va a autenticarse (el integration user real cuando exista, G3; el admin
   mientras tanto para la prueba).
9. **Settings → OAuth Settings → Consumer Key and Secret → View** → copiar el **Consumer Key**
   (= `SF_CLIENT_ID`). El secret no se usa en JWT.
10. **Smoke test** (igual que en §3 de este doc, mismo comando):
    ```bash
    sf org login jwt --username "<username>" --jwt-key-file server.key \
      --client-id "<CONSUMER_KEY>" --instance-url https://test.salesforce.com --alias wsc-jwt
    sf org list   # confirma alias wsc-jwt en estado "Connected" (no imprime el token)
    ```

### C. Integration user con **mínimo privilegio** (crítico, D4)
- [ ] Crear un **integration user dedicado** (NO un usuario humano, NO Community/Chatter).
      Preferir la **licencia *Salesforce Integration*** (API-only, headless; hay ~5 gratis en
      Enterprise/Unlimited). Si no está disponible, una licencia Salesforce completa marcada
      **API Only** también sirve. Ej. `svc-portal-bff@wsc…`.
- [ ] Crear un **Permission Set** que otorgue SOLO:
      - CRUD + FLS de los objetos del portal: `Shelf_Corp__c`, `Payment__c`, `Document__c`,
        `Credit_Profile__c`, `Portal_Event__c`, y **read** sobre `Account`, `Contact`,
        `Opportunity`, `Case` (los campos que el portal expone).
      - System perms: **API Enabled** (y **Apex REST Services** si en Fase 2 exponen el
        endpoint Apex de reserva).
      - Asignarlo al integration user **y** a la Connected App.
- [ ] **Modelo de sharing:** que el integration user pueda VER los registros que debe servir
      (via role hierarchy / sharing rules / “View All” del objeto). **Evitar “Modify All
      Data”/“View All Data”** — preferimos scoping explícito. La autorización por fila
      (Contact.Id) la aplica el BFF encima, pero el usuario no debe poder leer fuera del
      portal.
- [ ] **Verificación de mínimo privilegio (DoD 1.5):** confirmar que una query fuera de
      alcance **falla** (ver §3, paso 5).

### D. Eventos / plataforma (para realtime y caché — Fase 2)
- [ ] Habilitar **Change Data Capture** (Setup → *Change Data Capture*) para
      `Shelf_Corp__c` y `Opportunity` (invalidación de caché por evento).
- [ ] Confirmar **Platform Events** disponibles y el endpoint **Pub/Sub API**
      (`api.pubsub.salesforce.com:7443`).
- [ ] Indicar la **API version** objetivo (p. ej. `v62.0`) y el **límite de API diario** del
      edition (para el diseño de caché / load test de Fase 5).

### E. Datos que te tiene que devolver
- [ ] `SF_LOGIN_URL` → **`https://test.salesforce.com`** para sandbox · `login.salesforce.com`
      para prod. *(Error típico: usar `login` en un sandbox → `invalid_grant`.)*
- [ ] `SF_CLIENT_ID` (Consumer Key) · `SF_INTEGRATION_USERNAME` (usuario del integration user)
- [ ] URL de My Domain / login del sandbox · Org ID · nombre del sandbox
- [ ] Confirmación de que la Connected App está **pre-autorizada** para el integration user.

---

## 2. LO QUE HACES TÚ (no requiere admin de prod)

- [ ] **Instalar tooling:** Salesforce CLI `sf` v2 (`sf --version`), **OpenSSL**, Node (ya
      lo tienes). Autorizar el org cuando el admin te dé acceso (`sf org login web`).
- [ ] **Generar el par X.509 tú mismo** (así la llave privada nunca sale de tu control):
      ```bash
      openssl genrsa -out server.key 2048
      openssl req -new -x509 -key server.key -out server.crt -days 365 -subj "/CN=wsc-portal-bff"
      ```
      - Entregas **`server.crt`** (público) al admin para la Connected App (§1.B).
      - Metes **`server.key`** (privado) en el **secrets manager** como `SF_JWT_PRIVATE_KEY`.
        **NUNCA lo commitees.** Rotación ~90 días (SF admite múltiples certs → rotación sin
        downtime).
- [ ] **Guardar los secretos** que te devuelve el admin en el secrets manager, con los
      **mismos nombres** de `.env.example` (`SF_LOGIN_URL`, `SF_CLIENT_ID`,
      `SF_INTEGRATION_USERNAME`, `SF_JWT_PRIVATE_KEY`, `SF_API_VERSION`, `SF_PUBSUB_ENDPOINT`).
      Solo los **nombres** van a git; los valores, jamás.
- [ ] **Higiene:** NO metas PII real de clientes en un Developer sandbox. NO crees todavía el
      IdP de clientes (decisión abierta). Define quién tiene el admin “break-glass” y el
      calendario de rotación de llaves.

---

## 3. Smoke-test del handshake JWT (lo corres tú, sin código del BFF)

Esto prueba que Connected App + integration user + llave están bien alineados. Es
**exactamente** el handshake que el BFF automatiza en Fase 1 (1.6) — si funciona aquí,
la config es correcta.

```bash
# 1) (scratch) crear org desde el proyecto committeado
sf org login web --set-default-dev-hub --alias WSC-DevHub          # una vez
sf org create scratch --definition-file sfdx/config/project-scratch-def.json \
     --alias wsc-dev --duration-days 7 --set-default

# 2) Probar el JWT Bearer contra el sandbox/scratch
sf org login jwt \
     --username "<SF_INTEGRATION_USERNAME>" \
     --jwt-key-file server.key \
     --client-id "<SF_CLIENT_ID>" \
     --instance-url https://test.salesforce.com \
     --alias wsc-jwt
sf org display --target-org wsc-jwt        # debe mostrar un Access Token  ✅

# 3) Una lectura dentro de alcance debe funcionar
sf data query --query "SELECT Id, StageName FROM Opportunity LIMIT 1" --target-org wsc-jwt

# 4) Verificación de MÍNIMO PRIVILEGIO (DoD 1.5): fuera de alcance debe FALLAR
sf data query --query "SELECT Id FROM User LIMIT 1" --target-org wsc-jwt   # se espera error de permisos
```

Si el paso 2 falla:
- `user hasn't approved this consumer` → falta pre-autorizar (Permitted Users / permset).
- `invalid_grant` → `instance-url`/`SF_LOGIN_URL` equivocado (test vs login), o el cert
  subido no corresponde a `server.key`, o aún no propagó (esperar unos minutos).
- `inactive user / user is locked out` → el integration user no está activo o sin API Enabled.

---

## 4. Qué NO es parte de esto (para no confundir alcances)
- Identidad del cliente (magic-link / Auth0/Cognito) → **ADR pendiente**, Fase 1 posterior.
- Creación de objetos/campos `Shelf_Corp__c` etc. → ROADMAP 1.1–1.3 (después de tener el org).
- Código del JWT flow en el BFF, caché Redis, S3, Stripe → Fases 1–3. Aquí solo dejamos el
  **org + Connected App + integration user** listos y verificados a mano.
```
