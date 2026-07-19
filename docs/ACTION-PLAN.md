# WSC Customer Portal — Action Plan (actualizado 2026-07-19, post-merge a `main`)

> Para el historial completo (qué se descubrió, qué falló, por qué) ver
> [`STATUS.md`](STATUS.md). Este doc es el checklist accionable, **priorizado por
> qué se puede hacer AHORA sin depender de Salesforce ni de acceso de admin**, que es
> justo lo que pediste.

## Estado

- ✅ Todo mergeado a **`main`** (fast-forward limpio, sin conflictos) y pusheado a origin.
  `main` ya tiene: Fase 0 completa, demo con datos reales de Salesforce, JWT Bearer
  real implementado en el BFF, mockup rediseñado y sincronizado con la orden real
  `UO1423102`.
- La rama `phase-0-foundations` sigue existiendo en el mismo commit — puedes seguir
  trabajando directo en `main` o abrir una rama nueva para el próximo bloque.

---

## 🟢 Grupo A — Se puede hacer YA, cero dependencia de Salesforce/admin

Nada de esto requiere volver a Setup de Salesforce ni esperar a nadie. Orden sugerido:

1. **ADR-0005** — decisión de auth del cliente (magic-link nativo del BFF vs
   Auth0/Cognito). Es la única decisión de arquitectura que sigue abierta (G1);
   puedo redactarla ahora si me confirmas la dirección (magic-link nativo es mi
   recomendación — ver el chat anterior).
2. **Deploy del frontend en Vercel** (`Root Directory = apps/web`). Tu dominio se
   agrega ahí apuntando DNS desde donde ya lo tengas — no hace falta transferirlo.
3. **Deploy del backend en Railway** (`Root Directory = apps/bff`). Puede desplegarse
   incluso antes de tener las credenciales JWT nuevas (arranca en modo `mock` mientras
   tanto).
4. **`vercel.json` con rewrite** de `/api/*` → la URL de Railway (un solo dominio,
   sin CORS).
5. **HTTP Basic Auth** en el borde (Vercel Edge Middleware o Password Protection) —
   para que el demo no quede abierto al público.
6. **Redis para caché de lecturas** (ROADMAP 1.9) — infraestructura pura, no toca SF.
7. **Portar el resto de las 5 vistas del prototipo a React real** (Order/Payments/
   Documents/Profile — hoy solo Login+Dashboard están portados) — trabajo de
   componentes de frontend, reutilizando `packages/shared`.
8. Revisar el mockup pulido en dispositivos reales (ya está publicado y sincronizado
   con la orden real) e iterar si algo no calza visualmente.

## 🟡 Grupo B — Necesitas Salesforce Setup, pero ya tienes el acceso (no es "el admin", eres tú)

Repetir el mismo runbook de hoy (documentado en `salesforce-sandbox-setup.md` §B-bis),
con un usuario nuevo en vez del admin:

9. **G3** — integration user de mínimo privilegio + Permission Set propio (solo
   objetos WSC, `Brand__c='WSC'`).
10. **External Client App nueva**, separada de la de hoy (la de hoy quedó ligada al
    admin y su Consumer Key ya se compartió en este chat — no reusar para nada público).
11. **Nuevo par de llaves X.509** para esa app (no reusar `~/.wsc-keys/server.key`,
    que es del admin).

## 🔴 Grupo C — Depende de que A y B estén listos

12. Probar `PORTAL_DATA_SOURCE=salesforce-jwt` en producción con las credenciales
    nuevas del Grupo B, cargadas como variables de entorno en Railway (nunca en el repo).
13. Decidir si el despliegue público final es el **mockup estático** (cero riesgo,
    ya listo) o la **app React + BFF real** (tiempos de carga reales, requiere A+B
    completos) — ver la tabla comparativa que ya armamos.

---

## Por qué este orden

El Grupo A es donde vale la pena empezar: son ~7 tareas de puro código/infraestructura/
decisión que no requieren volver a tocar Salesforce ni esperar nada externo. El Grupo B
es Salesforce, pero es exactamente el mismo procedimiento que ya hiciste hoy — no hay
nada nuevo que aprender, solo repetirlo con un usuario distinto. El Grupo C es la
integración final entre ambos.

¿Por cuál del Grupo A arrancamos?
