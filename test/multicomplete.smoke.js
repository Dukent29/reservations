// test/multicomplete.smoke.js
require("dotenv").config();
const { etg } = require("../src/lib/etgClient");

(async () => {
  try {
    const { data } = await etg.post("/search/multicomplete/", {
      query: "Paris",
      language: "fr",
    });

    const regions = (data?.results?.regions || [])
      .filter(r => r.is_searchable !== false)
      .slice(0, 5)
      .map(({ id, name, type, country_code }) => ({ id, name, type, country_code }));

    console.log("OK multicomplete sample:", regions);
    if (!regions.length) {
      console.error("No regions returned. Check API key / ENV / network.");
      process.exitCode = 2;
    }
  } catch (err) {
    const status = err?.response?.status;
    const body   = err?.response?.data;
    console.error("FAIL multicomplete:", status || err.code || err.name, body || err.message);
    process.exit(1);
  }
})();

