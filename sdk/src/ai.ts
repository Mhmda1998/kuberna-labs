import { KubernaSDK } from './index.js';
import { KubernaError } from './errors.js';

// ═══════════════════════════════════════════
// Types
// ═══════════════════════════════════════════

export interface AiConfig {
  /** النموذج الافتراضي */
  defaultModel?: string;
  /** درجة الحرارة الافتراضية */
  defaultTemperature?: number;
  /** الحد الأقصى للرموز */
  maxTokens?: number;
  /** مهلة الطلب */
  timeout?: number;
}

export interface ParseIntentResult {
  /** سلسلة المصدر */
  sourceChain: string;
  /** رمز المصدر */
  sourceToken: string;
  /** كمية المصدر */
  sourceAmount: string;
  /** سلسلة الوجهة */
  destChain: string;
  /** رمز الوجهة */
  destToken: string;
  /** الحد الأدنى للكمية المستلمة */
  minDestAmount: string;
  /** المهلة بالثواني */
  timeoutSeconds: number;
  /** الميزانية */
  budget: number;
  /** العملة */
  currency: string;
  /** درجة الثقة (0-1) */
  confidence: number;
  /** الوصف الخام */
  rawDescription: string;
  /** الخطوات المقترحة */
  steps?: Array<{
    action: string;
    protocol: string;
    params: Record<string, unknown>;
  }>;
}

export interface AgentDecision {
  /** الإجراء */
  action: string;
  /** السبب */
  reason: string;
  /** درجة الثقة */
  confidence: number;
  /** المعاملات */
  parameters: Record<string, unknown>;
  /** الطابع الزمني */
  timestamp: string;
  /** البدائل */
  alternatives?: Array<{
    action: string;
    confidence: number;
    reason: string;
  }>;
}

export interface AnalyzeParams {
  /** النص للتحليل */
  text: string;
  /** سياق إضافي */
  context?: Record<string, unknown>;
  /** اللغة */
  language?: string;
  /** نوع التحليل */
  analysisType?: 'general' | 'financial' | 'technical' | 'sentiment';
}

export interface AnalysisResult {
  /** النية المستخرجة */
  intent: string;
  /** الكيانات المستخرجة */
  entities: Record<string, unknown>;
  /** المشاعر */
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  /** درجة الثقة */
  confidence: number;
  /** ملخص */
  summary?: string;
  /** التوصيات */
  recommendations?: string[];
}

export interface ChatMessage {
  /** الدور */
  role: 'system' | 'user' | 'assistant';
  /** المحتوى */
  content: string;
}

export interface ChatParams {
  /** الرسائل */
  messages: ChatMessage[];
  /** النموذج */
  model?: string;
  /** درجة الحرارة */
  temperature?: number;
  /** الحد الأقصى للرموز */
  maxTokens?: number;
}

export interface ChatResult {
  /** الرد */
  content: string;
  /** النموذج المستخدم */
  model: string;
  /** عدد الرموز */
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// ═══════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════

const DEFAULTS = {
  MODEL: 'kuberna-agent-v1',
  TEMPERATURE: 0.3,
  MAX_TOKENS: 2000,
  TIMEOUT: 60000,
} as const;

// ═══════════════════════════════════════════
// AiManager Class
// ═══════════════════════════════════════════

/**
 * مدير الذكاء الاصطناعي - تحليل النوايا واتخاذ القرارات
 * 
 * @class AiManager
 * @description خدمات AI لتحليل النوايا واتخاذ قرارات الوكلاء
 * 
 * @example
 * ```typescript
 * const sdk = new KubernaSDK({ apiKey: '...' });
 * const ai = new AiManager(sdk);
 * 
 * // تحليل نية
 * const intent = await ai.parseIntent('حوّل 100 USDC من إيثيريوم إلى بوليجون');
 * 
 * // تحليل نص
 * const analysis = await ai.analyze({
 *   text: 'سوق العملات الرقمية يشهد ارتفاعاً',
 *   analysisType: 'sentiment'
 * });
 * 
 * // محادثة
 * const chat = await ai.chat({
 *   messages: [{ role: 'user', content: 'ما هو الإيثيريوم؟' }]
 * });
 * ```
 */
export class AiManager {
  private config: AiConfig;

  constructor(
    private sdk: KubernaSDK,
    config?: AiConfig
  ) {
    this.config = {
      defaultModel: DEFAULTS.MODEL,
      defaultTemperature: DEFAULTS.TEMPERATURE,
      maxTokens: DEFAULTS.MAX_TOKENS,
      timeout: DEFAULTS.TIMEOUT,
      ...config,
    };
  }

  // ═══════════════════════════════════════════
  // Validation
  // ═══════════════════════════════════════════

  private validateInput(text: string, name = 'النص'): void {
    if (!text || text.trim().length === 0) {
      throw new KubernaError(`${name} مطلوب`, 'VALIDATION_ERROR', 400);
    }
  }

  private handleError(operation: string, error: unknown): never {
    if (error instanceof KubernaError) throw error;
    const message = error instanceof Error ? error.message : 'خطأ غير معروف';
    throw new KubernaError(`فشل ${operation}: ${message}`, 'AI_ERROR', 500);
  }

  // ═══════════════════════════════════════════
  // Intent Parsing
  // ═══════════════════════════════════════════

  /**
   * تحليل نية من وصف نصي
   * 
   * @param description - وصف النية
   * @returns النية المحللة
   * 
   * @example
   * ```typescript
   * const intent = await ai.parseIntent(
   *   'حوّل 50 USDT من أربيتروم إلى BASE بأقل رسوم'
   * );
   * console.log(intent.sourceChain); // 'arbitrum'
   * console.log(intent.destToken);   // 'USDT'
   * ```
   */
  async parseIntent(description: string): Promise<ParseIntentResult> {
    this.validateInput(description, 'الوصف');

    try {
      const response = await this.sdk.request({
        method: 'POST',
        path: '/intents/parse',
        data: { description: description.trim() },
      });
      return response.data as ParseIntentResult;
    } catch (error) {
      this.handleError('تحليل النية', error);
    }
  }

  // ═══════════════════════════════════════════
  // Agent Decision
  // ═══════════════════════════════════════════

  /**
   * الحصول على قرار من وكيل AI
   * 
   * @param agentId - معرف الوكيل
   * @param context - سياق القرار
   * @returns قرار الوكيل
   * 
   * @example
   * ```typescript
   * const decision = await ai.getDecision('agent-123', {
   *   marketCondition: 'bullish',
   *   riskLevel: 'medium'
   * });
   * 
   * console.log(decision.action);
   * console.log(decision.confidence);
   * ```
   */
  async getDecision(
    agentId: string,
    context?: Record<string, unknown>
  ): Promise<AgentDecision> {
    if (!agentId || agentId.trim().length === 0) {
      throw new KubernaError('معرف الوكيل مطلوب', 'VALIDATION_ERROR', 400);
    }

    try {
      const response = await this.sdk.request({
        method: 'POST',
        path: `/agents/${agentId}/decide`,
        data: {
          context: context || {},
          timestamp: new Date().toISOString(),
        } as Record<string, unknown>,
      });
      return response.data as AgentDecision;
    } catch (error) {
      this.handleError('اتخاذ القرار', error);
    }
  }

  // ═══════════════════════════════════════════
  // Analysis
  // ═══════════════════════════════════════════

  /**
   * تحليل نص باستخدام AI
   * 
   * @param params - معاملات التحليل
   * @returns نتيجة التحليل
   * 
   * @example
   * ```typescript
   * const result = await ai.analyze({
   *   text: 'سعر البيتكوين ارتفع بنسبة 10% اليوم',
   *   analysisType: 'sentiment'
   * });
   * 
   * console.log(result.sentiment);  // 'positive'
   * console.log(result.intent);     // 'market_analysis'
   * ```
   */
  async analyze(params: AnalyzeParams): Promise<AnalysisResult> {
    this.validateInput(params.text);

    try {
      const response = await this.sdk.request({
        method: 'POST',
        path: '/ai/analyze',
        data: {
          text: params.text.trim(),
          context: params.context || {},
          language: params.language || 'auto',
          analysisType: params.analysisType || 'general',
        } as unknown as Record<string, unknown>,
      });
      return response.data as AnalysisResult;
    } catch (error) {
      this.handleError('التحليل', error);
    }
  }

  // ═══════════════════════════════════════════
  // Chat
  // ═══════════════════════════════════════════

  /**
   * محادثة مع AI
   * 
   * @param params - معاملات المحادثة
   * @returns نتيجة المحادثة
   * 
   * @example
   * ```typescript
   * const chat = await ai.chat({
   *   messages: [
   *     { role: 'system', content: 'أنت مساعد مفيد' },
   *     { role: 'user', content: 'اشرح لي الإيثيريوم' }
   *   ]
   * });
   * 
   * console.log(chat.content);
   * ```
   */
  async chat(params: ChatParams): Promise<ChatResult> {
    if (!params.messages || params.messages.length === 0) {
      throw new KubernaError('الرسائل مطلوبة', 'VALIDATION_ERROR', 400);
    }

    try {
      const response = await this.sdk.request({
        method: 'POST',
        path: '/ai/chat',
        data: {
          messages: params.messages,
          model: params.model || this.config.defaultModel,
          temperature: params.temperature ?? this.config.defaultTemperature,
          max_tokens: params.maxTokens ?? this.config.maxTokens,
        } as unknown as Record<string, unknown>,
      });
      return response.data as ChatResult;
    } catch (error) {
      this.handleError('المحادثة', error);
    }
  }

  // ═══════════════════════════════════════════
  // Convenience Methods
  // ═══════════════════════════════════════════

  /**
   * تحليل المشاعر فقط
   * 
   * @param text - النص
   * @returns المشاعر
   */
  async analyzeSentiment(text: string): Promise<string> {
    const result = await this.analyze({
      text,
      analysisType: 'sentiment',
    });
    return result.sentiment;
  }

  /**
   * استخراج الكيانات من نص
   * 
   * @param text - النص
   * @returns الكيانات المستخرجة
   */
  async extractEntities(text: string): Promise<Record<string, unknown>> {
    const result = await this.analyze({
      text,
      analysisType: 'general',
    });
    return result.entities;
  }
}
