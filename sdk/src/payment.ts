import { KubernaSDK } from './index.js';
import { KubernaError } from './errors.js';
import { ethers } from 'ethers';
import { validateEthAddress } from './utils/address.js';

// ═══════════════════════════════════════════
// Types
// ═══════════════════════════════════════════

export interface PaymentConfig {
  /** العملة الافتراضية */
  defaultCurrency?: string;
  /** السلسلة الافتراضية */
  defaultChain?: string;
  /** مهلة الدفع بالمللي ثانية */
  paymentTimeout?: number;
}

export interface CreatePaymentIntentParams {
  /** المبلغ المطلوب */
  amount: string;
  /** العملة (USDC, USDT, ETH, DAI) */
  currency: string;
  /** عنوان العقد الذكي للرمز */
  token: string;
  /** السلسلة (ethereum, polygon, arbitrum) */
  chain: string;
  /** وصف الدفع */
  description?: string;
  /** بيانات وصفية إضافية */
  metadata?: Record<string, unknown>;
  /** عنوان المستلم */
  recipient?: string;
  /** تاريخ الانتهاء */
  expiresAt?: string;
}

export interface PaymentIntent {
  /** معرف نية الدفع */
  intentId: string;
  /** معرف الضمان */
  escrowId: string;
  /** الحالة */
  status: 'pending' | 'funded' | 'released' | 'refunded' | 'expired' | 'cancelled';
  /** الموافقة المطلوبة */
  requiredApproval: {
    token: string;
    spender: string;
    amount: string;
  };
  /** المبلغ */
  amount: string;
  /** العملة */
  currency: string;
  /** السلسلة */
  chain: string;
  /** وقت الإنشاء */
  createdAt?: string;
}

export interface PaymentStatus {
  /** معرف النية */
  intentId: string;
  /** معرف الضمان */
  escrowId: string;
  /** الحالة */
  status: string;
  /** المبلغ */
  amount: string;
  /** الرمز */
  token: string;
  /** السلسلة */
  chain: string;
  /** مقدم الطلب */
  requester: string;
  /** المنفذ */
  executor?: string;
  /** تاريخ الإنشاء */
  createdAt: string;
  /** تاريخ التحديث */
  updatedAt: string;
  /** تجزئة المعاملة */
  txHash?: string;
}

export interface TokenInfo {
  /** عنوان العقد */
  address: string;
  /** الرمز */
  symbol: string;
  /** الاسم */
  name: string;
  /** عدد المنازل العشرية */
  decimals: number;
  /** الحد الأدنى للمبلغ */
  minAmount: string;
  /** الحد الأقصى للمبلغ */
  maxAmount: string;
  /** السلسلة */
  chain?: string;
  /** رابط صورة الرمز */
  logoUrl?: string;
}

export interface PaymentHistory {
  /** قائمة المدفوعات */
  payments: PaymentStatus[];
  /** إجمالي المدفوعات */
  total: number;
  /** الصفحة الحالية */
  page: number;
  /** هل توجد المزيد */
  hasMore: boolean;
}

export interface PaymentStats {
  /** إجمالي المدفوعات */
  totalPayments: number;
  /** إجمالي المبلغ المحول */
  totalVolume: string;
  /** المدفوعات النشطة */
  activeEscrows: number;
  /** متوسط وقت التسوية */
  averageSettlementTime: number;
}

// ═══════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════

const SUPPORTED_CURRENCIES = ['USDC', 'USDT', 'ETH', 'DAI', 'WETH', 'WBTC'] as const;

const SUPPORTED_CHAINS = ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base'] as const;

const VALID_PAYMENT_STATUSES = [
  'pending', 'funded', 'released', 'refunded', 'expired', 'cancelled',
] as const;

// ═══════════════════════════════════════════
// PaymentManager Class
// ═══════════════════════════════════════════

/**
 * مدير المدفوعات عبر السلاسل
 * 
 * @class PaymentManager
 * @description إدارة نوايا الدفع والضمان والإفراج عن الأموال
 * 
 * @example
 * ```typescript
 * const sdk = new KubernaSDK({ apiKey: '...' });
 * const payments = new PaymentManager(sdk);
 * 
 * // إنشاء نية دفع
 * const intent = await payments.createIntent({
 *   amount: '100',
 *   currency: 'USDC',
 *   token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
 *   chain: 'ethereum',
 *   description: 'دفع مقابل خدمة AI'
 * });
 * 
 * // الإفراج عن الدفع
 * const txHash = await payments.release(intent.escrowId, 'ethereum');
 * ```
 */
export class PaymentManager {
  private config: PaymentConfig;

  constructor(
    private sdk: KubernaSDK,
    config?: PaymentConfig
  ) {
    this.config = {
      defaultCurrency: 'USDC',
      defaultChain: 'ethereum',
      paymentTimeout: 3600000, // ساعة
      ...config,
    };
  }

  // ═══════════════════════════════════════════
  // Validation
  // ═══════════════════════════════════════════

  /**
   * التحقق من صحة معاملات الدفع
   */
  private validateCreateParams(params: CreatePaymentIntentParams): void {
    if (!params.amount || isNaN(Number(params.amount)) || Number(params.amount) <= 0) {
      throw new KubernaError('المبلغ يجب أن يكون رقماً موجباً', 'VALIDATION_ERROR', 400);
    }

    if (!params.currency) {
      throw new KubernaError('العملة مطلوبة', 'VALIDATION_ERROR', 400);
    }

    if (!params.token) {
      throw new KubernaError('عنوان الرمز مطلوب', 'VALIDATION_ERROR', 400);
    }

    // التحقق من عنوان الرمز (محسن من PR #41)
    if (params.token !== ethers.ZeroAddress && params.token.toUpperCase() !== 'ETH') {
      params.token = validateEthAddress(params.token, 'token');
    }

    if (!params.chain) {
      throw new KubernaError('السلسلة مطلوبة', 'VALIDATION_ERROR', 400);
    }

    if (params.recipient) {
      params.recipient = validateEthAddress(params.recipient, 'recipient');
    }
  }

  /**
   * معالجة خطأ موحد
   */
  private handleError(operation: string, error: unknown): never {
    if (error instanceof KubernaError) throw error;

    const message = error instanceof Error ? error.message : 'خطأ غير معروف';
    throw new KubernaError(
      `فشل ${operation}: ${message}`,
      'PAYMENT_ERROR',
      500
    );
  }

  // ═══════════════════════════════════════════
  // Payment Intents
  // ═══════════════════════════════════════════

  /**
   * إنشاء نية دفع جديدة
   * 
   * @param params - معاملات الدفع
   * @returns نية الدفع المنشأة
   * 
   * @example
   * ```typescript
   * const intent = await payments.createIntent({
   *   amount: '50',
   *   currency: 'USDC',
   *   token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
   *   chain: 'ethereum',
   *   description: 'اشتراك شهري',
   *   recipient: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0'
   * });
   * ```
   */
  async createIntent(params: CreatePaymentIntentParams): Promise<PaymentIntent> {
    this.validateCreateParams(params);

    try {
      const response = await this.sdk.request({
        method: 'POST',
        path: '/payments/intents',
        data: params as unknown as Record<string, unknown>,
      });
      return response.data as PaymentIntent;
    } catch (error) {
      this.handleError('إنشاء نية الدفع', error);
    }
  }

  /**
   * الحصول على حالة الدفع
   * 
   * @param intentId - معرف نية الدفع
   * @returns حالة الدفع
   */
  async getStatus(intentId: string): Promise<PaymentStatus> {
    if (!intentId) {
      throw new KubernaError('معرف نية الدفع مطلوب', 'VALIDATION_ERROR', 400);
    }

    try {
      const response = await this.sdk.request({
        method: 'GET',
        path: `/payments/intents/${intentId}`,
      });
      return response.data as PaymentStatus;
    } catch (error) {
      this.handleError('الحصول على حالة الدفع', error);
    }
  }

  // ═══════════════════════════════════════════
  // Token Management
  // ═══════════════════════════════════════════

  /**
   * الحصول على الرموز المدعومة لسلسلة معينة
   * 
   * @param chain - اسم السلسلة
   * @returns قائمة الرموز المدعومة
   */
  async getSupportedTokens(chain: string): Promise<TokenInfo[]> {
    if (!chain) {
      throw new KubernaError('اسم السلسلة مطلوب', 'VALIDATION_ERROR', 400);
    }

    try {
      const response = await this.sdk.request({
        method: 'GET',
        path: '/payments/tokens',
        data: { chain },
      });
      return (response.data as { tokens: TokenInfo[] }).tokens;
    } catch (error) {
      this.handleError('الحصول على الرموز المدعومة', error);
    }
  }

  // ═══════════════════════════════════════════
  // Escrow Actions
  // ═══════════════════════════════════════════

  /**
   * الإفراج عن الأموال من الضمان
   * 
   * @param escrowId - معرف الضمان
   * @param chain - السلسلة
   * @returns تجزئة المعاملة
   */
  async release(escrowId: string, chain: string): Promise<string> {
    if (!escrowId) {
      throw new KubernaError('معرف الضمان مطلوب', 'VALIDATION_ERROR', 400);
    }
    if (!chain) {
      throw new KubernaError('السلسلة مطلوبة', 'VALIDATION_ERROR', 400);
    }

    try {
      const response = await this.sdk.request({
        method: 'POST',
        path: '/payments/release',
        data: { escrowId, chain },
      });
      return (response.data as { txHash: string }).txHash;
    } catch (error) {
      this.handleError('الإفراج عن الدفع', error);
    }
  }

  /**
   * استرداد الأموال من الضمان
   * 
   * @param escrowId - معرف الضمان
   * @param reason - سبب الاسترداد
   * @param chain - السلسلة
   * @returns تجزئة المعاملة
   */
  async refund(escrowId: string, reason: string, chain: string): Promise<string> {
    if (!escrowId) {
      throw new KubernaError('معرف الضمان مطلوب', 'VALIDATION_ERROR', 400);
    }
    if (!reason) {
      throw new KubernaError('سبب الاسترداد مطلوب', 'VALIDATION_ERROR', 400);
    }
    if (!chain) {
      throw new KubernaError('السلسلة مطلوبة', 'VALIDATION_ERROR', 400);
    }

    try {
      const response = await this.sdk.request({
        method: 'POST',
        path: '/payments/refund',
        data: { escrowId, reason, chain },
      });
      return (response.data as { txHash: string }).txHash;
    } catch (error) {
      this.handleError('استرداد الدفع', error);
    }
  }

  // ═══════════════════════════════════════════
  // Convenience Methods
  // ═══════════════════════════════════════════

  /**
   * التحقق من حالة الدفع وانتظار الاكتمال
   * 
   * @param intentId - معرف النية
   * @param timeoutMs - المهلة بالمللي ثانية
   * @returns الحالة النهائية
   */
  async waitForCompletion(
    intentId: string,
    timeoutMs?: number
  ): Promise<PaymentStatus> {
    const timeout = timeoutMs ?? this.config.paymentTimeout;
    const startTime = Date.now();
    const pollInterval = 5000; // 5 ثوان

    while (Date.now() - startTime < timeout) {
      const status = await this.getStatus(intentId);

      if (['released', 'refunded', 'expired', 'cancelled'].includes(status.status)) {
        return status;
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new KubernaError(
      `انتهت مهلة انتظار الدفع ${intentId}`,
      'TIMEOUT_ERROR',
      408
    );
  }

  /**
   * التحقق مما إذا كان الدفع مكتملاً
   * 
   * @param intentId - معرف النية
   * @returns true إذا اكتمل
   */
  async isCompleted(intentId: string): Promise<boolean> {
    try {
      const status = await this.getStatus(intentId);
      return ['released', 'refunded'].includes(status.status);
    } catch {
      return false;
    }
  }
}
