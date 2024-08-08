import { Request, Response } from "express";
import { functionEncoder } from "src/utils/encoder";
import { overrideBalance } from "src/utils/stateOverride";
import { createPublicClient, decodeAbiParameters, erc20Abi, formatEther, http, multicall3Abi, toHex } from "viem";
import { mainnet } from "viem/chains";
import { MULTICALL_3, logger } from "../config/index";

const routerV2Abi = require('../abis/UniswapV2Router02.json');

const publicClient = createPublicClient({
    chain: mainnet,
    transport: http('https://eth.llamarpc.com')
});

/**
 * @notice Check if a pair is a honeypot faster buy trying to swap and sell the target token without verifying tax
 * @param pairAddress 
 * @param tokenTarget 
 * @param amount 
 */
const fastCheckHoneypotV2 = async (req : Request, res : Response) => {

    const { router, accountToOverride, tokenTarget, mainTokenAddress, amountMainTokenAddress, mainTokenBalanceSlot } = req.body;

    const deadline = toHex(Math.round(Date.now() / 1000) + 60 * 20);

    const approveFunctionData = functionEncoder(erc20Abi, "approve", [router, amountMainTokenAddress]);

    const swapWETHForTokens = functionEncoder(routerV2Abi, "swapExactTokensForTokens", [amountMainTokenAddress, 0, [mainTokenAddress, tokenTarget], MULTICALL_3, deadline]);

    const swapSomeTokensForWETH = functionEncoder(routerV2Abi, "swapExactTokensForTokens", [BigInt(1e16), 0, [tokenTarget, mainTokenAddress], MULTICALL_3, deadline]);

    const balanceOfFunctionData = functionEncoder(erc20Abi, "balanceOf", [MULTICALL_3]);

    const calls = [
        {
            target: mainTokenAddress,
            callData: approveFunctionData,
        },
        {
            target: router,
            callData: swapWETHForTokens
        },
        {
            target : tokenTarget,
            callData: approveFunctionData
        },
        {
            target: tokenTarget,
            callData: balanceOfFunctionData
        },
        {
            target: router,
            callData: swapSomeTokensForWETH
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

    const { balanceSlotHash, newBalance } = overrideBalance(mainTokenBalanceSlot, MULTICALL_3, amountMainTokenAddress.toString());

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

    console.log(`Swap simulation for ${tokenTarget} with ${amountMainTokenAddress} $WETH :`, formatEther(decodedData[0][1] as any));

    const logData = {
        contractAddress: tokenTarget,
        isToken: true,
        amountMainTokenAddressSwaped: amountMainTokenAddress,
        swapSimulation : formatEther(decodedData[0][1] as any),
        balanceAfterSwap : formatEther(decodeAbiParameters([{ type: 'uint256', name: 'balanceOf' }],result[1][3]) as any)
    }

    logger.info(logData);
}