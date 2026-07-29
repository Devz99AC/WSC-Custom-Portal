# Mapa de display del pipeline

> **Estado: DECIDIDO E IMPLEMENTADO** el 2026-07-28 (paso 6 del roadmap).
> Vive en `packages/shared/src/domain/order-stage.ts` — los labels son data, nunca strings
> en los componentes (CLAUDE.md §1). Salesforce **no se toca**: es solo display.

## ⚠️ La corrección que lo cambió todo: `Status__c` se filtra por record type

La versión anterior de este documento estaba **mal**. Se construyó sobre el describe global
del campo, que devuelve **16 valores**. Pero las órdenes WSC usan el record type **WSC**
(`0120g000000QEpmAAG`), que solo expone **12** — una orden WSC **nunca** puede estar en
`Verified - Waiting to Ship`, `Verified - Shipped`, `Verified - Delivered` ni
`ON HOLD - Waiting for Client`. Esos pertenecen a otras marcas del CRM.

Se modelaron tres etapas de envío que no pueden ocurrir, y de ahí salieron dos "conflictos"
que en realidad no existían.

**Cómo leerlo bien** (UI API, no el describe):

```
GET /services/data/v62.0/ui-api/object-info/Online_Order__c/picklist-values/0120g000000QEpmAAG/Status__c
```

> **Segunda trampa: value ≠ label.** Ese endpoint devuelve ambos y **difieren** en un caso:
> la pantalla muestra `ON HOLD - Client Unresponsive`, pero el valor almacenado es
> `ON HOLD - Client's Unresponsive`, con apóstrofo. El código compara contra el **value**;
> copiar lo que se ve en pantalla habría producido una comparación que nunca hace match.

## El pipeline real de WSC — 5 estados

```
To Verify Payment → Pending Balance → Verified - Initial Contact
                 → Verified - Work Started → Verified - Complete
```

Más 5 `Cancelled - *` y 2 `ON HOLD - *`.

---

## El mapa implementado — 4 pasos

| # | Lo que ve el cliente | Estados que lo encienden |
|---|---|---|
| 1 | **Unpaid** | `To Verify Payment` · `Pending Balance` |
| 2 | **Initial Onboarding Call** | `Verified - Initial Contact` |
| 3 | **Work Started** | `Verified - Work Started` |
| 4 | **Complete — ready for funding** | `Verified - Complete` |

### Por qué 4 y no 6 (decisiones del stakeholder, 2026-07-28)

- **"Onboarding call" se eliminó por duplicado.** El paso 2 **es** la llamada de onboarding.
- **"Corp docs shipped" se eliminó como paso propio.** El envío ocurre el mismo día dentro de
  `Verified - Work Started` — una orden que entra un viernes a las 10am está lista a las 2pm.
  Un paso separado quedaría siempre encendido o siempre apagado, sin informar nada. Esto
  además disolvió el conflicto de orden: ya no hay nada que parezca ocurrir después del envío.

### Estados excepcionales

| Estado | Qué ve el cliente |
|---|---|
| `Cancelled - *` | **Sin barra de progreso.** Solo un aviso: "This order was cancelled". Una barra a medias en gris se lee como "en proceso" y engaña. El badge dice solo **"Cancelled"** — los motivos reales (`Chargeback Received`, `Duplicate Order`…) son contabilidad interna, suenan acusatorios y el cliente no puede accionarlos. |
| `ON HOLD - *` | **Barra + badge "On hold"** + el texto de `On_Hold_Reason__c`. |

### El detalle no obvio de ON HOLD

`Status__c` es un solo campo: al pasar a `ON HOLD - *` **se sobrescribe la etapa en la que
estaba** la orden. La barra se quedaría sin nada a qué apuntar.

En vez de adivinar, el progreso se re-deriva de los timestamps que Salesforce ya estampa:

| Campo | Prueba que se alcanzó |
|---|---|
| `TimeStamp_Verified_Complete__c` | paso 4 |
| `TimeStamp_Verified_IC__c` | paso 2 |
| *(nada)* | paso 1 |

`Verified - Work Started` **no tiene timestamp propio**, así que una orden pausada que había
llegado ahí se muestra en el paso 2 — subestima el progreso, que es el lado seguro del error.

---

## Lo que NO se hizo, y por qué

**No se tocó el picklist real de `Status__c`.** `Online_Order__c` tiene **126 reglas de
validación** y triggers de Apex colgando de los valores actuales; cambiarlos puede romper la
operación diaria del equipo de ventas. El portal agrupa y renombra al mostrar, y no escribe
nada.

## Recordatorio operativo

Los 3 campos nuevos (`On_Hold_Reason__c`, `TimeStamp_Verified_IC__c`,
`TimeStamp_Verified_Complete__c`) exigieron abrir **FLS de lectura** en el Permission Set
`WSC Portal - Read Only`. Verificar siempre con `-o wsc-integration`, **no** con el admin:
el admin ve todos los campos y da falsos positivos. Ese error tumbó producción el 2026-07-28.
