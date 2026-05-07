import { API_URL } from '@/config'

export async function signup(username, password) {
  const r = await fetch(API_URL + '/auth/signup/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!r.ok) throw new Error((await r.json()).detail || 'Signup failed')
  const data = await r.json()
  if (data.token) {
    localStorage.setItem('auth_token', data.token)
  }
  return data
}

export async function signin(username, password) {
  const r = await fetch(API_URL + '/auth/signin/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!r.ok) throw new Error((await r.json()).detail || 'Signin failed')
  const data = await r.json()
  if (data.token) {
    localStorage.setItem('auth_token', data.token)
  }
  return data
}

export async function whoami() {
  const token = localStorage.getItem('auth_token')
  const headers = { 'Content-Type': 'application/json' }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  const r = await fetch(API_URL + '/auth/whoami/', {
    headers: headers,
  })
  if (!r.ok) {
    const text = await r.text()
    throw new Error(`whoami failed: ${r.status} ${text}`)
  }
  return r.json()
}

export async function signout() {
  await fetch(API_URL + '/auth/signout/', { method: 'POST' })
  // Clear JWT token on signout
  localStorage.removeItem('auth_token')
}
