/**
 * Kuberna SDK - المدخل الرئيسي
 * 
 * @module KubernaSDK
 * @description واجهة موحدة للتعامل مع خدمات Kuberna
 * @version 1.0.0
 */

import { ethers } from 'ethers';
import { KubernaError } from './errors.js';

// ═══════════════════════════════════════════
// Import Managers
// ═══════════════════════════════════════════

import { AgentManager } from './agent.js';
import { IntentManager } from './intent.js';
import { BlockchainManager } from './blockchain.js';
import { AuthManager } from './auth.js';
import { PaymentManager } from './payment.js';
import { TeeManager } from './tee.js';
import { CertificateManager } from './certificate.js';
import { WalletManager } from './wallet.js';
import { AiManager } from './ai.js';
import { CrossChainIdentityManager } from './identity/crossChainIdentity.js';
import { SilentVerifyManager } from './silentverify.js';
import { KiteManager } from './kite.js';
import { DubstrataManager } from './dubstrata.js';
import { VirtualsManager } from './virtuals.js';

// ═══════════════════════════════════════════
// Types
// ═══════════════════════════════════════════

export interface KubernaConfig {
  /** مفتاح API */
  apiKey?: string;
  /** المفتاح الخاص للمحفظة */
  privateKey?: string;
  /** رابط RPC مخصص */
  rpcUrl?: string;
  /** الرابط الأساسي للـ API */
  baseUrl?: string;
  /** مهلة الطلبات بالمللي ثانية */
  timeout?: number;
  /** عدد مرات إعادة المحاولة */
  maxRetries?: number;
  /** تفعيل وضع التصحيح */
  debug?: boolean;
  /** شبكة البلوكشين الافتراضية */
  defaultChain?: string;
}

export interface ApiResponse<T = unknown> {
  /** هل الطلب ناجح */
  success: boolean;
  /** البيانات */
  data?: T;
  /** تفاصيل الخطأ */
  error?: {
    message: string;
    code: string;
    details?: unknown;
  };
  /** الطابع الزمني */
  timestamp?: string;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface RequestParams {
  /** طريقة HTTP */
  method: HttpMethod;
  /** المسار */
  path: string;
  /** البيانات */
  data?: Record<string, unknown>;
  /** ترويسات إضافية */
  headers?: Record<string, string>;
  /** معاملات الرابط */
  params?: Record<string, string | number | boolean>;
  /** مهلة مخصصة */
  timeout?: number;
  /** عدد مرات إعادة المحاولة */
  retries?: number;
}

export interface SDKStats {
  /** عدد الطلبات */
  requestCount: number;
  /** وقت بدء التشغيل */
  startTime: number;
  /** المحافظ المهيأة */
  walletInitialized: boolean;
  /** الرابط الأساسي */
  baseUrl: string;
  /** شبكة RPC */
  rpcUrl: string;
  /** حالة API Key */
  hasApiKey: boolean;
}

// ═══════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════

const DEFAULTS = {
  BASE_URL: 'https://api.kuberna.africa/api',
  RPC_URL: 'https://rpc.ankr.com/eth',
  TIMEOUT: 30000,
  MAX_RETRIES: 3,
  DEFAULT_CHAIN: 'ethereum',
} as const;

const PRIVATE_KEY_REGEX = /^0x[0-9a-fA-F]{64}$/;

// ═══════════════════════════════════════════
// KubernaSDK Class
// ═══════════════════════════════════════════

/**
 * Kuberna SDK - العمود الفقري للمكتبة
 * 
 * @class KubernaSDK
 * @description توفر واجهة موحدة لجميع خدمات Kuberna
 * 
 * @example
 * ```typescript
 * // تهيئة بسيطة
 * const sdk = new KubernaSDK({ apiKey: 'key_...' });
 * 
 * // مع محفظة
 * const sdkWithWallet = new KubernaSDK({
 *   apiKey: 'key_...',
 *   privateKey: '0x1234...'
 * });
 * 
 * // استخدام الخدمات
 * const balance = await sdk.wallet.getBalance();
 * const result = await sdk.ai.analyze({ prompt: '...' });
 * const intent = await sdk.intent.create({ task: '...' });
 * ```
 */
export class KubernaSDK {
  // ── Managers ─────────────────────────────
  public readonly agent: AgentManager;
  public readonly intent: IntentManager;
  public readonly blockchain: BlockchainManager;
  public readonly auth: AuthManager;
  public readonly payment: PaymentManager;
  public readonly tee: TeeManager;
  public readonly certificate: CertificateManager;
  public readonly wallet: WalletManager;
  public readonly ai: AiManager;
  public readonly verify: SilentVerifyManager;
  public readonly crossChainIdentity: CrossChainIdentityManager;
  public readonly kite: KiteManager;
  public readonly dubstrata: DubstrataManager;
  public readonly virtuals: VirtualsManager;

  // ── Private State ────────────────────────
  private config: Required<Omit<KubernaConfig, 'privateKey' | 'apiKey'>> & Pick<KubernaConfig, 'privateKey' | 'apiKey'>;
  private provider: ethers.JsonRpcProvider;
  private walletInstance?: ethers.Wallet;
  private requestCount: number = 0;
  private startTime: number = Date.now();
  private debug: boolean;

  /**
   * إنشاء نسخة جديدة من KubernaSDK
   * 
   * @param config - إعدادات التهيئة
   */
  constructor(config: KubernaConfig = {}) {
    // دمج الإعدادات مع القيم الافتراضية
    this.config = {
      baseUrl: config.baseUrl || DEFAULTS.BASE_URL,
      rpcUrl: config.rpcUrl || DEFAULTS.RPC_URL,
      timeout: config.timeout || DEFAULTS.TIMEOUT,
      maxRetries: config.maxRetries || DEFAULTS.MAX_RETRIES,
      defaultChain: config.defaultChain || DEFAULTS.DEFAULT_CHAIN,
      debug: config.debug || false,
      apiKey: config.apiKey,
      privateKey: config.privateKey,
    };

    this.debug = config.debug || false;

    // تهيئة المزود
    this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl);

    // تهيئة المحفظة إذا تم توفير المفتاح الخاص
    if (this.config.privateKey) {
      this.initializeWallet(this.config.privateKey);
    }

    // تهيئة جميع المدراء
    this.agent = new AgentManager(this);
    this.intent = new IntentManager(this);
    this.blockchain = new BlockchainManager(this);
    this.auth = new AuthManager(this);
    this.payment = new PaymentManager(this);
    this.tee = new TeeManager(this);
    this.certificate = new CertificateManager(this);
    this.wallet = new WalletManager(this);
    this.ai = new AiManager(this);
    this.verify = new SilentVerifyManager(this);
    this.crossChainIdentity = new CrossChainIdentityManager(this);
    this.kite = new KiteManager(this);
    this.dubstrata = new DubstrataManager(this);
    this.virtuals = new VirtualsManager(this);

    this.log('KubernaSDK initialized');
  }

  // ═══════════════════════════════════════════
  // Initialization
  // ═══════════════════════════════════════════

  /**
   * تهيئة المحفظة
   */
  private initializeWallet(privateKey: string): void {
    if (!PRIVATE_KEY_REGEX.test(privateKey)) {
      throw new KubernaError(
        'صيغة المفتاح الخاص غير صالحة. يجب أن يكون 64 حرفاً hex مسبوقاً بـ 0x',
        'VALIDATION_ERROR',
        400
      );
    }
    this.walletInstance = new ethers.Wallet(privateKey, this.provider);
    this.log('Wallet initialized');
  }

  /**
   * تهيئة إضافية بعد الإنشاء
   * 
   * @param params - معاملات التهيئة
   * @returns this للتسلسل
   * 
   * @example
   * ```typescript
   * const sdk = await new KubernaSDK({ apiKey: '...' }).initialize({
   *   wallet: '0x1234...'
   * });
   * ```
   */
  async initialize(params: { wallet?: string } = {}): Promise<this> {
    if (params.wallet) {
      this.initializeWallet(params.wallet);
    }

    // التحقق من صحة API Key
    if (this.config.apiKey) {
      try {
        await this.healthCheck();
      } catch (error) {
        this.log('API health check failed', error);
      }
    }

    return this;
  }

  // ═══════════════════════════════════════════
  // Getters
  // ═══════════════════════════════════════════

  /**
   * الحصول على نسخة المحفظة
   * 
   * @returns نسخة ethers.Wallet أو undefined
   */
  getWallet(): ethers.Wallet | undefined {
    return this.walletInstance;
  }

  /**
   * الحصول على مزود JSON-RPC
   * 
   * @returns مزود ethers
   */
  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }

  /**
   * الحصول على الرابط الأساسي
   * 
   * @returns الرابط الأساسي للـ API
   */
  getBaseUrl(): string {
    return this.config.baseUrl;
  }

  /**
   * الحصول على مفتاح API
   * 
   * @returns مفتاح API أو undefined
   */
  getApiKey(): string | undefined {
    return this.config.apiKey;
  }

  /**
   * التحقق مما إذا كانت المحفظة مهيأة
   * 
   * @returns true إذا كانت المحفظة جاهزة
   */
  hasWallet(): boolean {
    return !!this.walletInstance;
  }

  /**
   * الحصول على إحصائيات SDK
   * 
   * @returns إحصائيات الاستخدام
   */
  getStats(): SDKStats {
    return {
      requestCount: this.requestCount,
      startTime: this.startTime,
      walletInitialized: this.hasWallet(),
      baseUrl: this.config.baseUrl,
      rpcUrl: this.config.rpcUrl,
      hasApiKey: !!this.config.apiKey,
    };
  }

  // ═══════════════════════════════════════════
  // HTTP Client
  // ═══════════════════════════════════════════

  /**
   * تنفيذ طلب HTTP
   * 
   * @param params - معاملات الطلب
   * @returns استجابة API
   * 
   * @example
   * ```typescript
   * const response = await sdk.request({
   *   method: 'POST',
   *   path: '/agents',
   *   data: { name: 'my-agent' }
   * });
   * ```
   */
  async request<T = unknown>(params: RequestParams): Promise<ApiResponse<T>> {
    this.requestCount++;
    const url = `${this.config.baseUrl}${params.path}`;
    
    // إضافة معاملات الرابط
    const finalUrl = params.params
      ? `${url}?${new URLSearchParams(
          Object.entries(params.params).map(([k, v]) => [k, String(v)])
        ).toString()}`
      : url;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': `KubernaSDK/1.0.0`,
      ...params.headers,
    };

    if (this.config.apiKey) {
      headers['X-API-KEY'] = this.config.apiKey;
    }

    const controller = new AbortController();
    const timeout = params.timeout || this.config.timeout;
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    this.log(`${params.method} ${finalUrl}`);

    try {
      const response = await fetch(finalUrl, {
        method: params.method,
        headers,
        body: params.data ? JSON.stringify(params.data) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // محاولة قراءة JSON
      let data: unknown;
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        const errorData = data as Record<string, unknown>;
        return {
          success: false,
          error: {
            message: (errorData?.message as string) || response.statusText || 'فشل الطلب',
            code: (errorData?.code as string) || 'REQUEST_ERROR',
            details: errorData,
          },
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: true,
        data: data as T,
        timestamp: new Date().toISOString(),
      };
    } catch (error: unknown) {
      clearTimeout(timeoutId);

      if (error instanceof DOMException && error.name === 'AbortError') {
        return {
          success: false,
          error: {
            message: `انتهت مهلة الطلب بعد ${timeout}ms`,
            code: 'TIMEOUT_ERROR',
          },
          timestamp: new Date().toISOString(),
        };
      }

      const message = error instanceof Error ? error.message : 'خطأ غير معروف';
      
      return {
        success: false,
        error: {
          message: `فشل الطلب: ${message}`,
          code: 'NETWORK_ERROR',
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  // ═══════════════════════════════════════════
  // Utility Methods
  // ═══════════════════════════════════════════

  /**
   * فحص صحة الاتصال بالخادم
   * 
   * @returns true إذا كان الخادم متاحاً
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.request({
        method: 'GET',
        path: '/health',
        timeout: 5000,
      });
      return response.success;
    } catch {
      return false;
    }
  }

  /**
   * تحديث مفتاح API
   * 
   * @param apiKey - مفتاح API الجديد
   */
  setApiKey(apiKey: string): void {
    this.config.apiKey = apiKey;
    this.log('API key updated');
  }

  /**
   * تحديث رابط RPC
   * 
   * @param rpcUrl - رابط RPC الجديد
   */
  setRpcUrl(rpcUrl: string): void {
    this.config.rpcUrl = rpcUrl;
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.log(`RPC URL updated to ${rpcUrl}`);
  }

  /**
   * تسجيل رسالة تصحيح
   */
  private log(message: string, data?: unknown): void {
    if (this.debug) {
      console.log(`[KubernaSDK] ${message}`, data || '');
    }
  }

  /**
   * تفعيل/تعطيل وضع التصحيح
   */
  setDebug(enabled: boolean): void {
    this.debug = enabled;
  }
}

// ═══════════════════════════════════════════
// Re-exports - Types
// ═══════════════════════════════════════════

// Agent
export type { CreateAgentParams, Agent } from './agent.js';

// Intent
export type { CreateIntentParams, StructuredIntent, Intent } from './intent.js';

// Auth
export type { LoginParams, RegisterParams, AuthTokens, UserProfile } from './auth.js';

// Payment
export type { CreatePaymentIntentParams, PaymentIntent, PaymentStatus, TokenInfo } from './payment.js';

// TEE
export type { CreateEnclaveParams, Enclave, AttestationReport } from './tee.js';

// Certificate
export type { MintCertificateParams, Certificate, CertificateVerification } from './certificate.js';

// Wallet
export type { WalletInfo, TransactionResult } from './wallet.js';

// AI
export type { ParseIntentResult, AgentDecision, AnalyzeParams, AnalysisResult } from './ai.js';

// SilentVerify
export type {
  SilentVerifyConfig,
  AgentCertIssueRequest,
  StateCertIssueRequest,
  CertIssueResponse,
  CertVerifyResponse,
  StateCertWire,
  ChainBindingResponse,
  ChainVerifyResult,
  ChainHealth,
  ChainCatalogResponse,
  ChainCatalogEntry,
  EvmChainRequest,
  SolanaChainRequest,
  CosmosChainRequest,
  XrpChainRequest,
} from './silentverify.js';

// Kite
export type {
  KiteWalletInfo,
  KiteSessionRequest,
  KiteSession,
  KiteAgentInfo,
  X402PaymentRequest,
  X402PaymentCreate,
  X402SettleResult,
  X402VerifyResult,
} from './kite.js';

// Intent Types
export type {
  CrossChainOrder,
  ResolvedCrossChainOrder,
  SignedCrossChainOrder,
  FillInstruction,
  FillRequest,
  FillResponse,
  Output,
  OutputReceipt,
  NearIntent,
  SignedNearIntent,
  NearIntentProof,
  KubernaNormalizedIntent,
  IntentStandard,
  IntentValidationResult,
  ConfirmationPolicy,
  ConfirmationCheck,
} from './intent-types.js';

// TEE Verifier
export type {
  AttestationWitness,
  SgxWitness,
  TdxWitness,
  SevSnpWitness,
  NitroWitness,
  PhalaWitness,
  AttestationEnvelope,
  AttestationVerifier,
  VerificationReceipt,
  VerifierRegistry,
  KeyBinding,
  TeeTechnology,
  ConfirmationPolicy as TeeConfirmationPolicy,
  ConfirmationRequest,
  ConfirmationResponse,
} from './tee-verifier.js';

// Virtuals
export type {
  VirtualsConfig,
  VirtualsModel,
  ChatParams,
  ChatResult,
  ComputeBalance,
  ACPOffering,
  ACPJob,
  ACPServiceEvent,
  AgentIdentity,
} from './virtuals.js';

// Dubstrata
export type {
  DubstrataConfig,
  QueryRequest,
  QueryResponse,
  IntelligenceReportRequest,
  IntelligenceReportResponse,
  IngestRequest,
  IngestResponse,
  FeedbackRequest,
  FeedbackResult,
  AgentWalletUpdateRequest,
  AgentWalletUpdateResult,
  Claim,
  Relation,
  Source,
  PriceAction,
  IntelligenceReport,
  StructuredQueryResult,
  StructuredReportResult,
} from './dubstrata.js';

// Cross Chain Identity
export type {
  CrossChainIdentityRecord,
  AgentCertificateRecord,
  RegisterIdentityParams,
  CertIssueResult,
  SolanaWalletMapping,
} from './identity/crossChainIdentity.js';

// ERC-8004
export type { Erc8004AdapterConfig } from './verify/erc8004-adapter.js';

// ═══════════════════════════════════════════
// Re-exports - Classes & Functions
// ═══════════════════════════════════════════

export { SilentVerifyManager } from './silentverify.js';
export { KiteManager } from './kite.js';
export { DubstrataManager, DubstrataError } from './dubstrata.js';
export { VirtualsManager, VirtualsError } from './virtuals.js';
export { CrossChainIdentityManager } from './identity/crossChainIdentity.js';

// Verify
export { Erc8004Adapter } from './verify/erc8004-adapter.js';
export { IdentityResolver } from './verify/identity-resolver.js';
export { VerifierRouterClient } from './verify/verifier-router.js';
export { ExecutionProofBuilder, createStep } from './verify/execution-proof.js';
export { MandateBuilder } from './verify/mandate.js';
export {
  kubernaToOmWorld,
  structuredToOmWorld,
  omWorldToKubernaNormalized,
  computeIntentId,
  canonicalIntentJson,
} from './verify/intent-translator.js';
export { jcsCanonicalize, jcsHash } from './verify/jcs.js';

// Intent Types Functions
export {
  normalizeErc7683,
  normalizeNearIntent,
  normalizeKubernaIntent,
  validateIntent,
  checkConfirmationPolicy,
} from './intent-types.js';

// TEE Verifier Functions
export {
  evaluateConfirmation,
  createVerifierRegistry,
} from './tee-verifier.js';

// Errors
export {
  KubernaError,
  AuthenticationError,
  ValidationError,
  NotFoundError,
  ConfigurationError,
  NetworkError,
} from './errors.js';
