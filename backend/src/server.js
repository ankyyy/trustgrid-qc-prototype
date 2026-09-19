import { app } from "./app.js";
import { config } from "./config/env.js";
app.listen(config.port, () => console.log(`TrustGrid QC API listening on http://localhost:${config.port} (model: ${config.geminiModel})`));
