# Stage 1
FROM node:20 AS build-stage

WORKDIR /ui

COPY package.json package-lock.json ./
RUN npm ci

COPY src/ ./src
COPY public/ ./public

ARG REACT_APP_API_BASE_URL
ENV REACT_APP_API_BASE_URL=$REACT_APP_API_BASE_URL

# Empty by default (kiosk/local deploy, served at "/"); the public demo build
# passes PUBLIC_URL=/demo so CRA emits asset paths and BrowserRouter's
# basename (see App.js) matches the "/demo" path the reverse proxy uses.
ARG PUBLIC_URL=""
ENV PUBLIC_URL=$PUBLIC_URL

RUN npm run build

# Stage 2
FROM nginx:1.27.0-alpine

COPY --from=build-stage /ui/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

CMD nginx -g 'daemon off;'
