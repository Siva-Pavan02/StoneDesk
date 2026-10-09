import { useLanguage } from "../../i18n/LanguageContext";
import React, { useEffect, useRef, useState } from "react";
import { request } from "../../lib/pilotApi.js";
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
import { Button, Card, ComboField, Field, ErrorMessage } from "./Controls.jsx";
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
    if (!recoveryReady || lock.current) return;
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
  }, [draft, entry, settings.id, recoveryReady]);
  async function goBack() {
    await flushDraft(settings.id);
    onBack();
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
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      if (entry.length || entry.width)
        throw new Error("Add the current measurement row before saving");
      const body = payload(draft);
      let record = draft.serverId
        ? await request(`/dispatches/${draft.serverId}`)
        : await request("/dispatches", { method: "POST", body });
      const savedDraft = { ...draft, serverId: record.id };
      setDraft(savedDraft);
      if (settings.id)
        await writeDraft({ ...savedDraft, entry }, settings.id, localStorage);
      if (record.status === "Draft") {
        record = await request(`/dispatches/${record.id}`, {
          method: "PUT",
          body,
        });
        if (finalize)
          record = await request(`/dispatches/${record.id}/finalize`, {
            method: "POST",
          });
      }
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
            ? pick("Review load", "లోడ్ వివరాలు తనిఖీ చేయండి")
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
            : pick("Back to dashboard", "డ్యాష్‌బోర్డ్‌కు వెళ్ళండి")}
        </button>
      </div>
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
            <Field
              en="Load date"
              te="తేదీ"
              type="date"
              required
              value={draft.date}
              onChange={change("date")}
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
        .sort((a, b) => a - b)
        .map((no) => {
          const lines = rows
            .map((r, i) => ({ r, i }))
            .filter(({ r }) => r.rowNo === no);
          lines.sort(
            (a, b) => (a.r.category === "TOP") - (b.r.category === "TOP"),
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
              {lines.map(({ r, i }, n) => (
                <Card key={i} className="measurement-record gap-2">
                  <strong className="break-words">
                    {n + 1}. {r.stoneType} · {r.finish}
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
        <Card>
          <Field
            en="Loading / royalty charges (₹)"
            te="లోడింగ్ / రాయల్టీ ఛార్జీలు"
            type="number"
            min="0"
            step="0.01"
            value={draft.fee}
            onChange={change("fee")}
          />
        </Card>
      )}
      <LoadSummary rows={rows} summary={summary} />
      {review && (
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
            {canFinalize ? (
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
        <Button
          className="w-full"
          disabled={busy}
          en="Save draft"
          te="డ్రాఫ్ట్ సేవ్ చేయండి"
          onClick={() => save(false)}
        />
      </div>
    </div>
  );
}
