import XLSX from 'xlsx';
import fs from 'fs';

// Read the Excel file
const workbook = XLSX.readFile('/Users/tainh/Work/stock-analysis-app/dpm_test.xlsx');

// Get the first sheet
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

// Get the range
const range = XLSX.utils.decode_range(worksheet['!ref']);

console.log('Sheet Name:', sheetName);
console.log('Range:', worksheet['!ref']);
console.log('Rows:', range.e.r + 1, 'Cols:', range.e.c + 1);
console.log('\n=== CELL DATA ===\n');

// Read all cells with formatting
const data = [];
for (let R = range.s.r; R <= Math.min(range.e.r, 30); ++R) {
  const row = [];
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
    const cell = worksheet[cellAddress];

    if (cell) {
      row.push({
        address: cellAddress,
        value: cell.v,
        type: cell.t,
        formula: cell.f || null,
        style: cell.s || null
      });
    } else {
      row.push({ address: cellAddress, value: null });
    }
  }
  data.push(row);
}

// Print in a readable format
data.forEach((row, idx) => {
  const values = row.map(cell => {
    if (cell.value === null || cell.value === undefined) return '';
    if (typeof cell.value === 'number') return cell.value.toFixed(2);
    return String(cell.value);
  });
  console.log(`Row ${idx + 1}:`, values.join(' | '));
});

// Also convert to JSON for easier parsing
console.log('\n=== JSON FORMAT ===\n');
const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
console.log(JSON.stringify(jsonData.slice(0, 20), null, 2));
