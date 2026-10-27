/* ==========================================================================
   Cobros: lista de cobros de un día, con su detalle. Solo el dueño anula
   (con motivo). Cada barbero ve solo los suyos.
   ========================================================================== */

const Historial = { fecha: null, barbero: '' };

vista('cobros', {
  titulo: 'Cobros', icono: 'receipt', roles: TODOS,
  async render(cont) {
    Historial.fecha = Historial.fecha || Fmt.hoy();
    cont.innerHTML = `<div class="barra-herramientas">
        <input type="date" id="hi-fecha" value="${Historial.fecha}" aria-label="Fecha">
        ${esDueno() ? `<select id="hi-barbero" aria-label="Barbero"><option value="">Todos los barberos</option>
          ${App.datos.barberos.map(b => `<option value="${b.id}" ${String(b.id) === Historial.barbero ? 'selected' : ''}>${h(b.nombre)}</option>`).join('')}</select>` : ''}
        <span class="crece"></span><strong id="hi-total"></strong>
      </div>
      <div class="panel" id="hi-lista"></div>`;
    cont.querySelector('#hi-fecha').onchange = (ev) => { if (ev.target.value) { Historial.fecha = ev.target.value; this.render(cont); } };
    const sel = cont.querySelector('#hi-barbero');
    if (sel) sel.onchange = () => { Historial.barbero = sel.value; this.render(cont); };

    const lista = cont.querySelector('#hi-lista');
    UI.cargando(lista);
    const [a, b] = Fmt.rangoDias(Historial.fecha, Historial.fecha);
    let consulta = sb.from('cobros').select('*, detalle:cobros_detalle(*)').gte('fecha', a).lt('fecha', b).order('fecha', { ascending: false });
    if (Historial.barbero) consulta = consulta.eq('barbero_id', Number(Historial.barbero));
    const cobros = await q(consulta);
    const validos = cobros.filter(c => c.estado === 'Emitido');
    cont.querySelector('#hi-total').textContent = `${validos.length} ${validos.length === 1 ? 'cobro' : 'cobros'} · ${Fmt.L(validos.reduce((t, c) => t + Number(c.total), 0))}`;

    if (!cobros.length) { lista.innerHTML = UI.vacio('receipt', 'No hay cobros este día.'); return; }
    lista.innerHTML = `<div class="tabla-envoltura"><table class="tabla apilable">
      <thead><tr><th>Hora</th><th>Barbero</th><th>Lo que se hizo</th><th>Pago</th><th class="num">Total</th></tr></thead>
      <tbody>${cobros.map((c, i) => `<tr class="clic ${c.estado === 'Anulado' ? 'anulada' : ''}" data-i="${i}">
        <td data-t="Hora">${h(Fmt.hora(c.fecha))} <span class="suave peq">${h(c.numero)}</span></td>
        <td data-t="Barbero">${h(barberoDe(c.barbero_id).nombre)}</td>
        <td data-t="Detalle">${h(c.detalle.map(d => d.descripcion).join(', '))}</td>
        <td data-t="Pago">${c.estado === 'Anulado' ? '<span class="etiqueta gris">Anulado</span>' : h(c.metodo_pago)}</td>
        <td data-t="Total" class="num"><strong>${Fmt.L(c.total)}</strong></td></tr>`).join('')}
      </tbody></table></div>`;
    lista.querySelectorAll('tr[data-i]').forEach(tr => tr.onclick = () => this.detalle(cobros[Number(tr.dataset.i)], () => this.render(cont)));
  },

  detalle(c, recargar) {
    const lineas = c.detalle.map(d => d.tipo === 'Servicio'
      // Los cobros anteriores al pago por porcentaje no guardaban el valor de cada servicio
      ? `<div><span>${h(d.descripcion)}</span>${Number(d.importe) ? `<span>${Fmt.L(d.importe)}</span>` : '<span class="suave">servicio</span>'}</div>`
      : `<div><span>${h(d.descripcion)} × ${d.cantidad}</span><span>${Fmt.L(d.importe)}</span></div>`).join('');
    const cuerpo = `
      ${c.estado === 'Anulado' ? `<div class="aviso rojo mb"><i class="bi bi-x-circle"></i>Anulado: ${h(c.motivo_anulacion)}</div>` : ''}
      <div class="lista-def">
        <div><span>Fecha</span><span>${h(Fmt.fechaHora(c.fecha))}</span></div>
        <div><span>Barbero</span><span>${h(barberoDe(c.barbero_id).nombre)}</span></div>
        ${lineas}
        <div><span>Valor de servicios</span><span>${Fmt.L(c.monto_servicios)}</span></div>
        <div><span>Forma de pago</span><span>${h(c.metodo_pago)}</span></div>
        <div><span>Gana el barbero</span><span>${Fmt.L(c.pago_barbero)}</span></div>
        <div class="total"><span>Total</span><span>${Fmt.L(c.total)}</span></div>
      </div>`;
    const botones = [{ texto: 'Cerrar', clase: 'sec' }];
    if (esDueno() && c.estado === 'Emitido') botones.unshift({
      texto: 'Anular', clase: 'peligro', icono: 'x-circle', accion: async () => {
        const v = await UI.pedir('Anular ' + c.numero, [{ n: 'motivo', t: 'Motivo', req: true, ancho: true, ph: 'Ej. se cobró dos veces' }], { boton: 'Anular cobro' });
        if (!v) return false;
        await rpc('anular_cobro', { p_cobro: c.id, p_motivo: v.motivo });
        UI.ok('Cobro anulado.');
        if (c.detalle.some(d => d.tipo === 'Producto')) App.datos.productos = await q(sb.from('productos').select('*').order('categoria').order('orden').order('nombre'));
        recargar();
      }
    });
    UI.modal({ titulo: 'Cobro ' + c.numero, cuerpo, botones });
  }
});
