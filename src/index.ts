import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import cookieParser from 'cookie-parser';
import expressWinston from 'express-winston';

import { logger } from "./config/index";
import { Request, Response } from 'express';

const app = express();

app.use(express.json());
app.use(helmet());
app.use(cors());
app.use(cookieParser());
app.use(expressWinston.logger({
    winstonInstance: logger,
    meta: true,
    msg: 'HTTP {{req.method}} {{req.url}}',
    expressFormat: true,
    colorize: false,
    ignoreRoute: (req : Request, res : Response) => false
}));

app.use(expressWinston.errorLogger({
    winstonInstance: logger
}));

app.get('/', async (req: Request, res: Response) => {
    res.send('Hello World!');
});


app.listen(4000, () => {
    console.log('Express server is running on port 4000');
});
