import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Política de privacidad · Musa",
  description: "Cómo tratamos tus datos personales en Musa.",
}

export default function PrivacidadPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20 text-[var(--ivory)]">
      <h1 className="mb-8 font-display text-5xl">Política de privacidad</h1>
      <p className="mb-8 text-sm text-[var(--taupe)]">Última actualización: {new Date().toLocaleDateString("es-CO")}</p>

      <section className="space-y-6 text-[15px] leading-relaxed text-[var(--ivory)]/90">
        <div>
          <h2 className="mb-2 text-xl font-medium text-[var(--gold)]">1. Responsable del tratamiento</h2>
          <p>
            Musa (en adelante, "la plataforma") es responsable del tratamiento de los datos
            personales recolectados a través de esta web, en cumplimiento con la Ley 1581 de
            2012 de protección de datos personales en Colombia.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-xl font-medium text-[var(--gold)]">2. Datos que recolectamos</h2>
          <ul className="list-disc space-y-1 pl-6">
            <li><strong>De agencias:</strong> nombre de la agencia, correo, contraseña (encriptada), nombre del administrador.</li>
            <li><strong>De modelos publicados:</strong> nombre, descripción, número de WhatsApp o Telegram, fotografías.</li>
            <li><strong>De pagos:</strong> historial de transacciones. Los datos de tarjeta NO se almacenan en Musa; se manejan directamente por Wompi.</li>
            <li><strong>De visitantes:</strong> una cookie técnica para recordar la confirmación de mayoría de edad.</li>
          </ul>
        </div>

        <div>
          <h2 className="mb-2 text-xl font-medium text-[var(--gold)]">3. Finalidad</h2>
          <p>
            Usamos los datos únicamente para operar la plataforma: autenticar cuentas,
            mostrar los perfiles publicados, procesar pagos y comunicarnos con las agencias
            sobre su cuenta.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-xl font-medium text-[var(--gold)]">4. Con quién se comparten</h2>
          <ul className="list-disc space-y-1 pl-6">
            <li>Wompi — para procesar pagos.</li>
            <li>Vercel y Turso — como proveedores de infraestructura (hosting y base de datos).</li>
            <li>No vendemos ni compartimos datos con terceros con fines comerciales.</li>
          </ul>
        </div>

        <div>
          <h2 className="mb-2 text-xl font-medium text-[var(--gold)]">5. Derechos del titular</h2>
          <p>
            Puedes solicitar acceder, actualizar, rectificar o eliminar tus datos
            escribiendo a contacto@musa.co. Las agencias pueden gestionar la información de
            sus modelos directamente desde el panel.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-xl font-medium text-[var(--gold)]">6. Retención</h2>
          <p>
            Conservamos los datos mientras la cuenta esté activa. Si cierras tu cuenta,
            eliminamos los datos personales en un plazo de 30 días, excepto la información
            de facturación que se conserva conforme la ley colombiana.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-xl font-medium text-[var(--gold)]">7. Contacto</h2>
          <p>Para ejercer tus derechos o consultas: contacto@musa.co</p>
        </div>
      </section>
    </article>
  )
}
