import { KubernaSDK } from './index.js';
import { ethers } from 'ethers';
import { validateEthAddress } from './utils/address.js';

export class BlockchainManager {
  constructor(private sdk: KubernaSDK) {}

  async getBalance(address: string): Promise<string> {
    validateEthAddress(address, 'address');
    const balance = await this.sdk.getProvider().getBalance(address);
    return ethers.formatEther(balance);
  }

  async sendTransaction(to: string, amount: string): Promise<ethers.TransactionResponse> {
    validateEthAddress(to, 'recipient');
    const wallet = this.sdk.getWallet();
    if (!wallet) {
      throw new Error('Wallet not initialized. Provide a private key in SDK config.');
    }
    return wallet.sendTransaction({
      to,
      value: ethers.parseEther(amount),
    });
  }

  // Optional helper: SDK implementations can call this if they want a price source
  async getEthUsdPrice(): Promise<number> {
    // Try to use on-chain oracle if available via SDK.blockchain providers in future.
    // For now return NaN to indicate absence; WalletManager already falls back to CoinGecko.
    return NaN;
  }
}
