import { useLanguage } from "../../i18n/LanguageContext";
import React, { useEffect, useRef, useState } from "react";
import { request, reviseDispatch } from "../../lib/pilotApi.js";
import {
  newDraft,
  readDraft,
  writeDraft,
  clearDraft,
  flushDraft,
  hasDraftContent,
  makeRow,
  payload,
  previewRows,
  summarize,
  money,
} from "../../utils/pilotDraft.js";
import {
  Button,
  Card,
  ComboField,
  DateField,
  Field,
  ErrorMessage,
} from "./Controls.jsx";
import MeasurementEntry from "./MeasurementEntry.jsx";
import LoadSummary from "./LoadSummary.jsx";
import { decimalToFraction } from "../../utils/fractionParser.js";
import { fixed2 } from "../../utils/loadMath.js";

export default function NewLoad({
  settings,
  initialDraft,
  onSaved,
  onBack,
  canFinalize = true,
  recentLoads = [],
  user,
}) {
  const { pick } = useLanguage();
  const [draft, setDraft] = useState(
    () =>
      initialDraft || {
        ...newDraft(settings.defaultRoyaltyFee),
        supervisor: user?.name || "",
      },
  );
  const choices = (key, saved = []) =>
    [
      ...new Set(
        [
          ...saved,
          ...recentLoads.map((l) =>
            key === "partyName" ? l.partyName : l.logistics?.[key],
          ),
        ].filter(Boolean),
      ),
    ].slice(0, 30);
  const first = settings.stoneRates[0];
  const [entry, setEntry] = useState(() => {
    const saved = draft.entry;
    const valid =
      saved && settings.stoneRates.some((p) => p.id === saved.productId);
    const base = {
      productId: first?.id || "",
      category: "Regular",
      rowNo: "1",
      length: "",
      width: "",
      quantity: "1",
      rate: String(first?.defaultRate ?? ""),
    };
    const restored = saved && { ...saved, rowNo: saved.rowNo ?? "1" };
    return valid
      ? restored
      : saved
        ? { ...restored, productId: base.productId, rate: base.rate }
        : base;
  });
  const [review, setReview] = useState(false);
  const [error, setError] = useState("");
  const [storageError, setStorageError] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [recoveryReady, setRecoveryReady] = useState(Boolean(initialDraft));
  // Revising a finalized invoice (admin): never touches the phone's draft
  // recovery copy and saves through PUT /dispatches/:id/revise instead.
  const reviseOf = draft.reviseOf || null;

  useEffect(() => {
    if (initialDraft) return;
    let cancelled = false;
    readDraft(localStorage, settings.id).then((recovered) => {
      if (cancelled) return;
      if (recovered) {
        setDraft(recovered);
        if (recovered.entry)
          setEntry({ ...recovered.entry, rowNo: recovered.entry.rowNo ?? "1" });
      }
      setRecoveryReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [settings.id, initialDraft]);

  useEffect(() => {
    if (!recoveryReady || lock.current || reviseOf) return;
    const value = { ...draft, entry };
    const operation = hasDraftContent(value)
      ? writeDraft(value, settings.id)
      : clearDraft(settings.id);
    let cancelled = false;
    operation.then((ok) => {
      if (!cancelled)
        setStorageError(
          ok
            ? ""
            : "This browser cannot keep a recovery copy. Save your draft before leaving.",
        );
    });
    return () => {
      cancelled = true;
    };
  }, [draft, entry, settings.id, recoveryReady, reviseOf]);
  async function goBack() {
    if (!reviseOf) await flushDraft(settings.id);
    onBack();
  }
  async function revise() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      if (entry.length || entry.width)
        throw new Error("Add the current measurement row before saving");
      // Same body shape as a draft update; the server keeps slip number and status.
      const { clientRequestId: _clientRequestId, ...body } = payload(draft);
      const record = await reviseDispatch(reviseOf.id, {
        ...body,
        updatedAt: reviseOf.updatedAt,
      });
      onSaved(record);
    } catch (err) {
      setError(
        err.status === 409
          ? pick(
              "This invoice changed since you opened it. Cancel to reload the latest bill, then try again.",
              "మీరు తెరిచిన తర్వాత ఈ బిల్లు మారింది. తాజా బిల్లు కోసం రద్దు చేసి, మళ్ళీ ప్రయత్నించండి.",
            )
          : err.status === 403
            ? pick(
                "You are not permitted to edit this invoice.",
                "ఈ బిల్లును మార్చడానికి మీకు అనుమతి లేదు.",
              )
            : err.message,
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const rows = previewRows(draft.rows);
  const summary = summarize(draft.rows, draft.fee);
  const change = (key) => (e) => setDraft({ ...draft, [key]: e.target.value });
  function add() {
    setError("");
    try {
      const row = makeRow(
        entry,
        settings.stoneRates.find((p) => p.id === entry.productId),
      );
      setDraft({ ...draft, rows: [...draft.rows, row] });
      setEntry({ ...entry, length: "", width: "", quantity: "1" });
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }
  function openReview() {
    try {
      if (entry.length || entry.width)
        throw new Error(
          "Add the measurement row you are entering before reviewing",
        );
      payload(draft);
      setError("");
      setReview(true);
      window.scrollTo(0, 0);
    } catch (err) {
      setError(err.message);
    }
  }
  async function save(finalize) {
    // A revision must never create or finalize a separate dispatch.
    if (reviseOf) return revise();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      if (entry.length || entry.width)
        throw new Error("Add the current measurement row before saving");
      const body = payload(draft);
      const sentBody = JSON.stringify(body);
      let record;
      if (draft.serverId) {
        try {
          record = await request(`/dispatches/${draft.serverId}`, {
            method: "PUT",
            body,
          });
        } catch (err) {
          if (err.status !== 400) throw err;
          // A load finalized elsewhere is shown as-is; real validation errors still surface.
          record = await request(`/dispatches/${draft.serverId}`);
          if (record.status === "Draft") throw err;
        }
      } else {
        // A retried POST (same clientRequestId) returns the earlier copy, so remember
        // what was sent and only PUT when the retry carries newer edits.
        const previousBody = draft.postedBody;
        const postingDraft = { ...draft, postedBody: sentBody };
        setDraft(postingDraft);
        if (settings.id)
          await writeDraft({ ...postingDraft, entry }, settings.id, localStorage);
        record = await request("/dispatches", { method: "POST", body });
        const savedDraft = { ...draft, serverId: record.id, postedBody: undefined };
        setDraft(savedDraft);
        if (settings.id)
          await writeDraft({ ...savedDraft, entry }, settings.id, localStorage);
        if (record.status === "Draft" && previousBody && previousBody !== sentBody)
          record = await request(`/dispatches/${record.id}`, {
            method: "PUT",
            body,
          });
      }
      if (finalize && record.status === "Draft")
        record = await request(`/dispatches/${record.id}/finalize`, {
          method: "POST",
        });
      if (settings.id) await clearDraft(settings.id);
      onSaved(record);
    } catch (err) {
      setError(err.message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (!recoveryReady)
    return (
      <p role="status">
        {pick("Restoring draft…", "డ్రాఫ్ట్ పునరుద్ధరిస్తోంది…")}
      </p>
    );
  return (
    <div className="space-y-4">
      <div className="screen-heading">
        <h1>
          {review
            ? reviseOf
              ? pick("Review changes", "మార్పులు తనిఖీ చేయండి")
              : pick("Review load", "లోడ్ వివరాలు తనిఖీ చేయండి")
            : reviseOf
              ? pick("Edit invoice", "బిల్లు మార్చండి")
              : pick("New load", "కొత్త లోడ్")}
        </h1>
        <button
          type="button"
          className="text-button"
          disabled={busy}
          onClick={review ? () => setReview(false) : goBack}
        >
          {review
            ? pick("Back to edit", "వివరాలు మార్చండి")
            : reviseOf
              ? pick("Cancel and back to bill", "రద్దు చేసి బిల్లుకు వెళ్ళండి")
              : pick("Back to dashboard", "డ్యాష్‌బోర్డ్‌కు వెళ్ళండి")}
        </button>
      </div>
      {reviseOf && (
        <section
          className="flex flex-col gap-1 border-l-2 border-base-content/30 pl-3 text-sm"
          aria-label={pick("Editing a finalized invoice", "ఖరారైన బిల్లును మారుస్తున్నారు")}
        >
          <strong className="font-semibold">
            {reviseOf.slip
              ? pick(`Editing finalized invoice ${reviseOf.slip}`, `ఖరారైన బిల్లు ${reviseOf.slip} మారుస్తున్నారు`)
              : pick("Editing finalized invoice", "ఖరారైన బిల్లును మారుస్తున్నారు")}
          </strong>
          <span className="opacity-70">
            {pick(
              "The slip number and status stay the same. The current version is kept in the invoice history.",
              "స్లిప్ నంబర్ మరియు స్థితి మారవు. ప్రస్తుత వెర్షన్ బిల్లు చరిత్రలో భద్రపరచబడుతుంది.",
            )}
          </span>
        </section>
      )}
      <ErrorMessage error={error} />
      <ErrorMessage error={storageError} />
      {!review ? (
        <div className="load-entry-grid">
          <Card className="gap-4 logistics-fields">
            <h2>{pick("Load details", "లోడ్ వివరాలు")}</h2>
            <ComboField
              en="Party name"
              te="పార్టీ పేరు"
              required
              maxLength={120}
              options={choices("partyName")}
              value={draft.partyName}
              onValue={(value) => change("partyName")({ target: { value } })}
            />
            <ComboField
              en="Truck number"
              te="లారీ నంబర్"
              required
              maxLength={40}
              autoCapitalize="characters"
              options={choices("truckNumber", settings.savedTrucks)}
              value={draft.truckNumber}
              onValue={(value) => change("truckNumber")({ target: { value } })}
            />
            <DateField
              en="Load date"
              te="తేదీ"
              required
              value={draft.date}
              onValue={(value) => change("date")({ target: { value } })}
            />
            <ComboField
              en="Destination"
              te="గమ్యస్థానం"
              required
              maxLength={200}
              options={choices("buyerDestination", settings.savedDestinations)}
              value={draft.buyerDestination}
              onValue={(value) =>
                change("buyerDestination")({ target: { value } })
              }
            />
            <Field
              en="Supervisor"
              te="సూపర్‌వైజర్"
              required
              maxLength={120}
              value={draft.supervisor}
              onChange={change("supervisor")}
            />
          </Card>
          <MeasurementEntry
            products={settings.stoneRates}
            entry={entry}
            onChange={setEntry}
            onAdd={add}
          />
        </div>
      ) : (
        <Card className="review-summary">
          <dl>
            {[
              [pick("Party", "పార్టీ"), draft.partyName, true],
              [pick("Truck", "లారీ"), draft.truckNumber],
              [pick("Date", "తేదీ"), draft.date],
              [pick("Destination", "గమ్యస్థానం"), draft.buyerDestination],
              [pick("Supervisor", "సూపర్‌వైజర్"), draft.supervisor],
            ].map(([label, value, strong]) => (
              <div key={label} className={strong ? "is-primary" : undefined}>
                <dt>{label}</dt>
                <dd title={value}>{value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}
      {[...new Set(rows.map((r) => r.rowNo))]
        .sort((a, b) =>
          review
            ? a - b
            : rows.findLastIndex((r) => r.rowNo === b) -
              rows.findLastIndex((r) => r.rowNo === a),
        )
        .map((no) => {
          const lines = rows
            .map((r, i) => ({ r, i }))
            .filter(({ r }) => r.rowNo === no)
            .map((line, order) => ({ ...line, order }));
          lines.sort((a, b) =>
            review
              ? (a.r.category === "TOP") - (b.r.category === "TOP")
              : b.i - a.i,
          );
          return (
            <section
              key={no}
              className="row-group"
              aria-label={`${pick("Row", "వరుస")} ${no}`}
            >
              <h2 className="row-group-title">
                {pick("Row", "వరుస")} {no}
              </h2>
              {lines.map(({ r, i, order }, n) => (
                <Card key={i} className="measurement-record gap-2">
                  <strong className="break-words">
                    {(review ? n : order) + 1}. {r.stoneType} · {r.finish}
                    {r.category === "TOP" ? ` · ${pick("Top", "టాప్")}` : ""}
                  </strong>
                  <p>
                    {decimalToFraction(r.lengthFt)} ×{" "}
                    {decimalToFraction(r.widthFt)} {pick("ft", "అడుగులు")} ×{" "}
                    {r.quantity} {pick("pieces", "ముక్కలు")}
                  </p>
                  <p className="font-semibold">
                    {fixed2(r.sqFt)} {pick("sq ft", "చ.అ.")} ·{" "}
                    {money(r.lineTotal)}
                  </p>
                  {!review && (
                    <div className="measurement-actions">
                      <Button
                        en="Edit entry"
                        te="కొలత మార్చండి"
                        onClick={() => {
                          if (entry.length || entry.width) {
                            setError(
                              "Add your current row before editing another",
                            );
                            return;
                          }
                          const product = settings.stoneRates.find(
                            (p) =>
                              p.stoneType === r.stoneType &&
                              p.finish === r.finish,
                          );
                          setEntry({
                            productId: product?.id || "",
                            length: String(r.lengthFt),
                            width: String(r.widthFt),
                            quantity: String(r.quantity),
                            category: r.category,
                            rowNo: String(r.rowNo),
                            rate: String(r.ratePerSqFt),
                          });
                          setDraft({
                            ...draft,
                            rows: draft.rows.filter((_, index) => index !== i),
                          });
                        }}
                      />
                      <Button
                        en="Remove entry"
                        te="కొలత తొలగించండి"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            rows: draft.rows.filter((_, index) => index !== i),
                          })
                        }
                      />
                    </div>
                  )}
                </Card>
              ))}
            </section>
          );
        })}
      {!review && (
        <Card className="fee-field">
          <Field
            en="Loading charges (₹)"
            te="లోడింగ్ ఛార్జీలు (₹)"
            type="number"
            min="0"
            step="0.01"
            value={draft.fee}
            onChange={change("fee")}
          />
        </Card>
      )}
      <LoadSummary rows={rows} summary={summary} />
      {review && !reviseOf && (
        <p className="text-sm text-gray-700">
          {pick(
            "Finalizing locks this bill’s quantities, prices, totals, and business branding.",
            "ఖరారు చేసిన తర్వాత ఈ బిల్లులోని కొలతలు, ధరలు, మొత్తాలు మరియు వ్యాపార వివరాలు మారవు.",
          )}
        </p>
      )}
      <div className="workflow-actions">
        {review ? (
          <>
            {reviseOf ? (
              <Button
                className="w-full"
                primary
                disabled={busy}
                en={busy ? "Saving…" : "Save invoice changes"}
                te={busy ? "సేవ్ అవుతోంది…" : "బిల్లు మార్పులు సేవ్ చేయండి"}
                onClick={revise}
              />
            ) : canFinalize ? (
              <Button
                className="w-full"
                primary
                disabled={busy}
                en={busy ? "Saving…" : "Create invoice"}
                te={busy ? "సేవ్ అవుతోంది…" : "ఖరారు చేసి పంపండి"}
                onClick={() => save(true)}
              />
            ) : (
              <p className="font-semibold">
                {pick(
                  "Save the draft for your dispatcher to finalize.",
                  "డిస్పాచర్ ఖరారు చేయడానికి డ్రాఫ్ట్ సేవ్ చేయండి.",
                )}
              </p>
            )}
          </>
        ) : (
          <Button
            className="w-full"
            primary
            en="Review load"
            te="లోడ్ తనిఖీ చేయండి"
            onClick={openReview}
          />
        )}
        {!reviseOf && (
          <Button
            className="w-full"
            disabled={busy}
            en="Save draft"
            te="డ్రాఫ్ట్ సేవ్ చేయండి"
            onClick={() => save(false)}
          />
        )}
      </div>
    </div>
  );
}
