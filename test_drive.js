const axios = require('axios');

async function resolveGoogleDriveLink(fileId) {
    const initialUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
    try {
        const response = await axios.get(initialUrl, { responseType: 'text', withCredentials: true, maxRedirects: 5 });
        const html = response.data;
        const confirmMatch = html.match(/confirm=([a-zA-Z0-9_-]+)/);
        if (confirmMatch) {
            const confirmToken = confirmMatch[1];
            let cookie = '';
            if (response.headers['set-cookie']) {
                cookie = response.headers['set-cookie'].map(c => c.split(';')[0]).join('; ');
            }
            return { url: `${initialUrl}&confirm=${confirmToken}`, cookie: cookie, html: html.substring(0, 500) };
        }
        return { url: response.request?.res?.responseUrl || initialUrl, html: html.substring(0, 500) };
    } catch (err) {
        console.error("[Google Drive Resolve Error]", err.message);
        return { url: initialUrl, error: err.message };
    }
}

async function test() {
   const res = await resolveGoogleDriveLink('1xTYIIOE5eEzqTbMWBLrufqJi1s6hPnK9');
   console.log("Resolution:", res);
}

test();
