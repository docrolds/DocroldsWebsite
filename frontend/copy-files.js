
import fs from 'fs';
import path from 'path';

const files = ['admin.html', 'beats.html', 'login.html', 'admin.js', 'beats.js', 'config.js', 'index.html'];
const sourceDir = '.';
const destDir = './dist';

const apiUrl = process.env.VITE_API_URL || 'http://localhost:3000/api';

if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

files.forEach(file => {
    const source = path.join(sourceDir, file);
    const dest = path.join(destDir, file);
    
    if (fs.existsSync(source)) {
        if (file === 'config.js') {
            let content = fs.readFileSync(source, 'utf-8');
            content = content.replace('VITE_API_URL_PLACEHOLDER', apiUrl);
            fs.writeFileSync(dest, content);
            console.log(`Processed and copied ${file} to dist/`);
        } else {
            fs.copyFileSync(source, dest);
            console.log(`Copied ${file} to dist/`);
        }
    }
});
