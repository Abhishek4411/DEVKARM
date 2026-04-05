import Keycloak from 'keycloak-js';

const keycloak = new Keycloak({
  url: 'http://localhost:8080',
  realm: 'devkarm',
  clientId: 'devkarm-web',
});

export function initKeycloak(): Promise<boolean> {
  return keycloak.init({ onLoad: 'login-required' });
}

export default keycloak;
