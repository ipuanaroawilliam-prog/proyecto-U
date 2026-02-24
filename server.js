const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const cron = require('node-cron');

const app = express();

app.use(express.json());
// Endpoint de login profesional
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  // Validar correo estudiantil
  if (!/^.+@unadvirtual\.edu\.co$/.test(email)) {
    return res.status(400).json({ error: 'Solo se permite acceso con correo estudiantil (@unadvirtual.edu.co)' });
  }
 
  return res.json({ success: true });
});
const PORT = process.env.PORT || 3000;


app.use(express.static(path.join(__dirname, 'public')));


app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database(path.join(__dirname, 'data.db'));


 db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      type TEXT,
      day TEXT,
      startTime TEXT,
      endTime TEXT,
      email TEXT,
      subjectName TEXT,
      finishDay TEXT,
      finishTime TEXT
    )
  `);
});


const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.example.com',
  port: process.env.EMAIL_PORT ? parseInt(process.env.EMAIL_PORT) : 587,
  secure: process.env.EMAIL_SECURE === 'true', 
  auth: {
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || ''
  }
});


app.post('/api/classes', (req, res) => {
  console.log('POST /api/classes body:', req.body); 
  const { name, type, day, startTime, endTime, email, subjectName, finishDay, finishTime } = req.body;
  
  if (!name || !type || !day || !email) {
    console.log('Validation failed basic');
    return res.status(400).json({ error: 'Faltan campos obligatorios.' });
  }

  const entry = { name, type, day, email };
  if (type === 'materia') {
    if (!subjectName || !finishDay || !finishTime) {
      return res.status(400).json({ error: 'Materia requiere nombre, día y hora de finalización.' });
    }
    entry.subjectName = subjectName;
    entry.finishDay = finishDay;
    entry.finishTime = finishTime;
    entry.startTime = '';
    entry.endTime = '';
  } else if (type === 'clase' || type === 'cipa') {
    
    if (!startTime) {
      return res.status(400).json({ error: 'Clase o cipa requiere hora de inicio.' });
    }
    entry.startTime = startTime;
    entry.endTime = '';
  } else {
    
    entry.startTime = startTime || '';
    entry.endTime = endTime || '';
  }

  // insert into db
  const stmt = db.prepare(`INSERT INTO entries
    (name,type,day,startTime,endTime,email,subjectName,finishDay,finishTime)
    VALUES (?,?,?,?,?,?,?,?,?)`);
  stmt.run(
    entry.name,
    entry.type,
    entry.day,
    entry.startTime,
    entry.endTime,
    entry.email,
    entry.subjectName || '',
    entry.finishDay || '',
    entry.finishTime || '',
    function(err) {
      if (err) {
        console.error('DB insert error', err);
        return res.status(500).json({ error: 'Error guardando en la base de datos.'});
      }
      // after insertion, query all rows
      db.all('SELECT * FROM entries', (err2, rows) => {
        if (err2) {
          console.error('DB select error', err2);
          return res.status(500).json({ error: 'Error leyendo de la base de datos.'});
        }
        res.json({ success: true, classes: rows });
      });
    }
  );
  stmt.finalize();
});

// endpoint to list classes stored in DB
app.get('/api/classes', (req, res) => {
  db.all('SELECT * FROM entries', (err, rows) => {
    if (err) {
      console.error('DB select error', err);
      return res.status(500).json({ error: 'Error leyendo de la base de datos.'});
    }
    res.json(rows);
  });
});

// endpoint to delete a class by id
app.delete('/api/classes/:id', (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM entries WHERE id = ?', [id], function(err) {
    if (err) {
      console.error('DB delete error', err);
      return res.status(500).json({ error: 'Error eliminando el registro.' });
    }
    // return updated list
    db.all('SELECT * FROM entries', (err2, rows) => {
      if (err2) {
        console.error('DB select error', err2);
        return res.status(500).json({ error: 'Error leyendo de la base de datos.'});
      }
      res.json({ success: true, classes: rows });
    });
  });
});

// cron job que revisa cada minuto y envía recordatorios 5 días y 1 día antes de la clase
cron.schedule('* * * * *', () => {
  const now = new Date();
  const weekdayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const currentDay = weekdayNames[now.getDay()];
  const currentTime = now.toTimeString().slice(0,5); // HH:MM

  db.all('SELECT * FROM entries', (err, rows) => {
    if (err) return;
    rows.forEach(cl => {
      // Solo enviar recordatorio si tiene día y hora de inicio
      if (!cl.day || !cl.startTime) return;
      // Buscar la próxima fecha de la actividad a partir del día de la semana
      const targetDayIndex = weekdayNames.findIndex(d => d.toLowerCase() === cl.day.toLowerCase());
      if (targetDayIndex === -1) return;

      // Calcular la próxima fecha de la actividad
      const nextDate = new Date(now);
      nextDate.setHours(Number(cl.startTime.split(':')[0]), Number(cl.startTime.split(':')[1]), 0, 0);
      let daysToAdd = (targetDayIndex - now.getDay() + 7) % 7;
      if (daysToAdd === 0 && now > nextDate) daysToAdd = 7; // si ya pasó hoy, ir a la próxima semana
      nextDate.setDate(now.getDate() + daysToAdd);

      // 5 días antes
      const fiveDaysBefore = new Date(nextDate);
      fiveDaysBefore.setDate(nextDate.getDate() - 5);
      // 1 día antes
      const oneDayBefore = new Date(nextDate);
      oneDayBefore.setDate(nextDate.getDate() - 1);


      // Saludo según la hora
      let saludo = 'Buenos días';
      const hora = now.getHours();
      if (hora >= 12 && hora < 18) saludo = 'Buenas tardes';
      else if (hora >= 18 || hora < 6) saludo = 'Buenas noches';

      // Formato de fecha para mostrar
      const fechaClase = `${nextDate.getDate().toString().padStart(2, '0')}/${(nextDate.getMonth()+1).toString().padStart(2, '0')}/${nextDate.getFullYear()}`;

      // Etiqueta personalizada según tipo
      let tipoLabel = 'Clase';
      if (cl.type === 'cipa') tipoLabel = 'Cipa';
      if (cl.type === 'materia') tipoLabel = 'Materia';

      // Si es exactamente 5 días antes y la hora coincide
      if (
        now.toDateString() === fiveDaysBefore.toDateString() &&
        currentTime === cl.startTime
      ) {
        let text;
        if (cl.type === 'materia') {
          text = `${saludo},\n\nLa actividad de la materia "${cl.name}" está pronto a finalizar, por favor termina pronto.\n\nDía de finalización: ${cl.day} (${fechaClase})\nHora de finalización: ${cl.startTime}`;
        } else if (cl.type === 'clase') {
          text = `William, falta pocos días para tu clase en Teams.\n\nMateria: ${cl.name}\nDía: ${cl.day} (${fechaClase})\nHora: ${cl.startTime}`;
        } else if (cl.type === 'cipa') {
          text = `Hola William, tu actividad CIPA está próxima.\n\nActividad: ${cl.name}\nDía: ${cl.day} (${fechaClase})\nHora: ${cl.startTime}`;
        } else {
          text = `${saludo},\n\nQuiero recordarte que faltan pocos días para tu ${tipoLabel.toLowerCase()}. No lo olvides.\n\nMateria: ${cl.name}\nDía: ${cl.day} (${fechaClase})\nHora: ${cl.startTime}`;
        }
        const mailOptions = {
          from: process.env.EMAIL_FROM || 'noreply@example.com',
          to: cl.email,
          subject: `Recordatorio: ${tipoLabel} en 5 días (${cl.name})`,
          text
        };
        transporter.sendMail(mailOptions, (err, info) => {
          if (err) {
            console.error('Error enviando recordatorio 5 días antes:', err);
          } else {
            console.log('Correo de recordatorio 5 días antes enviado:', info.response);
          }
        });
      }

      // Si es exactamente 1 día antes y la hora coincide
      if (
        now.toDateString() === oneDayBefore.toDateString() &&
        currentTime === cl.startTime
      ) {
        let text;
        if (cl.type === 'materia') {
          text = `${saludo},\n\nLa actividad de la materia "${cl.name}" está pronto a finalizar, por favor termina pronto.\n\nDía de finalización: ${cl.day} (${fechaClase})\nHora de finalización: ${cl.startTime}`;
        } else if (cl.type === 'clase') {
          text = `William, falta pocos días para tu clase en Teams.\n\nMateria: ${cl.name}\nDía: ${cl.day} (${fechaClase})\nHora: ${cl.startTime}`;
        } else if (cl.type === 'cipa') {
          text = `Hola William, tu actividad CIPA está próxima.\n\nActividad: ${cl.name}\nDía: ${cl.day} (${fechaClase})\nHora: ${cl.startTime}`;
        } else {
          text = `${saludo},\n\nQuiero recordarte que faltan pocos días para tu ${tipoLabel.toLowerCase()}. No lo olvides.\n\nMateria: ${cl.name}\nDía: ${cl.day} (${fechaClase})\nHora: ${cl.startTime}`;
        }
        const mailOptions = {
          from: process.env.EMAIL_FROM || 'noreply@example.com',
          to: cl.email,
          subject: `Recordatorio: ${tipoLabel} en 1 día (${cl.name})`,
          text
        };
        transporter.sendMail(mailOptions, (err, info) => {
          if (err) {
            console.error('Error enviando recordatorio 1 día antes:', err);
          } else {
            console.log('Correo de recordatorio 1 día antes enviado:', info.response);
          }
        });
      }

      // Notificación justo al iniciar la actividad (como antes)
      if (
        cl.day.toLowerCase() === currentDay &&
        cl.startTime === currentTime
      ) {
        const mailOptions = {
          from: process.env.EMAIL_FROM || 'noreply@example.com',
          to: cl.email,
          subject: `Recordatorio de ${tipoLabel}: ${cl.name}`,
          text: `Tu ${tipoLabel.toLowerCase()} "${cl.name}" comienza ahora (${cl.day} ${cl.startTime}).`
        };
        transporter.sendMail(mailOptions, (err, info) => {
          if (err) {
            console.error('Error enviando correo de inicio:', err);
          } else {
            console.log('Correo de inicio enviado:', info.response);
          }
        });
      }
    });
  });
});

app.listen(PORT, () => {
  console.log(`Servidor iniciado en http://localhost:3000`);
});
