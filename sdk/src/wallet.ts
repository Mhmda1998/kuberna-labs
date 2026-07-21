import { KubernaSDK } from './index.js';
import { ethers } from 'ethers';
import { KubernaError } from './errors.js';

// ═══════════════════════════════════════════
// Types
// ═══════════════════════════════════════════

export interface WalletConfig {
  /** العنوان الافتراضي للمحفظة */
  defaultAddress?: string;
  /** عملة التسعير لتحويل USD */
  priceFeedCurrency?: 'ETH' | 'MATIC' | 'BNB';
  /** مهلة المعاملات بالمللي ثانية */
  transactionTimeout?: number;
}

export interface WalletInfo {
  address: string;
  balance: string;
  chainId: number;
  isConnected: boolean;
  network?: string;
  lastUpdated?: string;
}

export interface TransactionRequest {
  /** عنوان المستلم */
  to: string;
  /** القيمة بالإيثر */
  amount: string;
  /** حد الغاز (اختياري) */
  gasLimit?: number;
  /** سعر الغاز (اختياري) */
  gasPrice?: string;
  /** بيانات إضافية (اختياري) */
  data?: string;
}

export interface TransactionResult {
  hash: string;
  from: string;
  to: string;
  value: string;
  blockNumber?: number;
  status?: 'success' | 'failed' | 'pending';
  confirmations?: number;
  gasUsed?: string;
  effectiveGasPrice?: string;
  timestamp?: string;
}

export interface GasEstimate {
  gasLimit: string;
  gasPrice: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  estimatedCost: string;
}

// ═══════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════

const ERROR_MESSAGES = {
  NO_ADDRESS: 'لا يوجد عنوان متاح. قم بتوفير عنوان أو تهيئة المحفظة بمفتاح خاص.',
  NO_WALLET: 'المحفظة غير مهيأة. قم بتوفير مفتاح خاص في إعدادات SDK.',
  INVALID_ADDRESS: 'عنوان إيثيريوم غير صالح.',
  INVALID_AMOUNT: 'قيمة غير صالحة. يجب أن تكون رقماً موجباً.',
  TRANSACTION_FAILED: 'فشلت المعاملة.',
  INSUFFICIENT_FUNDS: 'رصيد غير كافٍ لإتمام المعاملة.',
} as const;

// ═══════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════

/**
 * التحقق من صحة عنوان إيثيريوم
 */
function validateAddress(address: string, name = 'address'): void {
  if (!address || typeof address !== 'string') {
    throw new KubernaError(`${name} مطلوب`, 'VALIDATION_ERROR', 400);
  }
  
  if (!ethers.isAddress(address)) {
    throw new KubernaError(ERROR_MESSAGES.INVALID_ADDRESS, 'VALIDATION_ERROR', 400);
  }
}

/**
 * التحقق من صحة القيمة
 */
function validateAmount(amount: string): void {
  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    throw new KubernaError(ERROR_MESSAGES.INVALID_AMOUNT, 'VALIDATION_ERROR', 400);
  }
}

// ═══════════════════════════════════════════
// WalletManager Class
// ═══════════════════════════════════════════

/**
 * مدير المحفظة للتعامل مع عمليات الإيثيريوم
 * 
 * @class WalletManager
 * @description يوفر واجهة موحدة لإدارة المحافظ وإرسال المعاملات
 * 
 * @example
 * ```typescript
 * const sdk = new KubernaSDK({ privateKey: '0x...' });
 * const wallet = new WalletManager(sdk);
 * 
 * const balance = await wallet.getBalance();
 * const tx = await wallet.sendTransaction({
 *   to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
 *   amount: '0.1'
 * });
 * ```
 */
export class WalletManager {
  private config: WalletConfig;
  private priceCache: { price: number; timestamp: number } | null = null;
  private readonly PRICE_CACHE_TTL = 60000; // دقيقة واحدة

  constructor(
    private sdk: KubernaSDK,
    config?: WalletConfig
  ) {
    this.config = {
      priceFeedCurrency: 'ETH',
      transactionTimeout: 120000,
      ...config,
    };
  }

  // ═══════════════════════════════════════════
  // Public Methods - Query
  // ═══════════════════════════════════════════

  /**
   * الحصول على عنوان المحفظة الحالي
   * 
   * @returns عنوان المحفظة أو undefined إذا لم تكن مهيأة
   * 
   * @example
   * ```typescript
   * const address = wallet.getAddress();
   * console.log(address); // '0x...'
   * ```
   */
  getAddress(): string | undefined {
    return this.sdk.getWallet()?.address;
  }

  /**
   * الحصول على معلومات المحفظة الكاملة
   * 
   * @param address - عنوان المحفظة (اختياري، يستخدم الافتراضي إذا لم يحدد)
   * @returns معلومات المحفظة متضمنة الرصيد والسلسلة
   * 
   * @example
   * ```typescript
   * const info = await wallet.getWalletInfo();
   * console.log(info.balance); // '1.5'
   * console.log(info.chainId); // 1
   * ```
   */
  async getWalletInfo(address?: string): Promise<WalletInfo> {
    const addr = address || this.config.defaultAddress || this.getAddress();
    if (!addr) throw new KubernaError(ERROR_MESSAGES.NO_ADDRESS, 'VALIDATION_ERROR', 400);
    
    validateAddress(addr);

    try {
      const [balance, network] = await Promise.all([
        this.sdk.getProvider().getBalance(addr),
        this.sdk.getProvider().getNetwork(),
      ]);

      return {
        address: addr,
        balance: ethers.formatEther(balance),
        chainId: Number(network.chainId),
        isConnected: true,
        network: network.name,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      throw new KubernaError(
        `فشل الحصول على معلومات المحفظة: ${(error as Error).message}`,
        'NETWORK_ERROR',
        503
      );
    }
  }

  /**
   * الحصول على رصيد المحفظة بالإيثر
   * 
   * @param address - عنوان المحفظة (اختياري)
   * @returns الرصيد بالإيثر كسلسلة نصية
   * 
   * @example
   * ```typescript
   * const balance = await wallet.getBalance();
   * console.log(balance); // '1.5'
   * ```
   */
  async getBalance(address?: string): Promise<string> {
    const addr = address || this.config.defaultAddress || this.getAddress();
    if (!addr) throw new KubernaError(ERROR_MESSAGES.NO_ADDRESS, 'VALIDATION_ERROR', 400);
    
    validateAddress(addr);

    try {
      const balance = await this.sdk.getProvider().getBalance(addr);
      return ethers.formatEther(balance);
    } catch (error) {
      throw new KubernaError(
        `فشل الحصول على الرصيد: ${(error as Error).message}`,
        'NETWORK_ERROR',
        503
      );
    }
  }

  /**
   * الحصول على الرصيد بالدولار الأمريكي
   * 
   * @param address - عنوان المحفظة (اختياري)
   * @returns الرصيد بالدولار كسلسلة نصية
   * 
   * @example
   * ```typescript
   * const usdBalance = await wallet.getBalanceInUsd();
   * console.log(usdBalance); // '3000.00'
   * ```
   */
  async getBalanceInUsd(address?: string): Promise<string> {
    const ethBalance = await this.getBalance(address);
    
    try {
      const ethPrice = await this.getEthPrice();
      const usdValue = Number(ethBalance) * ethPrice;
      return usdValue.toFixed(2);
    } catch (error) {
      // إذا فشل الحصول على السعر، نرجع رصيد ETH
      console.warn('فشل الحصول على سعر ETH/USD، إرجاع رصيد ETH');
      return ethBalance;
    }
  }

  /**
   * الحصول على عدد المعاملات للعنوان
   * 
   * @param address - عنوان المحفظة (اختياري)
   * @returns عدد المعاملات (nonce)
   */
  async getTransactionCount(address?: string): Promise<number> {
    const addr = address || this.config.defaultAddress || this.getAddress();
    if (!addr) throw new KubernaError(ERROR_MESSAGES.NO_ADDRESS, 'VALIDATION_ERROR', 400);
    
    validateAddress(addr);

    try {
      return await this.sdk.getProvider().getTransactionCount(addr);
    } catch (error) {
      throw new KubernaError(
        `فشل الحصول على عدد المعاملات: ${(error as Error).message}`,
        'NETWORK_ERROR',
        503
      );
    }
  }

  // ═══════════════════════════════════════════
  // Public Methods - Transactions
  // ═══════════════════════════════════════════

  /**
   * إرسال معاملة إيثيريوم
   * 
   * @param tx - تفاصيل المعاملة
   * @returns نتيجة المعاملة
   * 
   * @throws {KubernaError} إذا فشلت المعاملة
   * 
   * @example
   * ```typescript
   * const result = await wallet.sendTransaction({
   *   to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
   *   amount: '0.1'
   * });
   * console.log(result.hash); // '0x...'
   * ```
   */
  async sendTransaction(tx: TransactionRequest): Promise<TransactionResult> {
    // التحقق من المدخلات
    if (!tx.to) throw new KubernaError('المستلم مطلوب', 'VALIDATION_ERROR', 400);
    validateAddress(tx.to, 'to');
    validateAmount(tx.amount);

    const wallet = this.sdk.getWallet();
    if (!wallet) throw new KubernaError(ERROR_MESSAGES.NO_WALLET, 'VALIDATION_ERROR', 400);

    try {
      // التحقق من الرصيد الكافي
      const balance = await wallet.provider.getBalance(wallet.address);
      const amountWei = ethers.parseEther(tx.amount);
      
      if (balance < amountWei) {
        throw new KubernaError(ERROR_MESSAGES.INSUFFICIENT_FUNDS, 'INSUFFICIENT_FUNDS', 400);
      }

      // بناء المعاملة
      const txRequest: ethers.TransactionRequest = {
        to: tx.to,
        value: amountWei,
        gasLimit: tx.gasLimit,
        gasPrice: tx.gasPrice ? ethers.parseUnits(tx.gasPrice, 'gwei') : undefined,
        data: tx.data,
      };

      // إرسال المعاملة
      const transaction = await wallet.sendTransaction(txRequest);
      
      // انتظار التأكيد مع مهلة
      const receipt = await Promise.race([
        transaction.wait(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('انتهت مهلة المعاملة')),
            this.config.transactionTimeout
          )
        ),
      ]);

      return {
        hash: transaction.hash,
        from: transaction.from,
        to: transaction.to || tx.to,
        value: tx.amount,
        blockNumber: receipt?.blockNumber,
        status: receipt?.status === 1 ? 'success' : 'failed',
        confirmations: await transaction.confirmations(),
        gasUsed: receipt?.gasUsed?.toString(),
        effectiveGasPrice: receipt?.gasPrice?.toString(),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof KubernaError) throw error;
      
      throw new KubernaError(
        `فشل إرسال المعاملة: ${(error as Error).message}`,
        'TRANSACTION_FAILED',
        500
      );
    }
  }

  /**
   * تقدير تكلفة الغاز لمعاملة
   * 
   * @param tx - تفاصيل المعاملة
   * @returns تقدير الغاز والتكلفة
   */
  async estimateGas(tx: TransactionRequest): Promise<GasEstimate> {
    if (!tx.to) throw new KubernaError('المستلم مطلوب', 'VALIDATION_ERROR', 400);
    validateAddress(tx.to, 'to');
    validateAmount(tx.amount);

    const wallet = this.sdk.getWallet();
    if (!wallet) throw new KubernaError(ERROR_MESSAGES.NO_WALLET, 'VALIDATION_ERROR', 400);

    try {
      const feeData = await wallet.provider.getFeeData();
      
      const gasLimit = await wallet.provider.estimateGas({
        to: tx.to,
        value: ethers.parseEther(tx.amount),
        data: tx.data,
      });

      const gasPrice = feeData.gasPrice || 0n;
      const estimatedCost = gasLimit * gasPrice;

      return {
        gasLimit: gasLimit.toString(),
        gasPrice: ethers.formatUnits(gasPrice, 'gwei'),
        maxFeePerGas: feeData.maxFeePerGas ? ethers.formatUnits(feeData.maxFeePerGas, 'gwei') : undefined,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ? ethers.formatUnits(feeData.maxPriorityFeePerGas, 'gwei') : undefined,
        estimatedCost: ethers.formatEther(estimatedCost),
      };
    } catch (error) {
      throw new KubernaError(
        `فشل تقدير الغاز: ${(error as Error).message}`,
        'ESTIMATION_FAILED',
        500
      );
    }
  }

  // ═══════════════════════════════════════════
  // Public Methods - Signing
  // ═══════════════════════════════════════════

  /**
   * توقيع رسالة باستخدام المحفظة
   * 
   * @param message - الرسالة المراد توقيعها
   * @returns التوقيع
   */
  async signMessage(message: string): Promise<string> {
    const wallet = this.sdk.getWallet();
    if (!wallet) throw new KubernaError(ERROR_MESSAGES.NO_WALLET, 'VALIDATION_ERROR', 400);

    try {
      return await wallet.signMessage(message);
    } catch (error) {
      throw new KubernaError(
        `فشل توقيع الرسالة: ${(error as Error).message}`,
        'SIGNING_FAILED',
        500
      );
    }
  }

  // ═══════════════════════════════════════════
  // Private Methods
  // ═══════════════════════════════════════════

  /**
   * الحصول على سعر ETH/USD من السوق
   */
  private async getEthPrice(): Promise<number> {
    // استخدام الكاش إذا كان حديثاً
    if (this.priceCache && Date.now() - this.priceCache.timestamp < this.PRICE_CACHE_TTL) {
      return this.priceCache.price;
    }

    try {
      // محاولة استخدام oracle إذا كان متاحاً
      const provider = this.sdk.getProvider();
      // هنا يمكن استخدام Chainlink أو أي Oracle آخر
      // هذا مثال مبسط
      const price = 3000; // قيمة افتراضية
      
      this.priceCache = { price, timestamp: Date.now() };
      return price;
    } catch (error) {
      throw new KubernaError('فشل الحصول على سعر ETH/USD', 'PRICE_FEED_ERROR', 503);
    }
  }

  /**
   * تحديث إعدادات المدير
   */
  updateConfig(newConfig: Partial<WalletConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}
