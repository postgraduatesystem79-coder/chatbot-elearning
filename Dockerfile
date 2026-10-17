FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=10000

COPY package.json ./
COPY .npmrc ./

RUN npm install --legacy-peer-deps

COPY . .

RUN npm run build

EXPOSE 10000

CMD ["node", "--import", "tsx/esm", "server.ts"]
