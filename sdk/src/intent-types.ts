import type { StructuredIntent } from './intent.js';
import { KubernaError } from './errors.js';

// ═══════════════════════════════════════════
// ERC-7683: Cross-Chain Intent Standard
// ═══════════════════════════════════════════

/** نوع الضمان */
export type EscrowType = 'create' | 'fulfill' | 'cancel';

/** حالة الطلب */
export type OrderStatus = 'open' | 'filled' | 'cancelled' | 'expired';

/** طلب عبر السلاسل (ERC-7683) */
export interface CrossChainOrder {
  /** رقم غير متكرر */
  nonce: string;
  /** تاريخ الانتهاء */
  deadline: bigint;
  /** عنوان المبادل */
  swapper: string;
  /** عنوان المبادل في الوجهة */
  swapperDest: string;
  /** معرف سلسلة المصدر */
  originChainId: bigint;
  /** البادئ */
  initiator: string;
  /** المرسل */
  sender: string;
  /** المسوّي في المصدر */
  originSettler: string;
  /** رمز المصدر */
  originToken: string;
  /** كمية المصدر */
  originAmount: bigint;
  /** معرف سلسلة الوجهة */
  destinationChainId: bigint;
  /** مهلة التنفيذ */
  fillDeadline: bigint;
  /** المسوّي في الوجهة */
  destinationSettler: string;
  /** رمز الوجهة */
  destinationToken: string;
  /** كمية الوجهة */
  destinationAmount: bigint;
  /** المستلم في الوجهة */
  destinationRecipient: string;
  /** رسالة */
  message: string;
}

/** مخرج */
export interface Output {
  /** الرمز */
  token: string;
  /** الكمية */
  amount: bigint;
  /** المستلم */
  recipient: string;
  /** معرف السلسلة */
  chainId: bigint;
}

/** إيصال المخرج */
export interface OutputReceipt {
  /** المخرج */
  output: Output;
  /** الكمية المنفذة */
  filledAmount: bigint;
}

/** طلب محلول عبر السلاسل */
export interface ResolvedCrossChainOrder {
  nonce: string;
  deadline: bigint;
  swapper: string;
  swapperDest: string;
  originChainId: bigint;
  openDeadline: bigint;
  initiator: string;
  sender: string;
  originSettler: string;
  outputs: Output[];
  outputReceipts: OutputReceipt[];
  fillInstructions: FillInstruction[];
}

/** تعليمات التنفيذ */
export interface FillInstruction {
  /** المسوّي في الوجهة */
  destinationSettler: string;
  /** بيانات المصدر */
  originData: string;
  /** بيانات التنفيذ */
  fillData: string;
}

/** طلب موقع عبر السلاسل */
export interface SignedCrossChainOrder {
  /** الطلب */
  order: CrossChainOrder;
  /** التوقيع */
  signature: string;
  /** الموقّع */
  signer: string;
}

/** طلب تنفيذ */
export interface FillRequest {
  /** الطلب الموقع */
  order: SignedCrossChainOrder;
  /** بيانات التنفيذ */
  fillData: string;
  /** المنفذ */
  filler: string;
}

/** استجابة التنفيذ */
export interface FillResponse {
  /** تجزئة التنفيذ */
  fillHash: string;
  /** الحالة */
  status: OrderStatus;
}

// ═══════════════════════════════════════════
// NEAR Intents Types
// ═══════════════════════════════════════════

/** نوع إجراء NEAR */
export type NearIntentAction =
  | 'token_diff'
  | 'nft_diff'
  | 'ft_transfer'
  | 'native_transfer'
  | 'function_call'
  | 'batch';

/** فرق الرمز */
export interface TokenDiff {
  /** الرمز */
  token: string;
  /** الكمية */
  amount: string;
  /** معرف المستلم */
  receiver_id: string;
}

/** بيانات نية NEAR */
export interface NearIntentData {
  /** فروقات الرموز */
  diff: TokenDiff[];
  /** تاريخ الانتهاء */
  deadline: string;
  /** معرف الموقّع */
  signer_id: string;
  /** رقم غير متكرر */
  nonce: string;
}

/** نية NEAR */
export interface NearIntent {
  /** نوع النية */
  intent: NearIntentAction;
  /** معرف الموقّع */
  signer_id: string;
  /** تاريخ الانتهاء */
  deadline: string;
  /** رقم غير متكرر */
  nonce: string;
  /** بيانات النية */
  data: NearIntentData;
}

/** نية NEAR موقعة */
export interface SignedNearIntent {
  /** النية */
  intent: NearIntent;
  /** التوقيع */
  signature: string;
  /** المفتاح العام */
  public_key: string;
}

/** إثبات نية NEAR */
export interface NearIntentProof {
  /** البيانات الموقعة */
  signed_data: SignedNearIntent;
  /** النتيجة */
  outcome: string;
}

// ═══════════════════════════════════════════
// Kuberna Normalized Intent
// ═══════════════════════════════════════════

/** معيار النية المدعوم */
export type IntentStandard = 'erc-7683' | 'near-intents' | 'kuberna';

/** نية Kuberna الموحدة */
export interface KubernaNormalizedIntent {
  /** المعيار */
  standard: IntentStandard;
  /** الصيغة الأصلية */
  originalFormat: 'erc-7683' | 'near-intents' | 'kuberna';
  /** رقم غير متكرر */
  nonce: string;
  /** تاريخ الانتهاء */
  deadline: bigint;
  /** المبادل */
  swapper: string;
  /** معرف سلسلة المصدر */
  originChainId: bigint;
  /** معرف سلسلة الوجهة */
  destinationChainId: bigint;
  /** رمز المصدر */
  originToken: string;
  /** كمية المصدر */
  originAmount: bigint;
  /** رمز الوجهة */
  destinationToken: string;
  /** كمية الوجهة */
  destinationAmount: bigint;
  /** المستلم */
  destinationRecipient: string;
  /** الموقّع */
  signer: string;
  /** التوقيع */
  signature?: string;
  /** مهلة التنفيذ */
  fillDeadline: bigint;
  /** الرسالة */
  message: string;
  /** هل التوثيق مطلوب */
  attestationRequired: boolean;
}

/** نتيجة التحقق من النية */
export interface IntentValidationResult {
  /** هل النية صالحة */
  valid: boolean;
  /** قائمة الأخطاء */
  errors: string[];
  /** قائمة التحذيرات */
  warnings: string[];
}

// ═══════════════════════════════════════════
// Chain Registry
// ═══════════════════════════════════════════

/** سجل معرفات السلاسل */
const CHAIN_IDS: Record<string, number> = {
  // Ethereum
  'ethereum': 1,
  'ethereum-mainnet': 1,
  'mainnet': 1,
  'sepolia': 11155111,
  'holesky': 17000,
  
  // L2s
  'base': 8453,
  'base-sepolia': 84532,
  'optimism': 10,
  'op-sepolia': 11155420,
  'arbitrum': 42161,
  'arbitrum-sepolia': 421614,
  'arbitrum-nova': 42170,
  
  // Sidechains
  'polygon': 137,
  'polygon-amoy': 80002,
  'avalanche': 43114,
  'avalanche-fuji': 43113,
  'bsc': 56,
  'bsc-testnet': 97,
  'gnosis': 100,
  'gnosis-chiado': 10200,
  
  // Non-EVM
  'near': 0,
  'near-testnet': 0,
  'solana': 0,
  'solana-devnet': 0,
} as const;

// ═══════════════════════════════════════════
// Normalization Functions
// ═══════════════════════════════════════════

/**
 * تحويل طلب ERC-7683 إلى نية Kuberna الموحدة
 * 
 * @param order - طلب ERC-7683
 * @param signature - التوقيع (اختياري)
 * @param signer - الموقّع (اختياري)
 * @returns نية موحدة
 * 
 * @example
 * ```typescript
 * const normalized = normalizeErc7683(order, signature, signer);
 * console.log(normalized.standard); // 'erc-7683'
 * ```
 */
export function normalizeErc7683(
  order: CrossChainOrder,
  signature?: string,
  signer?: string
): KubernaNormalizedIntent {
  if (!order) {
    throw new KubernaError('الطلب مطلوب', 'VALIDATION_ERROR', 400);
  }

  return {
    standard: 'erc-7683',
    originalFormat: 'erc-7683',
    nonce: order.nonce,
    deadline: order.deadline,
    swapper: order.swapper,
    originChainId: order.originChainId,
    destinationChainId: order.destinationChainId,
    originToken: order.originToken,
    originAmount: order.originAmount,
    destinationToken: order.destinationToken,
    destinationAmount: order.destinationAmount,
    destinationRecipient: order.destinationRecipient,
    signer: signer ?? order.swapper,
    signature,
    fillDeadline: order.fillDeadline,
    message: order.message,
    attestationRequired: false,
  };
}

/**
 * تحويل نية NEAR إلى نية Kuberna الموحدة
 * 
 * @param intent - نية NEAR
 * @param signature - التوقيع (اختياري)
 * @param publicKey - المفتاح العام (اختياري)
 * @returns نية موحدة
 * 
 * @example
 * ```typescript
 * const normalized = normalizeNearIntent(nearIntent, signature, publicKey);
 * ```
 */
export function normalizeNearIntent(
  intent: NearIntent,
  signature?: string,
  publicKey?: string
): KubernaNormalizedIntent {
  if (!intent) {
    throw new KubernaError('النية مطلوبة', 'VALIDATION_ERROR', 400);
  }

  if (!intent.data?.diff || intent.data.diff.length === 0) {
    throw new KubernaError('بيانات الفرق مطلوبة في نية NEAR', 'VALIDATION_ERROR', 400);
  }

  const diff = intent.data.diff[0];
  const isTokenDiff = intent.intent === 'token_diff';

  return {
    standard: 'near-intents',
    originalFormat: 'near-intents',
    nonce: intent.nonce,
    deadline: BigInt(intent.deadline),
    swapper: intent.signer_id,
    originChainId: BigInt(0), // NEAR chain
    destinationChainId: BigInt(0),
    originToken: isTokenDiff ? diff.token : '',
    originAmount: isTokenDiff ? parseAmountSafe(diff.amount) : BigInt(0),
    destinationToken: isTokenDiff ? diff.token : '',
    destinationAmount: isTokenDiff ? parseAmountSafe(diff.amount) : BigInt(0),
    destinationRecipient: isTokenDiff ? diff.receiver_id : '',
    signer: publicKey ?? intent.signer_id,
    signature,
    fillDeadline: BigInt(intent.deadline),
    message: JSON.stringify(intent),
    attestationRequired: false,
  };
}

/**
 * تحويل نية Kuberna المهيكلة إلى نية موحدة
 * 
 * @param intent - نية Kuberna المهيكلة
 * @returns نية موحدة
 */
export function normalizeKubernaIntent(intent: StructuredIntent): KubernaNormalizedIntent {
  if (!intent) {
    throw new KubernaError('النية مطلوبة', 'VALIDATION_ERROR', 400);
  }

  return {
    standard: 'kuberna',
    originalFormat: 'kuberna',
    nonce: intent.id || '',
    deadline: BigInt(intent.timeoutSeconds),
    swapper: '',
    originChainId: BigInt(parseChainId(intent.sourceChain)),
    destinationChainId: BigInt(parseChainId(intent.destChain)),
    originToken: intent.sourceToken,
    originAmount: parseAmountSafe(intent.sourceAmount),
    destinationToken: intent.destToken,
    destinationAmount: parseAmountSafe(intent.minDestAmount),
    destinationRecipient: '',
    signer: '',
    fillDeadline: BigInt(intent.timeoutSeconds),
    message: intent.rawDescription,
    attestationRequired: false,
  };
}

/**
 * تحويل اسم السلسلة إلى معرف رقمي
 * 
 * @param chain - اسم السلسلة
 * @returns معرف السلسلة
 * 
 * @example
 * ```typescript
 * parseChainId('ethereum');  // 1
 * parseChainId('base');      // 8453
 * parseChainId('unknown');   // 0
 * ```
 */
export function parseChainId(chain: string): number {
  if (!chain) return 0;
  return CHAIN_IDS[chain.toLowerCase()] ?? 0;
}

/**
 * تحويل سلسلة نصية إلى bigint بأمان
 * يدعم الأعداد الصحيحة والعشرية (يحول إلى 18 منزلة)
 * 
 * @param amount - المبلغ كسلسلة نصية
 * @returns المبلغ كـ bigint
 * 
 * @example
 * ```typescript
 * parseAmountSafe('100');     // 100000000000000000000n
 * parseAmountSafe('1.5');     // 1500000000000000000n
 * parseAmountSafe('invalid'); // 0n
 * ```
 */
export function parseAmountSafe(amount: string): bigint {
  if (!amount || typeof amount !== 'string') {
    return BigInt(0);
  }

  try {
    return BigInt(amount);
  } catch {
    const parts = amount.split('.');
    const whole = parts[0] || '0';
    const fraction = (parts[1] || '').padEnd(18, '0').slice(0, 18);
    return BigInt(whole + fraction);
  }
}

// ═══════════════════════════════════════════
// Validation
// ═══════════════════════════════════════════

/**
 * التحقق من صحة نية Kuberna الموحدة
 * 
 * @param intent - النية الموحدة
 * @returns نتيجة التحقق
 * 
 * @example
 * ```typescript
 * const result = validateIntent(normalizedIntent);
 * if (!result.valid) {
 *   console.log('أخطاء:', result.errors);
 * }
 * ```
 */
export function validateIntent(intent: KubernaNormalizedIntent): IntentValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!intent) {
    return { valid: false, errors: ['النية مطلوبة'], warnings: [] };
  }

  // التحقق من الكمية
  if (intent.originAmount <= BigInt(0)) {
    errors.push('الكمية الأصلية يجب أن تكون أكبر من صفر');
  }

  // التحقق من المهلة
  if (intent.deadline <= BigInt(0)) {
    errors.push('المهلة يجب أن تكون أكبر من صفر');
  }

  // التحقق من وجود الرمز
  if (!intent.originToken) {
    errors.push('الرمز الأصلي مطلوب');
  }

  // التحقق من رمز الوجهة
  if (!intent.destinationToken) {
    errors.push('رمز الوجهة مطلوب');
  }

  // تحذير: مستلم فارغ
  if (!intent.destinationRecipient) {
    warnings.push('المستلم فارغ - قد تفشل المعاملة');
  }

  // تحذير: نفس السلسلة
  if (intent.originChainId === intent.destinationChainId && intent.originChainId !== BigInt(0)) {
    warnings.push('سلسلة المصدر والوجهة متطابقتان');
  }

  // تحقق إضافي: المهلة منتهية
  if (intent.deadline < BigInt(Math.floor(Date.now() / 1000))) {
    errors.push('المهلة منتهية');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ═══════════════════════════════════════════
// Confirmation Gate
// ═══════════════════════════════════════════

/** سياسة التأكيد */
export interface ConfirmationPolicy {
  /** هل التوثيق مطلوب */
  requireAttestation: boolean;
  /** عدد التأكيدات المطلوبة */
  requiredConfirmations: number;
  /** المهلة بالمللي ثانية */
  timeoutMs: number;
  /** السلاسل المسموحة */
  allowedChains: bigint[];
  /** الرموز المسموحة */
  allowedTokens: string[];
  /** الحد الأقصى للمبلغ */
  maxAmount: bigint;
  /** المستلمون المسموحون */
  allowedRecipients?: string[];
}

/** فحص التأكيد */
export interface ConfirmationCheck {
  /** النية */
  intent: KubernaNormalizedIntent;
  /** السياسة */
  policy: ConfirmationPolicy;
  /** هل تم التحقق من التوثيق */
  attestationVerified: boolean;
  /** الطابع الزمني */
  timestamp: number;
}

/**
 * فحص سياسة التأكيد
 * 
 * @param check - فحص التأكيد
 * @returns نتيجة التحقق
 * 
 * @example
 * ```typescript
 * const result = checkConfirmationPolicy({
 *   intent: normalizedIntent,
 *   policy: myPolicy,
 *   attestationVerified: true,
 *   timestamp: Date.now()
 * });
 * 
 * if (result.valid) {
 *   // تنفيذ العملية
 * }
 * ```
 */
export function checkConfirmationPolicy(check: ConfirmationCheck): IntentValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!check) {
    return { valid: false, errors: ['بيانات الفحص مطلوبة'], warnings: [] };
  }

  if (!check.intent) {
    return { valid: false, errors: ['النية مطلوبة'], warnings: [] };
  }

  if (!check.policy) {
    return { valid: false, errors: ['السياسة مطلوبة'], warnings: [] };
  }

  // 1. التحقق من التوثيق
  if (check.policy.requireAttestation && !check.attestationVerified) {
    errors.push('التوثيق مطلوب لكن لم يتم التحقق منه');
  }

  // 2. التحقق من السلاسل المسموحة
  if (check.policy.allowedChains.length > 0) {
    if (!check.policy.allowedChains.includes(check.intent.originChainId)) {
      errors.push(`سلسلة المصدر ${check.intent.originChainId} غير مسموحة`);
    }
    if (!check.policy.allowedChains.includes(check.intent.destinationChainId)) {
      errors.push(`سلسلة الوجهة ${check.intent.destinationChainId} غير مسموحة`);
    }
  }

  // 3. التحقق من الرموز المسموحة
  if (check.policy.allowedTokens.length > 0) {
    if (check.intent.originToken && !check.policy.allowedTokens.includes(check.intent.originToken)) {
      errors.push(`الرمز ${check.intent.originToken} غير مسموح`);
    }
  }

  // 4. التحقق من الحد الأقصى
  if (check.policy.maxAmount > BigInt(0) && check.intent.originAmount > check.policy.maxAmount) {
    errors.push(
      `الكمية ${check.intent.originAmount} تتجاوز الحد الأقصى ${check.policy.maxAmount}`
    );
  }

  // 5. التحقق من المستلمين المسموحين
  if (
    check.policy.allowedRecipients &&
    check.policy.allowedRecipients.length > 0 &&
    check.intent.destinationRecipient
  ) {
    if (!check.policy.allowedRecipients.includes(check.intent.destinationRecipient)) {
      errors.push(`المستلم ${check.intent.destinationRecipient} غير مسموح`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * إنشاء سياسة تأكيد افتراضية
 * 
 * @returns سياسة افتراضية
 */
export function createDefaultConfirmationPolicy(): ConfirmationPolicy {
  return {
    requireAttestation: false,
    requiredConfirmations: 1,
    timeoutMs: 300000, // 5 دقائق
    allowedChains: [],
    allowedTokens: [],
    maxAmount: BigInt(0), // غير محدود
  };
}

/**
 * الحصول على اسم السلسلة من معرفها
 * 
 * @param chainId - معرف السلسلة
 * @returns اسم السلسلة أو 'unknown'
 */
export function getChainName(chainId: bigint): string {
  const id = Number(chainId);
  for (const [name, cid] of Object.entries(CHAIN_IDS)) {
    if (cid === id) return name;
  }
  return 'unknown';
}
