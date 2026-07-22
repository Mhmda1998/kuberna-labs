import { KubernaSDK } from './index.js';
import { ethers } from 'ethers';
import { KubernaError } from './errors.js';

// ═══════════════════════════════════════════
// Types
// ═══════════════════════════════════════════

export interface BlockchainConfig {
  /** السلسلة الافتراضية */
  defaultChain?: string;
  /** عدد تأكيدات المعاملة */
  confirmations?: number;
  /** مضاعف الغاز */
  gasMultiplier?: number;
}

export interface GasEstimate {
  /** حد الغاز */
  gasLimit: string;
  /** سعر الغاز بـ gwei */
  gasPrice: string;
  /** التكلفة المقدرة بالإيثر */
  estimatedCost: string;
  /** التكلفة بالعملة المحلية */
  estimatedCostUsd?: string;
}

export interface NetworkInfo {
  /** اسم الشبكة */
  name: string;
  /** معرف السلسلة */
  chainId: number;
  /** أحدث كتلة */
  latestBlock: number;
  /** سعر الغاز الحالي */
  gasPrice: string;
}

export interface TransactionReceipt {
  /** تجزئة المعاملة */
  hash: string;
  /** رقم الكتلة */
  blockNumber: number;
  /** حالة المعاملة */
  status: 'success' | 'failed';
  /** الغاز المستخدم */
  gasUsed: string;
  /** السعر الفعلي للغاز */
  effectiveGasPrice: string;
  /** عدد التأكيدات */
  confirmations: number;
}

// ═══════════════════════════════════════════
// BlockchainManager Class
// ═══════════════════════════════════════════

/**
 * مدير البلوكشين - التفاعل مع شبكات الإيثيريوم
 * 
 * @class BlockchainManager
 * @description عمليات البلوكشين الأساسية: الرصيد، المعاملات، الغاز
 * 
 * @example
 * ```typescript
 * const sdk = new KubernaSDK({ privateKey: '0x...' });
 * const blockchain = new BlockchainManager(sdk);
 * 
 * // الحصول على الرصيد
 * const balance = await blockchain.getBalance('0x...');
 * 
 * // إرسال معاملة
 * const tx = await blockchain.sendTransaction('0x...', '0.1');
 * 
 * // تقدير الغاز
 * const gas = await blockchain.estimateGas('0x...', '0.1');
 * ```
 */
export class BlockchainManager {
  private config: BlockchainConfig;

  constructor(
    private sdk: KubernaSDK,
    config?: BlockchainConfig
  ) {
    this.config = {
      confirmations: 1,
      gasMultiplier: 1.1,
      ...config,
    };
  }

  // ═══════════════════════════════════════════
  // Validation
  // ═══════════════════════════════════════════

  private validateAddress(address: string): void {
    if (!address || !ethers.isAddress(address)) {
      throw new KubernaError('عنوان إيثيريوم غير صالح', 'INVALID_ADDRESS', 400);
    }
  }

  private validateAmount(amount: string): void {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      throw new KubernaError('المبلغ يجب أن يكون رقماً موجباً', 'VALIDATION_ERROR', 400);
    }
  }

  private ensureWallet(): ethers.Wallet {
    const wallet = this.sdk.getWallet();
    if (!wallet) {
      throw new KubernaError(
        'المحفظة غير مهيأة. قم بتوفير مفتاح خاص في إعدادات SDK.',
        'WALLET_REQUIRED',
        400
      );
    }
    return wallet;
  }

  private handleError(operation: string, error: unknown): never {
    if (error instanceof KubernaError) throw error;
    const message = error instanceof Error ? error.message : 'خطأ غير معروف';
    throw new KubernaError(`فشل ${operation}: ${message}`, 'BLOCKCHAIN_ERROR', 500);
  }

  // ═══════════════════════════════════════════
  // Balance
  // ═══════════════════════════════════════════

  /**
   * الحصول على رصيد عنوان
   * 
   * @param address - عنوان الإيثيريوم
   * @returns الرصيد بالإيثر
   * 
   * @example
   * ```typescript
   * const balance = await blockchain.getBalance('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0');
   * console.log(balance); // '1.5'
   * ```
   */
  async getBalance(address: string): Promise<string> {
    this.validateAddress(address);

    try {
      const balance = await this.sdk.getProvider().getBalance(address);
      return ethers.formatEther(balance);
    } catch (error) {
      this.handleError('الحصول على الرصيد', error);
    }
  }

  /**
   * الحصول على رصيد عناوين متعددة
   * 
   * @param addresses - قائمة العناوين
   * @returns خريطة العناوين والأرصدة
   */
  async getBalances(addresses: string[]): Promise<Map<string, string>> {
    const balances = new Map<string, string>();

    await Promise.all(
      addresses.map(async (address) => {
        try {
          const balance = await this.getBalance(address);
          balances.set(address, balance);
        } catch {
          balances.set(address, '0');
        }
      })
    );

    return balances;
  }

  // ═══════════════════════════════════════════
  // Transactions
  // ═══════════════════════════════════════════

  /**
   * إرسال معاملة إيثيريوم
   * 
   * @param to - عنوان المستلم
   * @param amount - الكمية بالإيثر
   * @param options - خيارات إضافية
   * @returns استجابة المعاملة
   * 
   * @example
   * ```typescript
   * const tx = await blockchain.sendTransaction(
   *   '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
   *   '0.1'
   * );
   * 
   * // انتظار التأكيد
   * const receipt = await blockchain.waitForTransaction(tx.hash);
   * ```
   */
  async sendTransaction(
    to: string,
    amount: string,
    options?: {
      data?: string;
      gasLimit?: number;
      gasPrice?: string;
      nonce?: number;
    }
  ): Promise<ethers.TransactionResponse> {
    this.validateAddress(to);
    this.validateAmount(amount);
    const wallet = this.ensureWallet();

    try {
      // التحقق من الرصيد
      const balance = await this.sdk.getProvider().getBalance(wallet.address);
      const amountWei = ethers.parseEther(amount);

      if (balance < amountWei) {
        throw new KubernaError(
          `رصيد غير كاف. المطلوب: ${amount} ETH، المتاح: ${ethers.formatEther(balance)} ETH`,
          'INSUFFICIENT_FUNDS',
          400
        );
      }

      const tx = await wallet.sendTransaction({
        to,
        value: amountWei,
        data: options?.data,
        gasLimit: options?.gasLimit,
        gasPrice: options?.gasPrice ? ethers.parseUnits(options.gasPrice, 'gwei') : undefined,
        nonce: options?.nonce,
      });

      return tx;
    } catch (error) {
      this.handleError('إرسال المعاملة', error);
    }
  }

  /**
   * انتظار تأكيد المعاملة
   * 
   * @param txHash - تجزئة المعاملة
   * @param confirmations - عدد التأكيدات المطلوبة
   * @returns إيصال المعاملة
   */
  async waitForTransaction(
    txHash: string,
    confirmations?: number
  ): Promise<TransactionReceipt> {
    if (!txHash || txHash.trim().length === 0) {
      throw new KubernaError('تجزئة المعاملة مطلوبة', 'VALIDATION_ERROR', 400);
    }

    try {
      const receipt = await this.sdk.getProvider().waitForTransaction(
        txHash,
        confirmations || this.config.confirmations
      );

      if (!receipt) {
        throw new KubernaError('لم يتم العثور على إيصال المعاملة', 'TRANSACTION_FAILED', 500);
      }

      return {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
        status: receipt.status === 1 ? 'success' : 'failed',
        gasUsed: receipt.gasUsed.toString(),
        effectiveGasPrice: receipt.gasPrice.toString(),
        confirmations: confirmations || this.config.confirmations!,
      };
    } catch (error) {
      this.handleError('انتظار تأكيد المعاملة', error);
    }
  }

  // ═══════════════════════════════════════════
  // Gas Estimation
  // ═══════════════════════════════════════════

  /**
   * تقدير تكلفة الغاز لمعاملة
   * 
   * @param to - عنوان المستلم
   * @param amount - الكمية بالإيثر
   * @returns تقدير الغاز
   */
  async estimateGas(to: string, amount: string): Promise<GasEstimate> {
    this.validateAddress(to);
    this.validateAmount(amount);
    const wallet = this.ensureWallet();

    try {
      const feeData = await this.sdk.getProvider().getFeeData();
      const gasLimit = await wallet.estimateGas({
        to,
        value: ethers.parseEther(amount),
      });

      const gasPrice = feeData.gasPrice || 0n;
      const adjustedGasPrice = (gasPrice * BigInt(Math.floor(this.config.gasMultiplier! * 100))) / 100n;
      const estimatedCost = gasLimit * adjustedGasPrice;

      return {
        gasLimit: gasLimit.toString(),
        gasPrice: ethers.formatUnits(adjustedGasPrice, 'gwei'),
        estimatedCost: ethers.formatEther(estimatedCost),
      };
    } catch (error) {
      this.handleError('تقدير الغاز', error);
    }
  }

  // ═══════════════════════════════════════════
  // Network Information
  // ═══════════════════════════════════════════

  /**
   * الحصول على معلومات الشبكة
   * 
   * @returns معلومات الشبكة الحالية
   */
  async getNetworkInfo(): Promise<NetworkInfo> {
    try {
      const provider = this.sdk.getProvider();
      const [network, blockNumber, feeData] = await Promise.all([
        provider.getNetwork(),
        provider.getBlockNumber(),
        provider.getFeeData(),
      ]);

      return {
        name: network.name,
        chainId: Number(network.chainId),
        latestBlock: blockNumber,
        gasPrice: ethers.formatUnits(feeData.gasPrice || 0n, 'gwei'),
      };
    } catch (error) {
      this.handleError('الحصول على معلومات الشبكة', error);
    }
  }

  /**
   * الحصول على سعر الغاز الحالي
   * 
   * @returns سعر الغاز بـ gwei
   */
  async getGasPrice(): Promise<string> {
    try {
      const feeData = await this.sdk.getProvider().getFeeData();
      return ethers.formatUnits(feeData.gasPrice || 0n, 'gwei');
    } catch (error) {
      this.handleError('الحصول على سعر الغاز', error);
    }
  }

  /**
   * التحقق من صحة عنوان إيثيريوم
   * 
   * @param address - العنوان
   * @returns true إذا كان صالحاً
   */
  isValidAddress(address: string): boolean {
    return ethers.isAddress(address);
  }

  /**
   * تنسيق الإيثر من wei
   * 
   * @param wei - القيمة بـ wei
   * @returns القيمة بالإيثر
   */
  formatEther(wei: bigint | string): string {
    return ethers.formatEther(wei);
  }

  /**
   * تحويل الإيثر إلى wei
   * 
   * @param ether - القيمة بالإيثر
   * @returns القيمة بـ wei
   */
  parseEther(ether: string): bigint {
    return ethers.parseEther(ether);
  }
}
