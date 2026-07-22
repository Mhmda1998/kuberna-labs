import { KubernaSDK } from './index.js';
import { KubernaError } from './errors.js';

// ═══════════════════════════════════════════
// Types
// ═══════════════════════════════════════════

export interface KiteConfig {
  /** مدة الجلسة الافتراضية */
  defaultTTL?: string;
  /** الشبكة الافتراضية */
  defaultNetwork?: string;
  /** الأصل الافتراضي */
  defaultAsset?: string;
  /** مهلة الطلب بالمللي ثانية */
  timeout?: number;
}

export interface KiteWalletInfo {
  /** حالة الاتصال */
  connected: boolean;
  /** عنوان محفظة Kite */
  kiteWalletAddress: string | null;
  /** الأرصدة */
  balances?: Array<{
    asset: string;
    amount: string;
    usdValue: string;
  }>;
  /** الشبكة */
  network?: string;
  /** تاريخ آخر تحديث */
  lastUpdated?: string;
}

export interface KiteSessionRequest {
  /** معرف الوكيل */
  agentId: string;
  /** ملخص المهمة */
  taskSummary: string;
  /** الحد الأقصى للمعاملة الواحدة */
  maxAmountPerTx: number;
  /** الحد الأقصى الإجمالي */
  maxTotalAmount: number;
  /** مدة الصلاحية (مثال: "24h", "7d") */
  ttl?: string;
  /** الأصول المسموحة */
  allowedAssets?: string[];
  /** الشبكات المسموحة */
  allowedNetworks?: string[];
  /** بيانات وصفية */
  metadata?: Record<string, unknown>;
}

export interface KiteSession {
  /** معرف الجلسة */
  sessionId: string;
  /** رابط الموافقة */
  approvalUrl: string;
  /** حالة الجلسة */
  status?: 'pending' | 'approved' | 'active' | 'expired' | 'revoked';
  /** إجمالي المصروف */
  totalSpent?: string;
  /** الميزانية المتبقية */
  remainingBudget?: string;
  /** تاريخ الانتهاء */
  expiresAt?: string;
  /** تاريخ الإنشاء */
  createdAt?: string;
}

export interface KiteAgentInfo {
  /** معرف الوكيل */
  id: string;
  /** عنوان محفظة Kite */
  kiteWalletAddress: string | null;
  /** DID الوكيل في Kite */
  kiteAgentDid: string | null;
  /** معرف الجلسة النشطة */
  kiteSessionId: string | null;
  /** حالة الوكيل */
  status?: 'registered' | 'active' | 'suspended';
  /** تاريخ التسجيل */
  registeredAt?: string;
}

export interface X402PaymentRequest {
  /** الحد الأقصى للمبلغ */
  maxAmountRequired: string;
  /** الأصل */
  asset: string;
  /** الشبكة */
  network: string;
  /** عنوان الدفع */
  payTo: string;
  /** المورد */
  resource: string;
  /** الوصف */
  description: string;
  /** المهلة القصوى بالثواني */
  maxTimeoutSeconds: number;
  /** المخطط */
  scheme: string;
  /** معرف الطلب */
  requestId?: string;
}

export interface X402PaymentCreate {
  /** معرف الدفع */
  paymentId: string;
  /** معرف دفع Kite */
  kitePaymentId: string;
  /** الحالة */
  status: 'pending' | 'processing' | 'completed' | 'failed';
  /** المبلغ */
  amount?: string;
  /** الأصل */
  asset?: string;
  /** وقت الإنشاء */
  createdAt?: string;
}

export interface X402SettleResult {
  /** تجزئة المعاملة */
  txHash: string;
  /** الحالة */
  status: 'success' | 'failed' | 'pending';
  /** رقم الكتلة */
  blockNumber?: number;
  /** الغاز المستخدم */
  gasUsed?: string;
  /** وقت التسوية */
  settledAt?: string;
}

export interface X402VerifyResult {
  /** حالة التحقق */
  verified: boolean;
  /** عنوان المستلم */
  toAddress: string;
  /** المبلغ */
  amount: string;
  /** رقم الكتلة */
  blockNumber: number;
  /** تجزئة المعاملة */
  txHash?: string;
  /** تفاصيل إضافية */
  details?: string;
}

export interface KitePaymentRecord {
  /** معرف الدفع */
  paymentId: string;
  /** معرف الجلسة */
  sessionId: string;
  /** المبلغ */
  amount: string;
  /** الأصل */
  asset: string;
  /** الحالة */
  status: string;
  /** تجزئة المعاملة */
  txHash?: string;
  /** وقت الإنشاء */
  createdAt: string;
}

// ═══════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════

const DEFAULTS = {
  TTL: '24h',
  NETWORK: 'ethereum',
  ASSET: 'USDC',
  TIMEOUT: 30000,
} as const;

// ═══════════════════════════════════════════
// KiteManager Class
// ═══════════════════════════════════════════

/**
 * مدير Kite - بروتوكول الدفع للوكلاء المستقلين
 * 
 * @class KiteManager
 * @description إدارة محافظ Kite والجلسات ومدفوعات X402
 * 
 * @example
 * ```typescript
 * const sdk = new KubernaSDK({ apiKey: '...' });
 * const kite = new KiteManager(sdk);
 * 
 * // تسجيل وكيل
 * const agent = await kite.registerAgent('my-agent');
 * 
 * // إنشاء جلسة دفع
 * const session = await kite.createSession({
 *   agentId: 'my-agent',
 *   taskSummary: 'تحليل بيانات',
 *   maxAmountPerTx: 10,
 *   maxTotalAmount: 100
 * });
 * 
 * // فتح رابط الموافقة
 * console.log(session.approvalUrl);
 * ```
 */
export class KiteManager {
  private config: KiteConfig;

  constructor(
    private sdk: KubernaSDK,
    config?: KiteConfig
  ) {
    this.config = {
      defaultTTL: DEFAULTS.TTL,
      defaultNetwork: DEFAULTS.NETWORK,
      defaultAsset: DEFAULTS.ASSET,
      timeout: DEFAULTS.TIMEOUT,
      ...config,
    };
  }

  // ═══════════════════════════════════════════
  // Validation
  // ═══════════════════════════════════════════

  /**
   * التحقق من صحة معرف الوكيل
   */
  private validateAgentId(agentId: string): void {
    if (!agentId || agentId.trim().length === 0) {
      throw new KubernaError('معرف الوكيل مطلوب', 'VALIDATION_ERROR', 400);
    }
  }

  /**
   * التحقق من صحة معرف الجلسة
   */
  private validateSessionId(sessionId: string): void {
    if (!sessionId || sessionId.trim().length === 0) {
      throw new KubernaError('معرف الجلسة مطلوب', 'VALIDATION_ERROR', 400);
    }
  }

  /**
   * التحقق من صحة معاملات الجلسة
   */
  private validateSessionParams(params: KiteSessionRequest): void {
    this.validateAgentId(params.agentId);

    if (!params.taskSummary || params.taskSummary.trim().length === 0) {
      throw new KubernaError('ملخص المهمة مطلوب', 'VALIDATION_ERROR', 400);
    }

    if (params.maxAmountPerTx <= 0) {
      throw new KubernaError('الحد الأقصى للمعاملة يجب أن يكون أكبر من صفر', 'VALIDATION_ERROR', 400);
    }

    if (params.maxTotalAmount <= 0) {
      throw new KubernaError('الحد الأقصى الإجمالي يجب أن يكون أكبر من صفر', 'VALIDATION_ERROR', 400);
    }

    if (params.maxAmountPerTx > params.maxTotalAmount) {
      throw new KubernaError(
        'الحد الأقصى للمعاملة لا يمكن أن يتجاوز الحد الأقصى الإجمالي',
        'VALIDATION_ERROR',
        400
      );
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
      'KITE_ERROR',
      500
    );
  }

  // ═══════════════════════════════════════════
  // Wallet Management
  // ═══════════════════════════════════════════

  /**
   * الحصول على معلومات محفظة Kite
   * 
   * @returns معلومات المحفظة والأرصدة
   * 
   * @example
   * ```typescript
   * const wallet = await kite.getWalletInfo();
   * console.log(wallet.connected ? 'متصل' : 'غير متصل');
   * wallet.balances?.forEach(b => console.log(`${b.asset}: ${b.amount}`));
   * ```
   */
  async getWalletInfo(): Promise<KiteWalletInfo> {
    try {
      const response = await this.sdk.request({
        method: 'GET',
        path: '/kite/wallet',
      });
      return response.data as KiteWalletInfo;
    } catch (error) {
      this.handleError('الحصول على معلومات المحفظة', error);
    }
  }

  /**
   * ربط محفظة Kite
   * 
   * @param kiteWalletAddress - عنوان محفظة Kite
   * @returns تأكيد الربط
   */
  async connectWallet(kiteWalletAddress: string): Promise<{ kiteWalletAddress: string }> {
    if (!kiteWalletAddress || kiteWalletAddress.trim().length === 0) {
      throw new KubernaError('عنوان محفظة Kite مطلوب', 'VALIDATION_ERROR', 400);
    }

    try {
      const response = await this.sdk.request({
        method: 'POST',
        path: '/kite/wallet/connect',
        data: { kiteWalletAddress },
      });
      return response.data as { kiteWalletAddress: string };
    } catch (error) {
      this.handleError('ربط المحفظة', error);
    }
  }

  // ═══════════════════════════════════════════
  // Agent Management
  // ═══════════════════════════════════════════

  /**
   * تسجيل وكيل في Kite
   * 
   * @param agentId - معرف الوكيل
   * @returns معلومات التسجيل متضمنة DID والمحفظة
   * 
   * @example
   * ```typescript
   * const agent = await kite.registerAgent('my-ai-agent');
   * console.log('DID:', agent.kiteDid);
   * console.log('Wallet:', agent.kiteWalletAddress);
   * ```
   */
  async registerAgent(agentId: string): Promise<{
    agentId: string;
    kiteDid: string;
    kiteWalletAddress: string;
  }> {
    this.validateAgentId(agentId);

    try {
      const response = await this.sdk.request({
        method: 'POST',
        path: '/kite/agents/register',
        data: { agentId: agentId.trim() },
      });
      return response.data as {
        agentId: string;
        kiteDid: string;
        kiteWalletAddress: string;
      };
    } catch (error) {
      this.handleError('تسجيل الوكيل', error);
    }
  }

  /**
   * الحصول على معلومات وكيل في Kite
   * 
   * @param agentId - معرف الوكيل
   * @returns معلومات الوكيل
   */
  async getAgentKiteInfo(agentId: string): Promise<KiteAgentInfo> {
    this.validateAgentId(agentId);

    try {
      const response = await this.sdk.request({
        method: 'GET',
        path: `/kite/agents/${agentId}/info`,
      });
      return response.data as KiteAgentInfo;
    } catch (error) {
      this.handleError('الحصول على معلومات الوكيل', error);
    }
  }

  // ═══════════════════════════════════════════
  // Session Management
  // ═══════════════════════════════════════════

  /**
   * إنشاء جلسة دفع للوكيل
   * 
   * @param params - معاملات الجلسة
   * @returns الجلسة المنشأة مع رابط الموافقة
   * 
   * @example
   * ```typescript
   * const session = await kite.createSession({
   *   agentId: 'my-agent',
   *   taskSummary: 'تحليل بيانات السوق',
   *   maxAmountPerTx: 5,
   *   maxTotalAmount: 50,
   *   ttl: '48h',
   *   allowedAssets: ['USDC', 'USDT']
   * });
   * 
   * // إرسال رابط الموافقة للمستخدم
   * console.log('رابط الموافقة:', session.approvalUrl);
   * ```
   */
  async createSession(params: KiteSessionRequest): Promise<KiteSession> {
    this.validateSessionParams(params);

    try {
      const response = await this.sdk.request({
        method: 'POST',
        path: '/kite/sessions/create',
        data: {
          agentId: params.agentId.trim(),
          taskSummary: params.taskSummary.trim(),
          maxAmountPerTx: params.maxAmountPerTx,
          maxTotalAmount: params.maxTotalAmount,
          ttl: params.ttl || this.config.defaultTTL,
          allowedAssets: params.allowedAssets,
          allowedNetworks: params.allowedNetworks,
          metadata: params.metadata,
        },
      });
      return response.data as KiteSession;
    } catch (error) {
      this.handleError('إنشاء الجلسة', error);
    }
  }

  /**
   * الحصول على حالة الجلسة
   * 
   * @param sessionId - معرف الجلسة
   * @returns حالة الجلسة
   */
  async getSessionStatus(sessionId: string): Promise<KiteSession> {
    this.validateSessionId(sessionId);

    try {
      const response = await this.sdk.request({
        method: 'GET',
        path: `/kite/sessions/${sessionId}`,
      });
      return response.data as KiteSession;
    } catch (error) {
      this.handleError('الحصول على حالة الجلسة', error);
    }
  }

  /**
   * انتظار موافقة المستخدم على الجلسة
   * 
   * @param sessionId - معرف الجلسة
   * @param timeoutMs - المهلة بالمللي ثانية
   * @returns الجلسة بعد الموافقة
   */
  async waitForApproval(
    sessionId: string,
    timeoutMs: number = 300000 // 5 دقائق
  ): Promise<KiteSession> {
    this.validateSessionId(sessionId);

    const startTime = Date.now();
    const pollInterval = 3000; // 3 ثوان

    while (Date.now() - startTime < timeoutMs) {
      const session = await this.getSessionStatus(sessionId);

      if (session.status === 'approved' || session.status === 'active') {
        return session;
      }

      if (session.status === 'expired' || session.status === 'revoked') {
        throw new KubernaError(
          `الجلسة ${session.status}`,
          'SESSION_EXPIRED',
          400
        );
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new KubernaError(
      'انتهت مهلة انتظار الموافقة',
      'TIMEOUT_ERROR',
      408
    );
  }

  // ═══════════════════════════════════════════
  // X402 Payment Protocol
  // ═══════════════════════════════════════════

  /**
   * تحليل طلب دفع X402
   * 
   * @param body - جسم الطلب
   * @returns تفاصيل الدفع المطلوب
   */
  async parseX402Payment(body: Record<string, unknown>): Promise<X402PaymentRequest> {
    if (!body || Object.keys(body).length === 0) {
      throw new KubernaError('جسم الطلب مطلوب', 'VALIDATION_ERROR', 400);
    }

    try {
      const response = await this.sdk.request({
        method: 'POST',
        path: '/payments/x402/parse',
        data: body,
      });
      return response.data as X402PaymentRequest;
    } catch (error) {
      this.handleError('تحليل طلب X402', error);
    }
  }

  /**
   * إنشاء دفع X402
   * 
   * @param params - معاملات الدفع
   * @returns تفاصيل الدفع المنشأ
   */
  async createX402Payment(params: {
    sessionId?: string;
    agentKiteDid?: string;
    kiteWalletAddr?: string;
    amount: string;
    asset?: string;
    network?: string;
    intentId?: string;
  }): Promise<X402PaymentCreate> {
    if (!params.amount || isNaN(Number(params.amount)) || Number(params.amount) <= 0) {
      throw new KubernaError('المبلغ يجب أن يكون رقماً موجباً', 'VALIDATION_ERROR', 400);
    }

    if (!params.sessionId && !params.agentKiteDid && !params.kiteWalletAddr) {
      throw new KubernaError(
        'يجب توفير sessionId أو agentKiteDid أو kiteWalletAddr',
        'VALIDATION_ERROR',
        400
      );
    }

    try {
      const response = await this.sdk.request({
        method: 'POST',
        path: '/payments/x402/create',
        data: {
          ...params,
          asset: params.asset || this.config.defaultAsset,
          network: params.network || this.config.defaultNetwork,
        },
      });
      return response.data as X402PaymentCreate;
    } catch (error) {
      this.handleError('إنشاء دفع X402', error);
    }
  }

  /**
   * تسوية دفع X402
   * 
   * @param params - معاملات التسوية
   * @returns نتيجة التسوية
   */
  async settleX402Payment(params: {
    kitePaymentId: string;
    authorization: Record<string, unknown>;
    signature: string;
    network?: string;
  }): Promise<X402SettleResult> {
    if (!params.kitePaymentId) {
      throw new KubernaError('معرف دفع Kite مطلوب', 'VALIDATION_ERROR', 400);
    }
    if (!params.signature) {
      throw new KubernaError('التوقيع مطلوب', 'VALIDATION_ERROR', 400);
    }
    if (!params.authorization || Object.keys(params.authorization).length === 0) {
      throw new KubernaError('بيانات التفويض مطلوبة', 'VALIDATION_ERROR', 400);
    }

    try {
      const response = await this.sdk.request({
        method: 'POST',
        path: '/payments/x402/settle',
        data: {
          ...params,
          network: params.network || this.config.defaultNetwork,
        },
      });
      return response.data as X402SettleResult;
    } catch (error) {
      this.handleError('تسوية دفع X402', error);
    }
  }

  /**
   * التحقق من معاملة X402
   * 
   * @param txHash - تجزئة المعاملة
   * @returns نتيجة التحقق
   */
  async verifyX402Transaction(txHash: string): Promise<X402VerifyResult> {
    if (!txHash || txHash.trim().length === 0) {
      throw new KubernaError('تجزئة المعاملة مطلوبة', 'VALIDATION_ERROR', 400);
    }

    try {
      const response = await this.sdk.request({
        method: 'POST',
        path: '/payments/x402/verify',
        data: { txHash },
      });
      return response.data as X402VerifyResult;
    } catch (error) {
      this.handleError('التحقق من معاملة X402', error);
    }
  }

  /**
   * الحصول على مدفوعات الجلسة
   * 
   * @param sessionId - معرف الجلسة
   * @returns قائمة المدفوعات
   */
  async getSessionPayments(sessionId: string): Promise<KitePaymentRecord[]> {
    this.validateSessionId(sessionId);

    try {
      const response = await this.sdk.request({
        method: 'GET',
        path: `/payments/x402/sessions/${sessionId}/payments`,
      });
      return (response.data as { payments: KitePaymentRecord[] }).payments || response.data as KitePaymentRecord[];
    } catch (error) {
      this.handleError('الحصول على مدفوعات الجلسة', error);
    }
  }

  // ═══════════════════════════════════════════
  // Convenience Methods
  // ═══════════════════════════════════════════

  /**
   * التحقق مما إذا كانت المحفظة متصلة
   * 
   * @returns true إذا كانت متصلة
   */
  async isWalletConnected(): Promise<boolean> {
    try {
      const wallet = await this.getWalletInfo();
      return wallet.connected;
    } catch {
      return false;
    }
  }

  /**
   * التحقق مما إذا كان الوكيل مسجلاً
   * 
   * @param agentId - معرف الوكيل
   * @returns true إذا كان مسجلاً
   */
  async isAgentRegistered(agentId: string): Promise<boolean> {
    try {
      await this.getAgentKiteInfo(agentId);
      return true;
    } catch {
      return false;
    }
  }
}
