// Titre révélé mot par mot : chaque mot monte depuis un masque, en cascade.
// `segments` : [{ texte, className }] pour colorer une partie du titre.
export default function TexteRevele({ segments, delaiInitial = 150, pas = 60 }) {
  let index = 0;
  return segments.map(({ texte, className = '' }, s) => (
    <span key={s} className={className}>
      {texte.split(' ').map((mot, m) => {
        const i = index++;
        return (
          <span key={m}>
            <span className="mot-masque">
              <span style={{ '--delai': `${delaiInitial + i * pas}ms` }}>{mot}</span>
            </span>{' '}
          </span>
        );
      })}
    </span>
  ));
}
