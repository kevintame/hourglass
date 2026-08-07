"use client";

import { Plus, X } from "lucide-react";
import { useId, useRef } from "react";

export function AddModal({ title, triggerLabel, children, disabled = false }: { title: string; triggerLabel: string; children: React.ReactNode; disabled?: boolean }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const close = () => dialogRef.current?.close();
  return <>
    <button className="btn btn-primary" type="button" disabled={disabled} onClick={() => dialogRef.current?.showModal()}><Plus size={15}/>{triggerLabel}</button>
    <dialog ref={dialogRef} className="add-dialog" aria-labelledby={titleId} onClick={(event) => { if (event.target === event.currentTarget) close(); }} onSubmit={() => window.setTimeout(close, 0)}>
      <div className="add-dialog-panel">
        <div className="add-dialog-head"><div><div className="eyebrow">New</div><h2 id={titleId}>{title}</h2></div><button className="btn btn-ghost add-dialog-close" type="button" onClick={close} aria-label="Close dialog"><X size={17}/></button></div>
        {children}
      </div>
    </dialog>
  </>;
}
