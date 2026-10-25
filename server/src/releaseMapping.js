import { DEFAULT_STEPS, statusFor } from './releaseLogic.js';
export function mapRelease(row) {
  const completed = [...new Set((row.completed_steps || []).map(Number).filter(n => Number.isInteger(n) && n >= 0 && n < DEFAULT_STEPS.length))];
  return { id: String(row.id), name: row.name, date: new Date(row.due_date).toISOString(), status: statusFor(completed), additionalInfo: row.additional_info || '', completedSteps: completed, steps: DEFAULT_STEPS.map((label, index) => ({ index, label, completed: completed.includes(index) })), createdAt: new Date(row.created_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString() };
}
