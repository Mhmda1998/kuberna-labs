/**
 * نظام الأخطاء الموحد لـ Kuberna SDK
 * 
 * @module Errors
 * @description فئات الأخطاء المستخدمة في جميع أنحاء SDK
 */

// ═══════════════════════════════════════════
// Error Codes
// ═══════════════════════════════════════════

export const ErrorCode = {
  // عام
  KUBERNA_ERROR: 'KUBERNA_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  
  // مصادقة
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  
  // تحقق
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  INVALID_ADDRESS: 'INVALID_ADDRESS',
  INVALID_DID: 'INVALID_DID',
  
  // موارد
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  
  // شبكة
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  CONNECTION_REFUSED: 'CONNECTION_REFUSED',
  RATE_LIMITED: 'RATE_LIMITED',
  
  // تكوين
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
  MISSING_CONFIG: 'MISSING_CONFIG',
  INVALID_CONFIG: 'INVALID_CONFIG',
  
  // بلوكشين
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  CONTRACT_ERROR: 'CONTRACT_ERROR',
  
  // TEE
  TEE_ERROR: 'TEE_ERROR',
  TEE_CREATE_FAILED: 'TEE_CREATE_FAILED',
  ATTESTATION_FAILED: 'ATTESTATION_FAILED',
  
  // دفع
  PAYMENT_ERROR: 'PAYMENT_ERROR',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  
  // نوايا
  INTENT_ERROR: 'INTENT_ERROR',
  INTENT_PARSE_FAILED: 'INTENT_PARSE_FAILED',
  
  // API
  API_ERROR: 'API_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

// ═══════════════════════════════════════════
// HTTP Status Codes
// ═══════════════════════════════════════════

export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  REQUEST_TIMEOUT: 408,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
} as const;

// ═══════════════════════════════════════════
// Base Error
// ═══════════════════════════════════════════

/**
 * خطأ Kuberna الأساسي
 * 
 * @class KubernaError
 * @extends Error
 * 
 * @example
 * ```typescript
 * throw new KubernaError('حدث خطأ ما', 'CUSTOM_ERROR', 400);
 * 
 * try {
 *   // ...
 * } catch (error) {
 *   if (error instanceof KubernaError) {
 *     console.log(error.code);       // 'CUSTOM_ERROR'
 *     console.log(error.statusCode); // 400
 *     console.log(error.toJSON());   // {...}
 *   }
 * }
 * ```
 */
export class KubernaError extends Error {
  /** كود الخطأ */
  public readonly code: string;
  /** كود HTTP */
  public readonly statusCode: number;
  /** الطابع الزمني */
  public readonly timestamp: string;
  /** بيانات إضافية */
  public readonly details?: unknown;
  /** معرف الطلب */
  public readonly requestId?: string;

  constructor(
    message: string,
    code: string = ErrorCode.KUBERNA_ERROR,
    statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR,
    details?: unknown,
    requestId?: string
  ) {
    super(message);
    this.name = 'KubernaError';
    this.code = code;
    this.statusCode = statusCode;
    this.timestamp = new Date().toISOString();
    this.details = details;
    this.requestId = requestId;

    // الحفاظ على تتبع المكدس
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, KubernaError);
    }
  }

  /**
   * تحويل الخطأ إلى JSON
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
      details: this.details,
      requestId: this.requestId,
      stack: process.env.NODE_ENV === 'development' ? this.stack : undefined,
    };
  }

  /**
   * إنشاء خطأ من استجابة HTTP
   */
  static fromResponse(
    response: { status: number; statusText?: string },
    body?: unknown
  ): KubernaError {
    const status = response.status;
    let message = 'فشل الطلب';
    let code = ErrorCode.API_ERROR;

    switch (status) {
      case 400:
        message = 'طلب غير صالح';
        code = ErrorCode.BAD_REQUEST;
        break;
      case 401:
        message = 'المصادقة مطلوبة';
        code = ErrorCode.UNAUTHORIZED;
        break;
      case 403:
        message = 'الوصول ممنوع';
        code = ErrorCode.FORBIDDEN;
        break;
      case 404:
        message = 'المورد غير موجود';
        code = ErrorCode.NOT_FOUND;
        break;
      case 408:
        message = 'انتهت مهلة الطلب';
        code = ErrorCode.TIMEOUT_ERROR;
        break;
      case 429:
        message = 'تم تجاوز الحد الأقصى للطلبات';
        code = ErrorCode.RATE_LIMITED;
        break;
      case 500:
        message = 'خطأ داخلي في الخادم';
        code = ErrorCode.INTERNAL_ERROR;
        break;
      case 503:
        message = 'الخدمة غير متاحة';
        code = ErrorCode.NETWORK_ERROR;
        break;
    }

    return new KubernaError(message, code, status, body);
  }
}

// ═══════════════════════════════════════════
// Specific Errors
// ═══════════════════════════════════════════

/**
 * خطأ المصادقة
 */
export class AuthenticationError extends KubernaError {
  constructor(message: string = 'فشلت المصادقة') {
    super(message, ErrorCode.AUTHENTICATION_ERROR, HttpStatus.UNAUTHORIZED);
    this.name = 'AuthenticationError';
  }
}

/**
 * خطأ التحقق من الصحة
 */
export class ValidationError extends KubernaError {
  constructor(message: string = 'فشل التحقق من الصحة', field?: string) {
    const fullMessage = field ? `${message} (الحقل: ${field})` : message;
    super(fullMessage, ErrorCode.VALIDATION_ERROR, HttpStatus.UNPROCESSABLE_ENTITY, { field });
    this.name = 'ValidationError';
  }
}

/**
 * خطأ المورد غير موجود
 */
export class NotFoundError extends KubernaError {
  constructor(resource: string = 'المورد') {
    super(`${resource} غير موجود`, ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND, { resource });
    this.name = 'NotFoundError';
  }
}

/**
 * خطأ في التكوين
 */
export class ConfigurationError extends KubernaError {
  constructor(message: string = 'تكوين SDK غير صالح') {
    super(message, ErrorCode.CONFIGURATION_ERROR, HttpStatus.INTERNAL_SERVER_ERROR);
    this.name = 'ConfigurationError';
  }
}

/**
 * خطأ في الشبكة
 */
export class NetworkError extends KubernaError {
  constructor(message: string = 'فشل طلب الشبكة') {
    super(message, ErrorCode.NETWORK_ERROR, HttpStatus.SERVICE_UNAVAILABLE);
    this.name = 'NetworkError';
  }
}

/**
 * خطأ انتهاء المهلة
 */
export class TimeoutError extends KubernaError {
  constructor(timeoutMs: number = 30000) {
    super(
      `انتهت مهلة الطلب بعد ${timeoutMs}ms`,
      ErrorCode.TIMEOUT_ERROR,
      HttpStatus.REQUEST_TIMEOUT
    );
    this.name = 'TimeoutError';
  }
}

/**
 * خطأ تجاوز الحد الأقصى
 */
export class RateLimitError extends KubernaError {
  constructor(retryAfter?: number) {
    const message = retryAfter
      ? `تم تجاوز الحد الأقصى. أعد المحاولة بعد ${retryAfter} ثانية`
      : 'تم تجاوز الحد الأقصى للطلبات';
    super(message, ErrorCode.RATE_LIMITED, HttpStatus.TOO_MANY_REQUESTS, { retryAfter });
    this.name = 'RateLimitError';
  }
}

/**
 * خطأ رصيد غير كاف
 */
export class InsufficientFundsError extends KubernaError {
  constructor(required: string, available: string) {
    super(
      `رصيد غير كاف. المطلوب: ${required}، المتاح: ${available}`,
      ErrorCode.INSUFFICIENT_FUNDS,
      HttpStatus.BAD_REQUEST,
      { required, available }
    );
    this.name = 'InsufficientFundsError';
  }
}

/**
 * خطأ معاملة فاشلة
 */
export class TransactionFailedError extends KubernaError {
  constructor(txHash: string, reason?: string) {
    super(
      reason ? `فشلت المعاملة ${txHash}: ${reason}` : `فشلت المعاملة ${txHash}`,
      ErrorCode.TRANSACTION_FAILED,
      HttpStatus.INTERNAL_SERVER_ERROR,
      { txHash, reason }
    );
    this.name = 'TransactionFailedError';
  }
}

// ═══════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════

/**
 * التحقق مما إذا كان الخطأ من نوع KubernaError
 */
export function isKubernaError(error: unknown): error is KubernaError {
  return error instanceof KubernaError;
}

/**
 * استخراج رسالة الخطأ من أي نوع
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof KubernaError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * استخراج كود الخطأ
 */
export function getErrorCode(error: unknown): string {
  if (error instanceof KubernaError) {
    return error.code;
  }
  return ErrorCode.KUBERNA_ERROR;
}

/**
 * استخراج كود HTTP
 */
export function getErrorStatusCode(error: unknown): number {
  if (error instanceof KubernaError) {
    return error.statusCode;
  }
  return 500;
}
