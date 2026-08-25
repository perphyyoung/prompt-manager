/**
 * FileUtils 单元测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import {
  copyFile,
  copyDirectory,
  copyDirectoryWithProgress,
  calculateDirectorySize
} from '../../../src/utils/FileUtils.js';

describe('FileUtils', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fileutils-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('copyFile', () => {
    it('should copy a file from source to target', async () => {
      const sourceFile = path.join(tempDir, 'source.txt');
      const targetFile = path.join(tempDir, 'target.txt');
      const content = 'Hello, World!';

      await fs.writeFile(sourceFile, content);
      await copyFile(sourceFile, targetFile);

      const result = await fs.readFile(targetFile, 'utf8');
      expect(result).toBe(content);
    });

    it('should throw error when source file does not exist', async () => {
      const sourceFile = path.join(tempDir, 'nonexistent.txt');
      const targetFile = path.join(tempDir, 'target.txt');

      await expect(copyFile(sourceFile, targetFile)).rejects.toThrow();
    });
  });

  describe('copyDirectory', () => {
    it('should copy directory with files', async () => {
      const sourceDir = path.join(tempDir, 'source');
      const targetDir = path.join(tempDir, 'target');

      await fs.mkdir(sourceDir, { recursive: true });
      await fs.writeFile(path.join(sourceDir, 'file1.txt'), 'content1');
      await fs.writeFile(path.join(sourceDir, 'file2.txt'), 'content2');

      await copyDirectory(sourceDir, targetDir);

      const file1 = await fs.readFile(path.join(targetDir, 'file1.txt'), 'utf8');
      const file2 = await fs.readFile(path.join(targetDir, 'file2.txt'), 'utf8');

      expect(file1).toBe('content1');
      expect(file2).toBe('content2');
    });

    it('should copy nested directories', async () => {
      const sourceDir = path.join(tempDir, 'source');
      const targetDir = path.join(tempDir, 'target');
      const nestedDir = path.join(sourceDir, 'nested');

      await fs.mkdir(nestedDir, { recursive: true });
      await fs.writeFile(path.join(nestedDir, 'nested.txt'), 'nested content');

      await copyDirectory(sourceDir, targetDir);

      const result = await fs.readFile(
        path.join(targetDir, 'nested', 'nested.txt'),
        'utf8'
      );
      expect(result).toBe('nested content');
    });

    it('should throw error when source directory does not exist', async () => {
      const sourceDir = path.join(tempDir, 'nonexistent');
      const targetDir = path.join(tempDir, 'target');

      await expect(copyDirectory(sourceDir, targetDir)).rejects.toThrow(
        'Source directory does not exist'
      );
    });
  });

  describe('copyDirectoryWithProgress', () => {
    it('should copy directory and report progress by file count', async () => {
      const sourceDir = path.join(tempDir, 'source');
      const targetDir = path.join(tempDir, 'target');

      await fs.mkdir(sourceDir, { recursive: true });
      await fs.writeFile(path.join(sourceDir, 'file1.txt'), 'a'.repeat(100));
      await fs.writeFile(path.join(sourceDir, 'file2.txt'), 'b'.repeat(200));

      const progressCalls: Array<{
        copiedCount: number;
        totalCount: number;
        fileName: string;
      }> = [];
      const onProgress = (copiedCount: number, totalCount: number, fileName: string): void => {
        progressCalls.push({ copiedCount, totalCount, fileName });
      };

      const result = await copyDirectoryWithProgress(sourceDir, targetDir, {
        onProgress
      });

      expect(result.copiedCount).toBe(2);
      expect(result.copiedSize).toBe(300);
      expect(progressCalls.length).toBe(2);
      expect(progressCalls.every((c) => c.totalCount === 2)).toBe(true);
      expect(progressCalls.map((c) => c.copiedCount)).toEqual([1, 2]);
      expect(progressCalls[progressCalls.length - 1].fileName).toBe('file2.txt');
    });

    it('should report nested files with top-level total count', async () => {
      const sourceDir = path.join(tempDir, 'source');
      const targetDir = path.join(tempDir, 'target');
      const nestedDir = path.join(sourceDir, 'nested');

      await fs.mkdir(nestedDir, { recursive: true });
      await fs.writeFile(path.join(sourceDir, 'file1.txt'), 'a');
      await fs.writeFile(path.join(nestedDir, 'file2.txt'), 'b');
      await fs.writeFile(path.join(nestedDir, 'file3.txt'), 'c');

      const progressCalls: Array<{ copiedCount: number; totalCount: number }> = [];
      const result = await copyDirectoryWithProgress(sourceDir, targetDir, {
        onProgress: (copiedCount, totalCount) => {
          progressCalls.push({ copiedCount, totalCount });
        }
      });

      expect(result.copiedCount).toBe(3);
      expect(progressCalls.length).toBe(3);
      expect(progressCalls.every((c) => c.totalCount === 3)).toBe(true);
      expect(progressCalls[progressCalls.length - 1].copiedCount).toBe(3);
    });

    it('should return zero stats when source does not exist', async () => {
      const sourceDir = path.join(tempDir, 'nonexistent');
      const targetDir = path.join(tempDir, 'target');

      const result = await copyDirectoryWithProgress(sourceDir, targetDir);

      expect(result.copiedCount).toBe(0);
      expect(result.copiedSize).toBe(0);
    });
  });

  describe('calculateDirectorySize', () => {
    it('should calculate total size of directory', async () => {
      const testDir = path.join(tempDir, 'testdir');

      await fs.mkdir(testDir, { recursive: true });
      await fs.writeFile(path.join(testDir, 'file1.txt'), 'a'.repeat(100));
      await fs.writeFile(path.join(testDir, 'file2.txt'), 'b'.repeat(200));

      const size = await calculateDirectorySize(testDir);

      expect(size).toBe(300);
    });

    it('should return 0 for non-existent directory', async () => {
      const nonExistentDir = path.join(tempDir, 'nonexistent');

      const size = await calculateDirectorySize(nonExistentDir);

      expect(size).toBe(0);
    });

    it('should calculate size of nested directories', async () => {
      const testDir = path.join(tempDir, 'testdir');
      const nestedDir = path.join(testDir, 'nested');

      await fs.mkdir(nestedDir, { recursive: true });
      await fs.writeFile(path.join(testDir, 'file1.txt'), 'a'.repeat(100));
      await fs.writeFile(path.join(nestedDir, 'file2.txt'), 'b'.repeat(200));

      const size = await calculateDirectorySize(testDir);

      expect(size).toBe(300);
    });
  });
});
