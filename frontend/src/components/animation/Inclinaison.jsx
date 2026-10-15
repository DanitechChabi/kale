import { useRef } from 'react';

// Inclinaison 3D qui suit la souris (ordinateur uniquement ; rien au toucher).
// Les angles passent par des variables CSS : aucun rendu React pendant le mouvement.
export default function Inclinaison({ amplitude = 10, className = '', children }) {
  const ref = useRef(null);

  function suivre(evenement) {
    if (evenement.pointerType !== 'mouse') return;
    const element = ref.current;
    const zone = element.getBoundingClientRect();
    const x = (evenement.clientX - zone.left) / zone.width - 0.5;
    const y = (evenement.clientY - zone.top) / zone.height - 0.5;
    element.style.setProperty('--rx', `${(-y * amplitude).toFixed(2)}deg`);
    element.style.setProperty('--ry', `${(x * amplitude * 1.4).toFixed(2)}deg`);
  }

  function reinitialiser() {
    ref.current?.style.setProperty('--rx', '0deg');
    ref.current?.style.setProperty('--ry', '0deg');
  }

  return (
    <div className="scene">
      <div
        ref={ref}
        className={`inclinaison ${className}`}
        onPointerMove={suivre}
        onPointerLeave={reinitialiser}
      >
        {children}
      </div>
    </div>
  );
}
