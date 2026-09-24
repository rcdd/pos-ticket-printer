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

# --chmod forces sane permissions regardless of whatever mode the source
# files in ui/public/ carry after checkout on a given host (this is the
# same bug class fixed in pos-ticket-printer-website's Dockerfile: some
# assets came out 700/owner-only, unreadable by nginx's non-root worker,
# hence 403s). 755 (not 644) because this COPY includes directories
# (static/, static/css/, static/js/) that need +x to be traversable.
COPY --from=build-stage --chmod=755 /ui/build /usr/share/nginx/html
COPY --chmod=644 nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

CMD nginx -g 'daemon off;'
