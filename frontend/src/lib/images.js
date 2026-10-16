// Préparation des photos avant envoi : une photo de téléphone (3 à 5 Mo) est
// réduite à 1 600 px et recompressée en JPEG (souvent 200 à 400 Ko), ce qui
// économise la data mobile. Les PDF et les petites images sont envoyés tels quels.

const COTE_MAX = 1600;
const QUALITE = 0.8;

function charger(fichier) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(fichier);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    image.src = url;
  });
}

export async function compresserImage(fichier) {
  if (!fichier.type.startsWith('image/') || fichier.size < 400 * 1024) return fichier;
  try {
    const image = await charger(fichier);
    const echelle = Math.min(1, COTE_MAX / Math.max(image.width, image.height));
    const canevas = document.createElement('canvas');
    canevas.width = Math.round(image.width * echelle);
    canevas.height = Math.round(image.height * echelle);
    canevas.getContext('2d').drawImage(image, 0, 0, canevas.width, canevas.height);
    const blob = await new Promise((resolve) => canevas.toBlob(resolve, 'image/jpeg', QUALITE));
    if (!blob || blob.size >= fichier.size) return fichier;
    return new File([blob], fichier.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return fichier; // navigateur sans canvas : envoi de l'original
  }
}
