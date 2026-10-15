import { useNavigate } from 'react-router-dom';

// Lien vers une section de l'accueil (#espaces…). Le défilement est géré en JavaScript
// pour fonctionner quel que soit le routeur (historique ou hash) et depuis n'importe quelle page.
export default function LienAncre({ cible, children, ...reste }) {
  const naviguer = useNavigate();

  function surClic(evenement) {
    evenement.preventDefault();
    const section = document.getElementById(cible);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      // Section absente de la page courante : retour à l'accueil, qui fera défiler
      naviguer('/', { state: { ancre: cible } });
    }
  }

  return (
    <a href={`#${cible}`} onClick={surClic} {...reste}>
      {children}
    </a>
  );
}
