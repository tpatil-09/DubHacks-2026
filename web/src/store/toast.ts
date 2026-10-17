import { create } from 'zustand'

export interface Toast {
  id: number
  text: string
  tone: 'info' | 'success' | 'error'
}

interface ToastState {
  toasts: Toast[]
  show: (text: string, tone?: Toast['tone']) => void
  dismiss: (id: number) => void
}

let nextId = 1

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  show(text, tone = 'info') {
    const id = nextId++
    set((state) => ({ toasts: [...state.toasts, { id, text, tone }] }))
    setTimeout(() => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })), 3200)
  },
  dismiss(id) {
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }))
  },
}))

export const toast = (text: string, tone?: Toast['tone']) => useToasts.getState().show(text, tone)
