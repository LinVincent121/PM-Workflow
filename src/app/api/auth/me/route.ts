import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';

export async function GET() {
  const user = currentUser();
  return user ? NextResponse.json({ user }) : NextResponse.json({ user: null }, { status: 401 });
}
