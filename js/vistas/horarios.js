/* ==========================================================================
   Horarios: qué días y a qué hora trabaja cada barbero. Cada barbero
   cambia el suyo cuando quiera; el dueño puede cambiar el de todos.
   ========================================================================== */

vista('horarios', {
  titulo: 'Horarios', icono: 'clock', roles: TODOS,
  render(cont) {
    const inicio = Number(App.config.dia_inicio_semana ?? 1);
    const orden = [0, 1, 2, 3, 4, 5, 6].map(i => (inicio + i) % 7);
    const hoy = new Date().getDay();
    const barberos = App.datos.barberos.filter(b => b.activo);
    const turno = (d) => d ? `${Fmt.hora12(d.entra)} – ${Fmt.hora12(d.sale)}` : '';
    const trabajanHoy = barberos.filter(b => b.horario[hoy]);

    if (!barberos.length) { cont.innerHTML = UI.vacio('clock', 'Todavía no hay barberos registrados.'); return; }
    cont.innerHTML = `
      <div class="panel mb">
        <h3 class="panel-titulo">Hoy ${h(DIAS[hoy].toLowerCase())} trabajan</h3>
        ${trabajanHoy.length ? `<div class="chips">${trabajanHoy.map(b =>
          `<span class="chip" style="cursor:default"><span class="avatar" style="width:26px;height:26px;font-size:.8rem;background:${h(b.color)}">${h(Fmt.inicial(b.nombre))}</span>
            ${h(b.nombre)} <span class="suave peq">${h(turno(b.horario[hoy]))}</span></span>`).join('')}</div>`
          : '<p class="suave" style="margin:0">Nadie tiene horario para hoy.</p>'}
      </div>
      <div class="panel"><div class="tabla-envoltura"><table class="tabla apilable">
        <thead><tr><th>Barbero</th>${orden.map(d => `<th${d === hoy ? ' style="color:var(--acento)"' : ''}>${DIAS_CORTOS[d]}</th>`).join('')}<th></th></tr></thead>
        <tbody>${barberos.map(b => `<tr>
          <td data-t="Barbero"><strong>${h(b.nombre)}</strong></td>
          ${orden.map(d => `<td data-t="${DIAS[d]}">${b.horario[d] ? h(turno(b.horario[d])) : '<span class="etiqueta gris">Libre</span>'}</td>`).join('')}
          <td>${esDueno() || App.perfil.barbero_id === b.id
            ? `<button class="btn chico suave" data-b="${b.id}"><i class="bi bi-pencil"></i> Cambiar</button>` : ''}</td>
        </tr>`).join('')}</tbody></table></div></div>`;
    cont.querySelectorAll('[data-b]').forEach(btn => btn.onclick = () =>
      this.editar(barberos.find(b => b.id === Number(btn.dataset.b)), orden, () => this.render(cont)));
  },

  editar(b, orden, recargar) {
    const cuerpo = document.createElement('div');
    cuerpo.innerHTML = orden.map(d => {
      const t = b.horario[d];
      return `<div class="horario-dia" data-d="${d}">
        <strong>${DIAS[d]}</strong>
        <label class="check" style="margin:0"><input type="checkbox" ${t ? 'checked' : ''}> Trabaja</label>
        <input type="time" data-c="entra" value="${h(t ? t.entra : '09:00')}" aria-label="Entra el ${DIAS[d]}" ${t ? '' : 'disabled'}>
        <input type="time" data-c="sale" value="${h(t ? t.sale : '18:00')}" aria-label="Sale el ${DIAS[d]}" ${t ? '' : 'disabled'}>
      </div>`;
    }).join('') + '<p class="suave peq">Marque los días que trabaja y escriba la hora de entrada y de salida.</p>';
    cuerpo.querySelectorAll('.horario-dia').forEach(fila => {
      const check = fila.querySelector('input[type=checkbox]');
      check.onchange = () => fila.querySelectorAll('input[type=time]').forEach(i => { i.disabled = !check.checked; });
    });

    UI.modal({
      titulo: 'Horario de ' + b.nombre, cuerpo, sinFoco: true,
      botones: [
        { texto: 'Cancelar', clase: 'sec' },
        {
          texto: 'Guardar horario', icono: 'check2', accion: async () => {
            const horario = {};
            cuerpo.querySelectorAll('.horario-dia').forEach(fila => {
              if (!fila.querySelector('input[type=checkbox]').checked) return;
              const entra = fila.querySelector('[data-c=entra]').value;
              const sale = fila.querySelector('[data-c=sale]').value;
              if (!entra || !sale) throw new Error(`Escriba la hora de entrada y salida del ${DIAS[fila.dataset.d].toLowerCase()}.`);
              if (sale <= entra) throw new Error(`El ${DIAS[fila.dataset.d].toLowerCase()} la salida debe ser después de la entrada.`);
              horario[fila.dataset.d] = { entra, sale };
            });
            await rpc('guardar_horario', { p_barbero: b.id, p_horario: horario });
            App.datos.barberos = await q(sb.from('barberos').select('*').order('orden').order('nombre'));
            UI.ok('Horario guardado.');
            recargar();
          }
        }
      ]
    });
  }
});
