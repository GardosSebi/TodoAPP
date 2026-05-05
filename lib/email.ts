import nodemailer from 'nodemailer'
import sgMail from '@sendgrid/mail'

export interface EmailNotification {
  to: string
  subject: string
  html: string
  text?: string
  sendgridTemplateId?: string
  sendgridDynamicTemplateData?: Record<string, string | number | boolean | null>
}

function getFromAddress(): { email: string; name: string } {
  const email =
    process.env.SENDGRID_FROM_EMAIL ||
    process.env.SMTP_FROM_EMAIL ||
    process.env.SMTP_USER ||
    'noreply@todoapp.com'
  const name = process.env.SMTP_FROM_NAME || 'Todo App'
  return { email, name }
}

/** Send via SendGrid Web API (used as fallback when SMTP is unavailable). */
async function sendViaSendGrid(notification: EmailNotification): Promise<boolean> {
  const apiKey = process.env.SENDGRID_API_KEY?.trim()
  if (!apiKey) return false

  sgMail.setApiKey(apiKey)
  const { email, name } = getFromAddress()
  const text = notification.text || notification.html.replace(/<[^>]*>/g, '')
  const templateId = notification.sendgridTemplateId?.trim()

  if (templateId) {
    await sgMail.send({
      to: notification.to.trim(),
      from: { email, name },
      templateId,
      dynamicTemplateData: notification.sendgridDynamicTemplateData || {},
    })
    return true
  }

  await sgMail.send({
    to: notification.to.trim(),
    from: { email, name },
    subject: notification.subject,
    html: notification.html,
    text,
  })
  return true
}

// Create SMTP transporter
function createTransporter() {
  // Check if SMTP is configured
  const smtpHost = process.env.SMTP_HOST
  const smtpPort = process.env.SMTP_PORT
  const smtpUser = process.env.SMTP_USER
  const smtpPassword = process.env.SMTP_PASSWORD

  if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword) {
    // Email not configured - return null to skip sending
    return null
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: parseInt(smtpPort, 10),
    secure: parseInt(smtpPort, 10) === 465, // true for 465, false for other ports
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
  })
}

export async function sendEmail(notification: EmailNotification): Promise<boolean> {
  try {
    if (!notification.to || !notification.to.trim()) {
      return false
    }

    const transporter = createTransporter()
    if (transporter) {
      const { email: fromEmail, name: fromName } = getFromAddress()

      await transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: notification.to,
        subject: notification.subject,
        html: notification.html,
        text: notification.text || notification.html.replace(/<[^>]*>/g, ''),
      })

      return true
    }

    if (process.env.SENDGRID_API_KEY?.trim()) {
      return await sendViaSendGrid(notification)
    }
    return false
  } catch {
    // Don't throw - email failures shouldn't break the app
    return false
  }
}

export function createTaskAssignedEmail(
  recipientName: string,
  assignerName: string,
  taskTitle: string,
  taskLink: string,
  projectName?: string | null
): EmailNotification {
  const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const fullLink = `${appUrl}${taskLink}`
  const projectInfo = projectName ? ` din proiectul <strong>"${projectName}"</strong>` : ''

  return {
    to: '', // Will be set by caller
    subject: `Ai fost atribuit la o sarcină: ${taskTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #3b82f6; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background-color: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; padding: 12px 24px; background-color: white; color: #3b82f6; text-decoration: none; border-radius: 6px; margin-top: 20px; border: 2px solid #3b82f6; }
            .footer { margin-top: 20px; font-size: 12px; color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Ai fost atribuit la o sarcină</h1>
            </div>
            <div class="content">
              <p>Salut ${recipientName},</p>
              <p><strong>${assignerName}</strong> te-a atribuit la sarcina${projectInfo}:</p>
              <p style="font-size: 18px; font-weight: bold; color: #1f2937;">"${taskTitle}"</p>
              ${projectName ? `<p style="color: #6b7280; font-size: 14px;">Proiect: <strong>${projectName}</strong></p>` : ''}
              <a href="${fullLink}" class="button">Vezi Sarcina</a>
            </div>
          </div>
        </body>
      </html>
    `,
  }
}

export function createProjectMemberEmail(
  recipientName: string,
  inviterName: string,
  projectName: string,
  projectLink: string
): EmailNotification {
  const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const fullLink = `${appUrl}${projectLink}`

  return {
    to: '', // Will be set by caller
    subject: `Ai fost adăugat la proiectul: ${projectName}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #10b981; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background-color: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; padding: 12px 24px; background-color: white; color: #10b981; text-decoration: none; border-radius: 6px; margin-top: 20px; border: 2px solid #10b981; }
            .footer { margin-top: 20px; font-size: 12px; color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Ai fost adăugat la un proiect</h1>
            </div>
            <div class="content">
              <p>Salut ${recipientName},</p>
              <p><strong>${inviterName}</strong> te-a adăugat la proiectul:</p>
              <p style="font-size: 18px; font-weight: bold; color: #1f2937;">"${projectName}"</p>
              <a href="${fullLink}" class="button">Vezi Proiectul</a>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `Salut ${recipientName},\n\n${inviterName} te-a adăugat la proiectul "${projectName}".\n\nVezi Proiectul: ${fullLink}`,
  }
}

export function createWorkspaceMemberEmail(
  recipientName: string,
  inviterName: string,
  workspaceName: string,
  workspaceLink: string
): EmailNotification {
  const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const fullLink = `${appUrl}${workspaceLink}`

  return {
    to: '', // Will be set by caller
    subject: `Ai fost adăugat la workspace-ul: ${workspaceName}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #8b5cf6; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background-color: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; padding: 12px 24px; background-color: white; color: #8b5cf6; text-decoration: none; border-radius: 6px; margin-top: 20px; border: 2px solid #8b5cf6; }
            .footer { margin-top: 20px; font-size: 12px; color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Ai fost adăugat la un workspace</h1>
            </div>
            <div class="content">
              <p>Salut ${recipientName},</p>
              <p><strong>${inviterName}</strong> te-a adăugat la workspace-ul:</p>
              <p style="font-size: 18px; font-weight: bold; color: #1f2937;">"${workspaceName}"</p>
              <a href="${fullLink}" class="button">Vezi Workspace-ul</a>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `Salut ${recipientName},\n\n${inviterName} te-a adăugat la workspace-ul "${workspaceName}".\n\nVezi Workspace-ul: ${fullLink}`,
  }
}

export function createMentionEmail(
  recipientName: string,
  commenterName: string,
  taskTitle: string,
  commentPreview: string,
  taskLink: string,
  projectName?: string | null
): EmailNotification {
  const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const fullLink = `${appUrl}${taskLink}`
  const projectInfo = projectName ? ` din proiectul <strong>"${projectName}"</strong>` : ''
  
  // Truncate comment preview if too long
  const maxPreviewLength = 150
  const truncatedPreview = commentPreview.length > maxPreviewLength
    ? commentPreview.substring(0, maxPreviewLength) + '...'
    : commentPreview

  return {
    to: '', // Will be set by caller
    subject: `Ai fost menționat într-un comentariu: ${taskTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #3b82f6; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background-color: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; padding: 12px 24px; background-color: white; color: #3b82f6; text-decoration: none; border-radius: 6px; margin-top: 20px; border: 2px solid #3b82f6; }
            .comment-preview { background-color: #ffffff; border-left: 3px solid #3b82f6; padding: 12px; margin: 15px 0; border-radius: 4px; font-style: italic; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Ai fost menționat într-un comentariu</h1>
            </div>
            <div class="content">
              <p>Salut ${recipientName},</p>
              <p><strong>${commenterName}</strong> te-a menționat într-un comentariu la sarcina${projectInfo}:</p>
              <p style="font-size: 18px; font-weight: bold; color: #1f2937;">"${taskTitle}"</p>
              ${projectName ? `<p style="color: #6b7280; font-size: 14px;">Proiect: <strong>${projectName}</strong></p>` : ''}
              <div class="comment-preview">
                "${truncatedPreview}"
              </div>
              <a href="${fullLink}" class="button">Vezi Comentariul</a>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `Salut ${recipientName},\n\n${commenterName} te-a menționat într-un comentariu la sarcina${projectName ? ` din proiectul "${projectName}"` : ''}:\n"${taskTitle}"\n\nComentariu: "${truncatedPreview}"\n\nVezi Comentariul: ${fullLink}`,
  }
}

export function createTaskCompletedEmail(
  recipientName: string,
  completerName: string,
  taskTitle: string,
  taskLink: string,
  projectName?: string | null
): EmailNotification {
  const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const fullLink = `${appUrl}${taskLink}`
  const projectInfo = projectName ? ` din proiectul <strong>"${projectName}"</strong>` : ''

  return {
    to: '', // Will be set by caller
    subject: `Sarcina finalizată: ${taskTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #3b82f6; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background-color: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; padding: 12px 24px; background-color: white; color: #3b82f6; text-decoration: none; border-radius: 6px; margin-top: 20px; border: 2px solid #3b82f6; }
            .footer { margin-top: 20px; font-size: 12px; color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Sarcina finalizată</h1>
            </div>
            <div class="content">
              <p>Salut ${recipientName},</p>
              <p><strong>${completerName}</strong> a finalizat sarcina${projectInfo}:</p>
              <p style="font-size: 18px; font-weight: bold; color: #1f2937;">"${taskTitle}"</p>
              ${projectName ? `<p style="color: #6b7280; font-size: 14px;">Proiect: <strong>${projectName}</strong></p>` : ''}
              <a href="${fullLink}" class="button">Vezi Sarcina</a>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `Salut ${recipientName},\n\n${completerName} a finalizat sarcina${projectName ? ` din proiectul "${projectName}"` : ''}:\n"${taskTitle}"\n\nVezi Sarcina: ${fullLink}`,
  }
}

export function createTaskDueSoonEmail(
  recipientName: string,
  taskTitle: string,
  taskLink: string,
  daysRemaining: number,
  dueDate: string,
  projectName?: string | null,
  crmLine?: string | null
): EmailNotification {
  const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const fullLink = `${appUrl}${taskLink}`
  const projectInfo = projectName ? ` din proiectul <strong>"${projectName}"</strong>` : ''
  const daysText = daysRemaining === 1 ? 'zi' : 'zile'
  const crmBlock = crmLine
    ? `<p style="color:#374151;font-size:14px;"><strong>CRM:</strong> ${crmLine}</p>`
    : ''

  return {
    to: '', // Will be set by caller
    subject: `Termen limită: ${taskTitle} (${daysRemaining} ${daysText} rămase)`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #f59e0b; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background-color: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; padding: 12px 24px; background-color: white; color: #f59e0b; text-decoration: none; border-radius: 6px; margin-top: 20px; border: 2px solid #f59e0b; }
            .footer { margin-top: 20px; font-size: 12px; color: #6b7280; }
            .warning { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 16px 0; border-radius: 4px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⏰ Termen limită apropiindu-se</h1>
            </div>
            <div class="content">
              <p>Salut ${recipientName},</p>
              <div class="warning">
                <p style="margin: 0; font-weight: bold; color: #92400e;">Mai ai <strong>${daysRemaining} ${daysText}</strong> până la termen!</p>
              </div>
              <p>Sarcina${projectInfo} <strong>"${taskTitle}"</strong> are termen limită pe <strong>${dueDate}</strong>.</p>
              ${crmBlock}
              ${projectName ? `<p style="color: #6b7280; font-size: 14px;">Proiect: <strong>${projectName}</strong></p>` : ''}
              <a href="${fullLink}" class="button">Vezi Sarcina</a>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `Salut ${recipientName},\n\nMai ai ${daysRemaining} ${daysText} până la termen!\n\nSarcina${projectName ? ` din proiectul "${projectName}"` : ''} "${taskTitle}" are termen limită pe ${dueDate}.${crmLine ? `\n\nCRM: ${crmLine}` : ''}\n\nVezi Sarcina: ${fullLink}`,
  }
}

export function createTaskOverdueEmail(
  recipientName: string,
  taskTitle: string,
  taskLink: string,
  daysOverdue: number,
  dueDate: string,
  projectName?: string | null,
  crmLine?: string | null
): EmailNotification {
  const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const fullLink = `${appUrl}${taskLink}`
  const projectInfo = projectName ? ` din proiectul <strong>"${projectName}"</strong>` : ''
  const daysText = daysOverdue === 1 ? 'zi' : 'zile'
  const crmBlock = crmLine
    ? `<p style="color:#374151;font-size:14px;"><strong>CRM:</strong> ${crmLine}</p>`
    : ''

  return {
    to: '', // Will be set by caller
    subject: `⚠️ Termen depășit: ${taskTitle} (${daysOverdue} ${daysText})`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #ef4444; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
            .content { background-color: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
            .button { display: inline-block; padding: 12px 24px; background-color: white; color: #ef4444; text-decoration: none; border-radius: 6px; margin-top: 20px; border: 2px solid #ef4444; }
            .footer { margin-top: 20px; font-size: 12px; color: #6b7280; }
            .error { background-color: #fee2e2; border-left: 4px solid #ef4444; padding: 12px; margin: 16px 0; border-radius: 4px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>⚠️ Termen depășit</h1>
            </div>
            <div class="content">
              <p>Salut ${recipientName},</p>
              <div class="error">
                <p style="margin: 0; font-weight: bold; color: #991b1b;">Termenul limită a fost depășit cu <strong>${daysOverdue} ${daysText}</strong>!</p>
              </div>
              <p>Sarcina${projectInfo} <strong>"${taskTitle}"</strong> avea termen limită pe <strong>${dueDate}</strong> și este acum depășită.</p>
              ${crmBlock}
              ${projectName ? `<p style="color: #6b7280; font-size: 14px;">Proiect: <strong>${projectName}</strong></p>` : ''}
              <p style="color: #991b1b; font-weight: bold;">Acțiune necesară: finalizează sau reprogramează.</p>
              <p style="margin-top:16px;">
                <a href="${fullLink}" class="button" style="margin-right:8px;">Finalizează sarcina</a>
                <a href="${fullLink}" class="button">Reprogramează</a>
              </p>
              <p style="font-size:12px;color:#6b7280;margin-top:12px;">Ambele butoane deschid sarcina în aplicație; acolo poți marca finalizată sau schimba data.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `Salut ${recipientName},\n\n⚠️ TERMEN DEPĂȘIT (${daysOverdue} ${daysText})\n\n"${taskTitle}" — termen ${dueDate}.${crmLine ? `\nCRM: ${crmLine}` : ''}\n\nFinalizează sau reprogramează în aplicație: ${fullLink}`,
  }
}

export function createDailyCrmDigestEmail(
  recipientName: string,
  lines: { label: string; items: string[] }[]
): EmailNotification {
  const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const inbox = `${appUrl}/app`
  const blocks = lines
    .filter((b) => b.items.length > 0)
    .map(
      (b) =>
        `<h3 style="margin:16px 0 8px;font-size:15px;color:#111;">${b.label}</h3><ul style="margin:0;padding-left:20px;">${b.items.map((i) => `<li style="margin:4px 0;">${i}</li>`).join('')}</ul>`
    )
    .join('')

  return {
    to: '',
    subject: 'Agenda CRM pentru astăzi',
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="font-family:Arial,sans-serif;color:#333;">
      <div style="max-width:600px;margin:0 auto;padding:20px;">
        <p>Salut ${recipientName},</p>
        <p>Iată ce merită atenție:</p>
        ${blocks || '<p>Nimic critic listat pentru acest rezumat.</p>'}
        <p style="margin-top:24px;"><a href="${inbox}" style="display:inline-block;padding:12px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Deschide aplicația</a></p>
      </div></body></html>`,
    text: `Salut ${recipientName},\n\n${lines.map((b) => (b.items.length ? `${b.label}:\n${b.items.map((i) => `- ${i}`).join('\n')}\n` : '')).join('\n')}\n${inbox}`,
  }
}

export function createCrmFollowUpReminderEmail(
  recipientName: string,
  taskTitle: string,
  taskLink: string,
  contactHint: string | null,
  lastInteractionHint: string | null,
  suggestedAction: string | null = null
): EmailNotification {
  const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const fullLink = `${appUrl}${taskLink}`
  const contactBlock = contactHint
    ? `<p><strong>Contact:</strong> ${contactHint}</p>`
    : ''
  const lastBlock = lastInteractionHint
    ? `<p style="color:#6b7280;font-size:14px;"><strong>Ultima interacțiune:</strong> ${lastInteractionHint}</p>`
    : '<p style="color:#6b7280;font-size:14px;">Nu avem încă o interacțiune înregistrată pentru acest contact.</p>'
  const actionBlock = suggestedAction
    ? `<p style="background:#f0fdfa;border-left:4px solid #0d9488;padding:12px;margin:16px 0;border-radius:4px;"><strong>Acțiune sugerată:</strong> ${suggestedAction}</p>`
    : ''

  return {
    to: '',
    subject: `Follow-up: ${taskTitle}`,
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="font-family:Arial,sans-serif;">
      <div style="max-width:600px;margin:0 auto;padding:20px;">
        <p>Salut ${recipientName},</p>
        <p>Ai un follow-up de reținut: <strong>${taskTitle}</strong></p>
        ${contactBlock}
        ${lastBlock}
        ${actionBlock}
        <p><a href="${fullLink}" style="display:inline-block;padding:12px 20px;background:#0d9488;color:#fff;text-decoration:none;border-radius:6px;">Deschide sarcina</a></p>
      </div></body></html>`,
    text: `Follow-up: ${taskTitle}\n${contactHint ? `Contact: ${contactHint}\n` : ''}${lastInteractionHint ? `Ultima interacțiune: ${lastInteractionHint}\n` : ''}${suggestedAction ? `${suggestedAction}\n` : ''}${fullLink}`,
  }
}

export function createInactiveContactsEmail(
  recipientName: string,
  rows: { name: string; daysSince: number; link: string; lastActivityLabel?: string | null }[]
): EmailNotification {
  const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const list = rows
    .map((r) => {
      const last = r.lastActivityLabel
        ? `<span style="color:#6b7280;font-size:13px;">Ultima activitate: ${r.lastActivityLabel}</span>`
        : ''
      return `<li style="margin:12px 0;"><strong>${r.name}</strong> — fără activitate de ~${r.daysSince} zile.<br/>${last}<br/><a href="${appUrl}${r.link}">Creează follow-up / vezi contactul</a></li>`
    })
    .join('')

  return {
    to: '',
    subject:
      rows.length === 1
        ? `Contact inactiv: ${rows[0].name}`
        : `${rows.length} contacte fără activitate recentă`,
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="font-family:Arial,sans-serif;">
      <div style="max-width:600px;margin:0 auto;padding:20px;">
        <p>Salut ${recipientName},</p>
        <p>Contactele de mai jos nu au activitate recentă (sarcini, note, interacțiuni). Reia legătura când e cazul.</p>
        <ul style="padding-left:20px;list-style:disc;">${list}</ul>
        <p><a href="${appUrl}/app/crm/contacts" style="display:inline-block;margin-top:12px;padding:12px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Deschide CRM — contacte</a></p>
      </div></body></html>`,
    text: `Contacte inactive:\n${rows.map((r) => `- ${r.name} (~${r.daysSince} zile)${r.lastActivityLabel ? ` — ultima activitate: ${r.lastActivityLabel}` : ''} — ${appUrl}${r.link}`).join('\n')}`,
  }
}

export function createNewContactEmail(
  recipientName: string,
  actorName: string,
  contactDisplayName: string,
  contactLink: string
): EmailNotification {
  const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const full = `${appUrl}${contactLink}`
  return {
    to: '',
    subject: `Contact nou: ${contactDisplayName}`,
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="font-family:Arial,sans-serif;">
      <div style="max-width:600px;margin:0 auto;padding:20px;">
        <p>Salut ${recipientName},</p>
        <p><strong>${actorName}</strong> a adăugat contactul <strong>${contactDisplayName}</strong> în CRM.</p>
        <p><a href="${full}" style="display:inline-block;padding:12px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Vezi contactul</a></p>
      </div></body></html>`,
    text: `Contact nou: ${contactDisplayName} (adăugat de ${actorName})\n${full}`,
  }
}

export function createContactStatusChangeEmail(
  recipientName: string,
  actorName: string,
  contactDisplayName: string,
  oldStatus: string,
  newStatus: string,
  contactLink: string
): EmailNotification {
  const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const full = `${appUrl}${contactLink}`
  return {
    to: '',
    subject: `Status contact: ${contactDisplayName} (${oldStatus} → ${newStatus})`,
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="font-family:Arial,sans-serif;">
      <div style="max-width:600px;margin:0 auto;padding:20px;">
        <p>Salut ${recipientName},</p>
        <p><strong>${actorName}</strong> a schimbat statusul pentru <strong>${contactDisplayName}</strong>: <strong>${oldStatus}</strong> → <strong>${newStatus}</strong>.</p>
        <p><a href="${full}" style="display:inline-block;padding:12px 20px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:6px;">Vezi contactul</a></p>
      </div></body></html>`,
    text: `Status contact ${contactDisplayName}: ${oldStatus} → ${newStatus} (${actorName})\n${full}`,
  }
}

export function createDealStageChangeEmail(
  recipientName: string,
  actorName: string,
  dealTitle: string,
  oldStage: string,
  newStage: string,
  dealLink: string
): EmailNotification {
  const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const full = `${appUrl}${dealLink}`
  return {
    to: '',
    subject: `Oportunitate: ${dealTitle} — etapă ${newStage}`,
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="font-family:Arial,sans-serif;">
      <div style="max-width:600px;margin:0 auto;padding:20px;">
        <p>Salut ${recipientName},</p>
        <p><strong>${actorName}</strong> a actualizat oportunitatea <strong>${dealTitle}</strong>.</p>
        <p>Etapă: <strong>${oldStage}</strong> → <strong>${newStage}</strong></p>
        <p><a href="${full}" style="display:inline-block;padding:12px 20px;background:#0369a1;color:#fff;text-decoration:none;border-radius:6px;">Vezi oportunitatea</a></p>
      </div></body></html>`,
    text: `Oportunitate "${dealTitle}": etapă ${oldStage} → ${newStage} (${actorName})\n${full}`,
  }
}

export function createDealClosingReminderEmail(
  recipientName: string,
  dealTitle: string,
  daysUntil: number,
  closeDateLabel: string,
  dealLink: string
): EmailNotification {
  const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const full = `${appUrl}${dealLink}`
  const z = daysUntil === 1 ? 'zi' : 'zile'
  return {
    to: '',
    subject: `Oportunitate aproape de închidere: ${dealTitle}`,
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="font-family:Arial,sans-serif;">
      <div style="max-width:600px;margin:0 auto;padding:20px;">
        <p>Salut ${recipientName},</p>
        <p>Oportunitatea <strong>${dealTitle}</strong> are dată țintă de închidere pe <strong>${closeDateLabel}</strong> (mai sunt <strong>${daysUntil}</strong> ${z}).</p>
        <p><a href="${full}" style="display:inline-block;padding:12px 20px;background:#d97706;color:#fff;text-decoration:none;border-radius:6px;">Deschide deal-ul</a></p>
      </div></body></html>`,
    text: `"${dealTitle}" — închidere ${closeDateLabel} (în ${daysUntil} ${z})\n${full}`,
  }
}

export function createDealWonLostEmail(
  recipientName: string,
  actorName: string,
  dealTitle: string,
  outcome: 'WON' | 'LOST',
  dealLink: string
): EmailNotification {
  const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const full = `${appUrl}${dealLink}`
  const label = outcome === 'WON' ? 'Câștigată' : 'Pierdută'
  const color = outcome === 'WON' ? '#059669' : '#6b7280'
  return {
    to: '',
    subject: `${label}: ${dealTitle}`,
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="font-family:Arial,sans-serif;">
      <div style="max-width:600px;margin:0 auto;padding:20px;">
        <p>Salut ${recipientName},</p>
        <p><strong>${actorName}</strong> a marcat oportunitatea <strong>${dealTitle}</strong> ca <strong style="color:${color}">${label}</strong>.</p>
        <p><a href="${full}" style="display:inline-block;padding:12px 20px;background:${color};color:#fff;text-decoration:none;border-radius:6px;">Vezi oportunitatea</a></p>
      </div></body></html>`,
    text: `Oportunitate "${dealTitle}" — ${label} (${actorName})\n${full}`,
  }
}

export function createCrmNoteAddedEmail(
  recipientName: string,
  authorName: string,
  contextLabel: string,
  notePreview: string,
  resourceLink: string
): EmailNotification {
  const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const full = `${appUrl}${resourceLink}`
  const previewRaw =
    notePreview.length > 280 ? `${notePreview.slice(0, 280)}…` : notePreview
  const previewEsc = previewRaw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
  return {
    to: '',
    subject: `Notă nouă CRM: ${contextLabel}`,
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="font-family:Arial,sans-serif;">
      <div style="max-width:600px;margin:0 auto;padding:20px;">
        <p>Salut ${recipientName},</p>
        <p><strong>${authorName}</strong> a adăugat o notă la <strong>${contextLabel}</strong>.</p>
        <blockquote style="border-left:4px solid #2563eb;padding-left:12px;margin:16px 0;color:#374151;">${previewEsc}</blockquote>
        <p><a href="${full}" style="display:inline-block;padding:12px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Vezi în CRM</a></p>
      </div></body></html>`,
    text: `Notă nouă la ${contextLabel} (${authorName}):\n${previewRaw}\n${full}`,
  }
}

export function createRegistrationConfirmationEmail(
  recipientName: string,
  verifyUrl: string
): EmailNotification {
  return {
    to: '',
    subject: 'Confirmă contul — Todo App',
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
      body{font-family:Arial,sans-serif;line-height:1.6;color:#333;}
      .container{max-width:600px;margin:0 auto;padding:20px;}
      .header{background:#10b981;color:#fff;padding:20px;border-radius:8px 8px 0 0;}
      .content{background:#f9fafb;padding:20px;border-radius:0 0 8px 8px;}
      .button{display:inline-block;padding:12px 24px;background:#fff;color:#10b981;text-decoration:none;border-radius:6px;margin-top:16px;border:2px solid #10b981;font-weight:600;}
    </style></head><body>
      <div class="container">
        <div class="header"><h1 style="margin:0;font-size:20px;">Confirmă înregistrarea</h1></div>
        <div class="content">
          <p>Salut ${recipientName},</p>
          <p>Am primit o cerere de cont Todo App pentru această adresă. Apasă butonul de mai jos pentru a-ți activa contul. Până atunci nu te poți conecta.</p>
          <p><a href="${verifyUrl}" class="button">Activează contul</a></p>
        </div>
      </div>
    </body></html>`,
    text: `Salut ${recipientName},\n\nConfirmă contul Todo App (obligatoriu înainte de login):\n${verifyUrl}`,
  }
}

export function createPasswordResetEmail(
  recipientName: string,
  resetLink: string,
  _expiresHours: number
): EmailNotification {
  const sendgridTemplateId = (
    process.env.SENDGRID_RESET_PASSWORD_TEMPLATE_ID || 'd-ea4885e2af084c0ba8e0681dfd17b114'
  ).trim()
  return {
    to: '',
    subject: 'Resetare parolă — Todo App',
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
      body{font-family:Arial,sans-serif;line-height:1.6;color:#333;}
      .container{max-width:600px;margin:0 auto;padding:20px;}
      .header{background:#2563eb;color:#fff;padding:20px;border-radius:8px 8px 0 0;}
      .content{background:#f9fafb;padding:20px;border-radius:0 0 8px 8px;}
      .button{display:inline-block;padding:12px 24px;background:#fff;color:#2563eb;text-decoration:none;border-radius:6px;margin-top:16px;border:2px solid #2563eb;font-weight:600;}
    </style></head><body>
      <div class="container">
        <div class="header"><h1 style="margin:0;font-size:20px;">Resetare parolă</h1></div>
        <div class="content">
          <p>Salut ${recipientName},</p>
          <p>Am primit o cerere de resetare a parolei pentru contul tău. Dacă tu ai făcut cererea, apasă butonul de mai jos:</p>
          <p><a href="${resetLink}" class="button">Alege parolă nouă</a></p>
        </div>
      </div>
    </body></html>`,
    text: `Salut ${recipientName},\n\nResetare parolă Todo App.\n${resetLink}`,
    sendgridTemplateId,
    sendgridDynamicTemplateData: {
      recipientName,
      resetLink,
      subject: 'Resetare parolă — Todo App',
    },
  }
}

