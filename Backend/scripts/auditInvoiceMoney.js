// Read-only legacy accounting inventory. Set AUDIT_DATABASE_URL explicitly;
// output contains identifiers and amounts, so redirect it to a private file.
const { Client } = require('pg');
const { Prisma } = require('@prisma/client');
const { validateInvoiceMoney } = require('../utils/invoiceMoney');

async function main() {
  if (!process.env.AUDIT_DATABASE_URL) throw new Error('Set AUDIT_DATABASE_URL explicitly');
  const url = new URL(process.env.AUDIT_DATABASE_URL);
  const schema = url.searchParams.get('schema') || 'public';
  if (!/^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(schema)) throw new Error('Invalid database schema');
  for (const key of ['schema', 'connection_limit', 'pool_timeout', 'pgbouncer']) url.searchParams.delete(key);
  const client = new Client({ connectionString: url.toString(), connectionTimeoutMillis: 10000 });
  await client.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await client.query(`SET LOCAL search_path TO "${schema}"`);
    const { rows } = await client.query(`
      SELECT d.id, d."organizationId", d.status, d.summary, d.inventory, d.revisions,
        COALESCE(SUM(p.amount), 0)::text AS received
      FROM "Dispatch" d
      LEFT JOIN "InvoicePayment" p ON p."dispatchId" = d.id
        AND p."organizationId" = d."organizationId"
      GROUP BY d.id
      ORDER BY d."organizationId", d.id
    `);
    const anomalies = [];
    for (const row of rows) {
      const summary = row.summary || {};
      const version = summary.calculationVersion === 2 ? 2 : 1;
      let raw;
      try { raw = new Prisma.Decimal(String(summary.netBillableAmount)); }
      catch { raw = null; }
      const rounded = raw?.isFinite() ? raw.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP) : null;
      const received = new Prisma.Decimal(row.received);
      const fractionalPaisa = version === 1 && raw?.isFinite() && !raw.times(100).isInteger();
      let invalidVersion2 = false;
      if (version === 2) {
        try { validateInvoiceMoney(summary, row.inventory); }
        catch { invalidVersion2 = true; }
      }
      const excess = rounded && received.greaterThan(rounded) ? received.minus(rounded) : new Prisma.Decimal(0);
      const incompleteRevisions = (Array.isArray(row.revisions) ? row.revisions : []).flatMap((revision, index) => {
        const missing = ['revisedAt', 'priorTotal', 'resultingTotal'].filter(key => revision?.[key] == null);
        return missing.length ? [{ index: index + 1, missing }] : [];
      });
      if (fractionalPaisa || invalidVersion2 || excess.greaterThan(0) || !raw?.isFinite() || incompleteRevisions.length) {
        anomalies.push({
          organizationId: row.organizationId, dispatchId: row.id, status: row.status,
          calculationVersion: version,
          rawTotal: raw?.isFinite() ? raw.toString() : null,
          roundedTotal: rounded?.toFixed(2) || null,
          received: received.toFixed(2), excess: excess.toFixed(2),
          fractionalPaisa: Boolean(fractionalPaisa), invalidVersion2, incompleteRevisions,
        });
      }
    }
    await client.query('COMMIT');
    process.stdout.write(JSON.stringify({ scanned: rows.length, anomalyCount: anomalies.length, anomalies }, null, 2) + '\n');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

main().catch(error => {
  console.error('Read-only invoice audit failed:', error.code || error.message);
  process.exitCode = 1;
});
