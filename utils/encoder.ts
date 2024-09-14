import { encodeFunctionData } from "viem";

export const functionEncoder = (abi : any, functionName : string, args : Array<any>) => {
    return encodeFunctionData({ abi, functionName, args });
}