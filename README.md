# Proyecto UNAD - Horario de clases

Base inicial para un programa que permite registrar días y horas de clases universitarias y recibir recordatorios por correo.

## Estructura

- `server.js` : servidor Express que expone la API y programa el envío de correos.
- `public/` : archivos estáticos (HTML, CSS, JS) para la interfaz.
- `package.json` : dependencias y scripts.

## Instalación

```bash
npm install
```

## Configuración de correo

El servidor utiliza `nodemailer` y espera encontrar las siguientes variables de entorno:

- `EMAIL_HOST` - servidor SMTP (ej. smtp.gmail.com)
- `EMAIL_PORT` - puerto SMTP (587 o 465)
- `EMAIL_SECURE` - `true` si usa SSL/TLS
- `EMAIL_USER` - usuario SMTP
- `EMAIL_PASS` - contraseña
- `EMAIL_FROM` - dirección desde la que se envían los correos (opcional)

Puedes definirlas en un archivo `.env` o en tu entorno.

## Uso

1. `npm start` o `npm run dev` (con nodemon)
2. Abre `http://localhost:3000` en tu navegador.
3. Agrega clases indicando nombre, día, hora y correo.

El servidor comprueba cada minuto y, si coincide con algún horario, envía un correo de recordatorio.

## Notas

- La lista de clases se guarda en memoria; al reiniciar se pierde.
- Para almacenamiento persistente, integra una base de datos.
