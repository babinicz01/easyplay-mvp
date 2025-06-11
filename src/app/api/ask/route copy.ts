import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  console.log("✅ Request received at /api/ask");

  const body = await req.json();
  const userMessage = body.message;

  if (!userMessage) {
    return NextResponse.json({ error: 'Brak wiadomości od użytkownika.' }, { status: 400 });
  }

  try {
    // Tutaj zwracamy przykładową odpowiedź:
    const responseText = `To przykładowa odpowiedź na: "${userMessage}"`;
    return NextResponse.json({ reply: responseText });

  } catch (error: any) {
    console.error("❌ Błąd:", error);
    return NextResponse.json({ error: 'Coś poszło nie tak.' }, { status: 500 });
  }
}