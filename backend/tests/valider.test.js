import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { valider } from '../src/middlewares/valider.js';
import { gestionnaireErreurs } from '../src/middlewares/erreurs.js';

// Mini-application qui utilise le middleware de validation Zod
const app = express();
app.use(express.json());
app.post(
  '/test',
  valider({ body: z.object({ nom: z.string().min(2), age: z.number().int().positive() }) }),
  (req, res) => res.json(req.valide.body),
);
app.use(gestionnaireErreurs);

describe('middleware valider (Zod)', () => {
  it('laisse passer des données valides', async () => {
    const res = await request(app).post('/test').send({ nom: 'Koffi', age: 17 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ nom: 'Koffi', age: 17 });
  });

  it('renvoie une 400 détaillée pour des données invalides', async () => {
    const res = await request(app).post('/test').send({ nom: 'K', age: -1 });
    expect(res.status).toBe(400);
    expect(res.body.erreur.code).toBe('VALIDATION');
    expect(res.body.erreur.details.map((d) => d.champ).sort()).toEqual(['age', 'nom']);
  });
});
