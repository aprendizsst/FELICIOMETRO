# Feliciómetro v2 — De mí para mí

Versión mobile-first para GitHub Pages + Firebase Firestore.

## Cambios principales de esta versión
- Dashboard visible únicamente para administrador autenticado.
- El nombre del participante se guarda para que el administrador pueda ver usuarios y respuestas.
- Preguntas y cierre personalizados con el nombre.
- Panel de respuestas en vivo con búsqueda y filtro por nivel de felicidad.
- Métricas calculadas con datos reales de Firestore, sin cifras de demostración.
- Actualización en tiempo real mediante `onSnapshot` de Firestore.
- Medidor animado con carita variable según el promedio.
- Gráfico en vivo con las últimas respuestas y hora de registro.
- Arcoíris de portada con aparición animada tipo “magia”.
- Logo más grande y optimizado en PNG para dispositivos móviles.
- Nuevo favicon/icono del Feliciómetro.
- Exportación CSV desde el panel administrador.

## Archivos que debes reemplazar en GitHub
Si ya tienes la versión anterior publicada, reemplaza:

- `index.html`
- `css/styles.css`
- `js/app.js`
- `firestore.rules`
- `firebase.json`

Y agrega/reemplaza en `assets/`:

- `logo-de-mi-para-mi.png`
- `logo-original.svg`
- `feliciometro-icon.svg`
- `feliciometro-icon.png`

`js/firebase-config.js` se incluye como plantilla. Si ya pusiste allí tus datos reales de Firebase, NO reemplaces ese archivo con los valores `REEMPLAZAR`; conserva tu configuración real.

## 1. Configurar Firebase
En Firebase Console:

1. Crea o abre el proyecto del Feliciómetro.
2. Activa **Firestore Database**.
3. Activa **Authentication > Sign-in method > Email/Password**.
4. En **Authentication > Users**, crea el correo y contraseña del administrador.
5. Registra una aplicación **Web** y copia su `firebaseConfig` en `js/firebase-config.js`.

Ejemplo:

```js
export const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "tu-proyecto.firebaseapp.com",
  projectId: "tu-proyecto",
  storageBucket: "tu-proyecto.firebasestorage.app",
  messagingSenderId: "...",
  appId: "..."
};
```

## 2. Publicar las reglas de Firestore
Estas reglas permiten:

- Público: crear una respuesta.
- Público: NO leer respuestas.
- Administrador autenticado: leer las respuestas.
- Nadie desde el navegador: modificar o borrar respuestas existentes.

Desde la carpeta del proyecto:

```bash
npm install -g firebase-tools
firebase login
firebase use --add
firebase deploy --only firestore:rules
```

Esta versión NO necesita Cloud Functions para el dashboard: el administrador recibe los cambios directamente desde Firestore en tiempo real.

## 3. GitHub Pages
El `index.html` debe estar en la raíz del repositorio.

En GitHub:

`Settings > Pages > Deploy from a branch > principal/main > /(root)`

Cada commit nuevo vuelve a desplegar la página automáticamente.

## Datos guardados por respuesta
Cada documento de `responses` contiene:

- `name`: nombre ingresado por el participante.
- `happiness`: nivel 1 a 5.
- `needs`: opciones seleccionadas.
- `createdAt`: fecha y hora.
- `source`: `qr-web`.
- `version`: `2`.

El nombre NO se muestra al público. Solo puede leerlo un administrador autenticado por Firebase.

## Rendimiento
La vista pública solo escribe una respuesta y no descarga la colección. El panel administrador sí mantiene una suscripción a las respuestas para calcular métricas y mostrar el listado en vivo. Esta arquitectura es adecuada para el uso del evento; si el histórico crece a decenas de miles de respuestas, conviene pasar las métricas agregadas a una estrategia de agregación/paginación.


## v2.1 - Actualización de marca
- Logo `De mí para mí` reemplazado por PNG con transparencia real.
- Se eliminó el fondo negro del recurso visual.
- Nuevo wordmark 3D `Feliciómetro` de alto contraste.
- Ajustes responsive para que logo y título se lean correctamente en dispositivos móviles.
- No se modificó `js/firebase-config.js`.
- No se modificó la lógica de Firebase ni el dashboard en tiempo real.


## v2.2 - Corrección de indicadores y reinicio de tableros
- `Necesita una pausa` cuenta respuestas con nivel 1 **o** con la necesidad `pausa`, sin duplicar una misma respuesta.
- `Con energía` cuenta niveles 4 y 5.
- Los porcentajes se muestran con un decimal y con su numerador/denominador.
- Se agregó `Reiniciar tableros` al panel administrador.
- Reiniciar no elimina el historial: guarda un `resetAt` en `adminConfig/dashboard` y la medición vuelve a cero desde ese momento.
- Las respuestas nuevas siguen actualizando KPIs, listado, medidor y gráfico en tiempo real.
- Deben publicarse las nuevas reglas de Firestore para permitir el documento privado `adminConfig/dashboard`.
