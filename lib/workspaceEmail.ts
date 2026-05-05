import { prisma } from '@/lib/prisma'
import { sendEmail, type EmailNotification } from '@/lib/email'
import {
  getEmailNotificationSettings,
  shouldDeferEmailForQuietHours,
  type EmailNotificationSettingsRow,
} from '@/lib/emailNotificationSettings'

export type WorkspaceBroadcastPref = keyof Pick<
  EmailNotificationSettingsRow,
  | 'newContactEmail'
  | 'contactStatusChangeEmail'
  | 'dealStageChangeEmail'
  | 'dealClosingReminderEmail'
  | 'dealWonLostEmail'
  | 'crmNoteAddedEmail'
>

export async function getWorkspaceMemberUsers(
  workspaceId: string
): Promise<{ id: string; name: string; email: string }[]> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      members: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
  })
  if (!ws) return []
  const map = new Map<string, { id: string; name: string; email: string }>()
  if (ws.user?.email) map.set(ws.user.id, ws.user)
  for (const m of ws.members) {
    if (m.user?.email) map.set(m.user.id, m.user)
  }
  return [...map.values()]
}

/** Trimite email tuturor din workspace (minus actor), respectând preferința + quiet hours. */
export async function broadcastWorkspaceEmail(
  workspaceId: string,
  actorUserId: string,
  pref: WorkspaceBroadcastPref,
  build: (recipientDisplayName: string) => EmailNotification
): Promise<void> {
  const users = await getWorkspaceMemberUsers(workspaceId)
  for (const u of users) {
    if (u.id === actorUserId || !u.email?.trim()) continue
    const s = await getEmailNotificationSettings(u.id)
    if (!s[pref]) continue
    if (shouldDeferEmailForQuietHours(s)) continue
    const mail = build(u.name || u.email)
    mail.to = u.email.trim()
    await sendEmail(mail)
  }
}
