/* Inicio: tarjetas grandes con cada módulo. Cobrar va primero y resaltado. */

vista('inicio', {
  titulo: 'Inicio', icono: 'grid-3x3-gap-fill',
  render(cont) {
    const hora = new Date().getHours();
    const saludo = hora < 12 ? 'Buenos días' : hora < 18 ? 'Buenas tardes' : 'Buenas noches';
    cont.innerHTML = `
      <div class="saludo"><h2>${saludo}, ${h(App.perfil.nombre.split(' ')[0])}</h2>
        <p>${h(Fmt.fechaLarga(Fmt.hoy()))}</p></div>
      <div class="mosaico">
        ${App.vistasPermitidas().filter(v => v.id !== 'inicio').map(v => `
          <a class="tarjeta-modulo ${v.id === 'cobrar' ? 'destacada' : ''}" href="#/${v.id}"><i class="bi bi-${v.icono}"></i><span>${h(v.titulo)}</span></a>`).join('')}
      </div>`;
  }
});
