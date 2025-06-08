declare global {
    namespace Express {
        interface Response {
            apiSuccess: <T>(data: T, statusCode?: number) => void;
            apiError: (message: string, statusCode?: number) => void;
        }
    }
}
declare const router: import("express-serve-static-core").Router;
export default router;
