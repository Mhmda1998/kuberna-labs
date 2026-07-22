import { KubernaSDK } from './index.js';
import { KubernaError } from './errors.js';

// ═══════════════════════════════════════════
// Types
// ═══════════════════════════════════════════

export interface IntentConfig {
  /** الميزانية الافتراضية */
  defaultBudget?: string;
  /** المهلة الافتراضية بالساعات */
  defaultDeadline?: number;
  /** نوع التنفيذ الآمن الافتراضي */
  defaultSecureExecution?: 'TEE' | 'NONE';
}

export interface CreateIntentParams {
  /** وصف المهمة */
  task: string;
  /** الميزانية المخصصة */
  budget?: string;
  /** المهلة بالساعات */
  deadline?: number;
  /** نوع التنفيذ الآمن */
  secureExecution?: 'TEE' | 'NONE';
  /** أولوية المهمة */
  priority?: 'low' | 'medium' | 'high';
  /** وسوم للتصنيف */
  tags?: string[];
  /** بيانات وصفية */
  metadata?: Record<string, unknown>;
}

export interface StructuredIntent {
  /** معرف النية */
  id?: string;
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
  /** تاريخ التحليل */
  parsedAt?: string;
  /** الخطوات المستخرجة */
  steps?: Array<{
    action: string;
    protocol: string;
    params: Record<string, unknown>;
  }>;
}

export interface Intent {
  /** معرف النية */
  id: string;
  /** حالة النية */
  status: 'pending' | 'parsing' | 'parsed' | 'executing' | 'completed' | 'failed' | 'cancelled';
  /** الوصف */
  description: string;
  /** النية المهيكلة بعد التحليل */
  structured?: StructuredIntent;
  /** الميزانية */
  budget?: string;
  /** المهلة */
  deadline?: number;
  /** نوع التنفيذ */
  secureExecution?: string;
  /** تاريخ الإنشاء */
  createdAt?: string;
  /** تاريخ التحديث */
  updatedAt?: string;
  /** نتيجة التنفيذ */
  result?: Record<string, unknown>;
  /** رسالة خطأ */
  error?: string;
}

export interface IntentListOptions {
  /** تصفية حسب الحالة */
  status?: Intent['status'];
  /** عدد النتائج */
  limit?: number;
  /** مؤشر البداية */
  offset?: number;
  /** ترتيب حسب */
  orderBy?: 'createdAt' | 'updatedAt' | 'status';
}

// ═══════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════

const VALID_STATUSES = [
  'pending', 'parsing', 'parsed', 'executing', 'completed', 'failed', 'cancelled',
] as const;

const DEFAULTS = {
  BUDGET: '100',
  DEADLINE: 24, // ساعة
  SECURE_EXECUTION: 'NONE' as const,
} as const;

// ═══════════════════════════════════════════
// IntentManager Class
// ═══════════════════════════════════════════

/**
 * مدير النوايا - تحويل النص إلى إجراءات قابلة للتنفيذ
 * 
 * @class IntentManager
 * @description تحليل النوايا من وصف نصي وتحويلها إلى معاملات عبر السلاسل
 * 
 * @example
 * ```typescript
 * const sdk = new KubernaSDK({ apiKey: '...' });
 * const intents = new IntentManager(sdk);
 * 
 * // إنشاء نية
 * const intent = await intents.create({
 *   task: 'حوّل 100 USDC من إيثيريوم إلى بوليجون',
 *   budget: '10',
 *   secureExecution: 'TEE'
 * });
 * 
 * // تحليل النية
 * const structured = await intents.parse(
 *   'حوّل 100 USDC من إيثيريوم إلى بوليجون'
 * );
 * console.log(structured.sourceChain); // 'ethereum'
 * console.log(structured.destChain);   // 'polygon'
 * ```
 */
export class IntentManager {
  private config: IntentConfig;

  constructor(
    private sdk: KubernaSDK,
    config?: IntentConfig
  ) {
    this.config = {
      defaultBudget: DEFAULTS.BUDGET,
      defaultDeadline: DEFAULTS.DEADLINE,
      defaultSecureExecution: DEFAULTS.SECURE_EXECUTION,
      ...config,
    };
  }

  // ═══════════════════════════════════════════
  // Validation
  // ═══════════════════════════════════════════

  /**
   * التحقق من صحة معرف النية
   */
  private validateIntentId(id: string): void {
    if (!id || id.trim().length === 0) {
      throw new KubernaError('معرف النية مطلوب', 'VALIDATION_ERROR', 400);
    }
  }

  /**
   * التحقق من صحة معاملات الإنشاء
   */
  private validateCreateParams(params: CreateIntentParams): void {
    if (!params.task || params.task.trim().length === 0) {
      throw new KubernaError('وصف المهمة مطلوب', 'VALIDATION_ERROR', 400);
    }

    if (params.task.trim().length < 10) {
      throw new KubernaError('وصف المهمة قصير جداً (الحد الأدنى 10 أحرف)', 'VALIDATION_ERROR', 400);
    }

    if (params.budget && (isNaN(Number(params.budget)) || Number(params.budget) <= 0)) {
      throw new KubernaError('الميزانية يجب أن تكون رقماً موجباً', 'VALIDATION_ERROR', 400);
    }

    if (params.deadline !== undefined && params.deadline <= 0) {
      throw new KubernaError('المهلة يجب أن تكون أكبر من صفر', 'VALIDATION_ERROR', 400);
    }

    if (params.secureExecution && !['TEE', 'NONE'].includes(params.secureExecution)) {
      throw new KubernaError('نوع التنفيذ يجب أن يكون TEE أو NONE', 'VALIDATION_ERROR', 400);
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
      'INTENT_ERROR',
      500
    );
  }

  // ═══════════════════════════════════════════
  // Intent CRUD
  // ═══════════════════════════════════════════

  /**
   * إنشاء نية جديدة
   * 
   * @param params - معاملات النية
   * @returns النية المنشأة
   * 
   * @example
   * ```typescript
   * const intent = await intents.create({
   *   task: 'حوّل 100 USDC من إيثيريوم إلى أربيتروم بأقل رسوم',
   *   budget: '5',
   *   deadline: 48,
   *   secureExecution: 'TEE',
   *   priority: 'high'
   * });
   * ```
   */
  async create(params: CreateIntentParams): Promise<Intent> {
    this.validateCreateParams(params);

    try {
      const response = await this.sdk.request({
        method: 'POST',
        path: '/intents',
        data: {
          description: params.task.trim(),
          budget: params.budget ?? this.config.defaultBudget,
          deadline: params.deadline ?? this.config.defaultDeadline,
          secureExecution: params.secureExecution ?? this.config.defaultSecureExecution,
          priority: params.priority || 'medium',
          tags: params.tags || [],
          metadata: params.metadata || {},
        } as Record<string, unknown>,
      });
      return response.data as Intent;
    } catch (error) {
      this.handleError('إنشاء النية', error);
    }
  }

  /**
   * الحصول على نية محددة
   * 
   * @param id - معرف النية
   * @returns تفاصيل النية
   */
  async get(id: string): Promise<Intent> {
    this.validateIntentId(id);

    try {
      const response = await this.sdk.request({
        method: 'GET',
        path: `/intents/${id}`,
      });
      return response.data as Intent;
    } catch (error) {
      this.handleError('الحصول على النية', error);
    }
  }

  /**
   * الحصول على قائمة النوايا
   * 
   * @param options - خيارات التصفية
   * @returns قائمة النوايا
   * 
   * @example
   * ```typescript
   * // النوايا النشطة
   * const active = await intents.list({ status: 'executing' });
   * 
   * // آخر 5 نوايا
   * const recent = await intents.list({ limit: 5, orderBy: 'createdAt' });
   * ```
   */
  async list(options?: IntentListOptions): Promise<Intent[]> {
    try {
      const response = await this.sdk.request({
        method: 'GET',
        path: '/intents',
        params: {
          ...(options?.status && { status: options.status }),
          ...(options?.limit && { limit: options.limit }),
          ...(options?.offset && { offset: options.offset }),
          ...(options?.orderBy && { orderBy: options.orderBy }),
        },
      });
      return (response.data as { intents: Intent[] }).intents;
    } catch (error) {
      this.handleError('قائمة النوايا', error);
    }
  }

  /**
   * إلغاء نية
   * 
   * @param id - معرف النية
   * 
   * @example
   * ```typescript
   * await intents.cancel('intent-123');
   * ```
   */
  async cancel(id: string): Promise<void> {
    this.validateIntentId(id);

    try {
      await this.sdk.request({
        method: 'POST',
        path: `/intents/${id}/cancel`,
        data: {},
      });
    } catch (error) {
      this.handleError('إلغاء النية', error);
    }
  }

  // ═══════════════════════════════════════════
  // Intent Parsing
  // ═══════════════════════════════════════════

  /**
   * تحليل وصف نصي إلى نية مهيكلة
   * 
   * @param description - الوصف النصي للمهمة
   * @returns النية المهيكلة
   * 
   * @example
   * ```typescript
   * const result = await intents.parse(
   *   'حوّل 50 USDT من بوليجون إلى BASE بأقل رسوم ممكنة'
   * );
   * 
   * console.log(result.sourceChain);    // 'polygon'
   * console.log(result.destChain);      // 'base'
   * console.log(result.sourceAmount);   // '50'
   * console.log(result.sourceToken);    // 'USDT'
   * console.log(result.confidence);     // 0.95
   * ```
   */
  async parse(description: string): Promise<StructuredIntent> {
    if (!description || description.trim().length === 0) {
      throw new KubernaError('الوصف مطلوب', 'VALIDATION_ERROR', 400);
    }

    if (description.trim().length < 10) {
      throw new KubernaError('الوصف قصير جداً للتحليل (الحد الأدنى 10 أحرف)', 'VALIDATION_ERROR', 400);
    }

    try {
      const response = await this.sdk.request({
        method: 'POST',
        path: '/intents/parse',
        data: { description: description.trim() },
      });
      return response.data as StructuredIntent;
    } catch (error) {
      this.handleError('تحليل النية', error);
    }
  }

  // ═══════════════════════════════════════════
  // Convenience Methods
  // ═══════════════════════════════════════════

  /**
   * إنشاء وتنفيذ نية في خطوة واحدة
   * 
   * @param task - وصف المهمة
   * @param options - خيارات إضافية
   * @returns النية المنشأة
   */
  async execute(
    task: string,
    options?: Omit<CreateIntentParams, 'task'>
  ): Promise<Intent> {
    // أولاً: تحليل النية
    const structured = await this.parse(task);

    // ثانياً: إنشاء النية مع البيانات المهيكلة
    const intent = await this.create({
      task,
      ...options,
      metadata: {
        ...options?.metadata,
        structuredIntent: structured,
      },
    });

    return intent;
  }

  /**
   * التحقق مما إذا كانت النية مكتملة
   * 
   * @param id - معرف النية
   * @returns true إذا اكتملت
   */
  async isCompleted(id: string): Promise<boolean> {
    try {
      const intent = await this.get(id);
      return ['completed', 'failed', 'cancelled'].includes(intent.status);
    } catch {
      return false;
    }
  }

  /**
   * انتظار اكتمال النية
   * 
   * @param id - معرف النية
   * @param timeoutMs - المهلة بالمللي ثانية
   * @returns النية المكتملة
   */
  async waitForCompletion(
    id: string,
    timeoutMs: number = 300000 // 5 دقائق
  ): Promise<Intent> {
    this.validateIntentId(id);

    const startTime = Date.now();
    const pollInterval = 5000;

    while (Date.now() - startTime < timeoutMs) {
      const intent = await this.get(id);

      if (['completed', 'failed', 'cancelled'].includes(intent.status)) {
        return intent;
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new KubernaError(
      `انتهت مهلة انتظار اكتمال النية ${id}`,
      'TIMEOUT_ERROR',
      408
    );
  }

  /**
   * إعادة محاولة نية فاشلة
   * 
   * @param id - معرف النية الفاشلة
   * @returns النية الجديدة
   */
  async retry(id: string): Promise<Intent> {
    const failedIntent = await this.get(id);

    if (failedIntent.status !== 'failed') {
      throw new KubernaError(
        `لا يمكن إعادة محاولة نية في حالة ${failedIntent.status}`,
        'VALIDATION_ERROR',
        400
      );
    }

    return this.create({
      task: failedIntent.description,
      budget: failedIntent.budget,
      deadline: failedIntent.deadline,
      secureExecution: failedIntent.secureExecution as 'TEE' | 'NONE',
      metadata: {
        retryOf: id,
        ...failedIntent.metadata,
      },
    });
  }
}
