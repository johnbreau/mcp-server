// src/router.ts
import { Router } from "express";
import fs from "fs";
import path from "path";
import { MCPTool } from "./types";

const toolRouter = Router();
const toolsDir = path.join(__dirname, "tools");

fs.readdirSync(toolsDir).forEach((file) => {
  if (!file.endsWith('.js') && !file.endsWith('.ts')) return;
  
  console.log(`Loading tool from file: ${file}`);
  const toolPath = path.join(toolsDir, file);
  const toolModule = require(toolPath);
  const tool: MCPTool = toolModule.default;
  
  if (!tool || !tool.name) {
    console.error(`Invalid tool in file ${file}: missing default export or name property`);
    return;
  }
  
  const routePath = `/tools/${tool.name}`;
  console.log(`Registering tool: ${tool.name} at ${routePath}`);
  
  toolRouter.all(routePath, async (req, res) => {
    try {
      const result = await tool.run(req.method === "POST" ? req.body : req.query);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });
});

export default toolRouter;