import { type Request, type Response, type NextFunction } from 'express';
declare const router: import("express-serve-static-core").Router;
export declare const handleToolRequest: (req: Request, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export default router;
