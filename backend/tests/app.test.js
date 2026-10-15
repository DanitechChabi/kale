import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { creerApp } from '../src/app.js';

const app = creerApp();

describe('API — initialisation', () => {
  it('GET /api/sante répond ok', async () => {
    const res = await request(app).get('/api/sante');
    expect(res.status).toBe(200);
    expect(res.body.statut).toBe('ok');
    expect(res.body.service).toBe('edureleve-api');
  });

  it('renvoie une 404 au format standard pour une route inconnue', async () => {
    const res = await request(app).get('/api/inexistante');
    expect(res.status).toBe(404);
    expect(res.body.erreur.code).toBe('ROUTE_INTROUVABLE');
  });

  it('rejette un JSON mal formé avec une 400', async () => {
    const res = await request(app)
      .post('/api/sante')
      .set('Content-Type', 'application/json')
      .send('{mal forme');
    expect(res.status).toBe(400);
    expect(res.body.erreur.code).toBe('JSON_INVALIDE');
  });

  it('applique les en-têtes de sécurité (helmet)', async () => {
    const res = await request(app).get('/api/sante');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
