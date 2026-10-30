/* ==========================================================================
   Cuentas: cuánto lleva cada barbero hoy o en la semana de pago, y cuánto
   hay que pagarle. El dueño ve a todos y los totales del negocio; cada
   barbero ve solo su cuenta (la base de datos solo le entrega sus cobros).
   ========================================================================== */

const Cuentas = { modo: 'semana', fecha: null };

vista('cuentas', {
  titulo: 'Cuentas', icono: 'wallet2', roles: TODOS,
  async render(cont) {
    Cuentas.fecha = Cuentas.fecha || Fmt.hoy();
    const semana = Cuentas.modo === 'semana';
    const desde = semana ? inicioSemana(Cuentas.fecha) : Cuentas.fecha;
    const hasta = semana ? Fmt.sumarDias(desde, 6) : Cuentas.fecha;
    const corto = (iso) => Fmt.aFecha(iso).toLocaleDateString('es-HN', { day: 'numeric', month: 'short' });

    cont.innerHTML = `
      <div class="pestanas">
        <button class="pestana ${semana ? '' : 'activa'}" data-modo="dia">Hoy</button>
        <button class="pestana ${semana ? 'activa' : ''}" data-modo="semana">Semana</button>
      </div>
      <div class="barra-herramientas">
        <button class="btn-icono" id="cu-ant" aria-label="${semana ? 'Semana' : 'Día'} anterior"><i class="bi bi-chevron-left"></i></button>
        <button class="btn-icono" id="cu-sig" aria-label="${semana ? 'Semana' : 'Día'} siguiente"><i class="bi bi-chevron-right"></i></button>
        <strong class="crece" style="font-size:1.1rem">${semana ? h(corto(desde) + ' – ' + corto(hasta)) : h(Fmt.fechaLarga(desde))}</strong>
      </div>
      <div id="cu-cuerpo"></div>`;
    const ir = (fecha, modo = Cuentas.modo) => { Cuentas.fecha = fecha; Cuentas.modo = modo; this.render(cont); };
    cont.querySelectorAll('[data-modo]').forEach(b => b.onclick = () => ir(Fmt.hoy(), b.dataset.modo));
    cont.querySelector('#cu-ant').onclick = () => ir(Fmt.sumarDias(Cuentas.fecha, semana ? -7 : -1));
    cont.querySelector('#cu-sig').onclick = () => ir(Fmt.sumarDias(Cuentas.fecha, semana ? 7 : 1));

    const cuerpo = cont.querySelector('#cu-cuerpo');
    UI.cargando(cuerpo);
    const [inicio, fin] = Fmt.rangoDias(desde, hasta);
    const cobros = await q(sb.from('cobros')
      .select('*, detalle:cobros_detalle(tipo,descripcion,cantidad,importe,pago_barbero)')
      .eq('estado', 'Emitido').gte('fecha', inicio).lt('fecha', fin).order('fecha'));

    const cuentas = this.agrupar(cobros);
    // El dueño ve a todos los barberos activos aunque no tengan cobros; el barbero, solo a sí mismo
    const ids = esDueno()
      ? App.datos.barberos.filter(x => x.activo || cuentas.has(x.id)).map(x => x.id)
      : [App.perfil.barbero_id].filter(Boolean);
    if (!ids.length) {
      cuerpo.innerHTML = UI.vacio('person-x', esDueno() ? 'Todavía no hay barberos registrados.' : 'Su usuario no está unido a un barbero. Pídale al dueño que lo una en Usuarios.');
      return;
    }

    // La propina entra a caja con la forma de pago del cobro, pero es toda del barbero
    const suma = (campo) => redondear(cobros.reduce((t, c) => t + Number(c[campo] || 0), 0));
    const porMetodo = (m) => redondear(cobros.filter(c => c.metodo_pago === m).reduce((t, c) => t + Number(c.total) + Number(c.propina || 0), 0));
    const kpis = esDueno() ? `<div class="kpis">
        <div class="kpi acento"><small>Ventas</small><strong>${Fmt.L(suma('total'))}</strong></div>
        <div class="kpi"><small>Propinas</small><strong>${Fmt.L(suma('propina'))}</strong></div>
        <div class="kpi"><small>Efectivo</small><strong>${Fmt.L(porMetodo('Efectivo'))}</strong></div>
        <div class="kpi"><small>Tarjeta</small><strong>${Fmt.L(porMetodo('Tarjeta'))}</strong></div>
        <div class="kpi"><small>Transferencia</small><strong>${Fmt.L(porMetodo('Transferencia'))}</strong></div>
        <div class="kpi"><small>Pago a barberos (con propinas)</small><strong>${Fmt.L(suma('pago_barbero') + suma('propina'))}</strong></div>
        <div class="kpi verde"><small>Queda para el negocio</small><strong>${Fmt.L(suma('total') - suma('pago_barbero'))}</strong></div>
      </div>` : '';

    const esEstaSemana = semana && desde === inicioSemana(Fmt.hoy());
    const etiquetaPago = !semana ? (desde === Fmt.hoy() ? 'Lleva hoy' : 'Ganó ese día') : esEstaSemana ? 'Lleva esta semana' : 'A pagar esa semana';
    cuerpo.innerHTML = kpis + '<div class="cuentas">' + ids.map(id => {
      const b = barberoDe(id);
      const x = cuentas.get(id) || this.vacia();
      const top = Object.entries(x.conteo).sort((u, v) => v[1] - u[1]).map(([n, c]) => `${h(n)} ${c}`).join(' · ');
      const dias = semana ? '<div class="dias">' + [0, 1, 2, 3, 4, 5, 6].map(i => {
        const f = Fmt.sumarDias(desde, i);
        return `<div class="${f === Fmt.hoy() ? 'hoy' : ''}">${DIAS_CORTOS[Fmt.aFecha(f).getDay()]}<b>${Fmt.num(x.dias[f] || 0, 0)}</b></div>`;
      }).join('') + '</div>' : '';
      return `<div class="cuenta" data-b="${id}" style="--color:${h(b.color)}">
        <div class="cuenta-cab"><span class="avatar">${h(Fmt.inicial(b.nombre))}</span>
          <div class="crece"><strong>${h(b.nombre)}</strong>
            <div class="suave peq">${x.cobros} ${x.cobros === 1 ? 'cliente' : 'clientes'} · ${x.servicios} servicios${x.unidades ? ` · ${x.unidades} productos` : ''}</div></div>
          <i class="bi bi-chevron-right suave"></i></div>
        ${top ? `<div class="peq suave">${top}</div>` : ''}
        <div class="lista-def mt" style="margin-top:8px">
          <div><span>Cobrado en servicios</span><span>${Fmt.L(x.servicio)}</span></div>
          <div><span>Productos vendidos</span><span>${Fmt.L(x.producto)}</span></div>
          <div><span>Ganancia (comisión)</span><span>${Fmt.L(x.pago)}</span></div>
          <div><span>Propinas</span><span>${Fmt.L(x.propina)}</span></div>
        </div>
        ${dias}
        <div class="cuenta-pago"><span>${etiquetaPago}</span><strong>${Fmt.L(x.pago + x.propina)}</strong></div>
      </div>`;
    }).join('') + '</div>' +
      (semana ? '<p class="suave peq mt">Los números de cada día son lo que ganó el barbero ese día, con propinas.</p>' : '');

    cuerpo.querySelectorAll('.cuenta').forEach(el => el.onclick = () => {
      const id = Number(el.dataset.b);
      this.detalle(barberoDe(id), cobros.filter(c => c.barbero_id === id), cuentas.get(id) || this.vacia(), desde, hasta);
    });
  },

  vacia() { return { cobros: 0, servicios: 0, unidades: 0, servicio: 0, producto: 0, pago: 0, propina: 0, conteo: {}, dias: {} }; },

  /** Suma los cobros por barbero. */
  agrupar(cobros) {
    const m = new Map();
    cobros.forEach(c => {
      if (!m.has(c.barbero_id)) m.set(c.barbero_id, this.vacia());
      const x = m.get(c.barbero_id);
      const dia = Fmt.iso(new Date(c.fecha));
      x.cobros++;
      x.servicio = redondear(x.servicio + Number(c.monto_servicios));
      x.producto = redondear(x.producto + Number(c.monto_productos));
      x.pago = redondear(x.pago + Number(c.pago_barbero));
      x.propina = redondear(x.propina + Number(c.propina || 0));
      x.dias[dia] = redondear((x.dias[dia] || 0) + Number(c.pago_barbero) + Number(c.propina || 0));
      c.detalle.forEach(d => {
        if (d.tipo === 'Servicio') { x.servicios++; x.conteo[d.descripcion] = (x.conteo[d.descripcion] || 0) + 1; }
        else x.unidades += d.cantidad;
      });
    });
    return m;
  },

  detalle(b, cobros, x, desde, hasta) {
    const rango = desde === hasta ? Fmt.fecha(desde) : Fmt.fecha(desde) + ' al ' + Fmt.fecha(hasta);
    const cuerpo = `
      <p class="suave" style="margin-top:0">${h(rango)}</p>
      ${cobros.length ? `<div class="tabla-envoltura"><table class="tabla apilable">
        <thead><tr><th>Fecha</th><th>Lo que se hizo</th><th class="num">Cobrado</th><th class="num">Gana</th><th class="num">Propina</th></tr></thead>
        <tbody>${cobros.map(c => `<tr>
          <td data-t="Fecha">${h(Fmt.fechaHora(c.fecha))}<div class="suave peq">${h(c.numero)} · ${h(c.metodo_pago)}</div></td>
          <td data-t="Detalle">${h(c.detalle.map(d => d.tipo === 'Producto' && d.cantidad > 1 ? `${d.descripcion} ×${d.cantidad}` : d.descripcion).join(', '))}</td>
          <td data-t="Cobrado" class="num">${Fmt.L(c.total)}</td>
          <td data-t="Gana" class="num"><strong>${Fmt.L(c.pago_barbero)}</strong></td>
          <td data-t="Propina" class="num">${Number(c.propina) ? Fmt.L(c.propina) : '—'}</td></tr>`).join('')}
        </tbody></table></div>` : UI.vacio('scissors', 'Sin cobros en este periodo.')}
      <div class="lista-def mt">
        <div><span>Servicios hechos</span><span>${x.servicios}</span></div>
        <div><span>Productos vendidos</span><span>${x.unidades}</span></div>
        <div><span>Ganancia (comisión)</span><span>${Fmt.L(x.pago)}</span></div>
        <div><span>Propinas</span><span>${Fmt.L(x.propina)}</span></div>
        <div class="total"><span>Total a pagar</span><span>${Fmt.L(x.pago + x.propina)}</span></div>
      </div>`;
    const tel = String(b.telefono || '').replace(/\D/g, '');
    const botones = [{ texto: 'Cerrar', clase: 'sec' }];
    if (esDueno() && tel) botones.push({
      texto: 'Enviar por WhatsApp', icono: 'whatsapp', accion: () => {
        const texto = `*${App.config.nombre_negocio}* — Cuenta de ${b.nombre}\n${rango}\n` +
          `Servicios: ${x.servicios} · Productos: ${x.unidades}\n` +
          `Comisión: ${Fmt.L(x.pago)} · Propinas: ${Fmt.L(x.propina)}\n*Total a pagar: ${Fmt.L(x.pago + x.propina)}*`;
        window.open('https://wa.me/' + (tel.length === 8 ? '504' + tel : tel) + '?text=' + encodeURIComponent(texto), '_blank');
        return false;
      }
    });
    UI.modal({ titulo: 'Cuenta de ' + b.nombre, cuerpo, ancho: true, botones });
  }
});
