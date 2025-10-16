import { NextRequest, NextResponse } from 'next/server';
import { setConn } from '@/lib/cookies';

export async function POST(req: NextRequest) {
  const body = await req.json(); // { baseUrl, token }
  setConn(body);
  return NextResponse.json({ ok: true });
}
