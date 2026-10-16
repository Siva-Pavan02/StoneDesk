import { useEffect, useId, useRef } from "react";
import { Button } from "./Controls.jsx";

// Modal yes/no question, following LogoutDialog: controlled `open`, Escape
// cancels, Cancel gets focus first. Text props are plain strings.
export default function ConfirmDialog({
  open,
  title,
  message,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
}) {
  const dialog = useRef(null);
  const id = useId();
  useEffect(() => {
    const el = dialog.current;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog
      ref={dialog}
      className="app-dialog pilot logout-dialog"
      aria-labelledby={`${id}-title`}
      aria-describedby={message ? `${id}-message` : undefined}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <div className="logout-dialog-body">
        <h2 id={`${id}-title`}>{title}</h2>
        {message && <p id={`${id}-message`}>{message}</p>}
      </div>
      <div className="logout-dialog-actions">
        <Button label={cancelLabel} onClick={onCancel} autoFocus />
        <Button primary label={confirmLabel} onClick={onConfirm} />
      </div>
    </dialog>
  );
}
