"use client";

import { CheckCircle2, X } from "lucide-react";
import type { FormHTMLAttributes } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

const toastEvent = "hourglass:toast";

type ToastItem = { id: number; message: string };
type ToastFormProps = Omit<FormHTMLAttributes<HTMLFormElement>, "action"> & {
  action: (formData: FormData) => Promise<void>;
  successMessage: string;
};

export function ToastForm({ action, successMessage, ...props }: ToastFormProps) {
  async function submit(formData: FormData) {
    await action(formData);
    window.dispatchEvent(new CustomEvent(toastEvent, { detail: successMessage }));
  }

  return <form {...props} action={submit}/>;
}

export function ToastViewport() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  useEffect(() => {
    const show = (event: Event) => {
      const message = (event as CustomEvent<string>).detail;
      if (!message) return;
      const id = ++nextId.current;
      setToasts((current) => [...current.slice(-2), { id, message }]);
      timers.current.set(id, window.setTimeout(() => dismiss(id), 4000));
    };
    window.addEventListener(toastEvent, show);
    const activeTimers = timers.current;
    return () => {
      window.removeEventListener(toastEvent, show);
      activeTimers.forEach((timer) => window.clearTimeout(timer));
      activeTimers.clear();
    };
  }, [dismiss]);

  return <div className="toast-region" aria-live="polite" aria-atomic="true">
    {toasts.map((toast) => <div className="toast" role="status" key={toast.id}>
      <CheckCircle2 size={19}/>
      <span>{toast.message}</span>
      <button type="button" onClick={() => dismiss(toast.id)} aria-label="Dismiss notification"><X size={16}/></button>
    </div>)}
  </div>;
}
