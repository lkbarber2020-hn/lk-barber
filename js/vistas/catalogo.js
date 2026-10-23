/* ==========================================================================
   Catálogos del dueño: servicios (con lo que gana el barbero por cada uno),
   productos con precio y existencias, y barberos.
   ========================================================================== */

const recargarProductos = async () => {
  App.datos.productos = await q(sb.from('productos').select('*').order('categoria').order('orden').order('nombre'));
};

/* ----- Servicios ---------------------------------------------------------- */

vista('servicios', {
  titulo: 'Servicios', icono: 'scissors', roles: DUENO,
  render(cont) {
    const lista = App.datos.servicios;
    const sinPago = lista.filter(s => s.activo && !Number(s.pago_barbero));
    cont.innerHTML = `<div class="barra-herramientas">
        <p class="crece suave" style="margin:0">Lo que aparece en Cobrar para tocar. El barbero escribe cuánto cobró; aquí se define cuánto gana él por cada servicio.</p>
        <button class="btn" id="sv-nuevo"><i class="bi bi-plus-lg"></i> Nuevo servicio</button></div>
      ${sinPago.length ? `<div class="aviso ambar mb"><i class="bi bi-exclamation-triangle"></i>
        <span>Falta poner cuánto gana el barbero en: <b>${h(sinPago.map(s => s.nombre).join(', '))}</b>. Toque cada uno para completarlo.</span></div>` : ''}
      <div class="panel">${lista.length ? `<div class="tabla-envoltura"><table class="tabla apilable">
        <thead><tr><th>Servicio</th><th class="num">Precio sugerido</th><th class="num">Gana el barbero</th><th>Estado</th></tr></thead>
        <tbody>${lista.map((s, i) => `<tr class="clic" data-i="${i}">
          <td data-t="Servicio"><strong>${h(s.nombre)}</strong></td>
          <td data-t="Precio sugerido" class="num">${s.precio_sugerido == null ? '<span class="suave">—</span>' : Fmt.L(s.precio_sugerido)}</td>
          <td data-t="Gana el barbero" class="num"><strong>${Fmt.L(s.pago_barbero)}</strong></td>
          <td data-t="Estado">${s.activo ? '<span class="etiqueta verde">Activo</span>' : '<span class="etiqueta gris">Oculto</span>'}</td></tr>`).join('')}
        </tbody></table></div>` : UI.vacio('scissors', 'No hay servicios.')}</div>`;
    const recargar = async () => { App.datos.servicios = await q(sb.from('servicios').select('*').order('orden').order('nombre')); this.render(cont); };
    cont.querySelector('#sv-nuevo').onclick = () => this.editar({ activo: true, pago_barbero: 0, orden: lista.length + 1 }, recargar);
    cont.querySelectorAll('tr[data-i]').forEach(tr => tr.onclick = () => this.editar(lista[Number(tr.dataset.i)], recargar));
  },

  editar(s, recargar) {
    const campos = [
      { n: 'nombre', t: 'Nombre', req: true, ancho: true, ph: 'Ej. Corte de pelo' },
      { n: 'pago_barbero', t: 'Gana el barbero (L)', tipo: 'number', req: true, min: 0, inputmode: 'decimal',
        ayuda: 'Monto fijo que gana el barbero cada vez que hace este servicio.' },
      { n: 'precio_sugerido', t: 'Precio sugerido (L, opcional)', tipo: 'number', min: 0, inputmode: 'decimal',
        ayuda: 'Si lo pone, se propone al cobrar. El barbero lo puede cambiar.' },
      { n: 'orden', t: 'Posición en la pantalla de cobrar', tipo: 'number', min: 0, paso: 1, ayuda: 'Los números más bajos salen primero.' },
      { n: 'activo', t: 'Mostrar en Cobrar', tipo: 'check' }
    ];
    UI.modal({
      titulo: s.id ? 'Editar servicio' : 'Nuevo servicio', cuerpo: Form.html(campos, s),
      botones: [
        { texto: 'Cancelar', clase: 'sec' },
        {
          texto: 'Guardar', icono: 'check2', accion: async (m) => {
            const v = Form.leer(m.cuerpo, campos);
            v.orden = v.orden ?? 0;
            if (s.id) await q(sb.from('servicios').update(v).eq('id', s.id));
            else await q(sb.from('servicios').insert(v));
            UI.ok('Servicio guardado.');
            recargar();
          }
        }
      ]
    });
  }
});

/* ----- Productos ---------------------------------------------------------- */

const Inventario = { buscar: '', categoria: '' };

vista('productos', {
  titulo: 'Productos', icono: 'cup-straw', roles: DUENO,
  render(cont) {
    const todos = App.datos.productos;
    const categorias = [...new Set(todos.map(p => p.categoria).filter(Boolean))].sort();
    const bajos = todos.filter(p => p.activo && p.stock <= p.stock_minimo);
    cont.innerHTML = `<div class="barra-herramientas">
        <div class="buscador"><i class="bi bi-search"></i><input type="search" id="pr-buscar" placeholder="Buscar producto…" value="${h(Inventario.buscar)}"></div>
        ${categorias.length ? `<select id="pr-cat" aria-label="Categoría"><option value="">Todas las categorías</option>
          ${categorias.map(c => `<option ${c === Inventario.categoria ? 'selected' : ''}>${h(c)}</option>`).join('')}</select>` : ''}
        <button class="btn" id="pr-nuevo"><i class="bi bi-plus-lg"></i> Nuevo producto</button></div>
      ${bajos.length ? `<div class="aviso ambar mb"><i class="bi bi-box-seam"></i>
        <span>Quedan pocos o se acabaron: <b>${h(bajos.map(p => `${p.nombre} (${p.stock})`).join(', '))}</b></span></div>` : ''}
      <div class="panel" id="pr-lista"></div>`;
    const recargar = async () => { await recargarProductos(); this.render(cont); };
    const pintar = () => {
      const t = Inventario.buscar.toLowerCase();
      const lista = todos.filter(p => (!t || p.nombre.toLowerCase().includes(t)) && (!Inventario.categoria || p.categoria === Inventario.categoria));
      const caja = cont.querySelector('#pr-lista');
      if (!lista.length) { caja.innerHTML = UI.vacio('cup-straw', todos.length ? 'Ningún producto coincide.' : 'Agregue los productos que se venden: refrescos, snacks, productos para el cabello…'); return; }
      caja.innerHTML = `<div class="tabla-envoltura"><table class="tabla apilable">
        <thead><tr><th>Producto</th><th>Categoría</th><th class="num">Precio</th><th class="num">Gana el barbero</th><th class="num">Existencias</th><th></th></tr></thead>
        <tbody>${lista.map(p => `<tr class="clic" data-id="${p.id}">
          <td data-t="Producto"><strong>${h(p.nombre)}</strong>${p.activo ? '' : ' <span class="etiqueta gris">Oculto</span>'}</td>
          <td data-t="Categoría">${h(p.categoria || '—')}</td>
          <td data-t="Precio" class="num">${Fmt.L(p.precio)}</td>
          <td data-t="Gana el barbero" class="num">${Fmt.L(p.pago_barbero)}</td>
          <td data-t="Existencias" class="num"><span class="etiqueta ${p.stock <= 0 ? 'rojo' : p.stock <= p.stock_minimo ? 'ambar' : 'verde'}">${p.stock}</span></td>
          <td data-t="" class="num"><div class="fila" style="justify-content:flex-end">
            <button class="btn chico suave" data-a="entrada" data-id="${p.id}"><i class="bi bi-plus-circle"></i> Entrada</button>
            <button class="btn chico suave" data-a="ajuste" data-id="${p.id}"><i class="bi bi-123"></i> Contar</button></div></td></tr>`).join('')}
        </tbody></table></div>`;
      caja.querySelectorAll('tr[data-id]').forEach(tr => tr.onclick = () => this.editar(todos.find(p => p.id === Number(tr.dataset.id)), categorias, recargar));
      caja.querySelectorAll('[data-a]').forEach(b => b.onclick = (ev) => {
        ev.stopPropagation();
        const p = todos.find(x => x.id === Number(b.dataset.id));
        if (b.dataset.a === 'entrada') this.entrada(p, recargar); else this.ajuste(p, recargar);
      });
    };
    cont.querySelector('#pr-buscar').oninput = (ev) => { Inventario.buscar = ev.target.value; pintar(); };
    const sel = cont.querySelector('#pr-cat');
    if (sel) sel.onchange = () => { Inventario.categoria = sel.value; pintar(); };
    cont.querySelector('#pr-nuevo').onclick = () => this.editar({ activo: true, pago_barbero: 0, stock_minimo: 3, orden: 0 }, categorias, recargar);
    pintar();
  },

  editar(p, categorias, recargar) {
    const nuevo = !p.id;
    const sugeridas = [...new Set([...categorias, 'Bebidas', 'Snacks', 'Cabello', 'Barba'])];
    const campos = [
      { n: 'nombre', t: 'Nombre', req: true, ancho: true, ph: 'Ej. Coca-Cola lata' },
      { n: 'categoria', t: 'Categoría', lista: 'pr-categorias', ph: 'Ej. Bebidas' },
      { n: 'precio', t: 'Precio de venta (L)', tipo: 'number', req: true, min: 0, inputmode: 'decimal' },
      { n: 'pago_barbero', t: 'Gana el barbero por unidad (L)', tipo: 'number', min: 0, inputmode: 'decimal', ayuda: '0 si no gana nada por venderlo.' },
      ...(nuevo ? [{ n: 'stock_inicial', t: 'Unidades que hay ahora', tipo: 'number', min: 0, paso: 1, inputmode: 'numeric' }] : []),
      { n: 'stock_minimo', t: 'Avisar cuando queden', tipo: 'number', min: 0, paso: 1, inputmode: 'numeric' },
      { n: 'orden', t: 'Posición en la pantalla de cobrar', tipo: 'number', min: 0, paso: 1 },
      ...(nuevo ? [] : [{ n: 'activo', t: 'Mostrar en Cobrar', tipo: 'check' }])
    ];
    const botones = [{ texto: 'Cancelar', clase: 'sec' }];
    if (!nuevo) botones.unshift({ texto: 'Historial', clase: 'sec', icono: 'clock-history', accion: () => { this.historial(p); return false; } });
    botones.push({
      texto: 'Guardar', icono: 'check2', accion: async (m) => {
        const v = Form.leer(m.cuerpo, campos);
        await rpc('guardar_producto', { p: { ...v, id: p.id || null, activo: nuevo ? true : v.activo } });
        UI.ok('Producto guardado.');
        recargar();
      }
    });
    UI.modal({
      titulo: nuevo ? 'Nuevo producto' : 'Editar producto',
      cuerpo: Form.html(campos, p) + `<datalist id="pr-categorias">${sugeridas.map(c => `<option value="${h(c)}">`).join('')}</datalist>` +
        (nuevo ? '' : `<p class="suave peq">Existencias actuales: <b>${p.stock}</b>. Para cambiarlas use "Entrada" o "Contar" en la lista.</p>`),
      botones
    });
  },

  async entrada(p, recargar) {
    const v = await UI.pedir('Entrada de ' + p.nombre, [
      { n: 'cantidad', t: 'Unidades que entran', tipo: 'number', req: true, min: 1, paso: 1, inputmode: 'numeric', ancho: true },
      { n: 'nota', t: 'Nota (opcional)', ancho: true, ph: 'Ej. compra en la distribuidora' }
    ], { boton: 'Agregar' });
    if (!v) return;
    try {
      if (!Number.isInteger(v.cantidad)) throw new Error('Escriba unidades enteras.');
      const stock = await rpc('entrada_producto', { p_producto: p.id, p_cantidad: v.cantidad, p_nota: v.nota });
      UI.ok(`Listo. Ahora hay ${stock} de "${p.nombre}".`);
      recargar();
    } catch (e) { UI.error(e); }
  },

  async ajuste(p, recargar) {
    const v = await UI.pedir('Contar ' + p.nombre, [
      { n: 'nuevo', t: `¿Cuántos hay realmente? (el sistema dice ${p.stock})`, tipo: 'number', req: true, min: 0, paso: 1, inputmode: 'numeric', ancho: true },
      { n: 'motivo', t: 'Motivo de la diferencia', req: true, ancho: true, ph: 'Ej. se dañó uno, conteo del mes' }
    ], { boton: 'Guardar conteo' });
    if (!v) return;
    try {
      if (!Number.isInteger(v.nuevo)) throw new Error('Escriba unidades enteras.');
      await rpc('ajustar_stock', { p_producto: p.id, p_nuevo: v.nuevo, p_motivo: v.motivo });
      UI.ok('Existencias corregidas.');
      recargar();
    } catch (e) { UI.error(e); }
  },

  async historial(p) {
    const m = UI.modal({ titulo: 'Historial de ' + p.nombre, cuerpo: '<div id="hi-mov"></div>', ancho: true });
    const caja = m.cuerpo.querySelector('#hi-mov');
    UI.cargando(caja);
    try {
      const filas = await q(sb.from('movimientos').select('*').eq('producto_id', p.id).order('fecha', { ascending: false }).limit(50));
      caja.innerHTML = filas.length ? `<div class="tabla-envoltura"><table class="tabla apilable">
        <thead><tr><th>Fecha</th><th>Movimiento</th><th class="num">Cantidad</th><th class="num">Quedaron</th></tr></thead>
        <tbody>${filas.map(f => `<tr>
          <td data-t="Fecha">${h(Fmt.fechaHora(f.fecha))}</td>
          <td data-t="Movimiento">${h(f.tipo === 'Anulacion' ? 'Anulación' : f.tipo)} <span class="suave peq">${h(f.nota)}</span></td>
          <td data-t="Cantidad" class="num">${f.cantidad > 0 ? '+' : ''}${f.cantidad}</td>
          <td data-t="Quedaron" class="num">${f.stock_resultante}</td></tr>`).join('')}
        </tbody></table></div>` : UI.vacio('clock-history', 'Sin movimientos.');
    } catch (e) { caja.innerHTML = UI.vacio('exclamation-triangle', e.message); }
  }
});

/* ----- Barberos ----------------------------------------------------------- */

vista('barberos', {
  titulo: 'Barberos', icono: 'people', roles: DUENO,
  async render(cont) {
    const lista = App.datos.barberos;
    const perfiles = await q(sb.from('perfiles').select('usuario,barbero_id,activo'));
    cont.innerHTML = `<div class="barra-herramientas">
        <p class="crece suave" style="margin:0">Cada barbero tiene su botón en Cobrar. Para que entre con su PIN, créele un usuario en <a href="#/usuarios">Usuarios</a>.</p>
        <button class="btn" id="ba-nuevo"><i class="bi bi-person-plus"></i> Nuevo barbero</button></div>
      <div class="panel">${lista.length ? `<div class="tabla-envoltura"><table class="tabla apilable">
        <thead><tr><th>Barbero</th><th>Teléfono</th><th>Usuario</th><th>Estado</th></tr></thead>
        <tbody>${lista.map((b, i) => {
          const u = perfiles.find(p => p.barbero_id === b.id && p.activo);
          return `<tr class="clic" data-i="${i}">
            <td data-t="Barbero"><span class="fila"><span class="avatar" style="background:${h(b.color)}">${h(Fmt.inicial(b.nombre))}</span><strong>${h(b.nombre)}</strong></span></td>
            <td data-t="Teléfono">${h(b.telefono || '—')}</td>
            <td data-t="Usuario">${u ? h(u.usuario) : '<span class="etiqueta ambar">Sin usuario</span>'}</td>
            <td data-t="Estado">${b.activo ? '<span class="etiqueta verde">Activo</span>' : '<span class="etiqueta gris">Ya no trabaja</span>'}</td></tr>`;
        }).join('')}
        </tbody></table></div>` : UI.vacio('people', 'Registre a los barberos para que aparezcan en Cobrar.')}</div>`;
    const recargar = async () => { App.datos.barberos = await q(sb.from('barberos').select('*').order('orden').order('nombre')); this.render(cont); };
    cont.querySelector('#ba-nuevo').onclick = () => this.editar({ activo: true, color: '#B22A2E', orden: lista.length + 1 }, recargar);
    cont.querySelectorAll('tr[data-i]').forEach(tr => tr.onclick = () => this.editar(lista[Number(tr.dataset.i)], recargar));
  },

  editar(b, recargar) {
    const campos = [
      { n: 'nombre', t: 'Nombre', req: true, ancho: true },
      { n: 'telefono', t: 'Teléfono (para enviarle su cuenta por WhatsApp)', tipo: 'tel', inputmode: 'tel', ancho: true },
      { n: 'color', t: 'Color de su botón', tipo: 'color' },
      { n: 'orden', t: 'Posición en Cobrar', tipo: 'number', min: 0, paso: 1 },
      ...(b.id ? [{ n: 'activo', t: 'Trabaja aquí (sale en Cobrar)', tipo: 'check' }] : [])
    ];
    UI.modal({
      titulo: b.id ? 'Editar barbero' : 'Nuevo barbero', cuerpo: Form.html(campos, b),
      botones: [
        { texto: 'Cancelar', clase: 'sec' },
        {
          texto: 'Guardar', icono: 'check2', accion: async (m) => {
            const v = Form.leer(m.cuerpo, campos);
            v.orden = v.orden ?? 0;
            if (b.id) await q(sb.from('barberos').update(v).eq('id', b.id));
            else await q(sb.from('barberos').insert(v));
            UI.ok('Barbero guardado.');
            recargar();
          }
        }
      ]
    });
  }
});
