/* ==========================================================================
   Usuarios (quién entra al sistema y con qué rol) y Configuración del negocio.
   Solo el dueño.
   ========================================================================== */

const DESCRIPCION_ROL = {
  Admin: 'Ve todo, anula cobros, maneja catálogos y usuarios',
  Barbero: 'Cobra, ve su propia cuenta y cambia su horario'
};

vista('usuarios', {
  titulo: 'Usuarios', icono: 'person-lock', roles: DUENO,
  async render(cont) {
    cont.innerHTML = `<div class="barra-herramientas">
        <p class="crece suave" style="margin:0">Cada persona entra tocando su nombre y escribiendo su PIN de 4 números.</p>
        <button class="btn" id="us-nuevo"><i class="bi bi-person-plus"></i> Nuevo usuario</button></div>
      <div class="panel" id="us-lista"></div>`;
    cont.querySelector('#us-nuevo').onclick = () => this.nuevo(() => this.render(cont));
    const lista = cont.querySelector('#us-lista');
    UI.cargando(lista);
    const filas = await q(sb.from('perfiles').select('*').order('nombre'));
    lista.innerHTML = `<div class="tabla-envoltura"><table class="tabla apilable">
      <thead><tr><th>Nombre</th><th>Usuario</th><th>Rol</th><th>Barbero</th><th>Estado</th></tr></thead>
      <tbody>${filas.map((u, i) => `<tr class="clic" data-i="${i}">
        <td data-t="Nombre"><strong>${h(u.nombre)}</strong>${u.id === App.perfil.id ? ' <span class="etiqueta">Usted</span>' : ''}</td>
        <td data-t="Usuario">${h(u.usuario)}</td>
        <td data-t="Rol">${h(NOMBRE_ROL[u.rol])}</td>
        <td data-t="Barbero">${h(nombreDe('barberos', u.barbero_id) || '—')}</td>
        <td data-t="Estado">${u.activo ? '<span class="etiqueta verde">Activo</span>' : '<span class="etiqueta gris">Desactivado</span>'}</td></tr>`).join('')}
      </tbody></table></div>`;
    lista.querySelectorAll('tr[data-i]').forEach(tr => tr.onclick = () => this.editar(filas[Number(tr.dataset.i)], () => this.render(cont)));
  },

  camposRol() {
    return [
      { n: 'rol', t: 'Rol', tipo: 'select', ancho: true, op: ROLES.map(r => [r, NOMBRE_ROL[r] + ' — ' + DESCRIPCION_ROL[r]]) },
      { n: 'barbero_id', t: '¿Qué barbero es?', tipo: 'select', vacio: 'Ninguno', ancho: true,
        op: App.datos.barberos.filter(b => b.activo).map(b => [b.id, b.nombre]),
        ayuda: 'Obligatorio para barberos. Si el dueño también corta, elíjalo aquí y su botón saldrá marcado al cobrar.' }
    ];
  },

  validarRol(v) {
    if (v.rol === 'Barbero' && !v.barbero_id) throw new Error('Elija qué barbero es. Si no aparece, regístrelo primero en Barberos.');
  },

  async nuevo(recargar) {
    const campos = [
      { n: 'nombre', t: 'Nombre', req: true, ancho: true },
      { n: 'usuario', t: 'Usuario (sin espacios)', req: true, ph: 'ej. luis' },
      { n: 'pin', t: 'PIN de 4 números', tipo: 'password', req: true, inputmode: 'numeric', maxlen: 4 },
      ...this.camposRol()
    ];
    UI.modal({
      titulo: 'Nuevo usuario', cuerpo: Form.html(campos, { rol: 'Barbero' }),
      botones: [
        { texto: 'Cancelar', clase: 'sec' },
        {
          texto: 'Crear usuario', icono: 'person-check', accion: async (m) => {
            const v = Form.leer(m.cuerpo, campos);
            const usuario = normalizarUsuario(v.usuario);
            if (!/^\d{4}$/.test(v.pin)) throw new Error('El PIN debe tener exactamente 4 números.');
            this.validarRol(v);
            const existe = await q(sb.from('perfiles').select('id').eq('usuario', usuario).maybeSingle());
            if (existe) throw new Error('Ya existe el usuario "' + usuario + '".');
            // Un segundo cliente sin sesión guardada, para no cerrar la sesión del dueño
            const temporal = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY, {
              auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'lk-alta-usuario' }
            });
            const { data, error } = await temporal.auth.signUp({ email: usuario + '@' + CONFIG.DOMINIO_USUARIOS, password: claveDesdePin(v.pin) });
            if (error) throw traducirError(error);
            if (!data.user || (data.user.identities && data.user.identities.length === 0)) {
              throw new Error('Ese usuario ya existe en Supabase. Use otro nombre de usuario.');
            }
            await rpc('crear_perfil', { p_id: data.user.id, p_usuario: usuario, p_nombre: v.nombre, p_rol: v.rol, p_barbero_id: v.barbero_id ? Number(v.barbero_id) : null });
            UI.ok(`Usuario creado. ${v.nombre} ya puede entrar con su PIN.`);
            recargar();
          }
        }
      ]
    });
  },

  editar(u, recargar) {
    const campos = [{ n: 'nombre', t: 'Nombre', req: true, ancho: true }, ...this.camposRol(), { n: 'activo', t: 'Puede entrar al sistema', tipo: 'check' }];
    UI.modal({
      titulo: 'Usuario: ' + u.usuario, cuerpo: Form.html(campos, u),
      botones: [
        { texto: 'Cambiar PIN', clase: 'sec', icono: 'key', accion: () => { cambiarPin(u.id, u.id === App.perfil.id); return false; } },
        {
          texto: 'Guardar', icono: 'check2', accion: async (m) => {
            const v = Form.leer(m.cuerpo, campos);
            this.validarRol(v);
            await rpc('actualizar_perfil', { p_id: u.id, p_nombre: v.nombre, p_rol: v.rol, p_barbero_id: v.barbero_id ? Number(v.barbero_id) : null, p_activo: v.activo });
            UI.ok('Usuario actualizado.');
            if (u.id === App.perfil.id) await App.cargarPerfil();
            recargar();
          }
        }
      ]
    });
  }
});

vista('configuracion', {
  titulo: 'Configuración', icono: 'gear', roles: DUENO,
  render(cont) {
    const campos = [
      { n: 'nombre_negocio', t: 'Nombre del negocio', req: true, ancho: true },
      { n: 'telefono', t: 'Teléfono', tipo: 'tel' },
      { n: 'direccion', t: 'Dirección' },
      { n: 'dia_inicio_semana', t: 'La semana de pago empieza el', tipo: 'select', op: DIAS.map((d, i) => [i, d]),
        ayuda: 'Las cuentas semanales de los barberos se cuentan desde este día.' },
      { n: 'minutos_inactividad', t: 'Cerrar sesión tras minutos sin uso', tipo: 'number', min: 0, req: true,
        ayuda: '0 = nunca. Si el equipo es compartido se recomienda 30.' }
    ];
    cont.innerHTML = `<div class="panel" style="max-width:760px"><form id="cf-form">${Form.html(campos, App.config)}
      <button class="btn grande" type="submit"><i class="bi bi-check2"></i> Guardar configuración</button></form>
      <p class="suave peq mt">Los horarios de cada barbero se cambian en <a href="#/horarios">Horarios</a>.</p></div>`;
    cont.querySelector('#cf-form').onsubmit = async (ev) => {
      ev.preventDefault();
      try {
        const v = Form.leer(cont, campos);
        v.dia_inicio_semana = Number(v.dia_inicio_semana);
        await q(sb.from('configuracion').update(v).eq('id', 1));
        await App.cargarDatos();
        UI.ok('Configuración guardada.');
      } catch (e) { UI.error(e); }
    };
  }
});
