import { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const classeSaisie = (erreur) =>
  `block w-full rounded-lg border bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:outline-none focus:ring-2 sm:text-sm ${
    erreur
      ? 'border-rouge/60 focus:border-rouge focus:ring-rouge/20'
      : 'border-slate-300 focus:border-marque-500 focus:ring-marque-500/20'
  }`;

/** Libellé, aide et message d'erreur autour d'un contrôle de formulaire. */
export function Cadre({ id, libelle, aide, erreur, obligatoire, children }) {
  return (
    <div className="space-y-1.5">
      {libelle && (
        <label htmlFor={id} className="block text-sm font-medium text-slate-800">
          {libelle}
          {obligatoire && <span className="text-rouge"> *</span>}
        </label>
      )}
      {children}
      {erreur ? (
        <p id={`${id}-erreur`} className="text-sm text-rouge" role="alert">
          {erreur}
        </p>
      ) : (
        aide && (
          <p id={`${id}-aide`} className="text-sm text-slate-500">
            {aide}
          </p>
        )
      )}
    </div>
  );
}

export function Champ({ libelle, aide, erreur, obligatoire, id: idFourni, ...reste }) {
  const idAuto = useId();
  const id = idFourni ?? idAuto;
  return (
    <Cadre id={id} libelle={libelle} aide={aide} erreur={erreur} obligatoire={obligatoire}>
      <input
        id={id}
        required={obligatoire}
        aria-invalid={Boolean(erreur)}
        aria-describedby={erreur ? `${id}-erreur` : aide ? `${id}-aide` : undefined}
        className={classeSaisie(erreur)}
        {...reste}
      />
    </Cadre>
  );
}

export function ChampMotDePasse({ libelle = 'Mot de passe', aide, erreur, obligatoire, ...reste }) {
  const [visible, setVisible] = useState(false);
  const id = useId();
  return (
    <Cadre id={id} libelle={libelle} aide={aide} erreur={erreur} obligatoire={obligatoire}>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          required={obligatoire}
          aria-invalid={Boolean(erreur)}
          aria-describedby={erreur ? `${id}-erreur` : aide ? `${id}-aide` : undefined}
          className={`${classeSaisie(erreur)} pr-11`}
          {...reste}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-slate-500 hover:text-slate-800"
          aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </Cadre>
  );
}

export function ChampSelection({
  libelle,
  aide,
  erreur,
  obligatoire,
  options,
  placeholder,
  ...reste
}) {
  const id = useId();
  return (
    <Cadre id={id} libelle={libelle} aide={aide} erreur={erreur} obligatoire={obligatoire}>
      <select
        id={id}
        required={obligatoire}
        aria-invalid={Boolean(erreur)}
        className={classeSaisie(erreur)}
        {...reste}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(({ valeur, libelle: texte }) => (
          <option key={valeur} value={valeur}>
            {texte}
          </option>
        ))}
      </select>
    </Cadre>
  );
}
