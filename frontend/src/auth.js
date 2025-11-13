const API = (p) => 'http://localhost:8008' + p;

export async function signup(username, password) {
  const r = await fetch(API('/auth/signup/'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!r.ok) throw new Error((await r.json()).detail || 'Signup failed');
  return r.json();
}

export async function signin(username, password) {
  const r = await fetch(API('/auth/signin/'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!r.ok) throw new Error((await r.json()).detail || 'Signin failed');
  return r.json();
}

export async function whoami() {
  const r = await fetch(API('/auth/whoami/'), { credentials: 'include' });
  return r.json();
}

export async function signout() {
  await fetch(API('/auth/signout/'), { method: 'POST', credentials: 'include' });
}
