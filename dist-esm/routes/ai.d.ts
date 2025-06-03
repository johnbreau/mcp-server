declare global {
    namespace Express {
        interface Response {
            apiSuccess: <T>(data: T, statusCode?: number) => Response;
            apiError: (message: string, statusCode?: number) => Response;
        }
    }
}
declare const router: import("express-serve-static-core").Router;
export default router;
