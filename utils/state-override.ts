import { keccak256, numberToHex, pad, toHex } from "viem";

/**
 * 
 * @param balanceSlotIndex 
 * @param walletToOverride 
 * @param newBalanceAmount 
 * @returns 
 */

export const overrideBalance = (balanceSlotIndex : number, walletToOverride : string, newBalanceAmount : string) => {

    const paddedAddress = pad(walletToOverride as `0x${string}`, { size: 32 });

    const paddedBaseSlot = pad(toHex(balanceSlotIndex), { size: 32 });

    const concatenated = paddedAddress + paddedBaseSlot.slice(2);

    const balanceSlotHash = keccak256(concatenated as any);

    const newBalance = pad(numberToHex(BigInt(newBalanceAmount)), { size: 32 });

    return { balanceSlotHash, newBalance }
};