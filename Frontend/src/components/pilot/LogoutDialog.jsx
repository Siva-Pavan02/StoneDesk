import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { Button } from "./Controls.jsx";

export default function LogoutDialog({ open, onCancel, onConfirm }) {
  const { pick } = useLanguage();
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
          {pick(
            "Are you sure you want to logout",
            "StoneDesk నుండి లాగ్ అవుట్ అవ్వాలా?",
          )}
        </h2>
      </div>
      <div className="logout-dialog-actions">
        <Button
          en="Cancel"
          te="రద్దు"
          disabled={busy}
          onClick={onCancel}
          autoFocus
        />
        <Button
          primary
          en={busy ? "Logging out…" : "Log out"}
          te={busy ? "లాగ్ అవుట్ అవుతోంది…" : "లాగ్ అవుట్"}
          disabled={busy}
          onClick={confirm}
        />
      </div>
    </dialog>
  );
}
