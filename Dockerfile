FROM node:16-slim

WORKDIR /usr/src/app
VOLUME /usr/src/app/keys

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

EXPOSE 3000

ENTRYPOINT [ "node", "dist/bin/www" ]