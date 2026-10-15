// Middleware de validation Zod réutilisable par toutes les routes.
// Usage : router.post('/', valider({ body: schemaCreation }), controleur)
// Les données validées (et nettoyées) sont exposées dans req.valide.

export function valider(schemas) {
  return (req, _res, next) => {
    try {
      req.valide = {};
      for (const source of ['body', 'params', 'query']) {
        if (schemas[source]) req.valide[source] = schemas[source].parse(req[source]);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
