export const cancellationQuestion = 'Can I cancel my annual plan after 10 days and get a refund?';

export function answerCancellationQuestion({ mode = 'broken' } = {}) {
  if (mode === 'fixed') {
    return 'Yes. You can cancel within 30 days of purchase for a full refund. After 30 days, cancellation stops renewal but does not refund the current term.';
  }
  return 'You can cancel your plan at any time. Please contact support for refund details.';
}

export function evaluateCancellationAnswer(answer) {
  const normalized = answer.toLowerCase();
  const checks = {
    mentionsRefundWindow: normalized.includes('30 days'),
    confirmsTenDayRefund: normalized.includes('full refund'),
    explainsAfterWindow: normalized.includes('after 30 days'),
  };
  const passedChecks = Object.values(checks).filter(Boolean).length;
  return {
    passed: passedChecks === Object.keys(checks).length,
    score: Number((passedChecks / Object.keys(checks).length).toFixed(2)),
    checks,
    rubric: 'Answer must state the 30-day refund window, confirm the ten-day refund, and explain post-window cancellation.',
  };
}
