const fs = require('fs');
const html = fs.readFileSync('drive_html.txt', 'utf8');
const uuidMatch = html.match(/name="uuid"\s+value="([^"]+)"/i);
console.log(uuidMatch ? 'UUID found: ' + uuidMatch[1] : 'No match');
