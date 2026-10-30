'use client'

import { useState, useCallback } from 'react'

export interface Toast {
  id: string
  title: string
  description?: string
  variant?: 'default' | 'success' | 'error' | 'warning'
  duration?: number
}

let toastCount = 0

interface UseToastReturn {
  toasts: Toast[]
  toast: (props: Omit<Toast, 'id'>) => void
  dismiss: (id: string) => void
}

const listeners: Array<(toasts: Toast[]) => void> = []
let memoryToasts: Toast[] = []

function dispatch(toasts: Toast[]) {
  memoryToasts = toasts
  listeners.forEach(listener => listener(toasts))
}

export function toast(props: Omit<Toast, 'id'>) {
  const id = String(toastCount++)
  const newToast = { ...props, id }
  dispatch([...memoryToasts, newToast])

  const duration = props.duration ?? 5000
  setTimeout(() => {
    dispatch(memoryToasts.filter(t => t.id !== id))
  }, duration)

  return id
}

export function useToast(): UseToastReturn {
  const [toasts, setToasts] = useState<Toast[]>(memoryToasts)

  useState(() => {
    listeners.push(setToasts)
    return () => {
      const index = listeners.indexOf(setToasts)
      if (index > -1) listeners.splice(index, 1)
    }
  })

  const dismiss = useCallback((id: string) => {
    dispatch(memoryToasts.filter(t => t.id !== id))
  }, [])

  return {
    toasts,
    toast: (props: Omit<Toast, 'id'>) => toast(props),
    dismiss,
  }
}
