# Checkpoint con el CEO — ~~Q1 (pipeline)~~ y ~~Q2 (Implementation Manager)~~

> ## ✅ Q2 CERRADO el 2026-07-28 — implementado (paso 7)
>
> El stakeholder definió **3 figuras**, no una, y las tres ya existen como lookups al mismo
> objeto `SEOX3_Team_Member__c`:
>
> | Figura | Lookup en `Online_Order__c` | Cuándo se ve |
> |---|---|---|
> | Sales Rep / Advisor | `Sales_Rep__c` | mientras la venta está abierta |
> | Support Manager (Lua) | `QC_Agent__c` | desde que el pago se verifica |
> | Back-End Support (Rinki) | `Back_End_Worker__c` | desde que el pago se verifica |
>
> Cada una aporta nombre, e-mail, teléfono y WhatsApp. Al cerrarse la venta el Advisor
> **desaparece** de la tarjeta y aparece una nota diciendo que la comunicación pasa a soporte.
>
> **La duda del correo genérico se resolvió sin necesidad de decisión**: el e-mail sale de
> `WSC_EMail__c` con respaldo en `Corporate_E_Mail__c` — o sea, el de la persona. El
> `QC_Agent_E_Mail__c` de la orden (fórmula `"QC@" + dominio`) **no se usa**, porque poner un
> buzón de departamento bajo el nombre de una persona engaña al cliente.
>
> **Se eliminó el nombre inventado "Lua" del código**, que hasta hoy se le mostraba a clientes
> reales en producción.

> ## ✅ Q1 CERRADO el 2026-07-28 — ya no hace falta llevarlo a la reunión
>
> El stakeholder decidió sobre la marcha y **ya está implementado** (paso 6 del roadmap).
> El mapa final vive en [`pipeline-display-map.md`](pipeline-display-map.md). Resumen:
> **4 pasos** (Unpaid → Initial Onboarding Call → Work Started → Complete), los `Cancelled`
> no se mapean, y `ON HOLD` mantiene la barra con un badge.
>
> Lo que hizo caer los "conflictos": el pipeline de WSC tiene **5 estados, no 8** — el
> describe global miente porque `Status__c` se filtra por record type. La sección de Q1 de
> abajo se conserva solo como registro de cómo se llegó ahí.
>
> **Sigue abierto: Q2.**

> Material para decidir, no para investigar. Todo lo de aquí está **verificado en vivo contra
> el org** el 2026-07-28 (describe + SOQL), no supuesto.
> Q1 desbloquea el paso 6 del roadmap · Q2 desbloquea el paso 7.
> El detalle largo del pipeline está en [`pipeline-display-map.md`](pipeline-display-map.md).

## ⚠️ Léase primero: qué NO puede responder el sandbox

El sandbox tiene **2 órdenes** (ambas de prueba, creadas por nosotros) y **1 registro de equipo**.
Sirve para saber **qué campos existen y cómo están definidos** — eso es concluyente. **No** sirve
para saber **si el equipo los llena en la operación diaria**, que es justo lo que decide Q2.

Esas dos preguntas de uso real se responden con una consulta en **producción** — 10 segundos,
solo lectura, sin tocar nada:

```sql
SELECT COUNT(Id) FROM Online_Order__c WHERE QC_Agent__c != null
SELECT COUNT(Id) FROM Online_Order__c WHERE Setup_Interview_Completed__c = true
```

Si alguien puede correrlas antes de la reunión, Q2 se resuelve prácticamente solo.

---

# Q1 — El pipeline de 6 pasos

**El problema:** pediste 6 pasos. Salesforce tiene 8 estados de pipeline (+8 fuera del happy
path). **4 de los 6 encajan bien. 2 no.**

| Paso que ve el cliente | Estados reales que lo activan | |
|---|---|---|
| 1. Unpaid | `To Verify Payment`, `Pending Balance` | ✅ |
| 2. Initial Onboarding | `Verified - Initial Contact` | ✅ |
| 3. Corp docs shipped | `Verified - Waiting to Ship`, `Shipped`, `Delivered` | ✅ |
| 4. Onboarding call | ver abajo | ⚠️ |
| 5. Credit ready setup | `Verified - Work Started` | ❌ orden invertido |
| 6. Complete, ready for funding | `Verified - Complete` | ✅ |

## 🆕 Conflicto 1 — "Onboarding call": puede que ya exista

En la sesión anterior esto figuraba como "no existe en Salesforce, hay que crear un campo".
**Eso era incompleto.** Buscando bien, el objeto ya tiene estos campos:

| Campo | Tipo | ¿Editable? |
|---|---|---|
| `Setup_Interview__c` | checkbox | sí |
| **`Setup_Interview_Completed__c`** | checkbox | **sí** |
| `Setup_Interview_sent_to_client__c` | picklist | sí |
| `WSC_Setup_Interview_Link__c` | link a un formulario Formstack de WSC | fórmula |

O sea: **el "Setup Interview" tiene toda la pinta de ser la llamada de onboarding**, y ya hay
una casilla para marcar que se completó. Si es así, no hace falta crear ningún campo nuevo.

**Preguntas concretas:**
1. ¿El "Setup Interview" **es** la llamada de onboarding, o son dos cosas distintas?
2. Si es la misma: ¿el equipo marca `Setup_Interview_Completed__c` en la práctica? *(la consulta
   de producción de arriba lo responde)*
3. Si nadie la marca hoy: ¿empezamos a marcarla, o el paso sale del portal?

**Opciones:**
- **1A** — Usar `Setup_Interview_Completed__c`. Cero cambios en Salesforce. ✅ **Recomendada si
  el equipo ya la marca.**
- **1B** — Quitar el paso → 5 pasos, todos con dato real detrás.
- **1C** — Fusionarlo con "Initial Onboarding" si en la práctica ocurren juntos.
- **1D** — Campo nuevo. Solo si el Setup Interview resulta ser otra cosa.

## Conflicto 2 — "Credit ready setup" está en orden invertido

En tu lista es el paso **5**, después de enviar los documentos. En Salesforce,
`Verified - Work Started` es el estado **4 de 8**: ocurre **antes** de `Waiting to Ship`,
`Shipped` y `Delivered`.

Esto importa más de lo que parece: si el portal pinta los pasos en un orden y la orden los va
encendiendo en otro, el cliente ve un paso posterior encendido y uno anterior apagado. El
tracker se ve roto y se pierde confianza.

**Preguntas concretas:**
1. En la operación real, ¿el setup de credit-ready va **antes** o **después** de enviar los docs?
2. Si va antes (como dice Salesforce): ¿reordenamos la lista para que refleje la verdad?
3. Si va después (como dice tu lista): entonces `Verified - Work Started` significa otra cosa —
   ¿qué estado representa de verdad el setup de credit-ready?

## Decisión de fondo

| | Qué implica | Riesgo |
|---|---|---|
| **(a) Solo display** — el portal agrupa y renombra, Salesforce intacto | ✅ **Recomendada** | Bajo, cero impacto en la operación |
| (b) Cambiar el picklist real de `Status__c` | ❌ Evitar | **Alto** — hay 126 reglas de validación y triggers de Apex colgando de los valores actuales |
| (c) Display + una casilla ya existente para la llamada | 👍 Buena | Bajo |

**Estados excepcionales** (`Cancelled - *`, `ON HOLD - *`): propuesta es mostrarlos como un
aviso **encima** de la barra, no como un paso. Un `ON HOLD` no es avanzar, es una desviación.

---

# Q2 — ¿Quién es el Implementation Manager y de dónde salen sus datos?

Hoy el portal muestra un mock: **"Lua", sin teléfono**, con una nota de "pendiente de
confirmar". Deliberadamente no le inventamos un número, porque lo van a ver clientes reales.

## Lo que confirmé del esquema (esto sí es concluyente)

`QC_Agent__c` **es un lookup a `SEOX3_Team_Member__c`** — el mismo objeto que usa
`Sales_Rep__c` para el asesor de ventas. Es la forma correcta para representar a una persona,
así que el candidato es sólido.

Y ya hay campos que traen los datos solos:

| Campo en la orden | Cómo se llena | Qué sirve para el portal |
|---|---|---|
| `QC_Agent_Name__c` | fórmula → `QC_Agent__r.Name` | ✅ nombre, automático |
| `QC_Agent_Telephone__c` | fórmula → `QC_Agent__r.Corporate_Phone__c` | ✅ teléfono, automático |
| `QC_Agent_E_Mail__c` | fórmula → `"QC@" + Brand_Domain_Name__c` | ⚠️ **ojo, ver abajo** |

### ⚠️ El hallazgo que hay que decidir: ese email NO es de una persona

Pese al nombre del campo, `QC_Agent_E_Mail__c` **no** es el correo del agente. La fórmula
construye una dirección genérica de departamento a partir de la marca:

```
"QC@" + Brand_Domain_Name__c   →   QC@WholesaleShelfCorporations.com
```

Es un buzón compartido, no el de una persona. **Mostrarlo bajo la foto y el nombre de "tu
Implementation Manager" haría creer al cliente que le escribe a esa persona, cuando en realidad
va a una bandeja de equipo.** Hay que decidir si eso está bien o no.

**Alternativa:** el objeto `SEOX3_Team_Member__c` tiene campos por marca —
`WSC_EMail__c`, `WSC_Customer_Care_Phone__c` — que para un portal de WSC probablemente sean los
correctos. También existe **`Public_Title__c`** (distinto del `Title__c` interno), que sugiere
que alguien ya pensó en un título apto para mostrarle al cliente.

**Preguntas concretas:**
1. ¿`QC_Agent__c` **es** el Implementation Manager / Support Rep post-venta, o el QC Agent es
   otro rol y el IM se asigna en otro lado?
2. ¿Se asigna en la práctica? *(la consulta de producción de arriba lo responde)*
3. Para el contacto que ve el cliente, ¿qué mostramos?
   - **2A** — el buzón genérico `QC@wholesaleshelfcorporations.com` (siempre existe, nunca falla,
     pero es impersonal)
   - **2B** — `WSC_EMail__c` de la persona (personal y correcto, pero **está vacío** en el único
     registro del sandbox — hay que confirmar si en producción se llena)
   - **2C** — nombre y teléfono de la persona + el buzón genérico para escribir. 👍 **Mi
     recomendación**: el cliente sabe con quién habla y el correo llega a un buzón que alguien
     vigila aunque esa persona esté de vacaciones.
4. ¿Usamos `Public_Title__c` como el cargo que ve el cliente? Hoy está vacío; si se quiere usar,
   alguien tiene que llenarlo.
5. ¿Foto? Existe `Photo_ID__c` pero es un número de identificación, **no** una imagen. Si quieres
   foto en la tarjeta, hoy no hay de dónde sacarla.

## Lo que implemento en cuanto respondas

Cambiar el mock de `StaffCard.tsx` por datos reales: añadir los campos al SOQL, abrir su FLS en
el Permission Set del usuario de integración, y mapearlos. **Es trabajo chico** — la tarjeta ya
existe y ya sabe cambiar de asesor de ventas a Implementation Manager según el estado de pago
(`isPostPaymentStage`). Solo cambia de dónde salen los datos.

---

## Resumen de lo que hay que salir decidiendo

| # | Decisión | Opción recomendada |
|---|---|---|
| Q1.1 | ¿El "Setup Interview" es la llamada de onboarding? | — |
| Q1.2 | Si no se marca hoy: ¿empezamos, o quitamos el paso? | 1A si ya se marca |
| Q1.3 | ¿Credit-ready va antes o después del envío? | seguir la verdad operativa |
| Q1.4 | ¿Solo display o tocar el picklist? | **(a) solo display** |
| Q2.1 | ¿`QC_Agent__c` es el Implementation Manager? | — |
| Q2.2 | ¿Qué correo ve el cliente? | **2C** nombre + teléfono personales, correo al buzón |
| Q2.3 | ¿Usamos `Public_Title__c`? (hay que llenarlo) | — |
