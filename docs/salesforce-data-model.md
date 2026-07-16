# WSC Portal — Modelo de datos REAL en Salesforce (descubierto en el sandbox)

> Descubierto el 2026-07-15 leyendo el sandbox `wsc-sandbox` (org "Shared Virtual Office",
> Unlimited Edition). **Hallazgo mayor:** el org **ya tiene** los objetos del dominio — es un
> CRM multi-marca donde WSC es una marca (`Brand__c = 'WSC'`). **No hay que crear
> `Shelf_Corp__c`/`Payment__c`** (ROADMAP 1.1); se **mapea a lo existente**. Esto reemplaza la
> suposición del roadmap. Todos los objetos están vacíos de datos (sandbox Developer = solo
> metadata), así que para el demo se siembran registros o se usan datos de ejemplo con la forma
> real.

## Grafo real (verificado por `referenceTo`)

```
FU_User__c (CLIENTE) ──< Client__c >── Online_Order__c ──< Corp__c >── SC_Corp__c (PRODUCTO)
                                            │
                                            ├─< Sales_Rep__c >── SEOX3_Team_Member__c (ADVISOR)
                                            │
                                            └──< Online_Order__c >── Online_Payment__c (PAGOS)
```

Identidad del cliente (magic-link): resolver **`email → FU_User__c.E_Mail__c`** y filtrar todo
por ese `Client__c` (autorización por fila — CLAUDE.md §Security). Ojo: `FU_User__c` tiene
`Email_Encrypted__c` / `Phone_Encrypted__c` → la PII ya está cifrada en el org (buena señal).

> **Objetos "gordos":** `Online_Order__c` = 698 campos, `FU_User__c` = 331, `SC_Corp__c` = 115.
> El portal expone un **DTO delgado** por objeto; el adaptador Salesforce (detrás del puerto
> `Repository`) hace el mapeo y **nunca** filtra los nombres crudos de SF al browser.

## DTO `Order` ← `Online_Order__c`  (filtrar `WHERE Brand__c = 'WSC'`)

| DTO portal | Campo real SF | Tipo |
|---|---|---|
| `id` | `Id` | id |
| `orderNumber` | `Name` (autonumber) | string |
| `amount` | `Amount__c` | currency |
| `paidToDate` | `Total_Payments__c` | currency |
| `balanceDue` | `Amount__c − Total_Payments__c` (derivado) | currency |
| `stage` | `Status__c` | picklist ↓ |
| `placedAt` | `Order_Date__c` | date |
| `advisor` | `Sales_Rep__c` → `SEOX3_Team_Member__c` · `SR_Name__c` | ref/string |
| `shelfCorpId` | `Corp__c` → `SC_Corp__c` · `Corp_Name__c` | ref/string |
| `clientId` | `Client__c` → `FU_User__c` | ref |
| `paymentMethod` | `Payment_Method__c` (`Credit Card`/`Wire Transfer`) | picklist |
| features | `Paid_Features_Selected__c` | textarea |
| envío | `Shipping_Method__c` (`UPS`/`DHL`/`Fedex`), `Shipping_Tracking_Link__c` | picklist/url |

## Pipeline de estado — `Online_Order__c.Status__c` (valores REALES)

| # | Valor real SF | Label portal (progreso) |
|---|---|---|
| 1 | `To Verify Payment` | To Verify Payment |
| 2 | `Pending Balance` | Pending Balance |
| 3 | `Verified - Initial Contact` | Initial Contact |
| 4 | `Verified - Work Started` | Work Started |
| 5 | `Verified - Waiting to Ship` | Waiting to Ship |
| 6 | `Verified - Shipped` | Shipped |
| 7 | `Verified - Delivered` | Delivered |
| 8 | `Verified - Complete` | Complete |

**Estados terminales (fuera de la barra de progreso):**
`Cancelled - (Payment Failed | Client Requested | Duplicate Order | Chargeback Received | Refunded)`
· `ON HOLD - (Client's Unresponsive | Other Reasons | Waiting for Client)`

> Coincide con el pipeline del prototipo/ROADMAP, pero los valores reales llevan prefijo
> `Verified - ` en las etapas 3-8. **Hay que ajustar `packages/shared/ORDER_STAGES`** a estos
> valores exactos.

## DTO `Payment` ← `Online_Payment__c`  (`WHERE Online_Order__c = :orderId`)

| DTO portal | Campo real SF | Tipo |
|---|---|---|
| `id` | `Id` | id |
| `orderId` | `Online_Order__c` | ref |
| `amount` | `Amount__c` | currency |
| `method` | `Payment_Method__c` (`Wire Transfer`/`Credit Card`/`ACH`/`PayPal`/`BTC`…) | picklist |
| `status` | `Status__c` | picklist ↓ |
| `statusDate` | `Status_Date__c` | datetime |

Ciclo real de pago: `To Charge → Charged → Temp Hold → Held in Reserves → Cleared → Paid`
(+ `Failed - Contact Client`, `Refunded`, `Chargeback *`, `Cancelled`…). Para el portal, un pago
cuenta como **verificado** cuando `Status__c ∈ { Cleared, Paid }`.

## DTO `ShelfCorp` ← `SC_Corp__c`

| DTO portal | Campo real SF |
|---|---|
| `entityType` | `Type__c` (picklist) |
| `stateOfFormation` | `Jurisdiction__c` |
| `incorporationDate` / `agedYears` | `Incorporation_Date__c` / `Age__c` |
| `status` | `Status__c` (Available/Reserved/Sold-like) |
| `price` | `Client_Price__c` |
| `duns` | `DUNS__c` · `Experian_BIN__c` · `Equifax_Business_ID__c` |
| `creditScore` | `Credit_Score__c` · `Funding_Capacity__c` |

## DTO `Client` ← `FU_User__c`  (identidad del portal)

| DTO portal | Campo real SF |
|---|---|
| `id` | `Id` |
| `email` | `E_Mail__c` (clave del magic-link; `Email_Encrypted__c` cifrado) |
| `name` | `Name` |
| `phone` | `Phone__c` / `Cell_Phone__c` |
| `businessName` | `Legal_Name_of_Business__c` / `Trade_Name__c` |
| `status` | `Status__c` |

## Impacto en el roadmap

- **ROADMAP 1.1** cambia de "crear objetos" a **"mapear a objetos existentes"** (+ agregar solo
  los campos de portal que falten). Menos trabajo, más riesgo de scope → coordinar con el admin.
- El **integration user / permission set (1.5)** debe dar acceso de solo-lectura a:
  `FU_User__c`, `Online_Order__c`, `Online_Payment__c`, `SC_Corp__c`, `SEOX3_Team_Member__c`
  — filtrado a `Brand__c='WSC'` donde aplique. Mínimo privilegio sobre un CRM compartido enorme
  es **crítico** (no debe ver otras marcas).
- `packages/shared` se actualiza a estos valores/enums reales (pipeline, métodos y estados de pago).
