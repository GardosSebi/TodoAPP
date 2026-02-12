import nodemailer from 'nodemailer'

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

export interface EmailNotification {
  to: string
  subject: string
  html: string
  text?: string
}

export async function sendEmail(notification: EmailNotification): Promise<boolean> {
  try {
    const transporter = createTransporter()
    if (!transporter) {
      // SMTP not configured - skip silently
      return false
    }

    if (!notification.to || !notification.to.trim()) {
      return false
    }

    const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'noreply@todoapp.com'
    const fromName = process.env.SMTP_FROM_NAME || 'Todo App'

    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: notification.to,
      subject: notification.subject,
      html: notification.html,
      text: notification.text || notification.html.replace(/<[^>]*>/g, ''),
    })

    return true
  } catch (error: any) {
    const errorDetails = {
      to: notification.to,
      subject: notification.subject,
      error: error?.message || error,
      code: error?.code || null,
    }
    
    
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
              <h1>✓ Sarcina finalizată</h1>
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
  projectName?: string | null
): EmailNotification {
  const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const fullLink = `${appUrl}${taskLink}`
  const projectInfo = projectName ? ` din proiectul <strong>"${projectName}"</strong>` : ''
  const daysText = daysRemaining === 1 ? 'zi' : 'zile'

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
              ${projectName ? `<p style="color: #6b7280; font-size: 14px;">Proiect: <strong>${projectName}</strong></p>` : ''}
              <a href="${fullLink}" class="button">Vezi Sarcina</a>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `Salut ${recipientName},\n\nMai ai ${daysRemaining} ${daysText} până la termen!\n\nSarcina${projectName ? ` din proiectul "${projectName}"` : ''} "${taskTitle}" are termen limită pe ${dueDate}.\n\nVezi Sarcina: ${fullLink}`,
  }
}

export function createTaskOverdueEmail(
  recipientName: string,
  taskTitle: string,
  taskLink: string,
  daysOverdue: number,
  dueDate: string,
  projectName?: string | null
): EmailNotification {
  const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const fullLink = `${appUrl}${taskLink}`
  const projectInfo = projectName ? ` din proiectul <strong>"${projectName}"</strong>` : ''
  const daysText = daysOverdue === 1 ? 'zi' : 'zile'

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
              ${projectName ? `<p style="color: #6b7280; font-size: 14px;">Proiect: <strong>${projectName}</strong></p>` : ''}
              <p style="color: #991b1b; font-weight: bold;">Te rugăm să finalizezi această sarcină cât mai curând posibil.</p>
              <a href="${fullLink}" class="button">Vezi Sarcina</a>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `Salut ${recipientName},\n\n⚠️ TERMEN DEPĂȘIT!\n\nTermenul limită a fost depășit cu ${daysOverdue} ${daysText}!\n\nSarcina${projectName ? ` din proiectul "${projectName}"` : ''} "${taskTitle}" avea termen limită pe ${dueDate}.\n\nTe rugăm să finalizezi această sarcină cât mai curând posibil.\n\nVezi Sarcina: ${fullLink}`,
  }
}

