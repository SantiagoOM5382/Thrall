# Arthas — Rediseño del panel financiero (Modelos vs Ganancias por modelo)

**Fecha:** 2026-07-12
**Estado:** Aprobado
**Proyectos afectados:** `thrall` (backend, cambio menor), `sylvanas` (frontend)
**Depende de:** [2026-06-26-arthas-payments-design.md](2026-06-26-arthas-payments-design.md)

---

## 1. Motivación

Hoy el detalle de modelo (`/dashboard/models/[id]`) mezcla la gestión de perfil
(fotos) con lo financiero (saldo, pagos, historiales). Se separan responsabilidades:

- **"Modelos" (detalle)** queda solo para lo **editable del admin**: perfil + fotos.
- **"Ganancias por modelo"** se vuelve el **centro financiero**: saldo acumulado,
  realizar pago, y el desglose de la actividad **por día**, con edición de montos.

## 2. Backend (thrall) — cambios

Agregar edición de monto a préstamos y multas (hoy solo crear/eliminar):

```
PUT /api/loans/:id     [admin, monitor]   body: { amount }   → actualiza amount
PUT /api/fines/:id     [admin]            body: { amount }   → actualiza amount
```

- `amount` entero positivo (misma validación que al crear).
- 404 si el registro no existe o está soft-deleted (`deleted_at IS NULL`).
- Registrar en `audit_logs` con acción `UPDATE`.
- Servicios ya tienen `PUT /api/services/:id` (edita `base_price` vía partial) — **sin cambios**.

## 3. Frontend — "Modelos" (detalle) `/dashboard/models/[id]`

**Se quita** (se mueve a Ganancias por modelo):
- Tarjeta de saldo + desglose
- Botón "Realizar pago" + diálogo
- Historial de pagos
- Tablas de multas y préstamos

**Se agrega:**
- **Edición de perfil**: nombre, correo, teléfono, telegram, descripción.
  Usa `PUT /api/users/:id` (ya existe). Formulario o diálogo con esos campos.
  (No: contraseña, activar/desactivar, ni cambio de rol — fuera de alcance.)

**Se mantiene:** galería de fotos (subir múltiples / eliminar).

Resultado: la página es **perfil editable + fotos**, nada financiero.

## 4. Frontend — "Ganancias por modelo" `/dashboard/model-earnings`

Estructura de arriba hacia abajo:

1. **Controles** (ya existen): selector de modelo + rango de fechas.

2. **Tarjeta de saldo acumulado a pagar** (todo el historial, no filtrado por fecha):
   - `GET /api/reports/model-balance/:id` → `{ balance, totalEarnings, totalFines, totalLoans, totalPayments }`
   - Muestra el saldo destacado (negativo = deuda, en rojo) con desglose.
   - Botón **"Realizar pago"** → diálogo (monto + método de pago), `POST /api/payments`.
   - Debajo, historial de pagos (`GET /api/payments?modelId=`).

3. **Desglose por día** (respeta el rango de fechas seleccionado):
   - Fuentes: servicios (`GET /api/reports/model-earnings/:id?from=&to=`),
     multas (`GET /api/fines`) y préstamos (`GET /api/loans`) filtrados por
     modelo + `createdAt`/`startTime` dentro del rango (client-side; el admin
     recibe todos).
   - Se agrupan por **día** (fecha en `America/Bogota`).
   - Por cada día, un bloque con:
     - **Encabezado:** fecha, cantidad de servicios, total pedido (Σ préstamos del día).
     - **Filas de servicios:** tipo/nota, precio base, ganancia modelo (`calcEarnings().modelTotal`).
     - **Filas de préstamos y multas:** motivo, monto.
   - Cada fila editable tiene un **lápiz** para editar solo el **monto**:
     - servicio → `PUT /api/services/:id` con `{ basePrice }`
     - préstamo → `PUT /api/loans/:id` con `{ amount }`
     - multa → `PUT /api/fines/:id` con `{ amount }`
   - Tras editar, `revalidatePath` para refrescar saldo y desglose.

## 5. Fuera de alcance (para después)

- Vista de **calendario** (por ahora solo la tabla por días; se deja la puerta abierta).
- Edición de perfil de **monitors/admins** (solo modelos por ahora).
- Editar tipo/nota/fecha/motivo con el lápiz (solo montos).
- Restablecer contraseña / activar-desactivar desde el detalle.

## 6. Decisiones

| Decisión | Razón |
|---|---|
| Saldo = acumulado (no por día) | El pago liquida el saldo total; el "por día" es solo desglose |
| Lápiz edita solo montos | Alcance acotado; corrección rápida de errores de digitación |
| Financiero fuera de "Modelos" | Separar perfil (editar datos/fotos) de dinero (ganancias/pagos) |
| PUT loans admin+monitor, PUT fines admin | Espeja los permisos de eliminación existentes |
| Balance no filtrado por fecha | Es un saldo corriente; filtrar por fecha lo haría inconsistente con los pagos |
