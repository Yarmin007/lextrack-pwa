import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  // Optional security: verify authorization header if configuring a secret token in vercel.json
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    // A lightweight query to establish database communication and prove activity
    const { data, error } = await supabase
      .from('transactions') // Uses an existing table to perform a simple check
      .select('id')
      .limit(1);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Database pinged successfully.' });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Ping failed' },
      { status: 500 }
    );
  }
}