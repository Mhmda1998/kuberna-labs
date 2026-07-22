import { KubernaError } from './errors.js';

// ═══════════════════════════════════════════
// TEE Technology Types
// ═══════════════════════════════════════════

/** تقنيات TEE المدعومة */
export type TeeTechnology = 'sgx' | 'tdx' | 'sev-snp' | 'nitro' | 'phala';

/** أسماء تقنيات TEE للعرض */
export const TEE_TECHNOLOGY_LABELS: Record<TeeTechnology, string> = {
  'sgx': 'Intel SGX',
  'tdx': 'Intel TDX',
  'sev-snp': 'AMD SEV-SNP',
  'nitro': 'AWS Nitro Enclaves',
  'phala': 'Phala Network',
};

// ═══════════════════════════════════════════
// Witness Types
// ═══════════════════════════════════════════

export interface SgxWitness {
  technology: 'sgx';
  /** اقتباس SGX */
  quote: string;
  /** بيانات البيئة المحفوظة */
  enclaveHeldData: string;
  /** قياس البيئة */
  mrEnclave: string;
  /** قياس الموقع */
  mrSigner: string;
  /** معرف المنتج */
  isvProdId: number;
  /** رقم إصدار الأمان */
  isvSvn: number;
  /** الطابع الزمني */
  timestamp: number;
}

export interface TdxWitness {
  technology: 'tdx';
  /** اقتباس TDX */
  quote: string;
  /** بيانات التقرير */
  reportData: string;
  /** قياس TD */
  mrTd: string;
  /** قياسات RTMR */
  rtmrs: string[];
  /** الطابع الزمني */
  timestamp: number;
}

export interface SevSnpWitness {
  technology: 'sev-snp';
  /** تقرير التوثيق */
  attestation: string;
  /** بيانات التقرير */
  reportData: string;
  /** معرف الشريحة */
  chipId: string;
  /** إصدار المنصة */
  platformVersion: string;
  /** الطابع الزمني */
  timestamp: number;
}

export interface NitroWitness {
  technology: 'nitro';
  /** وثيقة التوثيق */
  document: string;
  /** بيانات التقرير */
  reportData: string;
  /** معرف الوحدة */
  moduleId: string;
  /** الطابع الزمني */
  timestamp: number;
}

export interface PhalaWitness {
  technology: 'phala';
  /** اقتباس Phala */
  quote: string;
  /** الطابع الزمني */
  timestamp: number;
  /** بيانات وقت التشغيل */
  runtimeData: string;
}

/** شهادة التوثيق الموحدة */
export type AttestationWitness =
  | SgxWitness
  | TdxWitness
  | SevSnpWitness
  | NitroWitness
  | PhalaWitness;

// ═══════════════════════════════════════════
// Binding Types
// ═══════════════════════════════════════════

export interface KeyBinding {
  /** خوارزمية المفتاح */
  algorithm: 'ed25519' | 'ecdsa' | 'raw';
  /** المفتاح العام */
  publicKey: string;
  /** موضوع الربط */
  subject: string;
}

export interface IntentBinding {
  /** تجزئة النية */
  intentHash: string;
  /** بيانات النية (اختياري) */
  intentData?: string;
}

export interface WitnessBinding {
  /** ربط المفتاح */
  key: KeyBinding;
  /** ربط النية (اختياري) */
  intent?: IntentBinding;
}

// ═══════════════════════════════════════════
// Attestation Envelope
// ═══════════════════════════════════════════

export interface AttestationEnvelope {
  /** شهادة التوثيق */
  witness: AttestationWitness;
  /** بيانات الربط */
  binding: WitnessBinding;
  /** التوقيع على الظرف */
  signature: string;
  /** إصدار الظرف */
  version?: string;
  /** وقت الإنشاء */
  createdAt?: string;
}

// ═══════════════════════════════════════════
// Verifier Types
// ═══════════════════════════════════════════

export interface VerificationReceipt {
  /** حالة التحقق */
  verified: boolean;
  /** الطابع الزمني */
  timestamp: number;
  /** القياسات المستخرجة */
  measurements: Record<string, string>;
  /** قياس البيئة */
  mrEnclave?: string;
  /** قياس الموقع */
  mrSigner?: string;
  /** معرف المنتج */
  isvProdId?: string;
  /** رقم إصدار الأمان */
  isvSvn?: string;
  /** المنصة */
  platform?: string;
  /** معرف الشريحة */
  chipId?: string;
  /** رسالة خطأ */
  error?: string;
  /** مدة التحقق بالمللي ثانية */
  duration?: number;
  /** معرف المحقق */
  verifierId?: string;
}

export interface AttestationVerifier<T extends AttestationWitness = AttestationWitness> {
  /** التقنية المدعومة */
  readonly technology: T['technology'];
  /** اسم المحقق */
  readonly name: string;
  /** التحقق من الشهادة */
  verify(witness: T, binding: WitnessBinding): Promise<VerificationReceipt>;
}

// ═══════════════════════════════════════════
// Verifier Registry
// ═══════════════════════════════════════════

export interface VerifierRegistry {
  /** تسجيل محقق جديد */
  register(verifier: AttestationVerifier): void;
  /** إلغاء تسجيل محقق */
  unregister(technology: string): boolean;
  /** الحصول على محقق */
  get(technology: string): AttestationVerifier | undefined;
  /** الحصول على جميع المحققين */
  getAll(): AttestationVerifier[];
  /** التحقق من ظرف توثيق */
  verify(envelope: AttestationEnvelope): Promise<VerificationReceipt>;
}

/**
 * إنشاء سجل المحققين
 * 
 * @returns سجل محققين جديد
 * 
 * @example
 * ```typescript
 * const registry = createVerifierRegistry();
 * 
 * // تسجيل محقق SGX
 * registry.register({
 *   technology: 'sgx',
 *   name: 'SGX Verifier',
 *   verify: async (witness, binding) => ({
 *     verified: true,
 *     timestamp: Date.now(),
 *     measurements: { mrEnclave: witness.mrEnclave }
 *   })
 * });
 * 
 * // التحقق من ظرف
 * const receipt = await registry.verify(envelope);
 * ```
 */
export function createVerifierRegistry(): VerifierRegistry {
  const verifiers = new Map<string, AttestationVerifier>();

  return {
    register(verifier: AttestationVerifier): void {
      if (!verifier.technology) {
        throw new KubernaError('يجب تحديد تقنية المحقق', 'VALIDATION_ERROR', 400);
      }
      verifiers.set(verifier.technology, verifier);
    },

    unregister(technology: string): boolean {
      return verifiers.delete(technology);
    },

    get(technology: string): AttestationVerifier | undefined {
      return verifiers.get(technology);
    },

    getAll(): AttestationVerifier[] {
      return Array.from(verifiers.values());
    },

    async verify(envelope: AttestationEnvelope): Promise<VerificationReceipt> {
      // التحقق من صحة الظرف
      if (!envelope.witness) {
        return {
          verified: false,
          timestamp: Date.now(),
          measurements: {},
          error: 'الظرف لا يحتوي على شهادة توثيق',
        };
      }

      if (!envelope.binding) {
        return {
          verified: false,
          timestamp: Date.now(),
          measurements: {},
          error: 'الظرف لا يحتوي على بيانات ربط',
        };
      }

      const verifier = verifiers.get(envelope.witness.technology);

      if (!verifier) {
        return {
          verified: false,
          timestamp: Date.now(),
          measurements: {},
          error: `لا يوجد محقق مسجل للتقنية: ${envelope.witness.technology}`,
        };
      }

      try {
        const startTime = Date.now();
        const receipt = await verifier.verify(envelope.witness, envelope.binding);
        receipt.duration = Date.now() - startTime;
        receipt.verifierId = verifier.name;
        return receipt;
      } catch (error) {
        return {
          verified: false,
          timestamp: Date.now(),
          measurements: {},
          error: `فشل التحقق: ${(error as Error).message}`,
        };
      }
    },
  };
}

// ═══════════════════════════════════════════
// Confirmation Policy
// ═══════════════════════════════════════════

export interface ConfirmationPolicy {
  /** هل التوثيق مطلوب */
  requireAttestation: boolean;
  /** التقنيات المطلوبة */
  requiredTechnologies?: TeeTechnology[];
  /** القياسات المسموحة */
  allowedMeasurements?: Record<string, string[]>;
  /** السماح بالتوثيق الذاتي */
  allowSelfAttestation: boolean;
  /** الحد الأدنى من المحققين */
  minimumVerifiers?: number;
  /** مهلة التحقق بالمللي ثانية */
  verificationTimeout?: number;
}

export interface ConfirmationRequest {
  /** ظرف التوثيق */
  envelope: AttestationEnvelope;
  /** سياسة التأكيد */
  policy: ConfirmationPolicy;
  /** الإجراء المطلوب */
  action: string;
  /** حمولة البيانات */
  payload: Record<string, unknown>;
  /** معرف الطلب */
  requestId?: string;
}

export interface ConfirmationResponse {
  /** هل تمت الموافقة */
  approved: boolean;
  /** إيصال التحقق */
  verificationReceipt?: VerificationReceipt;
  /** سبب الرفض */
  rejectionReason?: string;
  /** معرف الطلب */
  requestId?: string;
  /** وقت المعالجة */
  processingTime?: number;
}

/**
 * تقييم طلب التأكيد
 * 
 * @param request - طلب التأكيد
 * @param receipt - إيصال التحقق
 * @returns استجابة التأكيد
 * 
 * @example
 * ```typescript
 * const response = evaluateConfirmation(request, receipt);
 * 
 * if (response.approved) {
 *   console.log('تمت الموافقة على الإجراء');
 * } else {
 *   console.log('مرفوض:', response.rejectionReason);
 * }
 * ```
 */
export function evaluateConfirmation(
  request: ConfirmationRequest,
  receipt: VerificationReceipt,
): ConfirmationResponse {
  const startTime = Date.now();
  const { policy, envelope } = request;

  // 1. التحقق من التوثيق
  if (policy.requireAttestation && !receipt.verified) {
    return {
      approved: false,
      verificationReceipt: receipt,
      rejectionReason: 'فشل التحقق من التوثيق',
      requestId: request.requestId,
      processingTime: Date.now() - startTime,
    };
  }

  // 2. التحقق من التقنيات المطلوبة
  if (policy.requiredTechnologies && policy.requiredTechnologies.length > 0) {
    const witnessTech = envelope.witness.technology as TeeTechnology;
    if (!policy.requiredTechnologies.includes(witnessTech)) {
      return {
        approved: false,
        verificationReceipt: receipt,
        rejectionReason: `التقنية المطلوبة غير متوفرة: ${witnessTech}. المطلوب: ${policy.requiredTechnologies.join(', ')}`,
        requestId: request.requestId,
        processingTime: Date.now() - startTime,
      };
    }
  }

  // 3. التحقق من القياسات المسموحة
  if (policy.allowedMeasurements && !policy.allowSelfAttestation) {
    const allowed = policy.allowedMeasurements;
    const measurements = receipt.measurements;

    for (const [key, value] of Object.entries(measurements)) {
      if (Object.prototype.hasOwnProperty.call(allowed, key)) {
        const allowedValues = allowed[key];
        if (!allowedValues.includes(value)) {
          return {
            approved: false,
            verificationReceipt: receipt,
            rejectionReason: `القياس ${key}=${value} غير موجود في القائمة المسموحة`,
            requestId: request.requestId,
            processingTime: Date.now() - startTime,
          };
        }
      }
    }
  }

  // 4. التحقق من التوقيع
  if (!envelope.signature || envelope.signature.length === 0) {
    return {
      approved: false,
      verificationReceipt: receipt,
      rejectionReason: 'التوقيع مفقود من الظرف',
      requestId: request.requestId,
      processingTime: Date.now() - startTime,
    };
  }

  // 5. تم اجتياز جميع التحققات
  return {
    approved: true,
    verificationReceipt: receipt,
    requestId: request.requestId,
    processingTime: Date.now() - startTime,
  };
}

// ═══════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════

/**
 * التحقق من صلاحية ظرف التوثيق
 * 
 * @param envelope - ظرف التوثيق
 * @returns true إذا كان الظرف صالحاً
 */
export function isValidEnvelope(envelope: AttestationEnvelope): boolean {
  return !!(
    envelope &&
    envelope.witness &&
    envelope.witness.technology &&
    envelope.binding &&
    envelope.binding.key &&
    envelope.signature
  );
}

/**
 * الحصول على اسم التقنية للعرض
 * 
 * @param technology - التقنية
 * @returns اسم العرض
 */
export function getTechnologyLabel(technology: TeeTechnology): string {
  return TEE_TECHNOLOGY_LABELS[technology] || technology;
}

/**
 * إنشاء سياسة تأكيد افتراضية
 * 
 * @returns سياسة تأكيد
 */
export function createDefaultPolicy(): ConfirmationPolicy {
  return {
    requireAttestation: true,
    allowSelfAttestation: false,
  };
}
