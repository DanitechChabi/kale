// Page publique de vérification d'un document : /verifier/:numero
//
// Page HTML autonome produite par le serveur, pensée pour un téléphone en 2G :
// aucune police à télécharger, aucun framework, environ 10 Ko. Elle s'affiche
// entièrement sans JavaScript ; un petit script facultatif dessine la rosace du
// document et compare l'empreinte d'un fichier PDF sans l'envoyer au serveur.
import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { config } from '../config/env.js';
import rateLimit from 'express-rate-limit';
import { dateLongue, libellePeriode, note, rang } from '../contexts/releves/contenu.js';
import { consulterDocument } from '../contexts/releves/serviceVerificationPublique.js';
import { formaterNumero, normaliserNumero } from '../utils/numeroDocument.js';
import { parametresRosace } from '../utils/rosace.js';

export function creerRouteurPageVerification({ limite = config.LIMITE_VERIFICATION } = {}) {
  const routeur = Router();
  // Jeton à usage unique autorisant le style et le script de la page (CSP)
  routeur.use((req, res, next) => {
    res.locals.nonce = randomBytes(16).toString('base64');
    next();
  });
  routeur.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: limite,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: (req, res) =>
        envoyer(
          res,
          429,
          gabarit(
            res,
            'Trop de vérifications',
            pageMessage('Trop de vérifications depuis cette connexion. Réessayez dans une minute.'),
          ),
        ),
    }),
  );

  // Formulaire (ou numéro passé en paramètre : /verifier?numero=…)
  routeur.get('/', (req, res) => {
    const saisie = typeof req.query.numero === 'string' ? req.query.numero : '';
    const numero = normaliserNumero(saisie);
    if (numero) return res.redirect(303, `/verifier/${formaterNumero(numero)}`);
    envoyer(res, 200, gabarit(res, 'Vérifier un document', formulaire(saisie, Boolean(saisie))));
  });

  routeur.get('/:numero', async (req, res) => {
    const fiche = await consulterDocument(req.params.numero);
    if (!fiche.trouve) {
      return envoyer(
        res,
        404,
        gabarit(res, 'Document introuvable', pageIntrouvable(req.params.numero, fiche)),
      );
    }
    // Adresse canonique (numéro mis en forme)
    if (req.params.numero !== fiche.numero) {
      return res.redirect(301, `/verifier/${fiche.numero}`);
    }
    envoyer(res, 200, gabarit(res, `Document ${fiche.numero}`, pageDocument(res, fiche)));
  });

  return routeur;
}

// --- Rendu --------------------------------------------------------------------------

const echapper = (texte) =>
  String(texte ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

function envoyer(res, statut, html) {
  res
    .status(statut)
    .set({
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
      'X-Robots-Tag': 'noindex, nofollow',
      'Content-Security-Policy': [
        "default-src 'none'",
        `style-src 'nonce-${res.locals.nonce}'`,
        `script-src 'nonce-${res.locals.nonce}'`,
        "img-src 'self' data:",
        "form-action 'self'",
        "base-uri 'none'",
        "frame-ancestors 'none'",
      ].join('; '),
    })
    .send(html);
}

const ICONE = `<svg viewBox="0 0 512 512" width="28" height="28" aria-hidden="true"><rect width="512" height="512" rx="116" fill="#065F33"/><g transform="translate(-31 -24)"><path d="M150 96h150l76 76v236a24 24 0 0 1-24 24H150a24 24 0 0 1-24-24V120a24 24 0 0 1 24-24z" fill="#fff"/><path d="M300 96v52a24 24 0 0 0 24 24h52z" fill="#BFE3CC"/><rect x="172" y="200" width="150" height="20" rx="10" fill="#0E8A48"/><rect x="172" y="248" width="168" height="20" rx="10" fill="#0E8A48" opacity=".35"/><circle cx="356" cy="372" r="92" fill="#065F33"/><circle cx="356" cy="372" r="74" fill="#FCD116"/><path d="M320 374l25 25 49-53" fill="none" stroke="#065F33" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`;

const STYLE = `
*{box-sizing:border-box}
body{margin:0;background:#f4f8f5;color:#0b2a1a;font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}
.mono{font-family:ui-monospace,"SFMono-Regular",Menlo,Consolas,monospace;font-variant-numeric:tabular-nums}
header{display:flex;align-items:center;gap:10px;padding:12px 16px;background:#fff;border-bottom:1px solid #dbe5de}
header a{display:flex;align-items:center;gap:8px;color:inherit;text-decoration:none;font-weight:700}
header span b{color:#0e8a48}
main{max-width:640px;margin:0 auto;padding:16px}
.etat{border-left:4px solid;padding:14px 16px;background:#fff;margin:0 0 16px}
.etat h1{margin:0;font-size:20px;line-height:1.25}
.etat p{margin:4px 0 0;font-size:14px}
.ok{border-color:#0e8a48}.ok h1{color:#065f33}
.alerte{border-color:#a8820f}.alerte h1{color:#7a5d06}
.ko{border-color:#c8102e}.ko h1{color:#c8102e}
section{background:#fff;border:1px solid #dbe5de;margin:0 0 16px;padding:14px 16px}
h2{margin:0 0 8px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#5b6b61}
dl{margin:0;display:grid;grid-template-columns:auto 1fr;gap:4px 14px;font-size:15px}
dt{color:#5b6b61}dd{margin:0;font-weight:600;overflow-wrap:anywhere}
table{width:100%;border-collapse:collapse;font-size:14px}
th{text-align:left;font-size:11px;color:#5b6b61;text-transform:uppercase;letter-spacing:.04em;border-bottom:2px solid #0b2a1a;padding:4px 0}
td{border-bottom:1px solid #c9dceb;padding:5px 0}
td.n,th.n{text-align:right;padding-left:10px}
.grand{font-size:30px;font-weight:700;line-height:1}
.rouge{color:#c8102e}
.rosace{display:flex;gap:14px;align-items:center}
.rosace svg{flex:none}
.petit{font-size:13px;color:#5b6b61}
.empreinte{font-size:12px;overflow-wrap:anywhere;background:#f4f8f5;padding:6px 8px;margin:6px 0 0}
form{display:flex;gap:8px;flex-wrap:wrap}
input[type=text]{flex:1 1 200px;font:inherit;padding:10px 12px;border:1px solid #9fb3a6;text-transform:uppercase}
button,.bouton{font:inherit;font-weight:700;padding:10px 16px;border:0;background:#065f33;color:#fff;cursor:pointer;text-decoration:none;display:inline-block}
a{color:#065f33}
footer{max-width:640px;margin:0 auto;padding:0 16px 24px;font-size:13px;color:#5b6b61}
#resultat-fichier{font-weight:700;margin:8px 0 0}
h2.titre{font-size:17px;letter-spacing:0;text-transform:none;color:#0b2a1a}
.fichier input{position:absolute;width:1px;height:1px;opacity:0}
.fichier{display:inline-block;position:relative;font-weight:700;padding:9px 14px;border:1px solid #9fb3a6;background:#fff;color:#065f33;cursor:pointer}
.fichier:focus-within{outline:2px solid #065f33;outline-offset:2px}
.m0{margin:0}.m10{margin:0 0 10px}.mt{margin:12px 0 4px}
`;

function gabarit(res, titre, contenu) {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<meta name="theme-color" content="#065f33">
<title>${echapper(titre)} · EduRelevé</title>
<style nonce="${res.locals.nonce}">${STYLE}</style></head>
<body><header><a href="/">${ICONE}<span>Edu<b>Relevé</b></span></a><span class="petit">· Vérification</span></header>
<main>${contenu}</main>
<footer>Vérification publique et gratuite des bulletins et relevés archivés. Service automatique pour les universités et employeurs : <a href="/api/public/v1/documents">API de vérification</a>.</footer>
</body></html>`;
}

const pageMessage = (message) => `<div class="etat ko"><h1>${echapper(message)}</h1></div>`;

function formulaire(saisie = '', invalide = false) {
  return `<section><h2>Vérifier un document</h2>
<p class="petit">Saisissez le numéro imprimé à côté du QR code, par exemple B26-7K3M-Q9P2X.</p>
<form method="get" action="/verifier"><input type="text" name="numero" value="${echapper(saisie)}" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Numéro du document" required><button type="submit">Vérifier</button></form>
${invalide ? '<p class="rouge">Ce numéro n’est pas valide : vérifiez chaque caractère.</p>' : ''}</section>`;
}

function pageIntrouvable(saisie, fiche) {
  return `<div class="etat ko"><h1>Aucun document archivé ne porte ce numéro</h1>
<p>${
    fiche.formatInvalide
      ? 'Le numéro saisi est mal formé (une faute de frappe est détectée par son caractère de contrôle).'
      : `Le numéro ${echapper(fiche.numero)} est bien formé mais n’existe pas dans l’archive. Un document qui le porte n’est pas authentique.`
  }</p></div>${formulaire(saisie)}`;
}

function pageDocument(res, f) {
  const enVigueur = f.statut === 'EN_VIGUEUR';
  const titreType =
    f.type === 'BULLETIN_PERIODE'
      ? `Bulletin du ${libellePeriode(f.periode)}`
      : 'Relevé de notes annuel';
  const etat = enVigueur
    ? `<div class="etat ok"><h1>Document authentique</h1><p>Archivé le ${dateLongue(f.delivreLe)} par l’établissement, sans modification possible depuis.</p></div>`
    : `<div class="etat alerte"><h1>Document authentique mais remplacé</h1><p>Une version corrigée a été délivrée : <a href="/verifier/${f.remplacePar.numero}" class="mono">${f.remplacePar.numero}</a>. Seule la version corrigée fait foi.</p></div>`;

  const lignes = f.matieres
    .map(
      (m) =>
        `<tr><td>${echapper(m.matiere)}${m.estFacultative ? ' <span class="petit">(facultative)</span>' : ''}</td><td class="n mono">${m.coefficient}</td><td class="n mono${m.moyenne !== null && m.moyenne < 10 ? ' rouge' : ''}">${note(m.moyenne)}</td></tr>`,
    )
    .join('');

  const parametres = JSON.stringify(parametresRosace(f.numero.replace(/-/g, '')));

  return `${etat}
<section><h2 class="titre">${echapper(titreType)} · ${echapper(f.anneeScolaire)}</h2>
<dl>
<dt>Numéro</dt><dd class="mono">${f.numero}</dd>
<dt>Élève</dt><dd>${echapper(f.eleve.nom)} ${echapper(f.eleve.prenoms)}</dd>
<dt>Naissance</dt><dd>${dateLongue(f.eleve.dateNaissance)}</dd>
<dt>Classe</dt><dd>${echapper(f.classe)}</dd>
<dt>Établissement</dt><dd>${echapper(f.etablissement.nom)}${f.etablissement.commune ? `, ${echapper(f.etablissement.commune)}` : ''}</dd>
${f.remplace ? `<dt>Remplace</dt><dd><a class="mono" href="/verifier/${f.remplace.numero}">${f.remplace.numero}</a> — ${echapper(f.remplace.motif)}</dd>` : ''}
</dl></section>
<section><h2>Résultats</h2>
<p class="m10"><span class="grand mono${f.resultats.moyenneGenerale !== null && f.resultats.moyenneGenerale < 10 ? ' rouge' : ''}">${note(f.resultats.moyenneGenerale)}</span> <span class="petit">/ 20 · rang ${rang(f.resultats.rang, f.resultats.exAequo)} sur ${f.resultats.classes}${f.resultats.distinction ? ` · ${echapper(f.resultats.distinction)}` : ''}</span></p>
<table><thead><tr><th>Matière</th><th class="n">Coef.</th><th class="n">${f.type === 'BULLETIN_PERIODE' ? 'Moy.' : 'Moy. ann.'}</th></tr></thead><tbody>${lignes}</tbody></table>
<p class="petit">Comparez ces moyennes avec celles de la copie présentée, notamment une copie papier.</p></section>
<section><h2>Contrôle du document</h2>
<div class="rosace"><svg id="rosace" width="96" height="96" viewBox="0 0 96 96" fill="none" stroke="#065f33" stroke-width=".6" aria-label="Rosace du document"></svg>
<p class="petit m0">Cette rosace est propre au document : elle doit être identique à celle imprimée à côté du QR code.</p></div>
<p class="petit mt">Empreinte SHA-256 du fichier PDF archivé :</p>
<p class="empreinte mono">${f.empreinteSha256}</p>
<p class="petit mt">Vous avez reçu le fichier PDF ? Vérifiez qu’il n’a pas été modifié (il reste sur votre appareil) :</p>
<label class="fichier">Choisir le fichier PDF<input type="file" id="fichier" accept="application/pdf,.pdf"></label>
<p id="resultat-fichier" role="status"></p>
</section>
<script nonce="${res.locals.nonce}">
(function(){
var p=${parametres},s=document.getElementById('rosace'),d='',r=48;
p.forEach(function(a){for(var i=0;i<a.copies;i++){var ph=((i+a.decalage)/a.copies)*(2*Math.PI/a.n);for(var k=0;k<=180;k++){var t=k/180*2*Math.PI,q=r*(a.R+a.A*Math.sin(a.n*t+ph));d+=(k?'L':'M')+(r+q*Math.cos(t)).toFixed(1)+' '+(r+q*Math.sin(t)).toFixed(1);}d+='Z';}});
s.innerHTML='<path d="'+d+'"/>';
var f=document.getElementById('fichier'),o=document.getElementById('resultat-fichier'),e='${f.empreinteSha256}';
if(!window.crypto||!crypto.subtle){f.disabled=true;return;}
f.addEventListener('change',function(){var x=f.files[0];if(!x)return;o.textContent='Calcul en cours…';o.className='';
x.arrayBuffer().then(function(b){return crypto.subtle.digest('SHA-256',b)}).then(function(h){
var v=Array.prototype.map.call(new Uint8Array(h),function(c){return('0'+c.toString(16)).slice(-2)}).join('');
if(v===e){o.textContent='Fichier conforme : il est identique à l’original archivé.';o.style.color='#065f33';}
else{o.textContent='Fichier non conforme : il diffère de l’original archivé (modifié ou autre document).';o.style.color='#c8102e';}});});
})();
</script>`;
}
