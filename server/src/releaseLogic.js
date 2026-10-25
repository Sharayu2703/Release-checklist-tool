export const DEFAULT_STEPS = [
  'Confirm scope and release notes', 'Review and merge pull requests', 'Run automated test suite',
  'Complete code review', 'Verify environment variables', 'Run database migrations',
  'Deploy to staging and smoke test', 'Verify monitoring and alerts', 'Deploy to production', 'Post-release verification'
];
export function statusFor(completedSteps) {
  const count = Array.isArray(completedSteps) ? completedSteps.length : 0;
  return count === 0 ? 'planned' : count >= DEFAULT_STEPS.length ? 'done' : 'ongoing';
}
