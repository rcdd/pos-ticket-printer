// A build-time REACT_APP_API_BASE_URL wins (the public /demo build sets it).
// Otherwise the API is on port 9393 of whatever host served this page:
// localhost on the POS itself, the PC's LAN address when the admin opens the
// UI from another computer (http://<pc-ip>:3000).
export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL
    || `${window.location.protocol}//${window.location.hostname || 'localhost'}:9393`;
