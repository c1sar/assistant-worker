export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function matchesBranchPattern(branch: string): boolean {
  if (branch === 'main' || branch === 'staging') {
    return true
  }
  
  return (
    branch.startsWith('feat/') ||
    branch.startsWith('fix/') ||
    branch.startsWith('task/')
  )
}

export function validateDate(date: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  return dateRegex.test(date)
}

