import { useEffect, useRef, useState } from "react";
import { Button } from "./Controls.jsx";

export default function LogoutDialog({ open, onCancel, onConfirm }) {
  const dialog = useRef(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const el = dialog.current;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);
  async function confirm() {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="app-dialog pilot logout-dialog"
      aria-labelledby="logout-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <div className="logout-dialog-body">
        <h2 id="logout-title">
          {"Are you sure you want to log out?"}
        </h2>
      </div>
      <div className="logout-dialog-actions">
        <Button
          label="Cancel"
          disabled={busy}
          onClick={onCancel}
          autoFocus
        />
        <Button
          primary
          label={busy ? "Logging out…" : "Log out"}
          disabled={busy}
          onClick={confirm}
        />
      </div>
    </dialog>
  );
}
