'use client';

import { useState } from 'react';

export default function ChatBox() {
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!message.trim()) return;

    setLoading(true);
    setReply('');

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });

      const data = await res.json();
      setReply(data.reply || 'Brak odpowiedzi.');
    } catch (err) {
      setReply('Wystąpił błąd 😢');
    }

    setLoading(false);
  };

  return (
    <div className="p-4 max-w-xl mx-auto">
      <textarea
        className="w-full border rounded p-2"
        placeholder="Zadaj pytanie np. Szukam zabawki dla 3-latka..."
        rows={3}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <button
        className="mt-2 bg-blue-600 text-white px-4 py-2 rounded"
        onClick={sendMessage}
        disabled={loading}
      >
        {loading ? 'Wysyłanie...' : 'Wyślij'}
      </button>

      {reply && (
        <div className="mt-4 p-4 bg-gray-100 rounded whitespace-pre-line">
          {reply}
        </div>
      )}
    </div>
  );
}