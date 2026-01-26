
const { seedData } = require('./seed-data.js');

let totalBiaya = 0;
let totalItems = 0;
const units = {};

seedData.forEach(item => {
    totalBiaya += item.totalBiaya;
    totalItems += item.items.length;
    item.items.forEach(i => {
        units[i.unit] = (units[i.unit] || 0) + i.biaya;
    });
});

console.log('=== VERIFICATION RESULT ===');
console.log(`Total Locations: ${seedData.length}`);
console.log(`Total Activities: ${totalItems}`);
console.log(`Total Cost: Rp ${totalBiaya.toLocaleString('id-ID')}`);
console.log('--- Cost per Unit ---');
Object.entries(units).forEach(([u, cost]) => {
    console.log(`${u}: Rp ${cost.toLocaleString('id-ID')}`);
});
console.log('===========================');
