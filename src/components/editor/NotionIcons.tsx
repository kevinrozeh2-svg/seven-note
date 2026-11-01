import React from 'react'

export const NotionTableIcon: React.FC<{ className?: string; size?: number }> = ({ className = 'w-4 h-4', size = 16 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="3" y="3" width="18" height="18" rx="2.5" />
    <line x1="3" y1="9.5" x2="21" y2="9.5" />
    <line x1="3" y1="15.5" x2="21" y2="15.5" />
    <line x1="9.5" y1="3" x2="9.5" y2="21" />
  </svg>
)

export const NotionBoardIcon: React.FC<{ className?: string; size?: number }> = ({ className = 'w-4 h-4', size = 16 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="3" y="3" width="18" height="18" rx="2.5" />
    <line x1="9" y1="3" x2="9" y2="21" />
    <line x1="15" y1="3" x2="15" y2="21" />
  </svg>
)

export const NotionListIcon: React.FC<{ className?: string; size?: number }> = ({ className = 'w-4 h-4', size = 16 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <line x1="8.5" y1="6" x2="21" y2="6" />
    <line x1="8.5" y1="12" x2="21" y2="12" />
    <line x1="8.5" y1="18" x2="21" y2="18" />
    <circle cx="4" cy="6" r="1" fill="currentColor" />
    <circle cx="4" cy="12" r="1" fill="currentColor" />
    <circle cx="4" cy="18" r="1" fill="currentColor" />
  </svg>
)

export const NotionTimelineIcon: React.FC<{ className?: string; size?: number }> = ({ className = 'w-4 h-4', size = 16 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="3" y="3" width="18" height="18" rx="2.5" />
    <line x1="6.5" y1="8" x2="13.5" y2="8" strokeWidth="2.5" />
    <line x1="10.5" y1="12" x2="17.5" y2="12" strokeWidth="2.5" />
    <line x1="7.5" y1="16" x2="12.5" y2="16" strokeWidth="2.5" />
  </svg>
)

export const NotionCalendarIcon: React.FC<{ className?: string; size?: number }> = ({ className = 'w-4 h-4', size = 16 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="3" y="4" width="18" height="17" rx="2.5" />
    <line x1="16" y1="2" x2="16" y2="5" />
    <line x1="8" y1="2" x2="8" y2="5" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <rect x="7" y="12" width="2" height="2" rx="0.5" fill="currentColor" />
    <rect x="11" y="12" width="2" height="2" rx="0.5" fill="currentColor" />
    <rect x="15" y="12" width="2" height="2" rx="0.5" fill="currentColor" />
    <rect x="7" y="15.5" width="2" height="2" rx="0.5" fill="currentColor" />
    <rect x="11" y="15.5" width="2" height="2" rx="0.5" fill="currentColor" />
    <rect x="15" y="15.5" width="2" height="2" rx="0.5" fill="currentColor" />
  </svg>
)

export const NotionGalleryIcon: React.FC<{ className?: string; size?: number }> = ({ className = 'w-4 h-4', size = 16 }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
    <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
  </svg>
)
