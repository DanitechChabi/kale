# Kalé — health API (image Docker portable, alternative à Render native)
# Build : docker build -t kale-health-api ./services/health-api
# Run   : docker run -p 4000:4000 kale-health-api

FROM node:22-alpine

WORKDIR /app

# Aucune dépendance npm — on copie juste les sources
COPY package.json ./
COPY index.js ./

EXPOSE 4000

ENV NODE_ENV=production

CMD ["node", "index.js"]
