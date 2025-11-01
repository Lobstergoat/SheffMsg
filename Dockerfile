FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* pnpm-lock.yaml* /app/
RUN npm install --omit=dev || true

COPY . /app

ENV NODE_ENV=production
EXPOSE 3000

RUN node src/db.js migrate

CMD ["node", "src/app.js"]


