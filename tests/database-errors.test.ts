import { describe, it, expect } from 'vitest';
import {
  DatabaseError,
  DatabaseErrorCode,
  DuplicateNameError,
  EntityNotFoundError,
  ConstraintViolationError,
  isDatabaseError,
  isConstraintError
} from '../src/main/database-errors.js';

describe('DatabaseError', () => {
  it('should create DatabaseError with all properties', () => {
    const originalError = new Error('Original');
    const error = new DatabaseError(
      'Test error',
      DatabaseErrorCode.SQL_ERROR,
      originalError,
      { sql: 'SELECT * FROM test' }
    );

    expect(error.message).toBe('Test error');
    expect(error.code).toBe(DatabaseErrorCode.SQL_ERROR);
    expect(error.originalError).toBe(originalError);
    expect(error.context).toEqual({ sql: 'SELECT * FROM test' });
    expect(error.name).toBe('DatabaseError');
  });

  it('should serialize to JSON correctly', () => {
    const originalError = new Error('Original error');
    const error = new DatabaseError(
      'Test error',
      DatabaseErrorCode.SQL_ERROR,
      originalError,
      { sql: 'SELECT * FROM test' }
    );

    const json = error.toJSON();
    expect(json.name).toBe('DatabaseError');
    expect(json.message).toBe('Test error');
    expect(json.code).toBe(DatabaseErrorCode.SQL_ERROR);
    expect(json.context).toEqual({ sql: 'SELECT * FROM test' });
    expect(json.originalError).toBe('Original error');
    expect(json.stack).toBeDefined();
  });

  it('should filter sensitive data in toJSON', () => {
    const error = new DatabaseError(
      'Test error',
      DatabaseErrorCode.SQL_ERROR,
      undefined,
      {
        sql: 'SELECT * FROM users',
        password: 'secret123',
        apiToken: 'token123',
        params: ['normal', 'a'.repeat(200)]
      }
    );

    const json = error.toJSON();
    const context = json.context as Record<string, unknown>;
    expect(context.password).toBe('***');
    expect(context.apiToken).toBe('***');
    expect(context.sql).toBe('SELECT * FROM users');
    // 长参数应该被截断
    expect((context.params as string[])[1]).toBe('a'.repeat(100) + '...');
  });
});

describe('DuplicateNameError', () => {
  it('should create error with correct message', () => {
    const error = new DuplicateNameError('标签组', '测试名称');
    
    expect(error.message).toBe('标签组 名称 "测试名称" 已存在');
    expect(error.code).toBe(DatabaseErrorCode.DUPLICATE_NAME);
    expect(error.context).toEqual({ entity: '标签组', name: '测试名称' });
  });
});

describe('EntityNotFoundError', () => {
  it('should create error with correct message', () => {
    const error = new EntityNotFoundError('提示词', 'abc-123');
    
    expect(error.message).toBe('提示词 (ID: abc-123) 不存在');
    expect(error.code).toBe(DatabaseErrorCode.ENTITY_NOT_FOUND);
  });
});

describe('ConstraintViolationError', () => {
  it('should create error with constraint type', () => {
    const originalError = new Error('UNIQUE constraint failed');
    const error = new ConstraintViolationError(
      '唯一约束违反',
      'UNIQUE',
      originalError
    );
    
    expect(error.constraintType).toBe('UNIQUE');
    expect(error.originalError).toBe(originalError);
  });
});

describe('isDatabaseError', () => {
  it('should return true for DatabaseError', () => {
    const error = new DatabaseError('Test', DatabaseErrorCode.SQL_ERROR);
    expect(isDatabaseError(error)).toBe(true);
  });
  
  it('should return false for regular Error', () => {
    expect(isDatabaseError(new Error('Test'))).toBe(false);
  });
});

describe('isConstraintError', () => {
  it('should return true for CONSTRAINT_VIOLATION error code', () => {
    const error = new DatabaseError(
      'Constraint failed',
      DatabaseErrorCode.CONSTRAINT_VIOLATION
    );
    expect(isConstraintError(error)).toBe(true);
  });

  it('should return true for ConstraintViolationError type', () => {
    const error = new ConstraintViolationError(
      '唯一约束违反',
      'UNIQUE',
      new Error('Original')
    );
    expect(isConstraintError(error)).toBe(true);
  });

  it('should return false for other errors', () => {
    const error = new DatabaseError('Other', DatabaseErrorCode.SQL_ERROR);
    expect(isConstraintError(error)).toBe(false);
  });

  it('should return false for non-DatabaseError', () => {
    expect(isConstraintError(new Error('Regular error'))).toBe(false);
  });
});
