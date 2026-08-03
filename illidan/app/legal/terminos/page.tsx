import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Términos y condiciones · Musa",
  description: "Términos de uso de la plataforma Musa.",
}

export default function TerminosPage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20 text-[var(--ivory)]">
      <h1 className="mb-8 font-display text-5xl">Términos y condiciones</h1>
      <p className="mb-8 text-sm text-[var(--taupe)]">Última actualización: {new Date().toLocaleDateString("es-CO")}</p>

      <section className="prose-invert space-y-6 text-[15px] leading-relaxed text-[var(--ivory)]/90">
        <div>
          <h2 className="mb-2 text-xl font-medium text-[var(--gold)]">1. Objeto</h2>
          <p>
            Musa es una plataforma que conecta a agencias con personas interesadas en
            contactarlas. Musa NO presta servicios de acompañamiento; únicamente facilita
            la publicación de perfiles y datos de contacto de las agencias registradas y
            sus modelos.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-xl font-medium text-[var(--gold)]">2. Edad mínima</h2>
          <p>
            El uso de Musa está restringido a personas mayores de 18 años. Al ingresar,
            el visitante declara ser mayor de edad y aceptar la naturaleza del contenido
            publicado.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-xl font-medium text-[var(--gold)]">3. Responsabilidad de las agencias</h2>
          <p>
            Las agencias son las únicas responsables por la veracidad, legalidad y actualidad
            de la información y contenido publicado en sus perfiles y en los perfiles de sus
            modelos, incluyendo fotografías, descripciones y datos de contacto.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-xl font-medium text-[var(--gold)]">4. Servicios pagos</h2>
          <p>
            Musa ofrece a las agencias planes de suscripción y paquetes de tokens para
            visibilidad destacada. Los precios y condiciones están descritos en el panel de
            la agencia. Los pagos se procesan a través de Wompi.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-xl font-medium text-[var(--gold)]">5. Contenido prohibido</h2>
          <p>
            Está prohibido publicar contenido que involucre menores de edad, actividades
            ilegales, o material sin consentimiento de los involucrados. Musa se reserva el
            derecho de retirar cualquier perfil o contenido que incumpla estas condiciones y
            cancelar la cuenta de la agencia responsable sin reembolso.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-xl font-medium text-[var(--gold)]">6. Limitación de responsabilidad</h2>
          <p>
            Musa no interviene en las relaciones que se generen entre los visitantes y las
            agencias o modelos. Cualquier acuerdo, transacción o interacción posterior al
            contacto inicial es responsabilidad exclusiva de las partes involucradas.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-xl font-medium text-[var(--gold)]">7. Modificaciones</h2>
          <p>
            Musa puede actualizar estos términos en cualquier momento. Los cambios se
            publican en esta página y aplican desde su publicación.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-xl font-medium text-[var(--gold)]">8. Contacto</h2>
          <p>Para consultas sobre estos términos: contacto@musa.co</p>
        </div>
      </section>
    </article>
  )
}
