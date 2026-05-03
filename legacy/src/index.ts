import { Connection, Keypair, VersionedTransaction } from '@solana/web3.js';
import fetch from 'cross-fetch';
import dotenv from 'dotenv';
import bs58 from 'bs58';

dotenv.config();

// Standard Mints 🪙
const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

async function executeSwap() {
    const connection = new Connection(process.env.SOLANA_RPC_URL!);
    const wallet = Keypair.fromSecretKey(bs58.decode(process.env.PRIVATE_KEY!));

    console.log(`Wallet: ${wallet.publicKey.toBase58()} 🔑`);

    // 1️⃣ Get a Quote (Direct V6) 📈
    const amount = 0.01 * 1e9; // 0.01 SOL
    const quoteUrl = `https://api.jup.ag/swap/v1/quote?inputMint=${SOL_MINT}&outputMint=${USDC_MINT}&amount=${amount}&slippageBps=50`;

    const quoteResponse = await (await fetch(quoteUrl)).json();
    if (!quoteResponse.outAmount) {
        console.error("Quote Failed! ❌", quoteResponse);
        return;
    }
    console.log(`Quote received: ${quoteResponse.outAmount} USDC expected 🎯`);

    // 2️⃣ Get serialized transaction 🔄
    // We pass wrapAndUnwrapSol: true to handle your Native SOL balance
    const swapResponse = await (
        await fetch('https://api.jup.ag/swap/v1/swap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                quoteResponse,
                userPublicKey: wallet.publicKey.toString(),
                wrapAndUnwrapSol: true,
                dynamicComputeUnitLimit: true,
                prioritizationFeeLamports: 'auto'
            })
        })
    ).json();

    if (!swapResponse.swapTransaction) {
        console.error("Swap Transaction Generation Failed! 📉", swapResponse);
        return;
    }

    // 3️⃣ Deserialize, Sign and Send ✍️
    const swapTransactionBuf = Buffer.from(swapResponse.swapTransaction, 'base64');
    var transaction = VersionedTransaction.deserialize(swapTransactionBuf);

    transaction.sign([wallet]);
    const latestBlockHash = await connection.getLatestBlockhash();

    const rawTransaction = transaction.serialize();
    const txid = await connection.sendRawTransaction(rawTransaction, {
        skipPreflight: true, // 👈 CRITICAL: This skips the faulty simulation!
        maxRetries: 3
    });

    console.log(`Transaction Sent! 🚀 https://solscan.io/tx/${txid} 🔍`);
}

executeSwap().catch(console.error);