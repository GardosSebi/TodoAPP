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
    
    console.error('[Email] Error sending email:', JSON.stringify(errorDetails, null, 2))
    
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

