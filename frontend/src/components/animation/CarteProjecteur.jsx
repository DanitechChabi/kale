// Carte avec halo lumineux qui suit le pointeur (effet « projecteur »).
export default function CarteProjecteur({
  as: Balise = 'div',
  className = '',
  children,
  ...reste
}) {
  function suivre(evenement) {
    const zone = evenement.currentTarget.getBoundingClientRect();
    evenement.currentTarget.style.setProperty('--x', `${evenement.clientX - zone.left}px`);
    evenement.currentTarget.style.setProperty('--y', `${evenement.clientY - zone.top}px`);
  }

  return (
    <Balise className={`projecteur ${className}`} onPointerMove={suivre} {...reste}>
      {children}
    </Balise>
  );
}
