import { useState } from "react";
import { billRows, rowGroups } from "../../utils/billData.js";
import { fixed2, round2 } from "../../utils/loadMath.js";
import { decimalToFraction } from "../../utils/fractionParser.js";
import { Button } from "./Controls.jsx";

const area = fixed2;
const amount = (value) =>
  round2(Number(value) || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
export default function InvoiceTable({ record }) {
  const [page, setPage] = useState(0);
  const groups = rowGroups(billRows(record));
  const pageSize = 6,
    pages = Math.max(1, Math.ceil(groups.length / pageSize));
  const current = Math.min(page, pages - 1);
  const rowWord = "Row";
  const regularWord = "Regular",
    topWord = "Top";
  const sub = (key, label, totals) => (
    <tr key={key} className="invoice-row-sub">
      <th scope="row" colSpan={3}>
        {label}
      </th>
      <td className="numeric">{totals.quantity}</td>
      <td className="numeric">{area(totals.sqFt)}</td>
      <td className="numeric">{amount(totals.amount)}</td>
    </tr>
  );
  const lineRow = (l, no, top) => (
    <tr key={`${top ? "t" : "r"}${no}`}>
      <th scope="row" className={top ? "invoice-type-top" : ""}>
        {top ? topWord : <span className="sr-only">{regularWord}</span>}
      </th>
      <td className="numeric">{decimalToFraction(l.lengthFt)}</td>
      <td className="numeric">{decimalToFraction(l.widthFt)}</td>
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
          <col className="invoice-col-type" />
          <col className="invoice-col-dim" />
          <col className="invoice-col-dim" />
          <col className="invoice-col-qty" />
          <col className="invoice-col-area" />
          <col className="invoice-col-amount" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col">{"Type"}</th>
            <th scope="col" className="numeric">
              {"L"}
            </th>
            <th scope="col" className="numeric">
              {"W"}
            </th>
            <th scope="col" className="numeric">
              {"Qty"}
            </th>
            <th scope="col" className="numeric">
              {"Sq ft"}
            </th>
            <th scope="col" className="numeric">
              {"Amount (₹)"}
            </th>
          </tr>
        </thead>
        <tbody>
          {g.regularLines.map((l, i) => lineRow(l, i + 1, false))}
          {g.regularLines.length > 0 &&
            sub("rs", "Regular subtotal", g.regular)}
          {g.topLines.map((l, i) =>
            lineRow(l, g.regularLines.length + i + 1, true),
          )}
          {g.topLines.length > 0 &&
            sub("ts", "Top subtotal", g.top)}
        </tbody>
        <tfoot>
          <tr className="invoice-row-total">
            <th scope="row" colSpan={3}>
              {"Total"}
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
          <h3>{"Rows"}</h3>
          <p>
            {groups.length}{" "}
            {groups.length === 1 ? "row" : "rows"}
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
              <h4>{g.rowNo}</h4>
              {rowTable(g)}
            </div>
          );
        })}
      </div>
      {!groups.length && (
        <p className="p-4 text-on-surface-variant">
          {"No measurement rows in this record."}
        </p>
      )}
      {pages > 1 && (
        <div className="table-pagination">
          <span role="status" className="text-sm text-on-surface-variant">
            {"Page"} {current + 1} / {pages} · {groups.length}{" "}
            {"rows"}
          </span>
          <div className="flex gap-2">
            <Button
              label="Previous"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            />
            <Button
              label="Next"
              disabled={current + 1 >= pages}
              onClick={() => setPage(current + 1)}
            />
          </div>
        </div>
      )}
    </section>
  );
}
