# Stage 1
FROM node:20 AS build-stage

WORKDIR /ui

COPY package.json package-lock.json ./
RUN npm ci

COPY src/ ./src
COPY public/ ./public

ARG REACT_APP_API_BASE_URL
ENV REACT_APP_API_BASE_URL=$REACT_APP_API_BASE_URL

RUN npm run build

# Stage 2
FROM nginx:1.27.0-alpine

COPY --from=build-stage /ui/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

CMD nginx -g 'daemon off;'
