import { createPublicClient, http } from 'viem';
import { mainnet } from "viem/chains";
import { createLogger, format, transports } from 'winston';

export const MULTICALL_3 = "0xcA11bde05977b3631167028862bE2a173976CA11";

export const logger = createLogger({
    level: 'info',
    format: format.combine(
        format.timestamp(),
        format.json()
    ),
    transports: [
        new transports.File({ filename: 'error.log', level: 'error' }),
        new transports.File({ filename: 'info.log', level: 'info' }),
    ],
});

export const publicClient = createPublicClient({
    chain: mainnet,
    transport: http("https://eth.llamarpc.com")
})