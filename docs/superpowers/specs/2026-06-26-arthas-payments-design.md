# Arthas — Multas, Préstamos y Sistema de Pagos

**Fecha:** 2026-06-26
**Estado:** Aprobado
**Proyectos afectados:** `thrall` (backend), `sylvanas` (frontend)
**Depende de:** [2026-06-23-arthas-design.md](2026-06-23-arthas-design.md)

---

## 1. Visión General

Se añaden tres conceptos de dinero alrededor de un **saldo corriente por modelo**
(modelo de "ledger"): **multas** (penalizaciones), **préstamos** (adelantos) y
**pagos** (liquidaciones que el admin realiza a la modelo).

Todo se reduce a un único saldo por modelo, calculado al vuelo (nunca persistido),
igual que las ganancias actuales:

```
saldo = Σ ganancia_modelo(servicios activos)
      − Σ multas activas
      − Σ préstamos activos
      − Σ pagos
```

- El saldo puede ser **negativo** (deuda): cuando préstamos + multas + pagos
  superan las ganancias acumuladas.
- "Pagar" es solo otro movimiento con monto **libre** que designa el admin: puede
  pagar el saldo completo (queda en 0), de más (deja deuda) o de menos (residual
  que se arrastra).
- Las **vistas semanales** son simplemente filtros por fecha sobre el historial;
  los datos nunca se pierden ni se "cierran".

---

## 2. Base de Datos (3 tablas nuevas)

> Convenciones existentes: IDs ULID (TEXT), montos INTEGER (COP), timestamps
> INTEGER (unix ms), soft delete via `deleted_at`.

### `fines` (multas)
```
id          TEXT PK
model_id    TEXT FK → users.id
amount      INTEGER            -- COP, positivo
reason      TEXT               -- motivo (texto libre)
created_by  TEXT FK → users.id -- monitor o admin que la registró
created_at  INTEGER
deleted_at  INTEGER NULL       -- soft delete (solo admin elimina)
```

### `loans` (préstamos)
```
id          TEXT PK
model_id    TEXT FK → users.id
amount      INTEGER            -- COP, positivo
reason      TEXT               -- motivo (texto libre)
created_by  TEXT FK → users.id -- monitor o admin que lo otorgó
created_at  INTEGER
deleted_at  INTEGER NULL       -- soft delete (monitor + admin eliminan)
```

### `payments` (pagos / liquidaciones)
```
id            TEXT PK
model_id      TEXT FK → users.id
amount        INTEGER          -- monto que designa el admin
pay_method_id TEXT FK → pay_methods.id
created_by    TEXT FK → users.id -- solo admin
created_at    INTEGER
```
> Los pagos son **definitivos**: no tienen `deleted_at`, no se editan ni eliminan.

Todas las mutaciones (CREATE/DELETE) se registran en `audit_logs`.

---

## 3. Lógica de Negocio

### Ganancia por servicio (ya existente)
```
ganancia_modelo = round(base_price × 0.6) + Σ extras.amount
```

### Saldo de una modelo
```
balance        = totalEarnings − totalFines − totalLoans − totalPayments
totalEarnings  = Σ ganancia_modelo de servicios con deleted_at IS NULL
totalFines     = Σ fines.amount con deleted_at IS NULL
totalLoans     = Σ loans.amount con deleted_at IS NULL
totalPayments  = Σ payments.amount
```
Solo cuentan registros activos (`deleted_at IS NULL`) excepto pagos (siempre activos).

### Timezone
"Hoy" se calcula server-side en `America/Bogota` (UTC−5), reutilizando
`getTodayRangeInBogota()`. Multas y préstamos filtran por `created_at`.

---

## 4. Permisos

| Acción | Admin | Monitor | Model |
|---|---|---|---|
| Crear servicio | ✅ | ✅ | ❌ |
| Eliminar servicio (soft) | ✅ | ✅ | ❌ |
| Crear multa | ✅ | ✅ | ❌ |
| Eliminar multa (soft) | ✅ | ❌ | ❌ |
| Crear préstamo | ✅ | ✅ | ❌ |
| Eliminar préstamo (soft) | ✅ | ✅ | ❌ |
| Realizar pago | ✅ | ❌ | ❌ |
| Ver saldo de modelo | ✅ | ❌ | ❌ |
| Ver multas/préstamos | ✅ todas | ✅ hoy | ✅ propias de hoy |
| Ver historial de pagos | ✅ | ❌ | ❌ |

---

## 5. API — `thrall`

```
Multas
  POST   /api/fines               [admin, monitor]  body: { modelId, amount, reason }
  GET    /api/fines               [scoped: admin=todas, monitor=hoy, model=propias hoy]
  DELETE /api/fines/:id           [admin]            soft delete

Préstamos
  POST   /api/loans               [admin, monitor]  body: { modelId, amount, reason }
  GET    /api/loans               [scoped igual que multas]
  DELETE /api/loans/:id           [admin, monitor]   soft delete

Pagos
  POST   /api/payments            [admin]            body: { modelId, amount, payMethodId }
  GET    /api/payments?modelId=   [admin]            historial de pagos de una modelo

Saldo
  GET    /api/reports/model-balance/:id   [admin]
         → { balance, totalEarnings, totalFines, totalLoans, totalPayments }
```

- `GET /fines` y `GET /loans` están filtrados por rol y timezone Bogotá
  exactamente igual que `GET /services` (admin=todas incl. eliminadas;
  monitor=hoy activas; model=propias de hoy activas).
- Validación: `amount` entero positivo; `reason` no vacío (multas/préstamos);
  `payMethodId` válido (pagos). Cada mutación valida que el `modelId` exista y
  sea rol `model`.

---

## 6. Frontend — `sylvanas`

### Panel del día — `/dashboard/services` (monitor + admin)
- La tabla del día es el centro de operación en vivo.
- Botones **"Nueva multa"** y **"Nuevo préstamo"** (diálogos: modelo + monto + motivo).
- Secciones con **multas y préstamos de hoy** (mismo scope de rol que servicios).
- Eliminar: monitor puede quitar servicios y préstamos; multas solo el admin.

### Detalle de modelo — `/dashboard/models/[id]` (solo admin)
- **Saldo actual** destacado, con desglose
  (ganancias, − multas, − préstamos, − pagos).
- Botón **"Realizar pago"** → diálogo (monto + método de pago).
- **Historial de pagos** de la modelo.
- Historial de multas y préstamos de la modelo.

### Perfil de modelo — `/dashboard/profile` (rol model)
- Además de servicios del día, sus **multas y préstamos del día en curso**.
- **No** ve saldo, ni pagos, ni semanas anteriores.

---

## 7. Decisiones de Diseño

| Decisión | Razón |
|---|---|
| Saldo calculado al vuelo (no persistido) | Igual filosofía que ganancias; sin riesgo de drift; el historial nunca se rompe si cambian reglas |
| Tablas separadas (no ledger unificado) | Más simple, no duplica servicios, SQLite-friendly |
| Pagos inmutables (sin soft delete) | Un pago realizado es definitivo |
| Saldo solo visible para admin | Requerimiento de negocio; la modelo no ve cuánto se le acumula |
| Vistas semanales = filtros por fecha | Evita "cerrar" semanas; los datos quedan íntegros para siempre |
| Multas: monitor crea pero no elimina | Control: una penalización registrada por monitor no se borra sin admin |
