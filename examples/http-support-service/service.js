import { answerCancellationQuestion } from '../support-answer-bot/support-bot.js';

export function supportHandler({ mode = 'broken' } = {}) {
  return (request, response) => {
    if (request.method !== 'GET' || request.url !== '/answer') {
      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'not found' }));
      return;
    }
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ answer: answerCancellationQuestion({ mode }) }));
  };
}
