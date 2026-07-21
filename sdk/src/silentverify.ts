/**
 * SilentVerify Manager
 * عميل متكامل للتعامل مع SilentVerify API
 * 
 * @module SilentVerifyManager
 * @version 1.0.0
 */

import { KubernaError } from './errors.js';

// ═══════════════════════════════════════════
// Configuration Types
// ═══════════════════════════════════════════

export interface SilentVerifyConfig {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  enableLogging?: boolean;
}

// ═══════════════════════════════════════════
// Certificate Types
// ═══════════════════════════════════════════

export interface AgentCertIssueRequest {
  agentDid: string;
  capabilities?: Record<string, unknown>;
  reputationHash?: string | null;
  anchor?: Record<string, unknown> | null;
  expiresInDays?: number;
  previousCertDigest?: string | null;
  taskContext?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
}

export interface StateCertIssueRequest {
  chainId?: string;
  blockHeight?: number;
  stateRootHex?: string;
  metadata?: Record<string, unknown>;
}

export interface CertIssueResponse {
  status: string;
  cert: StateCertWire;
  pubkeyFp: string;
}

export interface CertVerifyResponse {
  valid: boolean;
  pubkeyFp?: string | null;
  certType?: string | null;
  detail?: string | null;
}

export interface StateCertWire {
  schemaVersion?: string;
  q: number;
  o: number;
  v: number;
  digestY: number[];
  sigma: number[];
  publicKey: PublicKeyWire;
  pubkeyFp: string;
  metadata?: Record<string, unknown> | null;
  messageSha256Hex?: string | null;
}

export interface PublicKeyWire {
  q: number;
  o: number;
  v: number;
  centralMap: CentralMapWire;
  T: number[][];
}

export interface CentralMapWire {
  comps: CentralMapCompWire[];
}

export interface CentralMapCompWire {
  A: number[][];
  B: number[][];
  c: number[];
  d: number[];
  e: number;
}

// ═══════════════════════════════════════════
// Chain Types
// ═══════════════════════════════════════════

export interface ChainAnchorWire {
  kind: string;
  chainId?: string | null;
  blockHeight?: number | null;
  stateRootHex?: string | null;
}

export interface ChainBindingResponse extends CertIssueResponse {
  anchor?: ChainAnchorWire;
}

export interface ChainVerifyBinding {
  ok: boolean;
  digestBindsToAnchor: boolean;
  certificateCryptoOk: boolean;
  certificateFullOk: boolean;
  computedDigestY: number[];
}

export interface ChainVerifyResult {
  result: ChainVerifyBinding;
}

export interface EvmChainRequest {
  rpcUrl?: string;
  block?: number | string;
  caip2ChainId?: string | null;
  rpcHeaders?: Record<string, string> | null;
  policy?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
  timeout?: number;
}

export interface SolanaChainRequest {
  rpcUrl?: string;
  clusterId?: string;
  slot?: number | null;
  commitment?: 'processed' | 'confirmed' | 'finalized';
  metadata?: Record<string, unknown>;
  timeout?: number;
}

export interface CosmosChainRequest {
  restBase?: string;
  chainId?: string;
  height?: number | null;
  metadata?: Record<string, unknown>;
  timeout?: number;
}

export interface XrpChainRequest {
  rpcUrl?: string;
  networkId?: string;
  ledgerIndex?: number | string;
  metadata?: Record<string, unknown>;
  timeout?: number;
}

export interface ChainHealth {
  ok: boolean;
  service: string;
  version: string;
}

export interface ChainCatalogEntry {
  id: string;
  label: string;
  issue: string;
  verify: string;
  hints?: string;
  docs?: string;
}

export interface ChainCatalogResponse {
  chains: ChainCatalogEntry[];
  hint: string;
}

// ═══════════════════════════════════════════
// Error Codes
// ═══════════════════════════════════════════

const ERROR_CODES = {
  NETWORK_ERROR: 'SILENTVERIFY_NETWORK_ERROR',
  API_ERROR: 'SILENTVERIFY_ERROR',
  VALIDATION_ERROR: 'SILENTVERIFY_VALIDATION_ERROR',
  TIMEOUT_ERROR: 'SILENTVERIFY_TIMEOUT_ERROR',
  UNAUTHORIZED: 'SILENTVERIFY_UNAUTHORIZED',
} as const;

// ═══════════════════════════════════════════
// Default Configuration
// ═══════════════════════════════════════════

const DEFAULTS = {
  BASE_URL: 'https://silentverify.up.railway.app',
  API_KEY: 'sv_dev_test_key',
  TIMEOUT_MS: 30000,
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
  EXPIRES_IN_DAYS: 30,
  DEFAULT_CHAIN_ID: 'eip155:1',
  EVM_RPC_URL: 'https://eth.drpc.org',
  SOLANA_RPC_URL: 'https://api.mainnet-beta.solana.com',
  COSMOS_REST_BASE: 'https://cosmos-rest.publicnode.com',
  XRP_RPC_URL: 'https://xrplcluster.com',
  SOLANA_CLUSTER: 'mainnet-beta',
  SOLANA_COMMITMENT: 'finalized' as const,
  COSMOS_CHAIN_ID: 'cosmoshub-4',
  XRP_NETWORK: 'mainnet',
  XRP_LEDGER_INDEX: 'validated',
} as const;

// ═══════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════

/**
 * التحقق من صحة DID
 */
function isValidDID(did: string): boolean {
  return /^did:[a-zA-Z0-9]+:[a-zA-Z0-9._-]+$/.test(did);
}

/**
 * التحقق من صحة URL
 */
function isValidURL(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * التحقق من صحة hex string
 */
function isValidHex(hex: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(hex);
}

/**
 * التحقق من صحة CAIP-2 chain ID
 */
function isValidChainId(chainId: string): boolean {
  return /^[a-zA-Z0-9]+:[0-9]+$/.test(chainId);
}

/**
 * إخفاء البيانات الحساسة للسجلات
 */
function maskSensitiveData(obj: unknown): unknown {
  if (typeof obj !== 'object' || obj === null) return obj;
  
  if (Array.isArray(obj)) return obj.map(maskSensitiveData);
  
  const masked: Record<string, unknown> = {};
  const sensitiveKeys = ['apikey', 'api_key', 'secret', 'password', 'private'];
  
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    masked[key] = sensitiveKeys.some(sk => key.toLowerCase().includes(sk))
      ? '***MASKED***'
      : maskSensitiveData(value);
  }
  
  return masked;
}

/**
 * دالة التأخير
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * إعادة المحاولة مع exponential backoff
 */
async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = DEFAULTS.MAX_RETRIES,
  baseDelay: number = DEFAULTS.RETRY_DELAY_MS
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) break;
      
      // لا تعيد المحاولة مع أخطاء التحقق
      if (error instanceof KubernaError && error.code === ERROR_CODES.VALIDATION_ERROR) {
        throw error;
      }
      
      const waitTime = Math.min(baseDelay * Math.pow(2, attempt), 10000);
      await delay(waitTime);
    }
  }
  
  throw lastError;
}

// ═══════════════════════════════════════════
// Main Class
// ═══════════════════════════════════════════

export class SilentVerifyManager {
  private apiKey: string;
  private baseURL: string;
  private timeout: number;
  private maxRetries: number;
  private enableLogging: boolean;
  private requestCount: number;
  private lastRequestTime: number;

  constructor(config?: SilentVerifyConfig) {
    this.apiKey = config?.apiKey || process.env.SILENTVERIFY_API_KEY || DEFAULTS.API_KEY;
    this.baseURL = config?.baseUrl || process.env.SILENTVERIFY_BASE_URL || DEFAULTS.BASE_URL;
    this.timeout = config?.timeout ?? DEFAULTS.TIMEOUT_MS;
    this.maxRetries = config?.maxRetries ?? DEFAULTS.MAX_RETRIES;
    this.enableLogging = config?.enableLogging ?? false;
    this.requestCount = 0;
    this.lastRequestTime = Date.now();
  }

  /**
   * إحصائيات الاستخدام
   */
  get stats() {
    return {
      requestCount: this.requestCount,
      uptime: Date.now() - this.lastRequestTime,
      baseURL: this.baseURL,
      hasApiKey: !!this.apiKey,
    };
  }

  /**
   * بناء الترويسات
   */
  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'User-Agent': 'KubernaSDK/1.0.0',
      ...(this.apiKey ? { 'X-API-Key': this.apiKey } : {}),
    };
  }

  /**
   * بناء URL كامل
   */
  private buildURL(path: string): string {
    return `${this.baseURL}${path}`;
  }

  /**
   * تسجيل الطلبات
   */
  private log(method: string, url: string, body?: unknown): void {
    if (!this.enableLogging) return;
    
    const maskedBody = body ? maskSensitiveData(body) : undefined;
    console.log(`[KubernaSDK] ${method} ${url}`, {
      timestamp: new Date().toISOString(),
      requestNumber: ++this.requestCount,
      body: maskedBody,
    });
  }

  /**
   * تنفيذ طلب HTTP
   */
  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    data?: unknown,
    options?: { timeout?: number; isText?: boolean }
  ): Promise<T> {
    const url = this.buildURL(path);
    this.log(method, url, data);

    const controller = new AbortController();
    const requestTimeout = options?.timeout ?? this.timeout;
    const timeoutId = setTimeout(() => controller.abort(), requestTimeout);

    try {
      const response = await fetch(url, {
        method,
        headers: this.headers(),
        body: data ? JSON.stringify(data) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let detail: string;
        try {
          const body = await response.json() as { detail?: unknown };
          detail = JSON.stringify(body.detail ?? body);
        } catch {
          detail = response.statusText;
        }

        const errorCode = response.status === 401 || response.status === 403
          ? ERROR_CODES.UNAUTHORIZED
          : ERROR_CODES.API_ERROR;

        throw new KubernaError(
          `SilentVerify API error: ${detail}`,
          errorCode,
          response.status
        );
      }

      // التحقق من نوع المحتوى
      const contentType = response.headers.get('content-type');
      if (options?.isText || contentType?.includes('text/plain')) {
        return (await response.text()) as unknown as T;
      }

      return (await response.json()) as T;
    } catch (error: unknown) {
      clearTimeout(timeoutId);

      if (error instanceof KubernaError) throw error;

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new KubernaError(
          `Request timeout after ${requestTimeout}ms`,
          ERROR_CODES.TIMEOUT_ERROR,
          408
        );
      }

      const msg = error instanceof Error ? error.message : 'Unknown error';
      throw new KubernaError(
        `SilentVerify request failed: ${msg}`,
        ERROR_CODES.NETWORK_ERROR,
        503
      );
    }
  }

  /**
   * طلب GET
   */
  private async get<T>(path: string, retryRequest = false): Promise<T> {
    const execute = () => this.request<T>('GET', path);
    return retryRequest ? retry(execute, this.maxRetries) : execute();
  }

  /**
   * طلب POST
   */
  private async post<T>(
    path: string,
    data?: unknown,
    options?: { timeout?: number; isText?: boolean; retry?: boolean }
  ): Promise<T> {
    const execute = () => this.request<T>('POST', path, data, options);
    return options?.retry ? retry(execute, this.maxRetries) : execute();
  }

  // ═══════════════════════════════════════════
  // Health & Discovery
  // ═══════════════════════════════════════════

  /**
   * فحص صحة الخدمة
   */
  async health(): Promise<ChainHealth> {
    return this.get<ChainHealth>('/api/v1/health', true);
  }

  /**
   * الحصول على قائمة السلاسل المدعومة
   */
  async chains(): Promise<ChainCatalogResponse> {
    return this.get<ChainCatalogResponse>('/api/v1/chains', true);
  }

  // ═══════════════════════════════════════════
  // Agent Certificates
  // ═══════════════════════════════════════════

  /**
   * إصدار شهادة وكيل
   * 
   * @param params - بيانات طلب الشهادة
   * @throws {KubernaError} إذا كان agentDid غير صالح
   * 
   * @example
   * ```typescript
   * const cert = await manager.issueAgentCert({
   *   agentDid: 'did:example:123',
   *   expiresInDays: 90
   * });
   * ```
   */
  async issueAgentCert(params: AgentCertIssueRequest): Promise<CertIssueResponse> {
    // Validation
    if (!params.agentDid || typeof params.agentDid !== 'string') {
      throw new KubernaError(
        'agentDid is required and must be a string',
        ERROR_CODES.VALIDATION_ERROR,
        400
      );
    }

    if (!isValidDID(params.agentDid)) {
      throw new KubernaError(
        'agentDid must be a valid DID format (did:method:identifier)',
        ERROR_CODES.VALIDATION_ERROR,
        400
      );
    }

    if (params.expiresInDays !== undefined && (params.expiresInDays < 1 || params.expiresInDays > 365)) {
      throw new KubernaError(
        'expiresInDays must be between 1 and 365',
        ERROR_CODES.VALIDATION_ERROR,
        400
      );
    }

    return this.post<CertIssueResponse>('/api/v1/certs/agent/issue', {
      agent_did: params.agentDid,
      capabilities: params.capabilities,
      reputation_hash: params.reputationHash ?? null,
      previous_cert_digest: params.previousCertDigest ?? null,
      task_context: params.taskContext ?? null,
      anchor: params.anchor ?? null,
      expires_in_days: params.expiresInDays ?? DEFAULTS.EXPIRES_IN_DAYS,
      metadata: params.metadata,
    });
  }

  /**
   * التحقق من شهادة وكيل
   */
  async verifyAgentCert(cert: Record<string, unknown>): Promise<CertVerifyResponse> {
    if (!cert || Object.keys(cert).length === 0) {
      throw new KubernaError(
        'Certificate cannot be empty',
        ERROR_CODES.VALIDATION_ERROR,
        400
      );
    }

    return this.post<CertVerifyResponse>('/api/v1/certs/agent/verify', { cert });
  }

  // ═══════════════════════════════════════════
  // State Certificates
  // ═══════════════════════════════════════════

  /**
   * إصدار شهادة حالة
   */
  async issueStateCert(params: StateCertIssueRequest): Promise<CertIssueResponse> {
    // Validation
    if (params.chainId && !isValidChainId(params.chainId)) {
      throw new KubernaError(
        'chainId must be a valid CAIP-2 chain ID',
        ERROR_CODES.VALIDATION_ERROR,
        400
      );
    }

    if (params.stateRootHex && !isValidHex(params.stateRootHex)) {
      throw new KubernaError(
        'stateRootHex must be a valid 32-byte hex string',
        ERROR_CODES.VALIDATION_ERROR,
        400
      );
    }

    return this.post<CertIssueResponse>('/api/v1/certs/state/issue', {
      chain_id: params.chainId ?? DEFAULTS.DEFAULT_CHAIN_ID,
      block_height: params.blockHeight,
      state_root_hex: params.stateRootHex,
      metadata: params.metadata,
    });
  }

  /**
   * التحقق من أي شهادة
   */
  async verifyCert(cert: Record<string, unknown>): Promise<CertVerifyResponse> {
    if (!cert || Object.keys(cert).length === 0) {
      throw new KubernaError('Certificate cannot be empty', ERROR_CODES.VALIDATION_ERROR, 400);
    }

    return this.post<CertVerifyResponse>('/api/v1/certs/verify', { cert });
  }

  /**
   * التحقق من شهادة حالة
   */
  async verifyStateCert(cert: Record<string, unknown>): Promise<CertVerifyResponse> {
    if (!cert || Object.keys(cert).length === 0) {
      throw new KubernaError('Certificate cannot be empty', ERROR_CODES.VALIDATION_ERROR, 400);
    }

    return this.post<CertVerifyResponse>('/api/v1/certs/state/verify', { cert });
  }

  // ═══════════════════════════════════════════
  // EVM Chain
  // ═══════════════════════════════════════════

  /**
   * إصدار مرساة EVM
   */
  async issueEvmAnchor(params: EvmChainRequest): Promise<ChainBindingResponse> {
    // Validation
    if (params.rpcUrl && !isValidURL(params.rpcUrl)) {
      throw new KubernaError('rpcUrl must be a valid URL', ERROR_CODES.VALIDATION_ERROR, 400);
    }

    if (params.timeout !== undefined && (params.timeout < 1 || params.timeout > 300)) {
      throw new KubernaError('timeout must be between 1 and 300 seconds', ERROR_CODES.VALIDATION_ERROR, 400);
    }

    return this.post<ChainBindingResponse>('/api/v1/chains/evm/issue', {
      rpc_url: params.rpcUrl ?? DEFAULTS.EVM_RPC_URL,
      block: params.block ?? 'latest',
      caip2_chain_id: params.caip2ChainId ?? null,
      rpc_headers: params.rpcHeaders ?? null,
      policy: params.policy ?? null,
      metadata: params.metadata,
      timeout: params.timeout ?? 30,
    });
  }

  /**
   * التحقق من مرساة EVM
   */
  async verifyEvmAnchor(
    cert: Record<string, unknown>,
    params: EvmChainRequest,
  ): Promise<ChainVerifyResult> {
    if (!cert || Object.keys(cert).length === 0) {
      throw new KubernaError('Certificate cannot be empty', ERROR_CODES.VALIDATION_ERROR, 400);
    }

    if (params.rpcUrl && !isValidURL(params.rpcUrl)) {
      throw new KubernaError('rpcUrl must be a valid URL', ERROR_CODES.VALIDATION_ERROR, 400);
    }

    return this.post<ChainVerifyResult>('/api/v1/chains/evm/verify', {
      rpc_url: params.rpcUrl ?? DEFAULTS.EVM_RPC_URL,
      block: params.block ?? 'latest',
      caip2_chain_id: params.caip2ChainId ?? null,
      rpc_headers: params.rpcHeaders ?? null,
      policy: params.policy ?? null,
      metadata: params.metadata,
      timeout: params.timeout ?? 30,
      cert,
    });
  }

  // ═══════════════════════════════════════════
  // Solana Chain
  // ═══════════════════════════════════════════

  async issueSolanaAnchor(params: SolanaChainRequest): Promise<ChainBindingResponse> {
    if (params.rpcUrl && !isValidURL(params.rpcUrl)) {
      throw new KubernaError('rpcUrl must be a valid URL', ERROR_CODES.VALIDATION_ERROR, 400);
    }

    return this.post<ChainBindingResponse>('/api/v1/chains/solana/issue', {
      rpc_url: params.rpcUrl ?? DEFAULTS.SOLANA_RPC_URL,
      cluster_id: params.clusterId ?? DEFAULTS.SOLANA_CLUSTER,
      slot: params.slot ?? null,
      commitment: params.commitment ?? DEFAULTS.SOLANA_COMMITMENT,
      metadata: params.metadata,
      timeout: params.timeout ?? 30,
    });
  }

  async verifySolanaAnchor(
    cert: Record<string, unknown>,
    params: SolanaChainRequest,
  ): Promise<ChainVerifyResult> {
    if (!cert || Object.keys(cert).length === 0) {
      throw new KubernaError('Certificate cannot be empty', ERROR_CODES.VALIDATION_ERROR, 400);
    }

    return this.post<ChainVerifyResult>('/api/v1/chains/solana/verify', {
      rpc_url: params.rpcUrl ?? DEFAULTS.SOLANA_RPC_URL,
      cluster_id: params.clusterId ?? DEFAULTS.SOLANA_CLUSTER,
      slot: params.slot ?? null,
      commitment: params.commitment ?? DEFAULTS.SOLANA_COMMITMENT,
      metadata: params.metadata,
      timeout: params.timeout ?? 30,
      cert,
    });
  }

  // ═══════════════════════════════════════════
  // Cosmos Chain
  // ═══════════════════════════════════════════

  async issueCosmosAnchor(params: CosmosChainRequest): Promise<ChainBindingResponse> {
    if (params.restBase && !isValidURL(params.restBase)) {
      throw new KubernaError('restBase must be a valid URL', ERROR_CODES.VALIDATION_ERROR, 400);
    }

    return this.post<ChainBindingResponse>('/api/v1/chains/cosmos/issue', {
      rest_base: params.restBase ?? DEFAULTS.COSMOS_REST_BASE,
      chain_id: params.chainId ?? DEFAULTS.COSMOS_CHAIN_ID,
      height: params.height ?? null,
      metadata: params.metadata,
      timeout: params.timeout ?? 30,
    });
  }

  async verifyCosmosAnchor(
    cert: Record<string, unknown>,
    params: CosmosChainRequest,
  ): Promise<ChainVerifyResult> {
    if (!cert || Object.keys(cert).length === 0) {
      throw new KubernaError('Certificate cannot be empty', ERROR_CODES.VALIDATION_ERROR, 400);
    }

    return this.post<ChainVerifyResult>('/api/v1/chains/cosmos/verify', {
      rest_base: params.restBase ?? DEFAULTS.COSMOS_REST_BASE,
      chain_id: params.chainId ?? DEFAULTS.COSMOS_CHAIN_ID,
      height: params.height ?? null,
      metadata: params.metadata,
      timeout: params.timeout ?? 30,
      cert,
    });
  }

  // ═══════════════════════════════════════════
  // XRP Chain
  // ═══════════════════════════════════════════

  async issueXrpAnchor(params: XrpChainRequest): Promise<ChainBindingResponse> {
    if (params.rpcUrl && !isValidURL(params.rpcUrl)) {
      throw new KubernaError('rpcUrl must be a valid URL', ERROR_CODES.VALIDATION_ERROR, 400);
    }

    return this.post<ChainBindingResponse>('/api/v1/chains/xrp/issue', {
      rpc_url: params.rpcUrl ?? DEFAULTS.XRP_RPC_URL,
      network_id: params.networkId ?? DEFAULTS.XRP_NETWORK,
      ledger_index: params.ledgerIndex ?? DEFAULTS.XRP_LEDGER_INDEX,
      metadata: params.metadata,
      timeout: params.timeout ?? 30,
    });
  }

  async verifyXrpAnchor(
    cert: Record<string, unknown>,
    params: XrpChainRequest,
  ): Promise<ChainVerifyResult> {
    if (!cert || Object.keys(cert).length === 0) {
      throw new KubernaError('Certificate cannot be empty', ERROR_CODES.VALIDATION_ERROR, 400);
    }

    return this.post<ChainVerifyResult>('/api/v1/chains/xrp/verify', {
      rpc_url: params.rpcUrl ?? DEFAULTS.XRP_RPC_URL,
      network_id: params.networkId ?? DEFAULTS.XRP_NETWORK,
      ledger_index: params.ledgerIndex ?? DEFAULTS.XRP_LEDGER_INDEX,
      metadata: params.metadata,
      timeout: params.timeout ?? 30,
      cert,
    });
  }

  // ═══════════════════════════════════════════
  // Cross-Chain
  // ═══════════════════════════════════════════

  async issueEvmCrossAnchor(
    src: Record<string, unknown>,
    dst: Record<string, unknown>,
    policy?: Record<string, unknown> | null,
    metadata?: Record<string, unknown>,
    timeout?: number,
  ): Promise<ChainBindingResponse> {
    return this.post<ChainBindingResponse>('/api/v1/chains/evm-cross/issue', {
      src,
      dst,
      policy: policy ?? null,
      metadata,
      timeout: timeout ?? 30,
    });
  }

  async verifyEvmCrossAnchor(
    cert: Record<string, unknown>,
    src: Record<string, unknown>,
    dst: Record<string, unknown>,
    policy?: Record<string, unknown> | null,
    metadata?: Record<string, unknown>,
    timeout?: number,
  ): Promise<ChainVerifyResult> {
    if (!cert || Object.keys(cert).length === 0) {
      throw new KubernaError('Certificate cannot be empty', ERROR_CODES.VALIDATION_ERROR, 400);
    }

    return this.post<ChainVerifyResult>('/api/v1/chains/evm-cross/verify', {
      src,
      dst,
      policy: policy ?? null,
      metadata,
      timeout: timeout ?? 30,
      cert,
    });
  }

  async issueCrossL1Anchor(
    src: Record<string, unknown>,
    dst: Record<string, unknown>,
    policy?: Record<string, unknown> | null,
    metadata?: Record<string, unknown>,
    timeout?: number,
  ): Promise<ChainBindingResponse> {
    return this.post<ChainBindingResponse>('/api/v1/chains/cross-l1/issue', {
      src,
      dst,
      policy: policy ?? null,
      metadata,
      timeout: timeout ?? 30,
    });
  }

  async verifyCrossL1Anchor(
    cert: Record<string, unknown>,
    src: Record<string, unknown>,
    dst: Record<string, unknown>,
    policy?: Record<string, unknown> | null,
    metadata?: Record<string, unknown>,
    timeout?: number,
  ): Promise<ChainVerifyResult> {
    if (!cert || Object.keys(cert).length === 0) {
      throw new KubernaError('Certificate cannot be empty', ERROR_CODES.VALIDATION_ERROR, 400);
    }

    return this.post<ChainVerifyResult>('/api/v1/chains/cross-l1/verify', {
      src,
      dst,
      policy: policy ?? null,
      metadata,
      timeout: timeout ?? 30,
      cert,
    });
  }

  // ═══════════════════════════════════════════
  // Printing & Utilities
  // ═══════════════════════════════════════════

  async printCert(cert: Record<string, unknown>, autoprint?: boolean): Promise<string> {
    if (!cert || Object.keys(cert).length === 0) {
      throw new KubernaError('Certificate cannot be empty', ERROR_CODES.VALIDATION_ERROR, 400);
    }

    const params = new URLSearchParams();
    if (autoprint ?? true) params.set('autoprint', 'true');
    return this.post<string>(`/api/v1/certs/print?${params.toString()}`, { cert }, { isText: true });
  }

  async printCertPublic(cert: Record<string, unknown>, autoprint?: boolean): Promise<string> {
    if (!cert || Object.keys(cert).length === 0) {
      throw new KubernaError('Certificate cannot be empty', ERROR_CODES.VALIDATION_ERROR, 400);
    }

    const params = new URLSearchParams();
    if (autoprint ?? true) params.set('autoprint', 'true');
    return this.post<string>(`/api/v1/certs/print/public?${params.toString()}`, { cert }, { isText: true });
  }

  // ═══════════════════════════════════════════
  // Billing
  // ═══════════════════════════════════════════

  async getFreeKey(): Promise<Record<string, unknown>> {
    return this.post<Record<string, unknown>>('/api/v1/billing/free-key');
  }

  async getUsage(): Promise<Record<string, unknown>> {
    return this.get<Record<string, unknown>>('/api/v1/billing/usage');
  }

  async evmHints(): Promise<Record<string, unknown>> {
    return this.get<Record<string, unknown>>('/api/v1/chains/evm/hints');
  }

  async billingStatus(): Promise<Record<string, unknown>> {
    return this.get<Record<string, unknown>>('/api/v1/billing/status');
  }
}
