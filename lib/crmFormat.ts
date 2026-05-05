/** Etichete românești pentru emailuri CRM (enum-uri Prisma). */
export function formatContactStatus(status: string): string {
  const m: Record<string, string> = {
    LEAD: 'Lead',
    PROSPECT: 'Prospect',
    CUSTOMER: 'Client',
    PARTNER: 'Partener',
    INACTIVE: 'Inactiv',
  }
  return m[status] || status
}

export function formatDealStage(stage: string): string {
  const m: Record<string, string> = {
    NEW: 'Nou',
    QUALIFIED: 'Calificat',
    PROPOSAL: 'Propunere',
    NEGOTIATION: 'Negociere',
    WON: 'Câștigat',
    LOST: 'Pierdut',
  }
  return m[stage] || stage
}

export function followUpSuggestedActionFromTaskType(taskType: string | null | undefined): string {
  switch (taskType) {
    case 'CALL':
      return 'Apel telefonic către contact.'
    case 'EMAIL':
      return 'Trimite un email de follow-up.'
    case 'MEETING':
      return 'Programează sau confirmă o întâlnire.'
    case 'FOLLOW_UP':
      return 'Continuă follow-up-ul (apel sau mesaj).'
    case 'PROPOSAL':
      return 'Urmărește propunerea / negocierea.'
    case 'ADMIN':
      return 'Finalizează acțiunea administrativă legată de contact.'
    default:
      return 'Alege acțiunea potrivită: apel, email sau întâlnire.'
  }
}
