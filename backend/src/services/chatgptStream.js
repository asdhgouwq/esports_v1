class ChatGptStreamError extends Error {
  constructor(code) { super('ChatGPT response did not complete'); this.code = code; }
}

async function readChatGptResponse(response) {
  if (!response.body) throw new ChatGptStreamError('stream_interrupted');
  const decoder = new TextDecoder();
  let buffer = '', eventLines = [], bytes = 0, completed;
  const outputItems = new Map();
  function dispatch() {
    const data = eventLines.filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n');
    eventLines = [];
    if (!data || data === '[DONE]') return;
    let event;
    try { event = JSON.parse(data); } catch { throw new ChatGptStreamError('invalid_stream'); }
    if (event.type === 'response.failed' || event.type === 'error') throw new ChatGptStreamError(event.response?.error?.code || event.error?.code || event.code || 'response_failed');
    if (event.type === 'response.incomplete') throw new ChatGptStreamError('response_incomplete');
    if (event.type === 'response.output_item.done' && Number.isInteger(event.output_index) && event.output_index >= 0 && event.item?.status === 'completed') {
      outputItems.set(event.output_index, event.item);
    }
    if (event.type === 'response.completed') {
      if (event.response?.status !== 'completed') throw new ChatGptStreamError('response_incomplete');
      completed = event.response;
    }
  }
  for await (const chunk of response.body) {
    bytes += chunk.byteLength;
    if (bytes > 2 * 1024 * 1024) throw new ChatGptStreamError('response_too_large');
    buffer += decoder.decode(chunk, { stream: true });
    let newline;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline).replace(/\r$/, '');
      buffer = buffer.slice(newline + 1);
      if (!line) dispatch(); else eventLines.push(line);
    }
  }
  buffer += decoder.decode();
  if (buffer.trim()) eventLines.push(buffer.replace(/\r$/, ''));
  if (eventLines.length) dispatch();
  if (!completed) throw new ChatGptStreamError('stream_interrupted');
  // With store:false the terminal event may omit output already delivered in item.done.
  const output = completed.output?.length ? completed.output : [...outputItems].sort(([a], [b]) => a - b).map(([, item]) => item);
  return { ...completed, output };
}

module.exports = { readChatGptResponse, ChatGptStreamError };
