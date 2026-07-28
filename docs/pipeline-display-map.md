# Mapa de display del pipeline — material para la conversación con el CEO

> **Estado: PROPUESTA, no implementado.** Verificado en vivo contra el sandbox el
> 2026-07-24 (`Online_Order__c.Status__c`, 16 valores activos).
> Corresponde al paso 6 de [`execution-roadmap.html`](execution-roadmap.html) y a la
> pregunta **Q1** del checkpoint.

## El problema en una frase

El CEO pidió un pipeline de **6 pasos**. Salesforce tiene **8 estados de pipeline** (más 8
estados fuera del happy path). No mapean 1:1: **4 de los 6 encajan bien, 1 no existe en
Salesforce, y 1 está en orden invertido** respecto a lo que hace la automatización real.

---

## Lo que existe hoy en Salesforce (verificado, no supuesto)

**Pipeline progresivo — 8 estados, en este orden:**

| # | `Status__c` real |
|---|---|
| 1 | `To Verify Payment` *(valor por defecto)* |
| 2 | `Pending Balance` |
| 3 | `Verified - Initial Contact` |
| 4 | `Verified - Work Started` |
| 5 | `Verified - Waiting to Ship` |
| 6 | `Verified - Shipped` |
| 7 | `Verified - Delivered` |
| 8 | `Verified - Complete` |

**Fuera del happy path — 8 estados más que la lista del CEO no contempla:**

`Cancelled - Payment Failed` · `Cancelled - Client Requested` · `Cancelled - Duplicate Order` ·
`Cancelled - Chargeback Received` · `Cancelled - Refunded` · `ON HOLD - Client's Unresponsive` ·
`ON HOLD - Other Reasons` · `ON HOLD - Waiting for Client`

---

## Propuesta de mapa (opción recomendada: solo display)

El portal agrupa los estados reales bajo los 6 nombres del CEO. **Salesforce no se toca.**

| Paso que ve el cliente | Estados reales que lo activan | ¿Limpio? |
|---|---|---|
| **1. Unpaid** | `To Verify Payment`, `Pending Balance` | ✅ |
| **2. Initial Onboarding** | `Verified - Initial Contact` | ✅ |
| **3. Corp docs shipped** | `Verified - Waiting to Ship`, `Verified - Shipped`, `Verified - Delivered` | ✅ |
| **4. Onboarding call** | — **nada** — | ❌ **no existe** |
| **5. Credit ready setup** | `Verified - Work Started` | ⚠️ **orden invertido** |
| **6. Complete, ready for funding** | `Verified - Complete` | ✅ |

**Estados excepcionales:** propuesta = mostrarlos como un aviso/badge **encima** de la barra
de progreso, no como pasos. Un `Cancelled - *` o `ON HOLD - *` no es "avanzar", es una
desviación — meterlo como paso rompería la lectura de progreso.

---

## Los 2 conflictos que el CEO tiene que decidir

### ❌ Conflicto 1 — "Onboarding call" no existe en Salesforce

No hay ningún `Status__c`, ni campo de fecha, ni objeto que registre que esa llamada ocurrió.
El portal no puede mostrar un paso del que no hay dato: quedaría siempre apagado, o habría
que inventarlo (y eso es exactamente lo que no hacemos).

**Preguntas para el CEO:**
- ¿La llamada de onboarding se registra hoy en algún lado del CRM? (¿tarea, evento, campo,
  nota del rep?)
- Si no se registra: ¿se quiere empezar a registrarla, o el paso se elimina del portal?

**Opciones:**
- **1A.** Quitar el paso → quedan 5 pasos, todos con dato real detrás.
- **1B.** Agregar un campo nuevo en Salesforce (ej. `Onboarding_Call_Date__c`) que el equipo
  llene → el paso se enciende con dato real. Es un cambio chico y de bajo riesgo (campo nuevo,
  no toca el picklist).
- **1C.** Fusionarlo con "Initial Onboarding" si en la práctica son el mismo momento.

### ⚠️ Conflicto 2 — "Credit ready setup" está en orden invertido

En la secuencia del CEO, *Credit ready setup* es el **paso 5**, después de que se envían los
documentos. En Salesforce, `Verified - Work Started` es el **estado 4 de 8**, es decir, ocurre
**antes** de `Waiting to Ship` / `Shipped` / `Delivered`.

O sea: el CEO describe el setup de credit-ready como algo posterior al envío; la automatización
real de Salesforce lo trata como anterior.

**Preguntas para el CEO:**
- En la operación real, ¿el setup de credit-ready se hace antes o después de enviar los docs?
- Si es antes (como dice Salesforce): ¿se reordena la lista para que el cliente vea la
  secuencia verdadera?
- Si es después (como dice la lista): entonces `Verified - Work Started` significa **otra cosa**
  y hay que averiguar qué estado representa realmente el setup de credit-ready.

> Esto importa más de lo que parece: si mostramos los pasos en un orden y la orden del cliente
> los va encendiendo en otro, el tracker se ve roto (un paso posterior encendido y uno anterior
> apagado). Es el tipo de detalle que hace que un cliente pierda confianza en el portal.

---

## Las 3 opciones de fondo

| | Qué implica | Riesgo | Recomendación |
|---|---|---|---|
| **(a) Solo display** | El portal agrupa y renombra; Salesforce intacto. | **Bajo.** Cero impacto en la operación. | ✅ **Recomendada** |
| **(b) Cambiar el picklist real** | Nuevos valores de `Status__c` en Salesforce. | **Alto.** `Online_Order__c` tiene **126 reglas de validación** + triggers de Apex que dependen de los valores actuales. Un cambio ahí puede romper la operación diaria del equipo de ventas. | ❌ Evitar |
| **(c) Híbrido** | Display mapping + **un** campo nuevo para la llamada de onboarding (opción 1B). | **Bajo-medio.** Un campo nuevo no rompe reglas existentes. | 👍 Buena si el CEO quiere los 6 pasos completos |

---

## Qué se implementa cuando el CEO responda

Una tabla de mapeo en `packages/shared` (junto al `ORDER_PIPELINE` actual), siguiendo la regla
del proyecto de que **los labels son data, nunca strings hardcodeados en los componentes**
(CLAUDE.md §1). Es un cambio de solo lectura: agrupa y renombra a la hora de mostrar, y no
escribe nada en Salesforce.

Trabajo estimado una vez decidido: chico — la barra de progreso (`OrderTracker`) ya deriva todo
del pipeline compartido, así que cambia el mapa y la UI se acomoda sola.
