import { KubernaSDK } from './index.js';
import { KubernaError } from './errors.js';
import { z } from 'zod';

// ═══════════════════════════════════════════
// Schemas
// ═══════════════════════════════════════════

export const frameworkSchema = z.enum(['ElizaOS', 'LangChain', 'AutoGen', 'Rig']);

export const deploymentTypeSchema = z.enum(['CLOUD', 'TEE', 'LOCAL']);

export const agentStatusSchema = z.enum([
  'draft',
  'building',
  'deploying',
  'running',
  'stopped',
  'failed',
  'destroyed',
]);

export const createAgentSchema = z.object({
  name: z.string().min(3).max(64),
  description: z.string().max(500).optional(),
  framework: frameworkSchema,
  model: z.string().optional(),
  config: z.record(z.unknown()).optional(),
  tools: z.array(z.string()).optional(),
  codeRepo: z.string().url().optional(),
  deploymentType: deploymentTypeSchema.optional(),
});

// ═══════════════════════════════════════════
// Types
// ═══════════════════════════════════════════

export type Framework = z.infer<typeof frameworkSchema>;
export type DeploymentType = z.infer<typeof deploymentTypeSchema>;
export type AgentStatus = z.infer<typeof agentStatusSchema>;

export interface AgentConfig {
  /** النموذج الافتراضي */
  defaultModel?: string;
  /** نوع النشر الافتراضي */
  defaultDeploymentType?: DeploymentType;
  /** مهلة النشر */
  deployTimeout?: number;
}

export interface CreateAgentParams {
  /** اسم الوكيل */
  name: string;
  /** وصف الوكيل */
  description?: string;
  /** إطار العمل */
  framework: Framework;
  /** النموذج المستخدم */
  model?: string;
  /** إعدادات إضافية */
  config?: Record<string, unknown>;
  /** الأدوات المتاحة */
  tools?: string[];
  /** مستودع الكود */
  codeRepo?: string;
  /** نوع النشر */
  deploymentType?: DeploymentType;
  /** وسوم */
  tags?: string[];
  /** متغيرات البيئة */
  environment?: Record<string, string>;
}

export interface Agent {
  /** معرف الوكيل */
  id: string;
  /** اسم الوكيل */
  name: string;
  /** حالة الوكيل */
  status: AgentStatus;
  /** رابط النشر */
  deploymentUrl?: string;
  /** إطار العمل */
  framework?: Framework;
  /** النموذج */
  model?: string;
  /** وصف */
  description?: string;
  /** تاريخ الإنشاء */
  createdAt?: string;
  /** تاريخ التحديث */
  updatedAt?: string;
  /** حالة TEE */
  teeEnabled?: boolean;
  /** تقرير التوثيق */
  attestationReport?: string;
}

export interface AgentListOptions {
  /** تصفية حسب الحالة */
  status?: AgentStatus;
  /** تصفية حسب إطار العمل */
  framework?: Framework;
  /** عدد النتائج */
  limit?: number;
  /** مؤشر البداية */
  offset?: number;
}

export interface DeployOptions {
  /** نوع التنفيذ الآمن */
  secureExecution?: 'TEE' | 'NONE';
  /** الذاكرة المخصصة */
  memory?: number;
  /** المعالجات المخصصة */
  cpu?: number;
  /** متغيرات البيئة */
  environment?: Record<string, string>;
}

// ═══════════════════════════════════════════
// AgentManager Class
// ═══════════════════════════════════════════

/**
 * مدير الوكلاء - إنشاء وإدارة وكلاء AI
 * 
 * @class AgentManager
 * @description إدارة دورة حياة الوكلاء من الإنشاء حتى التدمير
 * 
 * @example
 * ```typescript
 * const sdk = new KubernaSDK({ apiKey: '...' });
 * const agents = new AgentManager(sdk);
 * 
 * // إنشاء وكيل
 * const agent = await agents.create({
 *   name: 'محلل السوق',
 *   framework: 'ElizaOS',
 *   description: 'وكيل لتحليل أسواق العملات الرقمية',
 *   tools: ['price-feed', 'news-api'],
 *   deploymentType: 'TEE'
 * });
 * 
 * // نشر الوكيل
 * await agents.deploy(agent.id, { secureExecution: 'TEE' });
 * 
 * // تشغيل الوكيل
 * await agents.start(agent.id);
 * ```
 */
export class AgentManager {
  private config: AgentConfig;

  constructor(
    private sdk: KubernaSDK,
    config?: AgentConfig
  ) {
    this.config = {
      defaultModel: 'gpt-4',
      defaultDeploymentType: 'CLOUD',
      deployTimeout: 300000, // 5 دقائق
      ...config,
    };
  }

  // ═══════════════════════════════════════════
  // Validation
  // ═══════════════════════════════════════════

  private validateAgentId(id: string): void {
    if (!id || id.trim().length === 0) {
      throw new KubernaError('معرف الوكيل مطلوب', 'VALIDATION_ERROR', 400);
    }
  }

  private handleError(operation: string, error: unknown): never {
    if (error instanceof KubernaError) throw error;
    if (error instanceof z.ZodError) {
      throw new KubernaError(
        `بيانات غير صالحة: ${error.errors.map(e => e.message).join(', ')}`,
        'VALIDATION_ERROR',
        400
      );
    }
    const message = error instanceof Error ? error.message : 'خطأ غير معروف';
    throw new KubernaError(`فشل ${operation}: ${message}`, 'AGENT_ERROR', 500);
  }

  // ═══════════════════════════════════════════
  // CRUD Operations
  // ═══════════════════════════════════════════

  /**
   * إنشاء وكيل جديد
   * 
   * @param params - بيانات الوكيل
   * @returns الوكيل المنشأ
   * 
   * @example
   * ```typescript
   * const agent = await agents.create({
   *   name: 'محلل DeFi',
   *   framework: 'LangChain',
   *   description: 'يحلل فرص DeFi',
   *   tools: ['defillama', '1inch'],
   *   deploymentType: 'TEE'
   * });
   * ```
   */
  async create(params: CreateAgentParams): Promise<Agent> {
    try {
      // التحقق من صحة البيانات باستخدام zod
      createAgentSchema.parse(params);
    } catch (error) {
      this.handleError('التحقق من بيانات الوكيل', error);
    }

    try {
      const response = await this.sdk.request({
        method: 'POST',
        path: '/agents',
        data: {
          ...params,
          deploymentType: params.deploymentType || this.config.defaultDeploymentType,
          model: params.model || this.config.defaultModel,
        } as unknown as Record<string, unknown>,
      });
      return response.data as Agent;
    } catch (error) {
      this.handleError('إنشاء الوكيل', error);
    }
  }

  /**
   * الحصول على وكيل محدد
   * 
   * @param id - معرف الوكيل
   * @returns الوكيل
   */
  async get(id: string): Promise<Agent> {
    this.validateAgentId(id);

    try {
      const response = await this.sdk.request({
        method: 'GET',
        path: `/agents/${id}`,
      });
      return response.data as Agent;
    } catch (error) {
      this.handleError('الحصول على الوكيل', error);
    }
  }

  /**
   * الحصول على قائمة الوكلاء
   * 
   * @param options - خيارات التصفية
   * @returns قائمة الوكلاء
   */
  async list(options?: AgentListOptions): Promise<Agent[]> {
    try {
      const response = await this.sdk.request({
        method: 'GET',
        path: '/agents',
        params: {
          ...(options?.status && { status: options.status }),
          ...(options?.framework && { framework: options.framework }),
          ...(options?.limit && { limit: options.limit }),
          ...(options?.offset && { offset: options.offset }),
        },
      });
      return (response.data as { agents: Agent[] }).agents;
    } catch (error) {
      this.handleError('قائمة الوكلاء', error);
    }
  }

  /**
   * تحديث وكيل
   * 
   * @param id - معرف الوكيل
   * @param updates - التحديثات
   * @returns الوكيل المحدث
   */
  async update(
    id: string,
    updates: Partial<Pick<CreateAgentParams, 'name' | 'description' | 'config' | 'tools'>>
  ): Promise<Agent> {
    this.validateAgentId(id);

    try {
      const response = await this.sdk.request({
        method: 'PUT',
        path: `/agents/${id}`,
        data: updates as unknown as Record<string, unknown>,
      });
      return response.data as Agent;
    } catch (error) {
      this.handleError('تحديث الوكيل', error);
    }
  }

  /**
   * حذف وكيل
   * 
   * @param id - معرف الوكيل
   */
  async delete(id: string): Promise<void> {
    this.validateAgentId(id);

    try {
      await this.sdk.request({
        method: 'DELETE',
        path: `/agents/${id}`,
      });
    } catch (error) {
      this.handleError('حذف الوكيل', error);
    }
  }

  // ═══════════════════════════════════════════
  // Lifecycle Operations
  // ═══════════════════════════════════════════

  /**
   * نشر الوكيل
   * 
   * @param id - معرف الوكيل
   * @param params - خيارات النشر
   * @returns الوكيل بعد النشر
   */
  async deploy(id: string, params: DeployOptions = {}): Promise<Agent> {
    this.validateAgentId(id);

    try {
      const endpoint = params.secureExecution === 'TEE'
        ? `/agents/${id}/deploy-tee`
        : `/agents/${id}/deploy`;

      const response = await this.sdk.request({
        method: 'POST',
        path: endpoint,
        data: {
          memory: params.memory,
          cpu: params.cpu,
          environment: params.environment,
        } as unknown as Record<string, unknown>,
      });
      return response.data as Agent;
    } catch (error) {
      this.handleError('نشر الوكيل', error);
    }
  }

  /**
   * تشغيل الوكيل
   * 
   * @param id - معرف الوكيل
   * @returns الوكيل بعد التشغيل
   */
  async start(id: string): Promise<Agent> {
    this.validateAgentId(id);

    try {
      const response = await this.sdk.request({
        method: 'POST',
        path: `/agents/${id}/start`,
        data: {},
      });
      return response.data as Agent;
    } catch (error) {
      this.handleError('تشغيل الوكيل', error);
    }
  }

  /**
   * إيقاف الوكيل
   * 
   * @param id - معرف الوكيل
   * @returns الوكيل بعد الإيقاف
   */
  async stop(id: string): Promise<Agent> {
    this.validateAgentId(id);

    try {
      const response = await this.sdk.request({
        method: 'POST',
        path: `/agents/${id}/stop`,
        data: {},
      });
      return response.data as Agent;
    } catch (error) {
      this.handleError('إيقاف الوكيل', error);
    }
  }

  /**
   * إعادة تشغيل الوكيل
   * 
   * @param id - معرف الوكيل
   * @returns الوكيل بعد إعادة التشغيل
   */
  async restart(id: string): Promise<Agent> {
    await this.stop(id);
    return this.start(id);
  }

  // ═══════════════════════════════════════════
  // Convenience Methods
  // ═══════════════════════════════════════════

  /**
   * انتظار حتى يصبح الوكيل جاهزاً
   * 
   * @param id - معرف الوكيل
   * @param timeoutMs - المهلة
   * @returns الوكيل الجاهز
   */
  async waitForReady(id: string, timeoutMs?: number): Promise<Agent> {
    this.validateAgentId(id);

    const timeout = timeoutMs || this.config.deployTimeout!;
    const startTime = Date.now();
    const pollInterval = 3000;

    while (Date.now() - startTime < timeout) {
      const agent = await this.get(id);

      if (agent.status === 'running') return agent;
      if (agent.status === 'failed') {
        throw new KubernaError(`فشل الوكيل ${id}`, 'AGENT_FAILED', 500);
      }

      await new Promise(r => setTimeout(r, pollInterval));
    }

    throw new KubernaError(`انتهت مهلة انتظار الوكيل ${id}`, 'TIMEOUT_ERROR', 408);
  }

  /**
   * التحقق مما إذا كان الوكيل موجوداً
   */
  async exists(id: string): Promise<boolean> {
    try {
      await this.get(id);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * الحصول على سجلات الوكيل
   */
  async getLogs(id: string, lines: number = 100): Promise<string[]> {
    this.validateAgentId(id);

    try {
      const response = await this.sdk.request({
        method: 'GET',
        path: `/agents/${id}/logs`,
        params: { lines },
      });
      return (response.data as { logs: string[] }).logs;
    } catch (error) {
      this.handleError('الحصول على سجلات الوكيل', error);
    }
  }
}
