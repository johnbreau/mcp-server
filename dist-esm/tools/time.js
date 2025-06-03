const timeTool = {
    name: "time",
    description: "Returns current server time",
    run: async () => {
        return { time: new Date().toISOString() };
    },
};
export default timeTool;
//# sourceMappingURL=time.js.map