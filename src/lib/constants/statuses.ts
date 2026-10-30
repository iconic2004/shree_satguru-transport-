// Goods statuses
export const GOODS_STATUS = {
  EXPECTED: 'expected',
  RECEIVED: 'received',
  VERIFICATION_PENDING: 'verification_pending',
  AVAILABLE: 'available',
  RESERVED: 'reserved',
  PARTIALLY_DISPATCHED: 'partially_dispatched',
  DISPATCHED: 'dispatched',
  DELIVERED: 'delivered',
  DAMAGED: 'damaged',
  ON_HOLD: 'on_hold',
  RETURNED: 'returned',
} as const

export const GOODS_STATUS_LABELS: Record<string, string> = {
  expected: 'Expected',
  received: 'Received',
  verification_pending: 'Verification Pending',
  available: 'Available for Dispatch',
  reserved: 'Reserved',
  partially_dispatched: 'Partially Dispatched',
  dispatched: 'Dispatched',
  delivered: 'Delivered',
  damaged: 'Damaged',
  on_hold: 'On Hold',
  returned: 'Returned',
}

export const GOODS_STATUS_COLORS: Record<string, string> = {
  expected: 'bg-blue-100 text-blue-800',
  received: 'bg-cyan-100 text-cyan-800',
  verification_pending: 'bg-yellow-100 text-yellow-800',
  available: 'bg-green-100 text-green-800',
  reserved: 'bg-purple-100 text-purple-800',
  partially_dispatched: 'bg-orange-100 text-orange-800',
  dispatched: 'bg-indigo-100 text-indigo-800',
  delivered: 'bg-emerald-100 text-emerald-800',
  damaged: 'bg-red-100 text-red-800',
  on_hold: 'bg-gray-100 text-gray-800',
  returned: 'bg-rose-100 text-rose-800',
}

// Dispatch statuses
export const DISPATCH_STATUS = {
  DRAFT: 'draft',
  PLANNED: 'planned',
  LOADING: 'loading',
  IN_TRANSIT: 'in_transit',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const

export const DISPATCH_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  planned: 'Planned',
  loading: 'Loading',
  in_transit: 'In Transit',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const DISPATCH_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-800',
  planned: 'bg-blue-100 text-blue-800',
  loading: 'bg-yellow-100 text-yellow-800',
  in_transit: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
}

// Delivery statuses
export const DELIVERY_STATUS = {
  PENDING: 'pending',
  ASSIGNED: 'assigned',
  LOADED: 'loaded',
  IN_TRANSIT: 'in_transit',
  DELIVERED: 'delivered',
  FAILED: 'failed',
  RESCHEDULED: 'rescheduled',
  RETURNED: 'returned',
  ON_HOLD: 'on_hold',
} as const

export const DELIVERY_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  assigned: 'Assigned',
  loaded: 'Loaded',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  failed: 'Failed',
  rescheduled: 'Rescheduled',
  returned: 'Returned',
  on_hold: 'On Hold',
}

export const DELIVERY_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-800',
  assigned: 'bg-blue-100 text-blue-800',
  loaded: 'bg-cyan-100 text-cyan-800',
  in_transit: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  rescheduled: 'bg-yellow-100 text-yellow-800',
  returned: 'bg-orange-100 text-orange-800',
  on_hold: 'bg-gray-100 text-gray-800',
}

// Vehicle statuses
export const VEHICLE_STATUS = {
  AVAILABLE: 'available',
  ASSIGNED: 'assigned',
  ON_TRIP: 'on_trip',
  UNDER_MAINTENANCE: 'under_maintenance',
  INACTIVE: 'inactive',
} as const

export const VEHICLE_STATUS_LABELS: Record<string, string> = {
  available: 'Available',
  assigned: 'Assigned',
  on_trip: 'On Trip',
  under_maintenance: 'Under Maintenance',
  inactive: 'Inactive',
}

export const VEHICLE_STATUS_COLORS: Record<string, string> = {
  available: 'bg-green-100 text-green-800',
  assigned: 'bg-blue-100 text-blue-800',
  on_trip: 'bg-purple-100 text-purple-800',
  under_maintenance: 'bg-yellow-100 text-yellow-800',
  inactive: 'bg-gray-100 text-gray-800',
}

// Attendance statuses
export const ATTENDANCE_STATUS = {
  PRESENT: 'present',
  ABSENT: 'absent',
  HALF_DAY: 'half_day',
  LEAVE: 'leave',
  WEEKLY_OFF: 'weekly_off',
  HOLIDAY: 'holiday',
} as const

export const ATTENDANCE_STATUS_LABELS: Record<string, string> = {
  present: 'Present',
  absent: 'Absent',
  half_day: 'Half Day',
  leave: 'Leave',
  weekly_off: 'Weekly Off',
  holiday: 'Holiday',
}

export const ATTENDANCE_STATUS_COLORS: Record<string, string> = {
  present: 'bg-green-100 text-green-800',
  absent: 'bg-red-100 text-red-800',
  half_day: 'bg-yellow-100 text-yellow-800',
  leave: 'bg-blue-100 text-blue-800',
  weekly_off: 'bg-gray-100 text-gray-800',
  holiday: 'bg-purple-100 text-purple-800',
}

// Payment statuses
export const PAYMENT_STATUS = {
  UNPAID: 'unpaid',
  PARTIALLY_PAID: 'partially_paid',
  PAID: 'paid',
} as const

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: 'Unpaid',
  partially_paid: 'Partially Paid',
  paid: 'Paid',
}

export const PAYMENT_STATUS_COLORS: Record<string, string> = {
  unpaid: 'bg-red-100 text-red-800',
  partially_paid: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-green-100 text-green-800',
}

// Invoice statuses
export const INVOICE_STATUS = {
  DRAFT: 'draft',
  REVIEW: 'review',
  APPROVED: 'approved',
  ISSUED: 'issued',
  PARTIALLY_PAID: 'partially_paid',
  PAID: 'paid',
  OVERDUE: 'overdue',
  CANCELLED: 'cancelled',
  CREDITED: 'credited',
} as const

// Loading/Unloading statuses
export const LOADING_STATUS = {
  SCHEDULED: 'scheduled',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  VERIFIED: 'verified',
  CANCELLED: 'cancelled',
} as const

// Employment statuses
export const EMPLOYMENT_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  TERMINATED: 'terminated',
  ON_LEAVE: 'on_leave',
} as const

// Priority
export const PRIORITY = {
  NORMAL: 'normal',
  HIGH: 'high',
  URGENT: 'urgent',
} as const

export const PRIORITY_LABELS: Record<string, string> = {
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
}

export const PRIORITY_COLORS: Record<string, string> = {
  normal: 'bg-gray-100 text-gray-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800',
}
