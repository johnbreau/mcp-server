"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const toolRouter = (0, express_1.Router)();
const toolsDir = path_1.default.join(__dirname, "tools");
fs_1.default.readdirSync(toolsDir).forEach((file) => {
    const tool = require(path_1.default.join(toolsDir, file)).default;
    toolRouter.all(`/tools/${tool.name}`, async (req, res) => {
        try {
            const result = await tool.run(req.method === "POST" ? req.body : req.query);
            res.json(result);
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
});
exports.default = toolRouter;
//# sourceMappingURL=router.js.map