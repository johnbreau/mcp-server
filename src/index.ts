// src/index.ts
import express from "express";
import dotenv from "dotenv";
import toolRouter from "./router";

dotenv.config();

const app = express();
app.use(express.json());
app.use("/", toolRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🔌 MCP server running at http://localhost:${PORT}`);
});