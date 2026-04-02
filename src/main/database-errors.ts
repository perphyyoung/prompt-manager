/**
 * 数据库错误基类
 * 所有数据库相关错误都应继承此类
 */
export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly code: DatabaseErrorCode,
    public readonly originalError?: Error,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DatabaseError';

    // 保持原型链
    Object.setPrototypeOf(this, DatabaseError.prototype);
  }

  /**
   * 序列化错误对象为 JSON
   * 确保自定义属性不会丢失，同时过滤敏感数据
   */
  toJSON(): Record<string, unknown> {
    // 过滤敏感字段（如密码、token 等）
    const filteredContext = this.context ? this.sanitizeContext(this.context) : undefined;

    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: filteredContext,
      stack: this.stack,
      originalError: this.originalError?.message
    };
  }

  /**
   * 清理上下文中的敏感数据
   */
  private sanitizeContext(context: Record<string, unknown>): Record<string, unknown> {
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'auth'];
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(context)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
        sanitized[key] = '***';
      } else if (key === 'params' && Array.isArray(value)) {
        // 对 params 数组也进行敏感数据过滤
        sanitized[key] = value.map((param, index) => {
          if (typeof param === 'string' && param.length > 100) {
            // 截断过长的参数
            return param.substring(0, 100) + '...';
          }
          return param;
        });
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}

/**
 * 数据库错误码枚举
 */
export enum DatabaseErrorCode {
  // 连接错误
  DB_NOT_INITIALIZED = 'DB_NOT_INITIALIZED',
  CONNECTION_FAILED = 'CONNECTION_FAILED',

  // SQL 执行错误
  SQL_ERROR = 'SQL_ERROR',
  CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION',

  // 业务逻辑错误
  DUPLICATE_NAME = 'DUPLICATE_NAME',
  ENTITY_NOT_FOUND = 'ENTITY_NOT_FOUND',
  INVALID_OPERATION = 'INVALID_OPERATION',

  // 事务错误
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  ROLLBACK_FAILED = 'ROLLBACK_FAILED'
}

/**
 * 重复名称错误
 */
export class DuplicateNameError extends DatabaseError {
  constructor(entity: string, name: string) {
    super(
      `${entity} 名称 "${name}" 已存在`,
      DatabaseErrorCode.DUPLICATE_NAME,
      undefined,
      { entity, name }
    );
    this.name = 'DuplicateNameError';
    Object.setPrototypeOf(this, DuplicateNameError.prototype);
  }
}

/**
 * 实体未找到错误
 */
export class EntityNotFoundError extends DatabaseError {
  constructor(entity: string, id: string) {
    super(
      `${entity} (ID: ${id}) 不存在`,
      DatabaseErrorCode.ENTITY_NOT_FOUND,
      undefined,
      { entity, id }
    );
    this.name = 'EntityNotFoundError';
    Object.setPrototypeOf(this, EntityNotFoundError.prototype);
  }
}

/**
 * 约束违反错误
 */
export class ConstraintViolationError extends DatabaseError {
  constructor(
    message: string,
    public readonly constraintType: 'UNIQUE' | 'FOREIGN_KEY' | 'CHECK' | 'NOT_NULL',
    originalError?: Error
  ) {
    super(
      message,
      DatabaseErrorCode.CONSTRAINT_VIOLATION,
      originalError,
      { constraintType }
    );
    this.name = 'ConstraintViolationError';
    Object.setPrototypeOf(this, ConstraintViolationError.prototype);
  }
}

/**
 * 判断错误是否为数据库错误
 */
export function isDatabaseError(error: unknown): error is DatabaseError {
  return error instanceof DatabaseError;
}

/**
 * 判断错误是否为约束违反
 * 包括 CONSTRAINT_VIOLATION 错误码或 ConstraintViolationError 类型
 */
export function isConstraintError(error: unknown): boolean {
  if (!isDatabaseError(error)) return false;
  // 检查错误码或错误类型
  return error.code === DatabaseErrorCode.CONSTRAINT_VIOLATION ||
         error.name === 'ConstraintViolationError';
}
