const ngrok = require('@ngrok/ngrok');

async function test() {
  try {
    const listener = await ngrok.forward({
      addr: 5000,
      authtoken: '3FFc2zbBvtxuwUckbZnDv9HrVDw_4kPJBQT5TZWKuhLD6pTUs'
    });
    console.log('NGROK URL:', listener.url());
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
test();
