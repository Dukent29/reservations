"use strict";
  
const dotenv = require("dotenv");
dotenv.config();

const app = require("./src/app");
require("./utils/db");

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Serve  r- Test  - auto deploy is running on http://0.0.0.0:${PORT}`);
});
