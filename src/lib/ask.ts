import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const ASSISTANT_ID = process.env.ASSISTANT_ID!;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const userMessage = req.body.message;
  if (!userMessage) {
    return res.status(400).json({ error: 'Missing message' });
  }

  try {
    // 1. Create thread
    const threadResp = await axios.post(
      'https://api.openai.com/v1/threads',
      {},
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'OpenAI-Beta': 'assistants=v2'
        }
      }
    );

    const threadId = threadResp.data.id;

    // 2. Add user message
    await axios.post(
      `https://api.openai.com/v1/threads/${threadId}/messages`,
      {
        role: 'user',
        content: userMessage
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2'
        }
      }
    );

    // 3. Run assistant
    const runResp = await axios.post(
      `https://api.openai.com/v1/threads/${threadId}/runs`,
      {
        assistant_id: ASSISTANT_ID
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'assistants=v2'
        }
      }
    );

    const runId = runResp.data.id;

    // 4. Polling loop
    let completed = false;
    let output = '';
    while (!completed) {
      const runStatus = await axios.get(
        `https://api.openai.com/v1/threads/${threadId}/runs/${runId}`,
        {
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            'OpenAI-Beta': 'assistants=v2'
          }
        }
      );

      if (runStatus.data.status === 'completed') {
        completed = true;
      } else if (runStatus.data.status === 'failed') {
        return res.status(500).json({ error: 'Run failed' });
      } else {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }

    // 5. Get assistant response
    const messagesResp = await axios.get(
      `https://api.openai.com/v1/threads/${threadId}/messages`,
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'OpenAI-Beta': 'assistants=v2'
        }
      }
    );

    const messages = messagesResp.data.data;
    const assistantMessage = messages.find((msg: any) => msg.role === 'assistant');

    if (!assistantMessage) {
      return res.status(500).json({ error: 'No assistant message found' });
    }

    output = assistantMessage.content[0].text.value;
    return res.status(200).json({ reply: output });
  } catch (err: any) {
    console.error('Error:', err?.response?.data || err.message);
    return res.status(500).json({ error: 'Internal error' });
  }
}