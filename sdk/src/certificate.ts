import { KubernaSDK } from './index.js';
import { KubernaError } from './errors.js';

// ═══════════════════════════════════════════
// Types
// ═══════════════════════════════════════════

export interface CertificateConfig {
  /** السلسلة الافتراضية للنشر */
  defaultChain?: string;
  /** مهلة الطلب */
  timeout?: number;
}

export interface MintCertificateParams {
  /** عنوان المستلم */
  recipientAddress: string;
  /** معرف الدورة */
  courseId: string;
  /** بيانات وصفية إضافية */
  metadata?: Record<string, unknown>;
  /** السلسلة المستهدفة */
  chain?: string;
  /** عنوان المصدر */
  issuerAddress?: string;
}

export interface Certificate {
  /** معرف الشهادة */
  id: string;
  /** معرف الرمز */
  tokenId: string;
  /** المستلم */
  recipient: string;
  /** معرف الدورة */
  courseId: string;
  /** تجزئة التحقق */
  verificationHash: string;
  /** السلسلة */
  chain: string;
  /** تجزئة المعاملة */
  transactionHash: string;
  /** تاريخ النشر */
  mintedAt: string;
  /** المصدر */
  issuer?: string;
  /** البيانات الوصفية */
  metadata?: Record<string, unknown>;
}

export interface CertificateVerification {
  /** هل الشهادة صالحة */
  valid: boolean;
  /** تفاصيل الشهادة */
  certificate?: Certificate;
  /** المصدر */
  issuer: string;
  /** تاريخ التحقق */
  timestamp: string;
  /** رسالة خطأ */
  error?: string;
}

// ═══════════════════════════════════════════
// CertificateManager Class
// ═══════════════════════════════════════════

/**
 * مدير الشهادات الرقمية على البلوكشين
 * 
 * @class CertificateManager
 * @description إدارة إصدار والتحقق من الشهادات الرقمية
 * 
 * @example
 * ```typescript
 * const sdk = new KubernaSDK({ apiKey: '...' });
 * const certs = new CertificateManager(sdk);
 * 
 * // إصدار شهادة
 * const cert = await certs.mint({
 *   recipientAddress: '0x...',
 *   courseId: 'course-123',
 *   metadata: { grade: 'A', completedAt: '2024-01-01' }
 * });
 * 
 * // التحقق من شهادة
 * const verification = await certs.verify(cert.id);
 * console.log(verification.valid ? 'صالحة' : 'غير صالحة');
 * ```
 */
export class CertificateManager {
  private config: CertificateConfig;

  constructor(
    private sdk: KubernaSDK,
    config?: CertificateConfig
  ) {
    this.config = {
      defaultChain: 'ethereum',
      timeout: 30000,
      ...config,
    };
  }

  // ═══════════════════════════════════════════
  // Validation
  // ═══════════════════════════════════════════

  /**
   * التحقق من صحة عنوان المستلم
   */
  private validateAddress(address: string): void {
    if (!address || address.trim().length === 0) {
      throw new KubernaError('عنوان المستلم مطلوب', 'VALIDATION_ERROR', 400);
    }
    if (!address.startsWith('0x') || address.length !== 42) {
      throw new KubernaError('عنوان إيثيريوم غير صالح', 'VALIDATION_ERROR', 400);
    }
  }

  /**
   * التحقق من صحة معرف الشهادة
   */
  private validateId(id: string, name = 'المعرف'): void {
    if (!id || id.trim().length === 0) {
      throw new KubernaError(`${name} مطلوب`, 'VALIDATION_ERROR', 400);
    }
  }

  /**
   * معالجة خطأ موحد
   */
  private handleError(operation: string, error: unknown): never {
    if (error instanceof KubernaError) throw error;
    const message = error instanceof Error ? error.message : 'خطأ غير معروف';
    throw new KubernaError(`فشل ${operation}: ${message}`, 'CERTIFICATE_ERROR', 500);
  }

  // ═══════════════════════════════════════════
  // Certificate Operations
  // ═══════════════════════════════════════════

  /**
   * إصدار شهادة جديدة على البلوكشين
   * 
   * @param params - بيانات الشهادة
   * @returns الشهادة المصدرة
   * 
   * @example
   * ```typescript
   * const cert = await certs.mint({
   *   recipientAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
   *   courseId: 'defi-101',
   *   metadata: { score: 95, completedModules: 12 }
   * });
   * ```
   */
  async mint(params: MintCertificateParams): Promise<Certificate> {
    this.validateAddress(params.recipientAddress);
    this.validateId(params.courseId, 'معرف الدورة');

    try {
      const response = await this.sdk.request({
        method: 'POST',
        path: '/certificates/mint',
        data: {
          recipientAddress: params.recipientAddress,
          courseId: params.courseId,
          metadata: params.metadata || {},
          chain: params.chain || this.config.defaultChain,
          issuerAddress: params.issuerAddress,
        } as unknown as Record<string, unknown>,
      });
      return response.data as Certificate;
    } catch (error) {
      this.handleError('إصدار الشهادة', error);
    }
  }

  /**
   * التحقق من صحة شهادة
   * 
   * @param certificateId - معرف الشهادة
   * @returns نتيجة التحقق
   * 
   * @example
   * ```typescript
   * const result = await certs.verify('cert-123');
   * if (result.valid) {
   *   console.log('الشهادة صالحة');
   *   console.log('المصدر:', result.issuer);
   * }
   * ```
   */
  async verify(certificateId: string): Promise<CertificateVerification> {
    this.validateId(certificateId, 'معرف الشهادة');

    try {
      const response = await this.sdk.request({
        method: 'GET',
        path: `/certificates/${certificateId}/verify`,
      });
      return response.data as CertificateVerification;
    } catch (error) {
      this.handleError('التحقق من الشهادة', error);
    }
  }

  /**
   * الحصول على شهادات مستخدم
   * 
   * @param userId - معرف المستخدم
   * @returns قائمة الشهادات
   */
  async getByUser(userId: string): Promise<Certificate[]> {
    this.validateId(userId, 'معرف المستخدم');

    try {
      const response = await this.sdk.request({
        method: 'GET',
        path: '/certificates',
        params: { userId },
      });
      return (response.data as { certificates: Certificate[] }).certificates;
    } catch (error) {
      this.handleError('الحصول على شهادات المستخدم', error);
    }
  }

  /**
   * الحصول على شهادات دورة
   * 
   * @param courseId - معرف الدورة
   * @returns قائمة الشهادات
   */
  async getByCourse(courseId: string): Promise<Certificate[]> {
    this.validateId(courseId, 'معرف الدورة');

    try {
      const response = await this.sdk.request({
        method: 'GET',
        path: '/certificates',
        params: { courseId },
      });
      return (response.data as { certificates: Certificate[] }).certificates;
    } catch (error) {
      this.handleError('الحصول على شهادات الدورة', error);
    }
  }

  /**
   * التحقق السريع من صحة شهادة
   * 
   * @param certificateId - معرف الشهادة
   * @returns true إذا كانت صالحة
   */
  async isValid(certificateId: string): Promise<boolean> {
    try {
      const result = await this.verify(certificateId);
      return result.valid;
    } catch {
      return false;
    }
  }
}
