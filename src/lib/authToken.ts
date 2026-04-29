let _accessToken: string | null = null;
let _refreshToken: string | null = null;
let _onTokenExpired: (() => void | Promise<void>) | null = null;

export function setAccessToken(token: string | null) {
  _accessToken = token;
}

export function getAccessToken() {
  return _accessToken;
}

export function setRefreshToken(token: string | null) {
  _refreshToken = token;
}

export function getRefreshToken() {
  return _refreshToken;
}

export function setOnTokenExpired(callback: (() => void | Promise<void>) | null) {
  _onTokenExpired = callback;
}

export function getOnTokenExpired(): (() => void | Promise<void>) | null {
  return _onTokenExpired;
}

export function clearTokens() {
  _accessToken = null;
  _refreshToken = null;
}
