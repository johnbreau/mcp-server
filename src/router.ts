// src/router.ts
import { Router } from "express";
import fs from "fs";
import path from "path";
import { MCPTool } from "./types";

const toolRouter = Router();
const toolsDir = path.join(__dirname, "tools");

fs.readdirSync(toolsDir).forEach((file) => {
  const tool: MCPTool = require(path.join(toolsDir, file)).default;
  toolRouter.all(`/tools/${tool.name}`, async (req, res) => {
    try {
      const result = await tool.run(req.method === "POST" ? req.body : req.query);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });
});

export default toolRouter;