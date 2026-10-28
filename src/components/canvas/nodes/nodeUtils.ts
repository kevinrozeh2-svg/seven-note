export function areNodePropsEqual(prevProps: any, nextProps: any): boolean {
  if (prevProps.id !== nextProps.id) return false
  if (prevProps.selected !== nextProps.selected) return false
  if (prevProps.dragging !== nextProps.dragging) return false

  // If data reference is the same, no data changes
  if (prevProps.data === nextProps.data) return true

  const pData = prevProps.data || {}
  const nData = nextProps.data || {}
  const pKeys = Object.keys(pData)
  const nKeys = Object.keys(nData)

  if (pKeys.length !== nKeys.length) return false

  for (const key of nKeys) {
    if (key === 'onOpenDoc') continue
    if (pData[key] !== nData[key]) {
      return false
    }
  }

  return true
}
