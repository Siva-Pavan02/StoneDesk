import { useLanguage } from "../../i18n/LanguageContext";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { request, reviseDispatch } from "../../lib/pilotApi.js";
import {
  newDraft,
  readDraft,
  writeDraft,
  clearDraft,
  flushDraft,
  hasDraftContent,
  DRAFTS_FULL,
  MAX_DRAFTS,
  makeRow,
  payload,
  detailErrors,
  entryErrors,
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

export default function NewLoad({
  settings,
  initialDraft,
  onSaved,
  onBack,
  canFinalize = true,
  recentLoads = [],
  user,
}) {
  const { pick, language } = useLanguage();
  const locale = language === "te" ? "te-IN" : "en-IN";
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
  // error: server and other non-field problems, shown at the top.
  // fieldErrors / entryFieldErrors / notice: shown next to the inputs they belong to.
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [entryFieldErrors, setEntryFieldErrors] = useState({});
  const [notice, setNotice] = useState("");
  const root = useRef(null);
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
    // Every change is saved on this device, so a closed tab or ended session
    // keeps the load. Each load has its own slot, keyed by clientRequestId.
    const operation = hasDraftContent(value)
      ? writeDraft(value, settings.id)
      : clearDraft(settings.id, localStorage, draft.clientRequestId);
    let cancelled = false;
    operation.then((ok) => {
      if (!cancelled)
        setStorageError(
          ok === true
            ? ""
            : ok === DRAFTS_FULL
              ? pick(
                  `This phone already keeps ${MAX_DRAFTS} unfinished loads. Save or delete one so this load is kept.`,
                  `ఈ ఫోన్‌లో ఇప్పటికే ${MAX_DRAFTS} పూర్తి కాని లోడ్లు ఉన్నాయి. ఈ లోడ్ ఉండాలంటే ఒకదాన్ని సేవ్ చేయండి లేదా తొలగించండి.`,
                )
              : "This browser cannot keep a recovery copy. Save your draft before leaving.",
        );
    });
    return () => {
      cancelled = true;
    };
  }, [draft, entry, settings.id, recoveryReady, reviseOf, pick]);
  // Autosave keeps ordinary loads on this phone. Two cases are not kept and get
  // a leave warning: an admin revision (never stored locally) with edits, and a
  // load the phone could not store (drafts full or storage unavailable).
  const [openedRevision] = useState(() => JSON.stringify(draft.rows));
  const revisionDirty =
    Boolean(reviseOf) &&
    (JSON.stringify(draft.rows) !== openedRevision ||
      Boolean(entry.length || entry.width) ||
      ["partyName", "truckNumber", "date", "buyerDestination", "supervisor", "fee"].some(
        (key) => String(draft[key] ?? "") !== String(initialDraft?.[key] ?? ""),
      ));
  const unstored =
    !reviseOf && Boolean(storageError) && hasDraftContent({ ...draft, entry });
  const mayLoseWork = !busy && (revisionDirty || unstored);
  useEffect(() => {
    if (!mayLoseWork) return;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [mayLoseWork]);
  async function goBack() {
    if (
      mayLoseWork &&
      !window.confirm(
        revisionDirty
          ? pick(
              "Leave without saving your invoice changes?",
              "బిల్లు మార్పులు సేవ్ చేయకుండా వెళ్ళాలా?",
            )
          : pick(
              "This load is not stored on this phone. Leave without saving it?",
              "ఈ లోడ్ ఈ ఫోన్‌లో నిల్వ కాలేదు. సేవ్ చేయకుండా వెళ్ళాలా?",
            ),
      )
    )
      return;
    if (!reviseOf) await flushDraft(settings.id);
    onBack();
  }
  // The edit and review screens swap the button that was clicked; move focus to the heading.
  const heading = useRef(null);
  function showReview(value) {
    setReview(value);
    requestAnimationFrame(() => heading.current?.focus({ preventScroll: true }));
  }
  // Last removed entry, offered back for a few seconds.
  const [removed, setRemoved] = useState(null);
  useEffect(() => {
    if (!removed) return;
    const timer = setTimeout(() => setRemoved(null), 6000);
    return () => clearTimeout(timer);
  }, [removed]);
  const focusLength = () =>
    requestAnimationFrame(() =>
      root.current?.querySelector('input[name="length"]')?.focus(),
    );
  // Move focus to the first field with an inline error (the browser scrolls it
  // into view). With no invalid field, bring the measurements message into view.
  function focusFirstProblem() {
    requestAnimationFrame(() => {
      const field = root.current?.querySelector('[aria-invalid="true"]');
      if (field) field.focus();
      else
        root.current
          ?.querySelector(".field-error-block")
          ?.scrollIntoView({ block: "center" });
    });
  }
  // Checks the load details and measurements before review or save. Problems are
  // shown under their fields, and review mode closes so those fields are visible.
  function checkLoad(pendingMessage) {
    const details = detailErrors(draft);
    const measurements =
      entry.length || entry.width
        ? pendingMessage
        : !draft.rows.length
          ? "Add at least one measurement row"
          : "";
    setFieldErrors(details);
    setNotice(measurements);
    const ok = !Object.keys(details).length && !measurements;
    if (!ok) {
      setError("");
      setReview(false);
      focusFirstProblem();
    }
    return ok;
  }
  function updateEntry(next) {
    setEntry(next);
    // Clear the message of each measurement field the user just changed.
    setEntryFieldErrors((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([key]) => next[key] === entry[key]),
      ),
    );
    if (!next.length && !next.width && draft.rows.length) setNotice("");
  }
  async function revise() {
    if (lock.current) return;
    if (!checkLoad("Add the current measurement row before saving")) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
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
  // Typing in Length/Width re-renders this screen; only recompute rows when they change.
  const rows = useMemo(() => previewRows(draft.rows), [draft.rows]);
  const summary = useMemo(
    () => summarize(draft.rows, draft.fee),
    [draft.rows, draft.fee],
  );
  const rowGroups = useMemo(() => {
    const lastIndex = new Map();
    rows.forEach((r, i) => lastIndex.set(r.rowNo, i));
    return [...lastIndex.keys()]
      .sort((a, b) => (review ? a - b : lastIndex.get(b) - lastIndex.get(a)))
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
        return { no, lines };
      });
  }, [rows, review]);
  const areaFormat = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [locale],
  );
  const countFormat = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const reviewDate = (iso) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return iso;
    return new Intl.DateTimeFormat(locale, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    }).format(new Date(`${iso}T00:00:00+05:30`));
  };
  const change = (key) => (e) => {
    setDraft({ ...draft, [key]: e.target.value });
    if (fieldErrors[key])
      setFieldErrors(({ [key]: _cleared, ...rest }) => rest);
  };
  function add() {
    setError("");
    const product = settings.stoneRates.find((p) => p.id === entry.productId);
    const errors = entryErrors(entry, product);
    setEntryFieldErrors(errors);
    if (Object.keys(errors).length) {
      focusFirstProblem();
      return false;
    }
    try {
      const row = makeRow(entry, product);
      setDraft({ ...draft, rows: [...draft.rows, row] });
      setEntry({ ...entry, length: "", width: "", quantity: "1" });
      setNotice("");
      return true;
    } catch (err) {
      // Only the row number can still fail here; it has no input of its own.
      setError(err.message);
      return false;
    }
  }
  function openReview() {
    if (!checkLoad("Add the measurement row you are entering before reviewing"))
      return;
    setError("");
    showReview(true);
    window.scrollTo(0, 0);
  }
  async function save(finalize) {
    // A revision must never create or finalize a separate dispatch.
    if (reviseOf) return revise();
    if (lock.current) return;
    if (!checkLoad("Add the current measurement row before saving")) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
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
      if (settings.id)
        await clearDraft(settings.id, localStorage, draft.clientRequestId);
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
    <div className="space-y-4" ref={root}>
      <div className="screen-heading">
        <h1 ref={heading} tabIndex={-1}>
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
          onClick={review ? () => showReview(false) : goBack}
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
              name="partyName"
              required
              maxLength={120}
              options={choices("partyName")}
              error={fieldErrors.partyName}
              value={draft.partyName}
              onValue={(value) => change("partyName")({ target: { value } })}
            />
            <ComboField
              en="Truck number"
              te="లారీ నంబర్"
              name="truckNumber"
              spellCheck={false}
              required
              maxLength={40}
              autoCapitalize="characters"
              options={choices("truckNumber", settings.savedTrucks)}
              error={fieldErrors.truckNumber}
              value={draft.truckNumber}
              onValue={(value) => change("truckNumber")({ target: { value } })}
            />
            <DateField
              en="Load date"
              te="తేదీ"
              name="date"
              required
              error={fieldErrors.date}
              value={draft.date}
              onValue={(value) => change("date")({ target: { value } })}
            />
            <ComboField
              en="Destination"
              te="గమ్యస్థానం"
              name="buyerDestination"
              required
              maxLength={200}
              options={choices("buyerDestination", settings.savedDestinations)}
              error={fieldErrors.buyerDestination}
              value={draft.buyerDestination}
              onValue={(value) =>
                change("buyerDestination")({ target: { value } })
              }
            />
            <Field
              en="Supervisor"
              te="సూపర్‌వైజర్"
              name="supervisor"
              autoComplete="off"
              required
              maxLength={120}
              error={fieldErrors.supervisor}
              value={draft.supervisor}
              onChange={change("supervisor")}
            />
          </Card>
          <MeasurementEntry
            products={settings.stoneRates}
            entry={entry}
            onChange={updateEntry}
            onAdd={add}
            errors={entryFieldErrors}
            notice={notice}
          />
        </div>
      ) : (
        <Card className="review-summary">
          <dl>
            {[
              [pick("Party", "పార్టీ"), draft.partyName, true],
              [pick("Truck", "లారీ"), draft.truckNumber],
              [pick("Date", "తేదీ"), reviewDate(draft.date)],
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
      {removed && !review && (
        <p role="status" aria-live="polite" className="measurement-undo">
          {pick("Entry removed.", "కొలత తొలగించబడింది.")}{" "}
          <button
            type="button"
            className="text-button"
            onClick={() => {
              const rowsBack = [...draft.rows];
              rowsBack.splice(Math.min(removed.index, rowsBack.length), 0, removed.row);
              setDraft({ ...draft, rows: rowsBack });
              setRemoved(null);
            }}
          >
            {pick("Undo", "రద్దు చేయండి")}
          </button>
        </p>
      )}
      {rowGroups.map(({ no, lines }) => {
          const titleId = `row-group-${no}-title`;
          return (
            <section
              key={no}
              className="row-group"
              aria-labelledby={titleId}
            >
              <h2 className="row-group-title" id={titleId}>
                {pick("Row", "వరుస")} {no}
              </h2>
              {lines.map(({ r, i, order }, n) => {
                const position = (review ? n : order) + 1;
                return (
                <Card key={i} className="measurement-record gap-2">
                  <strong className="break-words">
                    {position}. {r.stoneType} · {r.finish}
                    {r.category === "TOP" ? ` · ${pick("Top", "టాప్")}` : ""}
                  </strong>
                  <p>
                    {decimalToFraction(r.lengthFt)} ×{" "}
                    {decimalToFraction(r.widthFt)}{"\u00A0"}{pick("ft", "అడుగులు")} ×{" "}
                    {countFormat.format(r.quantity)}{"\u00A0"}{pick("pieces", "ముక్కలు")}
                  </p>
                  <p className="font-semibold">
                    {areaFormat.format(r.sqFt)}{"\u00A0"}{pick("sq\u00A0ft", "చ.అ.")} ·{" "}
                    {money(r.lineTotal)}
                  </p>
                  {!review && (
                    <div className="measurement-actions">
                      <Button
                        en="Edit entry"
                        te="కొలత మార్చండి"
                        aria-label={pick(
                          `Edit entry ${position}, row ${no}`,
                          `కొలత మార్చండి ${position}, వరుస ${no}`,
                        )}
                        onClick={() => {
                          if (entry.length || entry.width) {
                            setNotice(
                              "Add your current row before editing another",
                            );
                            focusFirstProblem();
                            return;
                          }
                          setEntryFieldErrors({});
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
                          setRemoved(null);
                          focusLength();
                        }}
                      />
                      <Button
                        en="Remove entry"
                        te="కొలత తొలగించండి"
                        aria-label={pick(
                          `Remove entry ${position}, row ${no}`,
                          `కొలత తొలగించండి ${position}, వరుస ${no}`,
                        )}
                        onClick={() => {
                          setDraft({
                            ...draft,
                            rows: draft.rows.filter((_, index) => index !== i),
                          });
                          setRemoved({ row: draft.rows[i], index: i });
                          // Focus moves to the Undo offer, which names what happened.
                          requestAnimationFrame(() =>
                            root.current?.querySelector(".measurement-undo button")?.focus(),
                          );
                        }}
                      />
                    </div>
                  )}
                </Card>
                );
              })}
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
            name="fee"
            error={fieldErrors.fee}
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
