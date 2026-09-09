# Feliciómetro - De mí para mí

Primera versión funcional mobile-first para GitHub Pages + Firebase.

## Incluye
- Bienvenida e ingreso de nombre.
- Pregunta de felicidad 1 a 5.
- Selección múltiple de necesidades.
- Pantalla final.
- Dashboard público.
- Login administrador.
- Panel administrador.
- Firestore Rules.
- Cloud Function para estadísticas públicas agregadas.
- Modo demo local antes de conectar Firebase.

## Configurar Firebase
1. Crea un proyecto en Firebase.
2. Activa Firestore Database.
3. Activa Authentication > Email/Password.
4. Crea el usuario administrador.
5. Crea una Web App.
6. Copia la configuración en `js/firebase-config.js`.

## Instalar y desplegar
```bash
npm install -g firebase-tools
firebase login
firebase use --add

cd functions
npm install
cd ..

firebase deploy --only firestore:rules,functions
```

## GitHub Pages
Sube los archivos al repositorio y activa:
Settings > Pages > Deploy from a branch > main > /(root)

## Privacidad
El nombre no se almacena en Firestore.
El dashboard público solo lee `publicStats/live`.
Las respuestas individuales quedan bloqueadas para usuarios públicos.
