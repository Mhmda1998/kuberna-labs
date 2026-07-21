import { KubernaError } from './errors.js';

// ═══════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════

export const VIRTUALS_COMPUTE_URL = 'https://compute.virtuals.io/v1';
export const VIRTUALS_ACP_URL = 'https://api.virtuals.io';
export const VIRTUALS_WS_URL = 'wss://app.virtuals.io/acp/agents';

const DEFAULTS = {
  TIMEOUT: 30000,
  TEMPERATURE: 0.3,
  MAX_TOKENS: 2000,
  STREAM_TIMEOUT: 120000,
} as const;

// ═══════════════════════════════════════════
// Types
// ═══════════════════════════════════════════

export interface VirtualsConfig {
  /** مفتاح API (يمكن استخدام VIRTUALS_API_KEY أو AI_API_KEY) */
  apiKey?: string;
  /** رابط خدمة الحوسبة */
  computeUrl?: string;
  /** رابط خدمة ACP */
  acpUrl?: string;
  /** مهلة الطلب بالمللي ثانية */
  timeout?: number;
  /** مهلة البث بالمللي ثانية */
  streamTimeout?: number;
}

export interface VirtualsModel {
  id: string;
  name: string;
  description: string;
  contextLength: number;
  pricing: {
    input: number;
    output: number;
    cacheInput: number | null;
  };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatParams {
  /** معرف النموذج */
  model: string;
  /** رسائل المحادثة */
  messages: ChatMessage[];
  /** درجة العشوائية (0-2) */
  temperature?: number;
  /** الحد الأقصى للرموز */
  maxTokens?: number;
  /** إيقاف عند رموز محددة */
  stop?: string[];
  /** بذرة عشوائية للتكرار */
  seed?: number;
}

export interface ChatResult {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost: number;
}

export interface ComputeBalance {
  balance: number;
  currency: string;
  autoTopUp: {
    enabled: boolean;
    amount: number;
    threshold: number;
    chain: string;
  };
}

export interface ACPOffering {
  id: string;
  name: string;
  description: string;
  priceType: 'fixed' | 'hourly' | 'milestone';
  priceValue: number;
  slaMinutes: number;
  requirements: Record<string, unknown>;
  deliverable: string;
  providerAddress: string;
  active: boolean;
}

export interface ACPJob {
  id: number;
  chainId: number;
  offeringId: string;
  clientAddress: string;
  providerAddress: string;
  status: 'pending' | 'budget_set' | 'funded' | 'submitted' | 'completed' | 'rejected' | 'expired';
  fee: number;
  fundTransferAmount?: number;
  createdAt: string;
}

export interface ACPServiceEvent {
  kind: 'system' | 'message';
  type?: 'job.created' | 'budget.set' | 'job.funded' | 'job.submitted' | 'job.completed' | 'job.rejected' | 'job.expired';
  from?: string;
  content?: string;
  contentType?: 'text' | 'proposal' | 'deliverable' | 'structured' | 'requirement';
  session?: {
    jobId: number;
    chainId: number;
    role: 'client' | 'provider' | 'evaluator';
    status: string;
  };
}

export interface AgentIdentity {
  walletAddress: string;
  agentAddress?: string;
  builderCode?: string;
  chainId?: number;
}

export interface StreamCallbacks {
  /** كل جزء من النص */
  onChunk: (chunk: string) => void;
  /** عند اكتمال البث */
  onComplete?: (result: ChatResult) => void;
  /** عند حدوث خطأ */
  onError?: (error: Error) => void;
}

// ═══════════════════════════════════════════
// VirtualsManager Class
// ═══════════════════════════════════════════

/**
 * مدير خدمات Virtuals Protocol
 * 
 * @class VirtualsManager
 * @description يدير التواصل مع خدمات Virtuals للحوسبة والـ ACP
 * 
 * @example
 * ```typescript
 * const virtuals = new VirtualsManager({ apiKey: 'key_...' });
 * 
 * // محادثة
 * const result = await virtuals.chat({
 *   model: 'virtuals-llama-3',
 *   messages: [{ role: 'user', content: 'مرحباً' }]
 * });
 * 
 * // بث مباشر
 * await virtuals.chatStream(
 *   { model: 'virtuals-llama-3', messages: [...] },
 *   (chunk) => console.log(chunk)
 * );
 * ```
 */
export class VirtualsManager {
  private apiKey: string;
  private computeUrl: string;
  private acpUrl: string;
  private timeout: number;
  private streamTimeout: number;

  constructor(config: VirtualsConfig = {}) {
    this.apiKey = this.resolveApiKey(config);
    this.computeUrl = config.computeUrl || VIRTUALS_COMPUTE_URL;
    this.acpUrl = config.acpUrl || VIRTUALS_ACP_URL;
    this.timeout = config.timeout || DEFAULTS.TIMEOUT;
    this.streamTimeout = config.streamTimeout || DEFAULTS.STREAM_TIMEOUT;
  }

  /**
   * حل مفتاح API من المصادر المتاحة
   */
  private resolveApiKey(config: VirtualsConfig): string {
    return (
      config.apiKey ||
      process.env.VIRTUALS_API_KEY ||
      process.env.VIRTUAL_API_KEY ||
      process.env.AI_API_KEY ||
      ''
    );
  }

  /**
   * تعيين مفتاح API جديد
   */
  setApiKey(key: string): void {
    if (!key) throw new KubernaError('مفتاح API مطلوب', 'VALIDATION_ERROR', 400);
    this.apiKey = key;
  }

  /**
   * التحقق من وجود مفتاح API
   */
  private ensureApiKey(): void {
    if (!this.apiKey) {
      throw new KubernaError(
        'مفتاح Virtuals API مطلوب. قم بتعيينه عبر config أو VIRTUAL_API_KEY أو AI_API_KEY',
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
   * تنفيذ طلب HTTP للـ Compute API
   */
  private async computeRequest<T>(
    path: string,
    data?: Record<string, unknown>,
    method: 'GET' | 'POST' = 'POST'
  ): Promise<T> {
    const url = `${this.computeUrl}${path}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url, {
        method,
        headers: this.getHeaders(),
        body: data ? JSON.stringify(data) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage = `Virtuals compute request failed: ${response.status}`;
        try {
          const errorBody = await response.json() as { error?: { message?: string } };
          errorMessage = errorBody.error?.message || errorMessage;
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
          `انتهت مهلة الطلب بعد ${this.timeout}ms`,
          'TIMEOUT_ERROR',
          408
        );
      }

      throw new KubernaError(
        `فشل طلب Virtuals: ${(error as Error).message}`,
        'NETWORK_ERROR',
        503
      );
    }
  }

  /**
   * تنفيذ طلب ACP API
   */
  private async acpRequest<T>(
    path: string,
    options: {
      method?: 'GET' | 'POST';
      body?: unknown;
      params?: Record<string, string>;
    } = {}
  ): Promise<T> {
    const url = new URL(`${this.acpUrl}${path}`);
    
    if (options.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(url.toString(), {
        method: options.method || 'GET',
        headers: this.getHeaders(),
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new KubernaError(
          `ACP request failed: ${response.status}`,
          'API_ERROR',
          response.status
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof KubernaError) throw error;

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new KubernaError('انتهت مهلة طلب ACP', 'TIMEOUT_ERROR', 408);
      }

      throw new KubernaError(
        `فشل طلب ACP: ${(error as Error).message}`,
        'NETWORK_ERROR',
        503
      );
    }
  }

  // ═══════════════════════════════════════════
  // Models
  // ═══════════════════════════════════════════

  /**
   * الحصول على قائمة النماذج المتاحة
   * 
   * @returns قائمة النماذج مع التسعير
   * 
   * @example
   * ```typescript
   * const models = await virtuals.listModels();
   * models.forEach(m => console.log(`${m.name}: ${m.pricing.input}$/token`));
   * ```
   */
  async listModels(): Promise<VirtualsModel[]> {
    const response = await this.computeRequest<{ data: VirtualsModel[] }>(
      '/models',
      undefined,
      'GET'
    );
    return response.data;
  }

  // ═══════════════════════════════════════════
  // Chat
  // ═══════════════════════════════════════════

  /**
   * إجراء محادثة مع نموذج Virtuals
   * 
   * @param params - إعدادات المحادثة
   * @returns نتيجة المحادثة
   * 
   * @example
   * ```typescript
   * const result = await virtuals.chat({
   *   model: 'virtuals-llama-3',
   *   messages: [
   *     { role: 'system', content: 'أنت مساعد مفيد' },
   *     { role: 'user', content: 'ما هو الإيثيريوم؟' }
   *   ],
   *   temperature: 0.7,
   *   maxTokens: 500
   * });
   * 
   * console.log(result.content);
   * console.log(`التكلفة: ${result.cost}$`);
   * ```
   */
  async chat(params: ChatParams): Promise<ChatResult> {
    // التحقق من المدخلات
    if (!params.model) {
      throw new KubernaError('اسم النموذج مطلوب', 'VALIDATION_ERROR', 400);
    }
    if (!params.messages || params.messages.length === 0) {
      throw new KubernaError('الرسائل مطلوبة', 'VALIDATION_ERROR', 400);
    }

    const response = await this.computeRequest<{
      choices: Array<{ message: { content: string } }>;
      model: string;
      usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
      };
      cost?: { usd?: number };
    }>('/chat/completions', {
      model: params.model,
      messages: params.messages,
      temperature: params.temperature ?? DEFAULTS.TEMPERATURE,
      max_tokens: params.maxTokens ?? DEFAULTS.MAX_TOKENS,
      stop: params.stop,
      seed: params.seed,
    });

    return {
      content: response.choices[0]?.message?.content || '',
      model: response.model,
      usage: {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      },
      cost: response.cost?.usd || 0,
    };
  }

  /**
   * بث مباشر للمحادثة
   * 
   * @param params - إعدادات المحادثة
   * @param onChunk - دالة استقبال كل جزء
   * @returns نتيجة المحادثة النهائية
   * 
   * @example
   * ```typescript
   * const result = await virtuals.chatStream(
   *   { model: 'virtuals-llama-3', messages: [...] },
   *   (chunk) => process.stdout.write(chunk)
   * );
   * ```
   */
  async chatStream(
    params: ChatParams,
    onChunk: (chunk: string) => void,
  ): Promise<ChatResult> {
    return this.chatStreamAdvanced(params, {
      onChunk,
      onError: (error) => { throw error; },
    });
  }

  /**
   * بث مباشر متقدم مع callbacks كاملة
   * 
   * @param params - إعدادات المحادثة
   * @param callbacks - دوال الاستدعاء
   * @returns نتيجة المحادثة النهائية
   */
  async chatStreamAdvanced(
    params: ChatParams,
    callbacks: StreamCallbacks,
  ): Promise<ChatResult> {
    if (!params.model) {
      throw new KubernaError('اسم النموذج مطلوب', 'VALIDATION_ERROR', 400);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.streamTimeout);

    try {
      const response = await fetch(`${this.computeUrl}/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: params.model,
          messages: params.messages,
          temperature: params.temperature ?? DEFAULTS.TEMPERATURE,
          max_tokens: params.maxTokens ?? DEFAULTS.MAX_TOKENS,
          stream: true,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new KubernaError(
          `فشل البث: ${response.status}`,
          'API_ERROR',
          response.status
        );
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new KubernaError('لا يوجد جسم استجابة للبث', 'STREAM_ERROR', 500);
      }

      const decoder = new TextDecoder();
      let fullContent = '';
      let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
      let cost = 0;
      let model = params.model;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter((l) => l.startsWith('data: '));

        for (const line of lines) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullContent += delta;
              callbacks.onChunk(delta);
            }
            if (parsed.model) model = parsed.model;
            if (parsed.usage) {
              usage = {
                promptTokens: parsed.usage.prompt_tokens || 0,
                completionTokens: parsed.usage.completion_tokens || 0,
                totalTokens: parsed.usage.total_tokens || 0,
              };
            }
            if (parsed.cost?.usd) cost = parsed.cost.usd;
          } catch {
            // تخطي الأسطر غير القابلة للتحليل
          }
        }
      }

      const result: ChatResult = { content: fullContent, model, usage, cost };
      callbacks.onComplete?.(result);
      return result;
    } catch (error) {
      clearTimeout(timeoutId);

      const kubernaError = error instanceof KubernaError
        ? error
        : new KubernaError(
            error instanceof DOMException && error.name === 'AbortError'
              ? 'انتهت مهلة البث'
              : `فشل البث: ${(error as Error).message}`,
            'STREAM_ERROR',
            500
          );

      callbacks.onError?.(kubernaError);
      throw kubernaError;
    }
  }

  // ═══════════════════════════════════════════
  // Balance
  // ═══════════════════════════════════════════

  /**
   * التحقق من رصيد الحوسبة
   * 
   * @returns معلومات الرصيد
   */
  async checkComputeBalance(): Promise<ComputeBalance> {
    const resp = await this.computeRequest<{
      balance: number;
      currency: string;
      auto_top_up?: {
        enabled: boolean;
        amount: number;
        threshold: number;
        preferred_chain: string;
      };
    }>('/compute/balance', undefined, 'GET');

    return {
      balance: resp.balance,
      currency: resp.currency,
      autoTopUp: resp.auto_top_up
        ? {
            enabled: resp.auto_top_up.enabled,
            amount: resp.auto_top_up.amount,
            threshold: resp.auto_top_up.threshold,
            chain: resp.auto_top_up.preferred_chain,
          }
        : { enabled: false, amount: 0, threshold: 0, chain: '' },
    };
  }

  // ═══════════════════════════════════════════
  // ACP Offerings
  // ═══════════════════════════════════════════

  /**
   * تسجيل عرض ACP جديد
   * 
   * @param offering - بيانات العرض
   * @returns العرض المسجل
   */
  async registerACPOffering(
    offering: Omit<ACPOffering, 'id' | 'active' | 'providerAddress'>
  ): Promise<ACPOffering> {
    if (!offering.name) {
      throw new KubernaError('اسم العرض مطلوب', 'VALIDATION_ERROR', 400);
    }

    return this.acpRequest<ACPOffering>('/api/v1/offerings', {
      method: 'POST',
      body: offering,
    });
  }

  /**
   * الحصول على قائمة عروض ACP
   * 
   * @returns قائمة العروض المتاحة
   */
  async listACPOfferings(): Promise<ACPOffering[]> {
    const response = await this.acpRequest<{ offerings: ACPOffering[] }>(
      '/api/v1/offerings',
      { method: 'GET' }
    );
    return response.offerings;
  }

  // ═══════════════════════════════════════════
  // ACP Jobs
  // ═══════════════════════════════════════════

  /**
   * الحصول على قائمة وظائف ACP
   * 
   * @returns قائمة الوظائف
   */
  async getACPJobs(): Promise<ACPJob[]> {
    const response = await this.acpRequest<{ jobs: ACPJob[] }>(
      '/api/v1/jobs',
      { method: 'GET' }
    );
    return response.jobs;
  }

  /**
   * الحصول على تفاصيل وظيفة ACP محددة
   * 
   * @param jobId - معرف الوظيفة
   * @param chainId - معرف السلسلة
   * @returns تفاصيل الوظيفة
   */
  async getACPJob(jobId: number, chainId: number): Promise<ACPJob> {
    if (!jobId || jobId <= 0) {
      throw new KubernaError('معرف الوظيفة غير صالح', 'VALIDATION_ERROR', 400);
    }

    return this.acpRequest<ACPJob>(`/api/v1/jobs/${jobId}`, {
      method: 'GET',
      params: { chainId: String(chainId) },
    });
  }
}
