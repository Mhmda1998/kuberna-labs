import { KubernaError } from './errors.js';

// ═══════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════

export const DUBSTRATA_BASE_URL = 'https://api.dubstrata.com/api/v1';

const DEFAULTS = {
  TIMEOUT: 30000,
  MAX_RETRIES: 12,
  RETRY_INTERVAL: 5000,
} as const;

// ═══════════════════════════════════════════
// Types
// ═══════════════════════════════════════════

export interface DubstrataConfig {
  /** مفتاح API */
  apiKey?: string;
  /** الرابط الأساسي */
  baseUrl?: string;
  /** مهلة الطلب بالمللي ثانية */
  timeout?: number;
  /** معرف المستأجر */
  tenantId?: string;
  /** عدد مرات إعادة المحاولة الافتراضي */
  maxRetries?: number;
}

export interface QueryRequest {
  /** نص الاستعلام */
  query: string;
  /** هل الاستعلام خاص */
  is_private?: boolean;
  /** فلتر النطاق */
  domain?: string;
  /** فلتر التاريخ */
  target_date?: string;
}

export interface IngestRequest {
  /** رابط المصدر */
  url: string;
  /** نص إضافي */
  text?: string;
  /** هل البيانات خاصة */
  is_private?: boolean;
  /** مخطط البيانات */
  schema?: string;
}

export interface FeedbackRequest {
  /** معرف السجل */
  log_id: string;
  /** التقييم (0-1) */
  score: number;
}

export interface AgentWalletUpdateRequest {
  /** عنوان المحفظة الجديد */
  new_wallet_address: string;
  /** التوقيع */
  signature: string;
}

export interface IntelligenceReportRequest {
  /** نص الاستعلام */
  query: string;
  /** هل التقرير خاص */
  is_private?: boolean;
}

export interface Claim {
  id: string;
  argument: string;
  evidence: string;
  source_url: string;
  domain: string | null;
  target_date: string | null;
  last_seen_at: number | null;
  similarity_score: number;
}

export interface Relation {
  subject: string;
  predicate: string;
  object: string;
  source_url: string;
  domain: string | null;
  target_date: string | null;
  last_seen_at: number | null;
}

export interface Source {
  url: string;
  abstract: string;
  domain: string | null;
  target_date: string | null;
  confidence_score: number;
  market_sentiment: string;
}

export interface PriceAction {
  ticker: string;
  cik?: string;
  assets?: number;
  liabilities?: number;
  net_income?: number;
  pe_ratio?: string;
  peg_ratio?: string;
  debt_to_equity?: string;
  price?: number;
  change_24h_percent?: number | null;
  high_24h?: number | null;
  low_24h?: number | null;
  volume_24h?: number | null;
  return_1m_percent?: number;
  return_6m_percent?: number;
  return_1y_percent?: number;
  historical_volatility_40d?: number;
  altman_z_score?: number;
  status?: string;
}

export interface StructuredQueryResult {
  code: string;
  message: string;
  claims?: Claim[];
  relations?: Relation[];
  sources?: Source[];
  price_action?: PriceAction[];
  log_id: string;
  trademark: string;
  remaining_balance: number;
  execution_cost: number;
}

export interface IntelligenceReport {
  /** الخلاصة */
  bluf: string;
  /** النطاق */
  scope: string;
  /** السياق */
  context: string;
  /** النتائج الرئيسية */
  key_findings: string[];
  /** تقييم المصادر */
  source_evaluation: string;
  /** التحليل */
  analysis: string;
  /** التهديدات والمخاطر */
  threats_risks: string;
  /** السيناريوهات البديلة */
  alternative_scenarios: string;
  /** النظرة المستقبلية */
  outlook: string;
  /** فجوات الاستخبارات */
  intelligence_gaps: string;
}

export interface StructuredReportResult {
  code: string;
  message: string;
  report: IntelligenceReport;
  claims?: Claim[];
  relations?: Relation[];
  sources?: Source[];
  price_action?: PriceAction[];
  log_id: string;
  trademark: string;
  remaining_balance: number;
  execution_cost: number;
}

export interface IngestResult {
  code: string;
  message: string;
  log_id: string;
  trademark: string;
  remaining_balance: number;
  execution_cost: number;
}

export interface FeedbackResult {
  status: string;
  message: string;
  log_id: string;
}

export interface AgentWalletUpdateResult {
  status: string;
  message: string;
  tenant_agent_id: string;
  old_wallet_address: string;
  new_wallet_address: string;
}

export interface DubstrataResponseBase {
  result?: string;
  status: string;
  aggregate_sentiment_score: number;
  graph_implied_trust_index: number;
  causal_magnitude: number;
  log_id: string;
  trademark: string;
  remaining_balance: number;
  execution_cost: number;
}

export interface QueryResponse extends DubstrataResponseBase {
  structured_result: StructuredQueryResult;
}

export interface IntelligenceReportResponse extends DubstrataResponseBase {
  structured_result: StructuredReportResult;
}

export interface IngestResponse {
  result?: string;
  status?: string;
  structured_result: IngestResult;
  log_id: string;
  trademark: string;
  remaining_balance: number;
  execution_cost: number;
}

// ═══════════════════════════════════════════
// DubstrataManager Class
// ═══════════════════════════════════════════

/**
 * مدير Dubstrata - تحليل البيانات والاستخبارات
 * 
 * @class DubstrataManager
 * @description استعلامات Dubstrata للتحليل والاستخبارات والتقارير
 * 
 * @example
 * ```typescript
 * const dubstrata = new DubstrataManager({ apiKey: 'key_...' });
 * 
 * // استعلام
 * const result = await dubstrata.query({
 *   query: 'ما هو تأثير البيتكوين على سوق العملات؟'
 * });
 * 
 * // تقرير استخباراتي
 * const report = await dubstrata.intelligenceReport({
 *   query: 'تحليل اتجاهات سوق DeFi'
 * });
 * ```
 */
export class DubstrataManager {
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;
  private maxRetries: number;

  constructor(config: DubstrataConfig = {}) {
    this.apiKey = config.apiKey || process.env.DUBSTRATA_API_KEY || '';
    this.baseUrl = config.baseUrl || DUBSTRATA_BASE_URL;
    this.timeout = config.timeout || DEFAULTS.TIMEOUT;
    this.maxRetries = config.maxRetries || DEFAULTS.MAX_RETRIES;
  }

  /**
   * تعيين مفتاح API
   */
  setApiKey(apiKey: string): void {
    if (!apiKey) {
      throw new KubernaError('مفتاح API مطلوب', 'VALIDATION_ERROR', 400);
    }
    this.apiKey = apiKey;
  }

  /**
   * التأكد من وجود مفتاح API
   */
  private ensureApiKey(): void {
    if (!this.apiKey) {
      throw new KubernaError(
        'مفتاح Dubstrata API مطلوب. قم بتعيينه عبر config أو DUBSTRATA_API_KEY',
        'UNAUTHORIZED',
        401
      );
    }
  }

  /**
   * بناء الترويسات
   */
  private getHeaders(): Record<string, string> {
    this.ensureApiKey();
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'KubernaSDK/1.0.0',
    };
  }

  /**
   * تنفيذ طلب HTTP
   */
  private async request<T>(path: string, data: Record<string, unknown>): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(data),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage = `Dubstrata API error: ${response.status}`;
        try {
          const errorBody = await response.json() as { message?: string };
          errorMessage = errorBody.message || errorMessage;
        } catch {
          // استخدام الرسالة الافتراضية
        }
        throw new KubernaError(errorMessage, 'API_ERROR', response.status);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof KubernaError) throw error;

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new KubernaError(
          `انتهت مهلة طلب Dubstrata بعد ${this.timeout}ms`,
          'TIMEOUT_ERROR',
          408
        );
      }

      const message = error instanceof Error ? error.message : 'خطأ غير معروف';
      throw new KubernaError(
        `فشل طلب Dubstrata: ${message}`,
        'NETWORK_ERROR',
        503
      );
    }
  }

  // ═══════════════════════════════════════════
  // Query
  // ═══════════════════════════════════════════

  /**
   * تنفيذ استعلام
   * 
   * @param params - معاملات الاستعلام
   * @returns نتيجة الاستعلام
   * 
   * @example
   * ```typescript
   * const result = await dubstrata.query({
   *   query: 'ما هو سعر البيتكوين حالياً؟',
   *   is_private: false
   * });
   * 
   * console.log(result.structured_result.claims);
   * console.log(`التكلفة: ${result.execution_cost}`);
   * ```
   */
  async query(params: QueryRequest): Promise<QueryResponse> {
    if (!params.query || params.query.trim().length === 0) {
      throw new KubernaError('نص الاستعلام مطلوب', 'VALIDATION_ERROR', 400);
    }

    return this.request<QueryResponse>('/query', {
      query: params.query.trim(),
      is_private: params.is_private ?? false,
      domain: params.domain,
      target_date: params.target_date,
    });
  }

  /**
   * انتظار اكتمال الاستعلام (للاستعلامات الطويلة)
   * 
   * @param params - معاملات الاستعلام
   * @param options - خيارات الانتظار
   * @returns نتيجة الاستعلام
   * 
   * @example
   * ```typescript
   * const result = await dubstrata.waitForQuery(
   *   { query: 'تحليل معقد...' },
   *   { maxRetries: 20, intervalMs: 3000 }
   * );
   * ```
   */
  async waitForQuery(
    params: QueryRequest,
    options: { maxRetries?: number; intervalMs?: number } = {},
  ): Promise<QueryResponse> {
    const maxRetries = options.maxRetries ?? this.maxRetries;
    const intervalMs = options.intervalMs ?? DEFAULTS.RETRY_INTERVAL;

    for (let i = 0; i < maxRetries; i++) {
      const result = await this.query(params);

      if (result.status === 'complete') {
        return result;
      }

      if (i < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, intervalMs));
      }
    }

    throw new KubernaError(
      `لم يكتمل الاستعلام بعد ${maxRetries} محاولة (${(maxRetries * intervalMs) / 1000} ثانية)`,
      'TIMEOUT_ERROR',
      408
    );
  }

  // ═══════════════════════════════════════════
  // Intelligence Report
  // ═══════════════════════════════════════════

  /**
   * إنشاء تقرير استخباراتي
   * 
   * @param params - معاملات التقرير
   * @returns التقرير الاستخباراتي
   * 
   * @example
   * ```typescript
   * const report = await dubstrata.intelligenceReport({
   *   query: 'تحليل مخاطر سوق العملات الرقمية'
   * });
   * 
   * console.log(report.structured_result.report.bluf);
   * console.log(report.structured_result.report.key_findings);
   * ```
   */
  async intelligenceReport(
    params: IntelligenceReportRequest
  ): Promise<IntelligenceReportResponse> {
    if (!params.query || params.query.trim().length === 0) {
      throw new KubernaError('نص الاستعلام مطلوب', 'VALIDATION_ERROR', 400);
    }

    return this.request<IntelligenceReportResponse>('/query/intelligence-report', {
      query: params.query.trim(),
      is_private: params.is_private ?? false,
    });
  }

  // ═══════════════════════════════════════════
  // Ingest
  // ═══════════════════════════════════════════

  /**
   * إدخال بيانات جديدة
   * 
   * @param params - بيانات الإدخال
   * @returns نتيجة الإدخال
   */
  async ingest(params: IngestRequest): Promise<IngestResponse> {
    if (!params.url && !params.text) {
      throw new KubernaError('يجب توفير رابط أو نص للإدخال', 'VALIDATION_ERROR', 400);
    }

    return this.request<IngestResponse>('/ingest', {
      url: params.url,
      text: params.text,
      is_private: params.is_private ?? false,
      schema: params.schema,
    });
  }

  // ═══════════════════════════════════════════
  // Feedback
  // ═══════════════════════════════════════════

  /**
   * إرسال تقييم لنتيجة
   * 
   * @param params - التقييم
   * @returns نتيجة التقييم
   */
  async feedback(params: FeedbackRequest): Promise<FeedbackResult> {
    if (!params.log_id) {
      throw new KubernaError('معرف السجل مطلوب', 'VALIDATION_ERROR', 400);
    }

    if (params.score < 0 || params.score > 1) {
      throw new KubernaError('التقييم يجب أن يكون بين 0 و 1', 'VALIDATION_ERROR', 400);
    }

    return this.request<FeedbackResult>('/feedback', {
      log_id: params.log_id,
      score: params.score,
    });
  }

  // ═══════════════════════════════════════════
  // Agent Wallet
  // ═══════════════════════════════════════════

  /**
   * تحديث محفظة الوكيل
   * 
   * @param params - بيانات التحديث
   * @returns نتيجة التحديث
   */
  async updateAgentWallet(
    params: AgentWalletUpdateRequest
  ): Promise<AgentWalletUpdateResult> {
    if (!params.new_wallet_address) {
      throw new KubernaError('عنوان المحفظة الجديد مطلوب', 'VALIDATION_ERROR', 400);
    }

    if (!params.signature) {
      throw new KubernaError('التوقيع مطلوب', 'VALIDATION_ERROR', 400);
    }

    return this.request<AgentWalletUpdateResult>('/auth/agent/update', {
      new_wallet_address: params.new_wallet_address,
      signature: params.signature,
    });
  }

  // ═══════════════════════════════════════════
  // Convenience Methods
  // ═══════════════════════════════════════════

  /**
   * استعلام سريع مع انتظار النتيجة
   * 
   * @param query - نص الاستعلام
   * @returns النتيجة المكتملة
   */
  async quickQuery(query: string): Promise<QueryResponse> {
    return this.waitForQuery({ query });
  }

  /**
   * التحقق من صحة مفتاح API
   * 
   * @returns true إذا كان المفتاح صالحاً
   */
  async validateApiKey(): Promise<boolean> {
    try {
      await this.query({ query: 'test', is_private: true });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * الحصول على الرصيد المتبقي
   * 
   * @returns الرصيد المتبقي أو -1 إذا فشل
   */
  async getRemainingBalance(): Promise<number> {
    try {
      const result = await this.query({ query: 'test', is_private: true });
      return result.remaining_balance;
    } catch {
      return -1;
    }
  }
}
