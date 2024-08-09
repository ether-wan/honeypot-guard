import { Request, Response } from "express";
import { functionEncoder } from "../utils/encoder";
import { overrideBalance } from "../utils/stateOverride";
import { createPublicClient, decodeAbiParameters, erc20Abi, formatEther, http, toHex } from "viem";
import { mainnet } from "viem/chains";
import { MULTICALL_3, logger } from "../config/index";

const multicall3Abi = require("../abi/Multicall.json");
const routerV2Abi = require("../abi/UniswapV2Router.json");
const routerV3Abi = require("../abi/UniswapV3Router.json");

const publicClient = createPublicClient({
    chain: mainnet,
    transport: http("https://eth.llamarpc.com")
});

/**
 * @notice Check if a pair is a honeypot faster buy trying to swap and sell the target token without verifying tax
 * @param pairAddress 
 * @param tokenTargetAddress 
 * @param amount 
 */
export const fastCheckHoneypotV2 = async (req : Request, res : Response) => {

    const {routerAddress, accountToOverride, tokenTargetAddress, mainTokenAddress, amountMainToken, mainTokenBalanceSlot } = req.body;

    const deadline = toHex(Math.round(Date.now() / 1000) + 60 * 20);

    const approveFunctionData = functionEncoder(erc20Abi, "approve", [routerAddress, amountMainToken]);

    const swapMainForTarget = functionEncoder(routerV2Abi, "swapExactTokensForTokens", [amountMainToken, 0, [mainTokenAddress, tokenTargetAddress], MULTICALL_3, deadline]);

    const swapSomeTargetForMain = functionEncoder(routerV2Abi, "swapExactTokensForTokens", [BigInt(1e16), 0, [tokenTargetAddress, mainTokenAddress], MULTICALL_3, deadline]);

    const balanceOfFunctionData = functionEncoder(erc20Abi, "balanceOf", [MULTICALL_3]);

    const calls = [
        {
            target: mainTokenAddress,
            callData: approveFunctionData,
        },
        {
            target: routerAddress,
            callData: swapMainForTarget
        },
        {
            target : tokenTargetAddress,
            callData: approveFunctionData
        },
        {
            target: tokenTargetAddress,
            callData: balanceOfFunctionData
        },
        {
            target: routerAddress,
            callData: swapSomeTargetForMain
        },
        {
            target : mainTokenAddress,
            callData: balanceOfFunctionData
        }
    ];

    /**
     * @notice Override the balance of the Multicall contract to simulate the swap. 
     * To find the balance slot location, you can decompile the contract on etherscan : https://etherscan.io/bytecode-decompiler?a=0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2
     */

    const { balanceSlotHash, newBalance } = overrideBalance(mainTokenBalanceSlot, MULTICALL_3, amountMainToken.toString());

    try {

        const { result } = await publicClient.simulateContract({
            address: MULTICALL_3,
            abi: multicall3Abi,
            functionName: "aggregate",
            args: [calls],
            account: accountToOverride,
            stateOverride: [
                {
                    address: mainTokenAddress,
                    stateDiff: [
                        {
                            slot: balanceSlotHash,
                            value: newBalance
                        }
                    ]
                }
            ]
        });
    
        const abiParameters = [
            { type: 'uint256[]', name: 'amounts' }
        ];
    
        const decodedData = decodeAbiParameters(abiParameters, result[1][1]);
    
        const logData = {
            tokenTarget : tokenTargetAddress,
            amountMainTokenSwaped : amountMainToken,
            amountTokenTargetReceived : formatEther(decodedData[0][1] as any),
            balanceAfterSwap : formatEther(decodeAbiParameters([{ type: 'uint256', name: 'balanceOf' }],result[1][3]) as any)
        }
    
        logger.info(logData);
    
        return res.status(200).json({
            message: "Honeypot check completed",
            data: logData
        })

    } catch(error) {

        logger.error(error);

        return res.status(500).json({
            message: "Error during check, token might be a honeypot",
            error
        })
    }
}

export const fastCheckHoneypotV3 = async (req : Request, res : Response) => {

    const {routerAddress, accountToOverride, tokenTargetAddress, mainTokenAddress, amountMainToken, mainTokenBalanceSlot, poolFee } = req.body;

    const deadline = toHex(Math.round(Date.now() / 1000) + 60 * 20);

    const approveFunctionData = functionEncoder(erc20Abi, "approve", [routerAddress, amountMainToken]);

    const swapMainForTarget = functionEncoder(routerV3Abi, "exactInputSingle", [[mainTokenAddress, tokenTargetAddress, poolFee, MULTICALL_3, deadline, amountMainToken, 0, 0]]);

    const swapSomeTargetForMain = functionEncoder(routerV3Abi, "exactInputSingle", [[tokenTargetAddress, mainTokenAddress, poolFee, MULTICALL_3, deadline, BigInt(1e16), 0, 0]]);

    const balanceOfFunctionData = functionEncoder(erc20Abi, "balanceOf", [MULTICALL_3]);

    const calls = [
        {
            target: mainTokenAddress,
            callData: approveFunctionData,
        },
        {
            target: routerAddress,
            callData: swapMainForTarget
        },
        {
            target : tokenTargetAddress,
            callData: approveFunctionData
        },
        {
            target: tokenTargetAddress,
            callData: balanceOfFunctionData
        },
        {
            target: routerAddress,
            callData: swapSomeTargetForMain
        },
        {
            target : mainTokenAddress,
            callData: balanceOfFunctionData
        }
    ];

    const { balanceSlotHash, newBalance } = overrideBalance(mainTokenBalanceSlot, MULTICALL_3, amountMainToken.toString());

    try {

        const { result } = await publicClient.simulateContract({
            address: MULTICALL_3,
            abi: multicall3Abi,
            functionName: "aggregate",
            args: [calls],
            account: accountToOverride,
            stateOverride: [
                {
                    address: mainTokenAddress,
                    stateDiff: [
                        {
                            slot: balanceSlotHash,
                            value: newBalance
                        }
                    ]
                }
            ]
        });
    
    
        const outputAmount = decodeAbiParameters([{type: 'uint256', name: 'amountOut'}], result[1][1]);
        const balanceAfterSwap = decodeAbiParameters([{type: 'uint256', name: 'balanceOf'}],result[1][3]);
    
        const logData = {
            tokenTarget : tokenTargetAddress,
            amountMainTokenSwaped : amountMainToken,
            amountTokenTargetReceived : formatEther(outputAmount as any),
            balanceAfterSwap : formatEther(balanceAfterSwap as any)
        }
    
        logger.info(logData);
    
        return res.status(200).json({
            message: "Honeypot check completed",
            data: logData
        })

    } catch(error) {

        logger.error(error);

        return res.status(500).json({
            message: "Error during check, token might be a honeypot",
            error
        })
    }



}