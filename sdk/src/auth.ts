import { KubernaSDK } from './index.js';
import { KubernaError } from './errors.js';

// ═══════════════════════════════════════════
// Types
// ═══════════════════════════════════════════

export interface AuthConfig {
  /** مدة صلاحية التوكن بالثواني */
  tokenExpiry?: number;
  /** التجديد التلقائي للتوكن */
  autoRefresh?: boolean;
}

export interface LoginParams {
  /** البريد الإلكتروني */
  email: string;
  /** كلمة المرور */
  password: string;
}

export interface RegisterParams {
  /** البريد الإلكتروني */
  email: string;
  /** كلمة المرور */
  password: string;
  /** الاسم */
  name: string;
  /** عنوان Web3 (اختياري) */
  web3Address?: string;
}

export interface AuthTokens {
  /** توكن الوصول */
  accessToken: string;
  /** توكن التجديد */
  refreshToken: string;
  /** مدة الصلاحية بالثواني */
  expiresIn: number;
  /** نوع التوكن */
  tokenType?: string;
}

export interface UserProfile {
  /** معرف المستخدم */
  id: string;
  /** البريد الإلكتروني */
  email: string;
  /** الاسم */
  name: string;
  /** عنوان Web3 */
  web3Address?: string;
  /** الدور */
  role: string;
  /** تاريخ الإنشاء */
  createdAt: string;
  /** تاريخ آخر تحديث */
  updatedAt?: string;
  /** حالة الحساب */
  status?: 'active' | 'inactive' | 'suspended';
}

// ═══════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 8;

// ═══════════════════════════════════════════
// AuthManager Class
// ═══════════════════════════════════════════

/**
 * مدير المصادقة - تسجيل الدخول والخروج وإدارة الجلسات
 * 
 * @class AuthManager
 * @description إدارة المصادقة والجلسات للمستخدمين
 * 
 * @example
 * ```typescript
 * const sdk = new KubernaSDK({ apiKey: '...' });
 * const auth = new AuthManager(sdk);
 * 
 * // تسجيل الدخول
 * const tokens = await auth.login({
 *   email: 'user@example.com',
 *   password: 'securePassword123'
 * });
 * 
 * // الحصول على الملف الشخصي
 * const profile = await auth.getProfile();
 * console.log(profile.name);
 * ```
 */
export class AuthManager {
  private config: AuthConfig;

  constructor(
    private sdk: KubernaSDK,
    config?: AuthConfig
  ) {
    this.config = {
      tokenExpiry: 3600,
      autoRefresh: true,
      ...config,
    };
  }

  // ═══════════════════════════════════════════
  // Validation
  // ═══════════════════════════════════════════

  /**
   * التحقق من صحة البريد الإلكتروني
   */
  private validateEmail(email: string): void {
    if (!email || email.trim().length === 0) {
      throw new KubernaError('البريد الإلكتروني مطلوب', 'VALIDATION_ERROR', 400);
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      throw new KubernaError('صيغة البريد الإلكتروني غير صالحة', 'VALIDATION_ERROR', 400);
    }
  }

  /**
   * التحقق من صحة كلمة المرور
   */
  private validatePassword(password: string): void {
    if (!password || password.length === 0) {
      throw new KubernaError('كلمة المرور مطلوبة', 'VALIDATION_ERROR', 400);
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      throw new KubernaError(
        `كلمة المرور يجب أن تكون ${PASSWORD_MIN_LENGTH} أحرف على الأقل`,
        'VALIDATION_ERROR',
        400
      );
    }
  }

  /**
   * معالجة خطأ موحد
   */
  private handleError(operation: string, error: unknown): never {
    if (error instanceof KubernaError) throw error;
    const message = error instanceof Error ? error.message : 'خطأ غير معروف';
    throw new KubernaError(`فشل ${operation}: ${message}`, 'AUTH_ERROR', 500);
  }

  // ═══════════════════════════════════════════
  // Authentication
  // ═══════════════════════════════════════════

  /**
   * تسجيل الدخول
   * 
   * @param params - بيانات تسجيل الدخول
   * @returns توكنز المصادقة
   * 
   * @example
   * ```typescript
   * const tokens = await auth.login({
   *   email: 'user@example.com',
   *   password: 'securePassword123'
   * });
   * 
   * console.log(tokens.accessToken);
   * ```
   */
  async login(params: LoginParams): Promise<AuthTokens> {
    this.validateEmail(params.email);
    this.validatePassword(params.password);

    try {
      const response = await this.sdk.request({
        method: 'POST',
        path: '/auth/login',
        data: {
          email: params.email.trim().toLowerCase(),
          password: params.password,
        } as unknown as Record<string, unknown>,
      });
      return response.data as AuthTokens;
    } catch (error) {
      this.handleError('تسجيل الدخول', error);
    }
  }

  /**
   * إنشاء حساب جديد
   * 
   * @param params - بيانات التسجيل
   * @returns توكنز المصادقة
   * 
   * @example
   * ```typescript
   * const tokens = await auth.register({
   *   email: 'newuser@example.com',
   *   password: 'securePassword123',
   *   name: 'محمد'
   * });
   * ```
   */
  async register(params: RegisterParams): Promise<AuthTokens> {
    this.validateEmail(params.email);
    this.validatePassword(params.password);

    if (!params.name || params.name.trim().length === 0) {
      throw new KubernaError('الاسم مطلوب', 'VALIDATION_ERROR', 400);
    }

    if (params.name.trim().length < 2) {
      throw new KubernaError('الاسم يجب أن يكون حرفين على الأقل', 'VALIDATION_ERROR', 400);
    }

    try {
      const response = await this.sdk.request({
        method: 'POST',
        path: '/auth/register',
        data: {
          email: params.email.trim().toLowerCase(),
          password: params.password,
          name: params.name.trim(),
          web3Address: params.web3Address,
        } as unknown as Record<string, unknown>,
      });
      return response.data as AuthTokens;
    } catch (error) {
      this.handleError('إنشاء الحساب', error);
    }
  }

  /**
   * تجديد توكن الوصول
   * 
   * @param refreshToken - توكن التجديد
   * @returns توكنز جديدة
   */
  async refresh(refreshToken: string): Promise<AuthTokens> {
    if (!refreshToken || refreshToken.trim().length === 0) {
      throw new KubernaError('توكن التجديد مطلوب', 'VALIDATION_ERROR', 400);
    }

    try {
      const response = await this.sdk.request({
        method: 'POST',
        path: '/auth/refresh',
        data: { refreshToken },
      });
      return response.data as AuthTokens;
    } catch (error) {
      this.handleError('تجديد التوكن', error);
    }
  }

  /**
   * تسجيل الخروج
   */
  async logout(): Promise<void> {
    try {
      await this.sdk.request({
        method: 'POST',
        path: '/auth/logout',
        data: {},
      });
    } catch (error) {
      this.handleError('تسجيل الخروج', error);
    }
  }

  // ═══════════════════════════════════════════
  // Profile
  // ═══════════════════════════════════════════

  /**
   * الحصول على الملف الشخصي للمستخدم
   * 
   * @returns بيانات الملف الشخصي
   * 
   * @example
   * ```typescript
   * const profile = await auth.getProfile();
   * console.log(profile.name);
   * console.log(profile.role);
   * ```
   */
  async getProfile(): Promise<UserProfile> {
    try {
      const response = await this.sdk.request({
        method: 'GET',
        path: '/auth/profile',
      });
      return response.data as UserProfile;
    } catch (error) {
      this.handleError('الحصول على الملف الشخصي', error);
    }
  }

  /**
   * تحديث الملف الشخصي
   * 
   * @param updates - التحديثات
   * @returns الملف الشخصي المحدث
   */
  async updateProfile(updates: Partial<Pick<UserProfile, 'name' | 'web3Address'>>): Promise<UserProfile> {
    try {
      const response = await this.sdk.request({
        method: 'PUT',
        path: '/auth/profile',
        data: updates as unknown as Record<string, unknown>,
      });
      return response.data as UserProfile;
    } catch (error) {
      this.handleError('تحديث الملف الشخصي', error);
    }
  }

  /**
   * التحقق من صحة التوكن الحالي
   * 
   * @returns true إذا كان التوكن صالحاً
   */
  async validateToken(): Promise<boolean> {
    try {
      await this.getProfile();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * تغيير كلمة المرور
   * 
   * @param oldPassword - كلمة المرور الحالية
   * @param newPassword - كلمة المرور الجديدة
   */
  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    this.validatePassword(oldPassword);
    this.validatePassword(newPassword);

    if (oldPassword === newPassword) {
      throw new KubernaError('كلمة المرور الجديدة يجب أن تختلف عن القديمة', 'VALIDATION_ERROR', 400);
    }

    try {
      await this.sdk.request({
        method: 'POST',
        path: '/auth/change-password',
        data: { oldPassword, newPassword } as unknown as Record<string, unknown>,
      });
    } catch (error) {
      this.handleError('تغيير كلمة المرور', error);
    }
  }
}
