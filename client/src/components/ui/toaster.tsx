import { useToast } from "@/hooks/use-toast"
import { useEffect, useRef } from "react"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

export function Toaster() {
  const { toasts, dismiss } = useToast()
  const scrollRef = useRef<number>(0)

  useEffect(() => {
    let isScrolling = false
    let scrollTimer: NodeJS.Timeout

    const handleScroll = () => {
      const currentScroll = window.pageYOffset

      // Se l'utente scrolla verso l'alto di almeno 10px
      if (currentScroll < scrollRef.current - 10 && !isScrolling) {
        isScrolling = true
        
        // Dismiss tutti i toast attivi
        toasts.forEach(toast => {
          if (toast.open) {
            dismiss(toast.id)
          }
        })

        // Reset del flag dopo 100ms per evitare chiamate multiple
        clearTimeout(scrollTimer)
        scrollTimer = setTimeout(() => {
          isScrolling = false
        }, 100)
      }

      scrollRef.current = currentScroll
    }

    // Aggiungi listener solo se ci sono toast attivi
    if (toasts.length > 0) {
      window.addEventListener('scroll', handleScroll, { passive: true })
    }

    return () => {
      window.removeEventListener('scroll', handleScroll)
      clearTimeout(scrollTimer)
    }
  }, [toasts, dismiss])

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
