# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Las personas autorizadas de la Asociación Cultural Fragua 47 que necesitan consultar, organizar y conservar documentos de trabajo de la asociación.

## Product Purpose

Fragua Documentos centraliza el acceso autenticado a documentos y a una conexión compartida de Google Drive. Las páginas legales públicas permiten informar a quienes usan la aplicación y completar la configuración del consentimiento de Google.

## Positioning

La aplicación usa una única conexión de Google Drive gestionada por la asociación, en lugar de exigir que cada persona conecte su propia cuenta de Google.

## Operating Context

Es una aplicación web interna con acceso mediante credenciales de Fragua 47. El backend autentica las sesiones y gestiona la integración con Google Drive.

## Capabilities and Constraints

- Frontend construido con Vue 3, TypeScript, Vite, Pinia y Vue Router.
- Las páginas de privacidad y condiciones deben ser públicas y estar disponibles sin iniciar sesión.
- La URL pública final de despliegue sigue pendiente de confirmar.

## Brand Commitments

El producto se llama Fragua Documentos y utiliza el logotipo de Fragua 47 disponible en `public/fragua47docs.png`.

## Evidence on Hand

El repositorio contiene la interfaz autenticada, las rutas de documentos y la integración cliente con la API. No hay una URL pública de despliegue ni textos legales previos dentro del repositorio.

## Product Principles

- El acceso a los documentos debe ser claro y seguro.
- La información para personas usuarias debe expresarse en lenguaje directo.
- Las páginas públicas no deben exponer datos ni requerir una sesión.
