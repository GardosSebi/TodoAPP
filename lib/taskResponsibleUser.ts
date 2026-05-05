type MinimalMember = { user: { id: string; name: string; email: string } }
type MinimalWorkspace = {
  user: { id: string; name: string; email: string } | null
  members: MinimalMember[]
}

export function resolveResponsibleUser(
  responsible: string | null,
  workspace: MinimalWorkspace
): { id: string; name: string; email: string } | null {
  if (!responsible) return null
  const fromMembers = workspace.members.find((m) => m.user.name === responsible)?.user
  if (fromMembers) return fromMembers
  if (workspace.user?.name === responsible) return workspace.user
  return null
}

export function formatTaskCrmLine(
  contact: { first_name: string; last_name: string } | null,
  company: { name: string } | null
): string | null {
  const name = contact ? `${contact.first_name} ${contact.last_name}`.trim() : null
  if (name && company?.name) return `${name} (${company.name})`
  if (name) return name
  if (company?.name) return company.name
  return null
}
