document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');
  const loginContainer = document.getElementById('login-container');
  const mainContent = document.getElementById('main-content');
  const loginBtn = document.getElementById('login-btn');
  const loginLoading = document.getElementById('login-loading');

  if (!loginForm) return;

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    // Mostrar cargando
    if (loginLoading) loginLoading.style.display = 'block'; loginError.textContent = ''; loginError.style.display = 'none'; loginBtn.disabled = true;
    try {
      // Validación rápida del correo
      if (!/^.+@unadvirtual\.edu\.co$/.test(email)) {
        loginError.textContent =
          'Solo se permite acceso con correo estudiantil, por favor intente de nuevo.';
        loginError.style.display = 'block';
        return;
      }

      // petición al servidor
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Entrar al sistema
        loginContainer.style.display = 'none';
        mainContent.style.display = 'block';
      } else {
        loginError.textContent = data.error || 'Credenciales inválidas';
        loginError.style.display = 'block';
      }

    } catch (err) {
      loginError.textContent = 'Error de conexión con el servidor.';
      loginError.style.display = 'block';
    } finally {
      // Ocultar cargando SIEMPRE
      if (loginLoading) loginLoading.style.display = 'none';
      loginBtn.disabled = false;
    }
  });
});
document.getElementById('class-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('name').value;
  const type = document.getElementById('type').value; 
  const day = document.getElementById('day').value;
  const email = document.getElementById('email').value;

  const startTime = document.getElementById('start-time').value;
  const endTimeInput = document.getElementById('end-time');
  const endTime = endTimeInput ? (endTimeInput.value || '') : '';
  try {
    const res = await fetch('/api/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type, day, startTime, endTime, email })
    });

    if (!res.ok) {
      const errData = await res.json();
      console.error('Server error', errData);
      alert(errData.error || 'Error del servidor');
      return;
    }

    const data = await res.json();
    if (!data.error) {
      renderClasses(data.classes); 
      document.getElementById('class-form').reset();
    } else {
      alert(data.error);
    }
  } catch (err) {
    console.error('Fetch failed', err);
    alert('No se pudo conectar con el servidor. ¿Está ejecutándose?');
  }
});

async function fetchClasses() {
  const res = await fetch('/api/classes');
  const classes = await res.json();
  renderClasses(classes);
}

function renderClasses(classes) {
  const list = document.getElementById('class-list');
  list.innerHTML = '';
  classes.forEach(c => {
    const li = document.createElement('li');
    let text = `${c.type.toUpperCase()}: ${c.name}`;
    if (c.type === 'materia') {
      text += ` (materia: ${c.subjectName}, fin ${c.finishDay}`;
      if (c.finishTime) text += ` ${c.finishTime}`;
      text += `)`;
    } else {
      if (c.startTime && c.endTime) {
        text += ` - ${c.day} ${c.startTime}‑${c.endTime}`;
      } else if (c.startTime) {
        text += ` - ${c.day} ${c.startTime}`;
      } else {
        text += ` - ${c.day}`;
      }
    }
    text += ` (correo: ${c.email})`;
    li.textContent = text;

    // Botón eliminar
    const delBtn = document.createElement('button');
    delBtn.textContent = 'Eliminar';
    delBtn.style.marginLeft = '10px';
    delBtn.onclick = async () => {
      if (confirm('¿Seguro que deseas eliminar este registro?')) {
        const res = await fetch(`/api/classes/${c.id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
          renderClasses(data.classes);
        } else {
          alert(data.error || 'Error eliminando');
        }
      }
    };
    li.appendChild(delBtn);
    list.appendChild(li);
  });
}


fetchClasses();