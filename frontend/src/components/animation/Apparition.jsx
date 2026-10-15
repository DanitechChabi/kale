import { useApparition } from '../../hooks/useApparition.js';

// Enveloppe qui fait apparaître son contenu en fondu montant lorsqu'il entre à l'écran.
// `delai` (ms) permet d'échelonner plusieurs éléments.
export default function Apparition({
  as: Balise = 'div',
  delai = 0,
  className = '',
  style,
  children,
  ...reste
}) {
  const [ref, visible] = useApparition();
  return (
    <Balise
      ref={ref}
      data-visible={visible}
      className={`apparition ${className}`}
      style={{ '--delai': `${delai}ms`, ...style }}
      {...reste}
    >
      {children}
    </Balise>
  );
}
