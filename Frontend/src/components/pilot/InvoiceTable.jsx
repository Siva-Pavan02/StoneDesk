import { useState } from "react";
import { useLanguage } from "../../i18n/LanguageContext";
import { billRows, rowGroups } from "../../utils/billData.js";
import { fixed2, round2 } from "../../utils/loadMath.js";
import { Button } from "./Controls.jsx";

const area = fixed2;
const amount = (value) =>
  round2(Number(value) || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
export default function InvoiceTable({ record }) {
  const { pick } = useLanguage();
  const [page, setPage] = useState(0);
  const groups = rowGroups(billRows(record));
  const pageSize = 6,
    pages = Math.max(1, Math.ceil(groups.length / pageSize));
  const current = Math.min(page, pages - 1);
  const rowWord = pick("Row", "వరుస");
  const regularWord = pick("Regular", "సాధారణ"),
    topWord = pick("Top", "టాప్");
  const sub = (key, label, totals) => (
    <tr key={key} className="invoice-row-sub">
      <th scope="row" colSpan={4}>
        {label}
      </th>
      <td className="numeric">{totals.quantity}</td>
      <td className="numeric">{area(totals.sqFt)}</td>
      <td className="numeric">{amount(totals.amount)}</td>
    </tr>
  );
  const lineRow = (l, no, top) => (
    <tr key={`${top ? "t" : "r"}${no}`}>
      <th scope="row">{no}</th>
      <td className={top ? "invoice-type-top" : ""}>
        {top ? topWord : <span className="sr-only">{regularWord}</span>}
      </td>
      <td className="numeric">{l.lengthFt}</td>
      <td className="numeric">{l.widthFt}</td>
      <td className="numeric">{l.quantity}</td>
      <td className="numeric">{area(l.sqFt)}</td>
      <td className="numeric">{amount(l.lineTotal)}</td>
    </tr>
  );
  const rowTable = (g) => (
    <div
      className="table-scroll"
      tabIndex={0}
      role="region"
      aria-label={`${rowWord} ${g.rowNo}`}
    >
      <table className="invoice-row-table">
        <caption className="sr-only">
          {rowWord} {g.rowNo}
        </caption>
        <colgroup>
          <col className="invoice-col-no" />
          <col className="invoice-col-type" />
          <col className="invoice-col-dim" />
          <col className="invoice-col-dim" />
          <col className="invoice-col-qty" />
          <col className="invoice-col-area" />
          <col className="invoice-col-amount" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">{pick("S.No.", "క్ర.సం.")}</th>
            <th scope="col">{pick("Type", "రకం")}</th>
            <th scope="col" className="numeric">
              {pick("L (ft)", "పొడవు")}
            </th>
            <th scope="col" className="numeric">
              {pick("W (ft)", "వెడల్పు")}
            </th>
            <th scope="col" className="numeric">
              {pick("Qty", "సంఖ్య")}
            </th>
            <th scope="col" className="numeric">
              {pick("Sq ft", "చ.అ.")}
            </th>
            <th scope="col" className="numeric">
              {pick("Amount (₹)", "మొత్తం (₹)")}
            </th>
          </tr>
        </thead>
        <tbody>
          {g.regularLines.map((l, i) => lineRow(l, i + 1, false))}
          {g.regularLines.length > 0 &&
            sub("rs", pick("Regular subtotal", "సాధారణ ఉప మొత్తం"), g.regular)}
          {g.topLines.map((l, i) =>
            lineRow(l, g.regularLines.length + i + 1, true),
          )}
          {g.topLines.length > 0 &&
            sub("ts", pick("Top subtotal", "టాప్ ఉప మొత్తం"), g.top)}
        </tbody>
        <tfoot>
          <tr className="invoice-row-total">
            <th scope="row" colSpan={4}>
              {rowWord} {g.rowNo} {pick("total", "మొత్తం")}
            </th>
            <td className="numeric">{g.total.quantity}</td>
            <td className="numeric">{area(g.total.sqFt)}</td>
            <td className="numeric">{amount(g.total.amount)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
  return (
    <section className="invoice-section">
      <div className="invoice-section-heading">
        <div>
          <h3>{pick("Rows", "వరుసలు")}</h3>
          <p>
            {groups.length}{" "}
            {groups.length === 1 ? pick("row", "వరుస") : pick("rows", "వరుసలు")}
          </p>
        </div>
      </div>
      <div className="invoice-row-grid">
        {groups.map((g, index) => {
          const hidden =
            index < current * pageSize || index >= (current + 1) * pageSize
              ? "invoice-row-offpage"
              : "";
          return (
            <div key={g.rowNo} className={`invoice-row-block ${hidden}`}>
              <h4>
                {rowWord} {g.rowNo}
              </h4>
              {rowTable(g)}
            </div>
          );
        })}
      </div>
      {!groups.length && (
        <p className="p-4 text-gray-600">
          {pick(
            "No measurement rows in this record.",
            "ఈ రికార్డులో కొలతలు లేవు.",
          )}
        </p>
      )}
      {pages > 1 && (
        <div className="table-pagination">
          <span role="status" className="text-sm text-gray-600">
            {pick("Page", "పేజీ")} {current + 1} / {pages} · {groups.length}{" "}
            {pick("rows", "వరుసలు")}
          </span>
          <div className="flex gap-2">
            <Button
              en="Previous"
              te="మునుపటి"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            />
            <Button
              en="Next"
              te="తర్వాత"
              disabled={current + 1 >= pages}
              onClick={() => setPage(current + 1)}
            />
          </div>
        </div>
      )}
    </section>
  );
}
