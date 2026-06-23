interface PayMethodRow {
  id: string
  code: string
  displayName: string
  isActive: number
}

export function serializePayMethod(pm: PayMethodRow, role: string) {
  if (role === 'admin') {
    return { id: pm.id, code: pm.code, displayName: pm.displayName, isActive: pm.isActive }
  }
  return { id: pm.id, code: pm.code, isActive: pm.isActive }
}
