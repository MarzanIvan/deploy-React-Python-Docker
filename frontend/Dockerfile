FROM node:24-alpine AS build

COPY package.json package.json
RUN rm -rf node_modules package-lock.json
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build

FROM nginx:stable-alpine

COPY --from=build /build /usr/share/nginx/html
COPY --from=build nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000
EXPOSE 443

CMD [ "nginx", "-g", "daemon off;"]
