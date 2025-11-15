import { API_URL } from '@/config';

export async function signup(username, password) {
  const r = await fetch(API_URL + '/auth/signup/', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!r.ok) throw new Error((await r.json()).detail || 'Signup failed');
  return r.json();
}

export async function signin(username, password) {
  const r = await fetch(API_URL + '/auth/signin/', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!r.ok) throw new Error((await r.json()).detail || 'Signin failed');
  return r.json();
}

export async function whoami() {
  const r = await fetch(API_URL + '/auth/whoami/', { credentials: 'include' });
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`whoami failed: ${r.status} ${text}`);
  }
  return r.json();
}

export async function signout() {
  await fetch(API_URL + '/auth/signout/', { method: 'POST', credentials: 'include' });
}
