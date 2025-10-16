'use server';
import { cookies } from 'next/headers';

const KEY = 'te_conn';

export async function getConn() {
  const raw = cookies().get(KEY)?.value;
  return raw ? JSON.parse(raw) as { baseUrl: string; token: string } : null;
}

export async function setConn(v: { baseUrl: string; token: string }) {
  cookies().set(KEY, JSON.stringify(v), { 
    httpOnly: true, 
    secure: true, 
    sameSite: 'lax', 
    path: '/' 
  });
}
