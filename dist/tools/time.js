"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const timeTool = {
    name: "time",
    description: "Returns current server time",
    run: async () => {
        return { time: new Date().toISOString() };
    },
};
exports.default = timeTool;
//# sourceMappingURL=time.js.map