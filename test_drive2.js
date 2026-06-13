const axios = require('axios');
const fs = require('fs');

async function test() {
    const initialUrl = `https://drive.google.com/uc?export=download&id=1xTYIIOE5eEzqTbMWBLrufqJi1s6hPnK9`;
    try {
        const response = await axios.get(initialUrl, { responseType: 'text', withCredentials: true, maxRedirects: 5 });
        fs.writeFileSync('drive_html.txt', response.data);
        console.log("Saved HTML");
    } catch (err) {
        console.error(err.message);
    }
}
test();
