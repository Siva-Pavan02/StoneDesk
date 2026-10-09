// Repair the old code-vs-UUID lookup without deleting any source records.
require('dotenv').config({ quiet: true });
const prisma = require('../utils/prisma');
const fields = ['businessName', 'address', 'phone', 'gstNumber', 'tradeLicense', 'logoPath', 'savedTrucks', 'savedDestinations', 'stoneRates', 'defaultRoyaltyFee'];
async function repair(apply = false) {
  return prisma.$transaction(async tx => {
    const records = await tx.masterSettings.findMany({ include: { _count: { select: { users: true, dispatches: true, loadingLists: true } } } });
    let repaired = 0;
    for (const source of records) {
      const target = records.find(row => row.id === source.organizationId && row._count.users > 0);
      if (!target || Object.values(source._count).some(Boolean)) continue;
      const untouched = target.businessName === target.organizationId && !target.address && !target.phone && !target.gstNumber && !target.tradeLicense && !target.logoPath && !target.defaultRoyaltyFee && !target.savedTrucks.length && !target.savedDestinations.length && (!Array.isArray(target.stoneRates) || !target.stoneRates.length);
      if (!untouched) continue;
      if (apply) await tx.masterSettings.update({ where: { id: target.id, updatedAt: target.updatedAt }, data: Object.fromEntries(fields.map(key => [key, source[key]])) });
      repaired++;
    }
    return { mode: apply ? 'applied' : 'preview', profiles: repaired, sourceRecordsRetained: true };
  });
}
if (require.main === module) repair(process.argv.includes('--apply')).then(console.log).catch(error => { console.error(error.code || error.name); process.exitCode = 1; }).finally(() => prisma.$disconnect());
module.exports = { repair };
