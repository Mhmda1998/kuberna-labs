import { KubernaSDK } from './index.js';
import { ethers } from 'ethers';

export interface WalletInfo {
  address: string;
  balance: string;
  chainId: number;
  isConnected: boolean;
}

export interface TransactionResult {
  hash: string;
  from: string;
  to: string;
  value: string;
  blockNumber?: number;
  status?: number;
}

const COINGECKO_API = 'https://api.coingecko.com/api/v3/simple/price';
let _priceCache: { usd: number; fetchedAt: number } | null = null;
const PRICE_CACHE_TTL = 60 * 1000; // 1 minute

async function fetchEthUsdPrice(): Promise<number> {
  // simple in-repo fallback to CoinGecko when no on-chain oracle available
  try {
    const now = Date.now();
    if (_priceCache && now - _priceCache.fetchedAt < PRICE_CACHE_TTL) {
      return _priceCache.usd;
    }
    const url = `${COINGECKO_API}?ids=ethereum&vs_currencies=usd`;
    const resp = await fetch(url, { method: 'GET' });
    if (!resp.ok) throw new Error(`CoinGecko responded ${resp.status}`);
    const data = await resp.json();
    const usd = Number(data?.ethereum?.usd ?? NaN);
    if (Number.isFinite(usd) && usd > 0) {
      _priceCache = { usd, fetchedAt: now };
      return usd;
    }
    throw new Error('Invalid price from CoinGecko');
  } catch (err) {
    // bubble up; caller can decide fallback
    throw new Error(`Failed to fetch ETH price: ${(err as Error).message}`);
  }
}

export class WalletManager {
  constructor(private sdk: KubernaSDK) {}

  getAddress(): string | undefined {
    return this.sdk.getWallet()?.address;
  }

  async getBalance(address?: string): Promise<string> {
    const addr = address || this.getAddress();
    if (!addr) throw new Error('No address available. Provide an address or initialize with a private key.');
    if (!ethers.isAddress(addr)) throw new Error('Invalid Ethereum address');
    const balance = await this.sdk.getProvider().getBalance(addr);
    return ethers.formatEther(balance);
  }

  async sendTransaction(to: string, amount: string): Promise<TransactionResult> {
    const wallet = this.sdk.getWallet();
    if (!wallet) throw new Error('Wallet not initialized. Provide a private key in SDK config.');
    if (!ethers.isAddress(to)) throw new Error('Invalid recipient address');
    const tx = await wallet.sendTransaction({
      to,
      value: ethers.parseEther(amount),
    });
    const receipt = await tx.wait();
    return {
      hash: tx.hash,
      from: tx.from,
      to: tx.to || to,
      value: amount,
      blockNumber: receipt?.blockNumber ?? undefined,
      status: receipt?.status ?? undefined,
    };
  }

  async getTransactionCount(address?: string): Promise<number> {
    const addr = address || this.getAddress();
    if (!addr) throw new Error('No address available.');
    if (!ethers.isAddress(addr)) throw new Error('Invalid Ethereum address');
    return this.sdk.getProvider().getTransactionCount(addr);
  }

  async getBalanceInUsd(address?: string): Promise<string> {
    // returns USD string with 2 decimals
    const ethBalanceStr = await this.getBalance(address);
    const ethBalance = Number(ethBalanceStr);
    if (!Number.isFinite(ethBalance)) throw new Error('Invalid ETH balance');

    // Try to use on-chain price oracle if SDK/blockchain manager exposes one
    // Fallback to CoinGecko
    let priceUsd: number;
    try {
      // try a best-effort to call a price endpoint on the SDK if available
      // (some SDKs expose blockchain.getPrice or similar). We don't assume existence;
      // fallback to CoinGecko.
      // @ts-ignore
      if (typeof this.sdk.blockchain?.getEthUsdPrice === 'function') {
        // @ts-ignore
        priceUsd = await this.sdk.blockchain.getEthUsdPrice();
      } else {
        priceUsd = await fetchEthUsdPrice();
      }
    } catch (err) {
      // If price fetch fails, return raw ETH balance as USD unavailable marker
      throw new Error(`Unable to determine ETH/USD price: ${(err as Error).message}`);
    }

    const usd = ethBalance * priceUsd;
    return usd.toFixed(2);
  }
}
