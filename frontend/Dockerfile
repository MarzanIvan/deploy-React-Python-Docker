FROM node:alpine AS build

COPY package.json package.json
RUN rm -rf node_modules
RUN rm -rf node_modules package-lock.json
RUN npm install typescript@4.6.4 --save-dev
RUN npm install
RUN npm install typescript@latest --save-dev
COPY . .
RUN npm run build

FROM nginx:stable-alpine

COPY --from=build /build /usr/share/nginx/html
COPY --from=build nginx.conf /etc/nginx/conf.d/default.conf

# Копируем SSL сертификаты в контейнер из монтированной директории
COPY --from=certs fullchain.pem /etc/ssl/certs/fullchain.pem
COPY --from=certs privkey.pem /etc/ssl/certs/privkey.pem
COPY --from=certs chain.pem /etc/ssl/certs/chain.pem

EXPOSE 3000
EXPOSE 443

CMD [ "nginx", "-g", "daemon off;"]
