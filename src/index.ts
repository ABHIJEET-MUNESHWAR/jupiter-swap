import {
    Connection,
    Keypair,
    VersionedTransaction,
} from "@solana/web3.js";

import fetch from 'cross-fetch';
import dotenv from 'dotenv';
import bs58 from 'bs58';

dotenv.config();

// Constants 📍
const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const JUP_API_BASE_URL = "https://api.jup.ag/swap/v2"; // Using the latest Swap API V2 🚀

async function swapSOLtoUSDC() {
    try {
        // 1️⃣ Setup Connection & Wallet 🔑
        const connection = new Connection(process.env.SOLANA_RPC_URL!);
        const wallet = Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY!));
        console.log("Using Wallet Public Key:", wallet.publicKey.toBase58());

        // 2️⃣ Get Order (Quote + Assembled Transaction) 📊
        // We're swapping 0.1 SOL to USDC
        const amount = 0.1 * 10 ** 9; // 0.1 SOL in lamports
        const taker = wallet.publicKey.toString();

        console.log("Fetching order from Jupiter... 📡");
        const orderResponse = await (
            await fetch(`${JUP_API_BASE_URL}/order?inputMint=${SOL_MINT}&outputMint=${USDC_MINT}&amount=${amount}&taker=${taker}&slippageBps=5&disableMultihops=true`, {
                headers: {
                    'x-api-key': process.env.JUP_API_KEY!,
                }
            })
        ).json();
        if (orderResponse.errorCode) {
            throw new Error(`Jupiter Order Error: ${orderResponse.errorMessage} ❌`);
        }

        const {transaction, requestId} = orderResponse;
        console.log("Order fetched! Request ID:", requestId, "✅");

        // 3️⃣ Deserialize & Sign the Transaction ✍️
        console.log("Signing transaction... ✒️");
        const swapTransactionBuffer = Buffer.from(transaction, "base64");
        const transactionObject = VersionedTransaction.deserialize(swapTransactionBuffer);
        transactionObject.sign([wallet]);

        // 4️⃣ Execute Transaction via Jupiter 🚀
        // This flow lets Jupiter handle the heavy lifting of landing your tx!
        console.log("Executing swap... ⏩");
        const executeResponse = await (
            await fetch(`${JUP_API_BASE_URL}/execute`, {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': process.env.JUP_API_KEY!,
                },
                body: JSON.stringify({
                    requestId,
                    signedTransaction: Buffer.from(transactionObject.serialize()).toString('base64'),
                }),
            })
        ).json();

        // 5️⃣ Check Results 🏁
        if (executeResponse.status === "success") {
            console.log("Swap successful! 🎉");
            console.log("Signature:", `https://solscan.io/tx/${executeResponse.signature} 🔍`);
        } else {
            console.error("Swap failed! 🤕", JSON.stringify(executeResponse, null, 2));
        }
    } catch (error) {
        console.error("Oops! Something went wrong:", error, "🛑");
    }
}

swapSOLtoUSDC();