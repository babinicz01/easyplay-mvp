import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  console.log("✅ Request received at /api/ask");

  try {
    const body = await req.json();
    const userMessage = body.message;
    if (!userMessage) {
      console.warn("⚠️ Brak wiadomości");
      return NextResponse.json({ error: 'Brak wiadomości od użytkownika.' }, { status: 400 });
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
    const ASSISTANT_ID = process.env.ASSISTANT_ID!;

    // 1. Stwórz wątek
    const threadRes = await fetch('https://api.openai.com/v1/threads', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Beta': 'assistants=v2',
      },
    });
    const thread = await threadRes.json();
    const threadId = thread.id;
    console.log("🧵 Utworzono thread:", threadId);

    // 2. Dodaj wiadomość
    await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Beta': 'assistants=v2',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role: 'user', content: userMessage }),
    });

    // 3. Uruchom run
    const runRes = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Beta': 'assistants=v2',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ assistant_id: ASSISTANT_ID }),
    });
    const run = await runRes.json();
    const runId = run.id;
    console.log("🏃‍♂️ Run uruchomiony:", runId);

    // 4. Polluj status
    let status = 'queued';
    while (status !== 'completed' && status !== 'failed') {
      await new Promise((r) => setTimeout(r, 2000));
      const statusRes = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}`, {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'OpenAI-Beta': 'assistants=v2',
        },
      });
      const statusJson = await statusRes.json();
      status = statusJson.status;
      console.log("📬 Status runu:", status);

      // 5. Obsługa requires_action (tool call)
      if (status === 'requires_action') {
        const toolCall = statusJson.required_action.submit_tool_outputs.tool_calls[0];
        const { age, interests } = JSON.parse(toolCall.function.arguments);
        console.log("🛠️ Wywołanie funkcji fetchToys:", { age, interests });

        const toolOutputRes = await fetch("https://epbackend-production.up.railway.app/assistant-webhook", {
          method: "POST",
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ age, interests })
        });
        const toolOutput = await toolOutputRes.json();

        await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}/submit_tool_outputs`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            'OpenAI-Beta': 'assistants=v2',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tool_outputs: [
              {
                tool_call_id: toolCall.id,
                output: JSON.stringify({ toys: toolOutput.toys })
              },
            ],
          }),
        });
        console.log("🔁 Tool output przesłany do OpenAI");
      }
    }

    // 6. Pobierz wiadomość
    const messagesRes = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'OpenAI-Beta': 'assistants=v2',
      },
    });

    const messages = await messagesRes.json();
    const assistantReply = messages.data.find((m: any) => m.role === 'assistant');
    const text = assistantReply?.content?.[0]?.text?.value || 'Brak odpowiedzi od asystenta.';

    console.log("🧠 Odpowiedź asystenta:", text);
    return NextResponse.json({ reply: text });

  } catch (err) {
    console.error("❌ Błąd:", err);
    return NextResponse.json({ error: 'Coś poszło nie tak.' }, { status: 500 });
  }
}