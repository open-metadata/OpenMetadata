/**
 * ThirdEye API Proxy Route
 * 
 * Proxies all requests to the Python backend to avoid CORS issues
 * Route: /api/thirdeye/* -> http://localhost:8586/api/v1/thirdeye/*
 */

import { NextRequest, NextResponse } from 'next/server';

const THIRDEYE_BACKEND_URL = process.env.THIRDEYE_BACKEND_URL || 'http://localhost:8586';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const path = params.path.join('/');
    const searchParams = request.nextUrl.searchParams.toString();
    const url = `${THIRDEYE_BACKEND_URL}/api/v1/thirdeye/${path}${searchParams ? `?${searchParams}` : ''}`;

    console.log(`[ThirdEye Proxy] GET ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`[ThirdEye Proxy] Error: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: `Backend error: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('[ThirdEye Proxy] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to connect to ThirdEye backend',
        detail: error instanceof Error ? error.message : 'Unknown error',
        backend_url: THIRDEYE_BACKEND_URL
      },
      { status: 503 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const path = params.path.join('/');
    const body = await request.json();
    const url = `${THIRDEYE_BACKEND_URL}/api/v1/thirdeye/${path}`;

    console.log(`[ThirdEye Proxy] POST ${url}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error(`[ThirdEye Proxy] Error: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: `Backend error: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('[ThirdEye Proxy] Error:', error);
    return NextResponse.json(
      { error: 'Failed to connect to ThirdEye backend' },
      { status: 503 }
    );
  }
}

