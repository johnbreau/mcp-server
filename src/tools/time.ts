// src/tools/time.ts
import { MCPTool } from "../types.js";

const timeTool: MCPTool = {
  name: "time",
  description: "Returns current server time",
  run: async () => {
    return { time: new Date().toISOString() };
  },
};

export default timeTool;