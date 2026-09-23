import prisma from '../lib/prisma';
import { startOfDay } from './invoice.calc';
import { notificationService } from './notification.service';

const OPEN_STATUSES = ['sent', 'viewed', 'partially_paid', 'overdue'];
const dayDiff = (a: Date, b: Date) => Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / 86_400_000);

/**
 * Evaluates every active Reminder rule against every open invoice and sends the ones that are
 * due today, skipping any (invoice, rule, channel) pair already sent today (idempotent).
 */
export async function runReminderSweep(now = new Date()): Promise<{ evaluated: number; sent: number }> {
  const [rules, invoices] = await Promise.all([
    prisma.reminder.findMany({ where: { isActive: true } }),
    prisma.invoice.findMany({ where: { issuedAt: { not: null }, cancelledAt: null, status: { in: OPEN_STATUSES }, balanceDue: { gt: 0 } } }),
  ]);
  if (rules.length === 0 || invoices.length === 0) return { evaluated: 0, sent: 0 };

  const todayStart = startOfDay(now);
  let sent = 0;
  let evaluated = 0;

  for (const invoice of invoices) {
    const applicableRules = rules.filter((r) => r.invoiceId === null || r.invoiceId === invoice.id);
    for (const rule of applicableRules) {
      const diff = dayDiff(now, invoice.dueDate); // >0 = past due, 0 = due today, <0 = days before due
      let due = false;
      if (rule.triggerType === 'before_due') due = diff === -rule.daysOffset;
      else if (rule.triggerType === 'on_due') due = diff === 0;
      else if (rule.triggerType === 'overdue') {
        if (diff < rule.daysOffset) due = false;
        else if (diff === rule.daysOffset) due = true;
        else if (rule.repeatEveryDays && rule.repeatEveryDays > 0) {
          const repeats = Math.floor((diff - rule.daysOffset) / rule.repeatEveryDays);
          due = repeats >= 1 && (diff - rule.daysOffset) % rule.repeatEveryDays === 0 && repeats < rule.maxRepeats;
        }
      }
      if (!due) continue;
      evaluated += 1;

      const already = await prisma.notificationLog.findFirst({
        where: { invoiceId: invoice.id, reminderId: rule.id, channel: rule.channel, createdAt: { gte: todayStart } },
      });
      if (already) continue;

      await notificationService.sendReminder(rule.id, invoice.id);
      sent += 1;
    }
  }
  return { evaluated, sent };
}
