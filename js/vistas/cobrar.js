/* ==========================================================================
   Cobrar: la pantalla principal. Tres pasos y un botón:
   1) qué barbero atendió, 2) qué se hizo y cuánto se cobró, 3) productos.
   El valor de cada servicio lo escribe el barbero porque varía mucho (de
   ahí sale su porcentaje); los productos tienen precio fijo del catálogo.
   ========================================================================== */

const METODOS_PAGO = [['Efectivo', 'cash-stack'], ['Tarjeta', 'credit-card'], ['Transferencia', 'phone']];

/** Barbero del usuario que entró, si tiene uno activo. Se elige solo al empezar. */
const barberoPropio = () => {
  const id = App.perfil && App.perfil.barbero_id;
  return App.datos.barberos.some(b => b.id === id && b.activo) ? id : null;
};

/** El cobro en curso. Sobrevive a cambiar de pantalla. */
const Cobro = {
  iniciado: false, enviando: false,
  limpiar() {
    Object.assign(this, {
      iniciado: true, barbero: barberoPropio(), servicios: new Map(),   // id → lo que se cobró (texto del campo)
      productos: new Map(), metodo: 'Efectivo', pagaCon: ''
    });
  },
  montoDe(id) { return redondear(Number(this.servicios.get(id)) || 0); },
  montoServicios() { let t = 0; this.servicios.forEach((_, id) => { t += this.montoDe(id); }); return redondear(t); },
  /** Estimado de lo que gana el barbero; el valor oficial lo calcula la base de datos. */
  ganaBarbero() {
    let t = 0;
    this.servicios.forEach((_, id) => {
      const s = App.datos.servicios.find(x => x.id === id);
      if (s) t += s.porcentaje_barbero != null ? redondear(this.montoDe(id) * s.porcentaje_barbero / 100) : Number(s.pago_barbero);
    });
    this.productos.forEach((cant, id) => { const p = App.datos.productos.find(x => x.id === id); if (p) t += redondear(p.pago_barbero * cant); });
    return redondear(t);
  },
  montoProductos() {
    let t = 0;
    this.productos.forEach((cant, id) => { const p = App.datos.productos.find(x => x.id === id); if (p) t += p.precio * cant; });
    return redondear(t);
  },
  total() { return redondear(this.montoServicios() + this.montoProductos()); }
};

vista('cobrar', {
  titulo: 'Cobrar', icono: 'cash-coin', roles: TODOS,
  render(cont) {
    if (!Cobro.iniciado) Cobro.limpiar();
    const barberos = App.datos.barberos.filter(b => b.activo);
    const productos = App.datos.productos.filter(p => p.activo);
    const categorias = [...new Set(productos.map(p => p.categoria).filter(Boolean))];
    if (Cobro.categoria && !categorias.includes(Cobro.categoria)) Cobro.categoria = '';

    cont.innerHTML = `
      <div class="cobro">
        <div class="cobro-principal">
          <section class="panel">
            <h3 class="panel-titulo"><span class="paso">1</span>¿Quién atendió?</h3>
            ${barberos.length ? '<div class="barberos" id="co-barberos"></div>'
              : `<div class="aviso ambar"><i class="bi bi-person-exclamation"></i>Todavía no hay barberos.${esDueno() ? ' Regístrelos en <a href="#/barberos">Barberos</a>.' : ''}</div>`}
          </section>
          <section class="panel">
            <h3 class="panel-titulo"><span class="paso">2</span>¿Qué se hizo?</h3>
            <div class="chips" id="co-servicios"></div>
            <div id="co-montos"></div>
          </section>
          ${productos.length ? `<section class="panel">
            <h3 class="panel-titulo"><span class="paso">3</span>Productos <span class="suave peq">(si llevó algo)</span></h3>
            ${categorias.length > 1 ? `<div class="pestanas chicas">${['', ...categorias].map(c =>
              `<button class="pestana ${c === (Cobro.categoria || '') ? 'activa' : ''}" data-cat="${h(c)}">${h(c || 'Todos')}</button>`).join('')}</div>` : ''}
            <div class="productos-grid" id="co-productos"></div>
          </section>` : ''}
        </div>
        <aside class="panel cobro-resumen" id="co-resumen"></aside>
      </div>
      <div class="barra-movil visible" id="co-barra"></div>`;

    cont.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => { Cobro.categoria = b.dataset.cat; this.render(cont); });

    this.pintarBarberos(cont);
    this.pintarServicios(cont);
    this.pintarMontos(cont);
    this.pintarProductos(cont);
    this.pintarResumen(cont);
  },

  pintarBarberos(cont) {
    const caja = cont.querySelector('#co-barberos');
    if (!caja) return;
    caja.innerHTML = App.datos.barberos.filter(b => b.activo).map(b => `
      <button class="barbero ${Cobro.barbero === b.id ? 'activo' : ''}" data-b="${b.id}" style="--color:${h(b.color)}">
        <span class="avatar">${h(Fmt.inicial(b.nombre))}</span>${h(b.nombre)}</button>`).join('');
    caja.querySelectorAll('[data-b]').forEach(el => el.onclick = () => {
      Cobro.barbero = Number(el.dataset.b);
      this.pintarBarberos(cont);
      this.pintarResumen(cont);
    });
  },

  pintarServicios(cont) {
    const caja = cont.querySelector('#co-servicios');
    const servicios = App.datos.servicios.filter(s => s.activo);
    if (!servicios.length) {
      caja.innerHTML = `<p class="suave" style="margin:0">No hay servicios en el catálogo.${esDueno() ? ' Agréguelos en <a href="#/servicios">Servicios</a>.' : ''}</p>`;
      return;
    }
    caja.innerHTML = servicios.map(s => `<button class="chip ${Cobro.servicios.has(s.id) ? 'activo' : ''}" data-s="${s.id}">
      <i class="bi bi-${Cobro.servicios.has(s.id) ? 'check-circle-fill' : 'circle'}"></i>${h(s.nombre)}</button>`).join('');
    caja.querySelectorAll('[data-s]').forEach(el => el.onclick = () => {
      const id = Number(el.dataset.s);
      const s = servicios.find(x => x.id === id);
      // Al elegirlo se propone el precio sugerido; el barbero lo puede cambiar
      if (Cobro.servicios.has(id)) Cobro.servicios.delete(id);
      else Cobro.servicios.set(id, s.precio_sugerido > 0 ? String(redondear(Number(s.precio_sugerido))) : '');
      this.pintarServicios(cont);
      this.pintarMontos(cont, id);
      this.pintarResumen(cont);
    });
  },

  /** Un campo "cuánto se cobró" por cada servicio elegido. */
  pintarMontos(cont, enfocar) {
    const caja = cont.querySelector('#co-montos');
    const elegidos = App.datos.servicios.filter(s => Cobro.servicios.has(s.id));
    caja.innerHTML = elegidos.map(s => `<div class="campo mt" style="margin-bottom:0">
        <label for="co-monto-${s.id}">¿Cuánto se cobró por ${h(s.nombre)}? (${h(App.config.moneda)})</label>
        <input id="co-monto-${s.id}" data-monto="${s.id}" class="monto-grande" type="number" inputmode="decimal" min="0" step="any" placeholder="0.00" value="${h(Cobro.servicios.get(s.id))}">
      </div>`).join('');
    caja.querySelectorAll('[data-monto]').forEach(el => el.oninput = () => {
      Cobro.servicios.set(Number(el.dataset.monto), el.value);
      this.pintarResumen(cont);
    });
    const campo = enfocar && caja.querySelector(`[data-monto="${enfocar}"]`);
    if (campo && !campo.value) campo.focus();
  },

  pintarProductos(cont) {
    const caja = cont.querySelector('#co-productos');
    if (!caja) return;
    const lista = App.datos.productos.filter(p => p.activo && (!Cobro.categoria || p.categoria === Cobro.categoria));
    caja.innerHTML = lista.map(p => {
      const cant = Cobro.productos.get(p.id) || 0;
      return `<button class="prod-btn ${cant ? 'elegido' : ''}" data-p="${p.id}" ${p.stock <= 0 ? 'disabled' : ''}>
        ${cant ? `<span class="cuantos">${cant}</span>` : ''}
        <strong>${h(p.nombre)}</strong>
        <span class="precio">${Fmt.L(p.precio)}</span>
        <span class="quedan">${p.stock <= 0 ? 'Agotado' : 'Quedan ' + p.stock}</span></button>`;
    }).join('');
    caja.querySelectorAll('[data-p]').forEach(el => el.onclick = () => this.cambiarProducto(cont, Number(el.dataset.p), 1));
  },

  cambiarProducto(cont, id, delta) {
    const p = App.datos.productos.find(x => x.id === id);
    const nueva = (Cobro.productos.get(id) || 0) + delta;
    if (nueva > p.stock) return UI.error(new Error(`Solo quedan ${p.stock} de "${p.nombre}".`));
    if (nueva <= 0) Cobro.productos.delete(id); else Cobro.productos.set(id, nueva);
    this.pintarProductos(cont);
    this.pintarResumen(cont);
  },

  pintarResumen(cont) {
    const r = cont.querySelector('#co-resumen');
    const barbero = App.datos.barberos.find(b => b.id === Cobro.barbero);
    const servicios = App.datos.servicios.filter(s => Cobro.servicios.has(s.id)).map(s => s.nombre);
    const total = Cobro.total();
    const lineas = [...Cobro.productos].map(([id, cant]) => {
      const p = App.datos.productos.find(x => x.id === id);
      return `<div class="linea">
        <div><strong>${h(p.nombre)}</strong><div class="fila mt" style="margin-top:4px">
          <span class="cantidad"><button data-menos="${id}" aria-label="Quitar uno">−</button><span>${cant}</span><button data-mas="${id}" aria-label="Agregar uno">+</button></span>
          <span class="suave peq">× ${Fmt.L(p.precio)}</span></div></div>
        <span class="importe">${Fmt.L(p.precio * cant)}</span></div>`;
    }).join('');

    r.innerHTML = `
      <h3 class="panel-titulo">Resumen</h3>
      <div class="lista-def">
        <div><span>Barbero</span><span>${barbero ? h(barbero.nombre) : '<span style="color:var(--rojo)">Elegir</span>'}</span></div>
        <div><span>Servicios</span><span>${servicios.length ? h(servicios.join(', ')) : '—'}</span></div>
        <div><span>Valor de servicios</span><span>${Fmt.L(Cobro.montoServicios())}</span></div>
        <div><span>Gana el barbero</span><span>${Fmt.L(Cobro.ganaBarbero())}</span></div>
      </div>
      ${lineas}
      <div class="total-grande"><span>Total</span><span>${Fmt.L(total)}</span></div>
      <h4 class="mt" style="margin-bottom:8px">Forma de pago</h4>
      <div class="opciones-pago">${METODOS_PAGO.map(([m, i]) =>
        `<button class="opcion ${Cobro.metodo === m ? 'activa' : ''}" data-m="${m}"><i class="bi bi-${i}"></i>${m}</button>`).join('')}</div>
      ${Cobro.metodo === 'Efectivo' ? `<div class="fila mt">
        <div class="campo crece" style="margin:0"><label for="co-paga">Paga con (opcional)</label>
          <input id="co-paga" type="number" inputmode="decimal" min="0" step="any" value="${h(Cobro.pagaCon)}"></div>
        <div class="cambio" id="co-cambio"></div></div>` : ''}
      <button class="btn grande mt" id="co-cobrar" ${total <= 0 ? 'disabled' : ''}><i class="bi bi-check2-circle"></i> Cobrar ${Fmt.L(total)}</button>
      <button class="btn suave mt" style="width:100%" id="co-limpiar"><i class="bi bi-arrow-counterclockwise"></i> Empezar de nuevo</button>`;

    r.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { Cobro.metodo = b.dataset.m; this.pintarResumen(cont); });
    r.querySelectorAll('[data-mas]').forEach(b => b.onclick = () => this.cambiarProducto(cont, Number(b.dataset.mas), 1));
    r.querySelectorAll('[data-menos]').forEach(b => b.onclick = () => this.cambiarProducto(cont, Number(b.dataset.menos), -1));
    const paga = r.querySelector('#co-paga');
    const pintarCambio = () => {
      const c = Number(Cobro.pagaCon) - total;
      r.querySelector('#co-cambio').textContent = Cobro.pagaCon !== '' && c >= 0 ? 'Cambio: ' + Fmt.L(c) : '';
    };
    if (paga) { paga.oninput = () => { Cobro.pagaCon = paga.value; pintarCambio(); }; pintarCambio(); }
    r.querySelector('#co-cobrar').onclick = () => this.cobrar(cont);
    r.querySelector('#co-limpiar').onclick = () => { Cobro.limpiar(); this.render(cont); };

    const barra = cont.querySelector('#co-barra');
    barra.innerHTML = `<button class="btn grande" ${total <= 0 ? 'disabled' : ''}><i class="bi bi-check2-circle"></i>
      Cobrar ${Fmt.L(total)} · ${h(Cobro.metodo)}</button>`;
    barra.querySelector('button').onclick = () => this.cobrar(cont);
  },

  async cobrar(cont) {
    if (Cobro.enviando) return;
    try {
      if (!Cobro.barbero) throw new Error('Toque el barbero que atendió.');
      if (!Cobro.servicios.size && !Cobro.productos.size) throw new Error('Elija qué se hizo o qué producto lleva.');
      const sinMonto = App.datos.servicios.find(s => Cobro.servicios.has(s.id) && Cobro.montoDe(s.id) <= 0);
      if (sinMonto) {
        cont.querySelector(`[data-monto="${sinMonto.id}"]`).focus();
        throw new Error(`Escriba cuánto se cobró por ${sinMonto.nombre}.`);
      }
      if (Cobro.metodo === 'Efectivo' && Cobro.pagaCon !== '' && Number(Cobro.pagaCon) < Cobro.total()) {
        throw new Error('Con lo que paga no alcanza para el total.');
      }
    } catch (e) { return UI.error(e); }

    Cobro.enviando = true;
    cont.querySelectorAll('#co-cobrar, #co-barra button').forEach(b => { b.disabled = true; });
    const llevaProductos = Cobro.productos.size > 0;
    try {
      const r = await rpc('registrar_cobro', {
        p: {
          barbero_id: Cobro.barbero, metodo_pago: Cobro.metodo,
          servicios: [...Cobro.servicios.keys()].map(id => ({ id, monto: Cobro.montoDe(id) })),
          productos: [...Cobro.productos].map(([id, cantidad]) => ({ id, cantidad }))
        }
      });
      UI.ok(`Listo: ${r.numero} · ${r.barbero} · ${Fmt.L(r.total)}`);
      Cobro.limpiar();
      window.scrollTo(0, 0);
    } catch (e) {
      UI.error(e);
    } finally {
      // Las existencias cambiaron (o estaban desactualizadas si falló por falta de producto)
      if (llevaProductos) {
        App.datos.productos = await q(sb.from('productos').select('*').order('categoria').order('orden').order('nombre')).catch(() => App.datos.productos);
      }
      Cobro.enviando = false;
      if (App.vistaActual === 'cobrar') this.render(cont);
    }
  }
});
