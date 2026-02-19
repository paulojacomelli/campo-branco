
import { exportData, importData } from './db-tools';

const args = process.argv.slice(2);
const command = args[0];

if (command === 'export') {
    exportData();
} else if (command === 'import') {
    const file = args[1];
    importData(file);
} else {
    console.log('Usage:');
    console.log('  npm run db:export');
    console.log('  npm run db:import -- <path_to_file>');
}
