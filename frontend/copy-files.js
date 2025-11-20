import fs from 'fs';
import path from 'path';

const files = ['admin.html', 'beats.html', 'login.html'];
const sourceDir = '.';
const destDir = './dist';

files.forEach(file => {
    const source = path.join(sourceDir, file);
    const dest = path.join(destDir, file);
    
    if (fs.existsSync(source)) {
        fs.copyFileSync(source, dest);
        console.log(`Copied ${file} to dist/`);
    }
});
