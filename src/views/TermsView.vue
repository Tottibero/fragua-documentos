<script setup lang="ts">
import { RouterLink } from 'vue-router'
import LegalPageLayout from '@/components/legal/LegalPageLayout.vue'
</script>

<template>
  <LegalPageLayout title="Condiciones de uso" updated-at="22 de septiembre de 2026">
    <h2>Objeto del servicio</h2>
    <p>
      Fragua Documentos es una herramienta interna de la Asociación Cultural Fragua 47 para
      organizar, consultar y gestionar documentación vinculada a sus actividades.
    </p>

    <h2>Acceso autorizado</h2>
    <p>
      El acceso está reservado a las personas a quienes la asociación haya autorizado. Cada persona
      usuaria debe conservar sus credenciales de acceso de forma confidencial y no permitir el uso
      de su cuenta por terceras personas.
    </p>

    <h2>Uso responsable</h2>
    <p>Al utilizar la aplicación, te comprometes a:</p>
    <ul>
      <li>usar el servicio únicamente para fines relacionados con la asociación;</li>
      <li>respetar la confidencialidad de la documentación a la que tengas acceso;</li>
      <li>no compartir, alterar ni eliminar documentos sin la autorización correspondiente; y</li>
      <li>comunicar cualquier incidencia de seguridad a la asociación lo antes posible.</li>
    </ul>

    <h2>Disponibilidad y acceso</h2>
    <p>
      La asociación puede actualizar, limitar o suspender el acceso cuando sea necesario para
      proteger la seguridad, mantener el servicio o garantizar su uso correcto. Esta medida no
      afecta a los derechos que correspondan a las personas usuarias.
    </p>

    <h2>Privacidad y contacto</h2>
    <p>
      El tratamiento de datos personales se rige por la
      <RouterLink :to="{ name: 'privacy' }">Política de privacidad</RouterLink>. Para consultas
      sobre estas condiciones, escribe a
      <a href="mailto:fragua47000@gmail.com">fragua47000@gmail.com</a>.
    </p>
  </LegalPageLayout>
</template>
