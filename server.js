// A simple oracle server for the CoinFlip game, designed for Render.

// We use the 'ethers' library to interact with the blockchain.
const { ethers } = require("ethers");

// --- Configuration ---
// These values are loaded from Render's Environment Variables for security.
const contractAddress = process.env.CONTRACT_ADDRESS;
const serverWalletKey = process.env.SERVER_WALLET_PRIVATE_KEY;
const fujiRpcUrl = "https://api.avax-test.network/ext/bc/C/rpc";

// --- ABIs ---
// We only need the parts of the ABI that the server interacts with.
const contractAbi = [
    "event FlipRequested(uint256 indexed requestId, address indexed player, bool choseHeads)",
    "function fulfillFlip(uint256 _requestId, uint256 _randomNumber)"
];

// --- Server Setup ---
if (!contractAddress || !serverWalletKey) {
    console.error("CRITICAL ERROR: Missing CONTRACT_ADDRESS or SERVER_WALLET_PRIVATE_KEY environment variables.");
    console.error("Please set these in your Render dashboard. The server will not start.");
    process.exit(1); // Exit if essential configuration is missing.
}

const provider = new ethers.providers.JsonRpcProvider(fujiRpcUrl);
const serverWallet = new ethers.Wallet(serverWalletKey, provider);
const contract = new ethers.Contract(contractAddress, contractAbi, serverWallet);

// --- Core Logic ---

async function fulfillRequest(requestId, player, choseHeads) {
    console.log(`[Request #${requestId}] Received from player: ${player} who chose ${choseHeads ? 'Heads' : 'Tails'}`);
    
    // 1. Generate a cryptographically secure random number.
    // We use Node.js's built-in crypto library via ethers for this.
    const randomNumber = ethers.BigNumber.from(ethers.utils.randomBytes(32));
    console.log(`[Request #${requestId}] Generated a secure random number.`);

    // 2. Send the transaction to the smart contract.
    try {
        console.log(`[Request #${requestId}] Fulfilling the request...`);
        const tx = await contract.fulfillFlip(requestId, randomNumber, {
            // Manually set a generous gas limit to prevent out-of-gas errors.
            gasLimit: 300000, 
        });

        console.log(`[Request #${requestId}] Transaction sent! Hash: ${tx.hash}`);
        await tx.wait(); // Wait for the transaction to be confirmed on the blockchain.
        console.log(`[Request #${requestId}] Successfully fulfilled and confirmed!`);
    } catch (error) {
        // This will catch errors like if the server runs out of gas.
        console.error(`[Request #${requestId}] FAILED to fulfill! Reason:`, error.reason || error.message);
    }
}

// --- Main Execution ---

async function main() {
    console.log("✅ Oracle Server Starting...");
    console.log(`Listening for 'FlipRequested' events on contract: ${contractAddress}`);
    console.log(`Server wallet address: ${serverWallet.address}`);

    // Check the server wallet's balance on startup to warn the user if it's empty.
    const balance = await provider.getBalance(serverWallet.address);
    console.log(`Server wallet balance: ${ethers.utils.formatEther(balance)} AVAX`);

    if (balance.isZero()) {
        console.warn("⚠️ WARNING: Server wallet has no AVAX. It will not be able to pay for gas to fulfill requests.");
    }
    
    // Set up the event listener. This is the core of the oracle.
    // It will run forever, waiting for the "FlipRequested" event to be emitted.
    contract.on("FlipRequested", (requestId, player, choseHeads) => {
        // When an event is heard, call the function to handle it.
        fulfillRequest(requestId, player, choseHeads);
    });

    console.log("...Listening...")
}

main().catch((error) => {
    console.error("An unrecoverable error occurred during startup:", error);
    process.exit(1);
});

