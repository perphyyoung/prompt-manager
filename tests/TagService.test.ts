import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TagService } from '../src/renderer/managers/TagService';

/**
 * TagService 单元测试
 * 验证所有公共方法存在且可调用
 */
describe('TagService', () => {
  let mockApi: any;
  let service: TagService;

  beforeEach(() => {
    // 重置单例
    (TagService as any).instances.clear();

    // 创建 Mock API
    mockApi = {
      getPromptTags: vi.fn().mockResolvedValue(['tag1', 'tag2']),
      getImageTags: vi.fn().mockResolvedValue(['img1', 'img2']),
      getPromptTagGroups: vi.fn().mockResolvedValue([{ id: 1, name: 'Group1' }]),
      getImageTagGroups: vi.fn().mockResolvedValue([{ id: 1, name: 'ImgGroup1' }]),
      addPromptTag: vi.fn().mockResolvedValue(true),
      addImageTag: vi.fn().mockResolvedValue(true),
      renamePromptTag: vi.fn().mockResolvedValue(true),
      renameImageTag: vi.fn().mockResolvedValue(true),
      deletePromptTag: vi.fn().mockResolvedValue(true),
      deleteImageTag: vi.fn().mockResolvedValue(true),
      assignPromptTagToBelongGroup: vi.fn().mockResolvedValue(true),
      assignImageTagToBelongGroup: vi.fn().mockResolvedValue(true),
      createPromptTagGroup: vi.fn().mockResolvedValue({ id: 1, name: 'NewGroup' }),
      createImageTagGroup: vi.fn().mockResolvedValue({ id: 1, name: 'NewImgGroup' }),
      updatePromptTagGroupAttrs: vi.fn().mockResolvedValue(true),
      updateImageTagGroupAttrs: vi.fn().mockResolvedValue(true),
      deletePromptTagGroup: vi.fn().mockResolvedValue(true),
      deleteImageTagGroup: vi.fn().mockResolvedValue(true),
    };

    service = TagService.getInstance('prompt', mockApi);
  });

  describe('方法存在性验证', () => {
    it('应该有 getTags 方法', () => {
      expect(typeof service.getTags).toBe('function');
    });

    it('应该有 getTagGroups 方法', () => {
      expect(typeof service.getTagGroups).toBe('function');
    });

    it('应该有 addTag 方法', () => {
      expect(typeof service.addTag).toBe('function');
    });

    it('应该有 renameTag 方法', () => {
      expect(typeof service.renameTag).toBe('function');
    });

    it('应该有 deleteTag 方法', () => {
      expect(typeof service.deleteTag).toBe('function');
    });

    it('应该有 assignTagToGroup 方法', () => {
      expect(typeof service.assignTagToGroup).toBe('function');
    });

    it('应该有 createGroup 方法', () => {
      expect(typeof service.createGroup).toBe('function');
    });

    it('应该有 updateGroup 方法', () => {
      expect(typeof service.updateGroup).toBe('function');
    });

    it('应该有 deleteGroup 方法', () => {
      expect(typeof service.deleteGroup).toBe('function');
    });

    it('应该有 getSpecialTags 方法', () => {
      expect(typeof service.getSpecialTags).toBe('function');
    });

    it('应该有 getSpecialTagChecks 方法', () => {
      expect(typeof service.getSpecialTagChecks).toBe('function');
    });

    it('应该有 validateTagAddition 方法', () => {
      expect(typeof service.validateTagAddition).toBe('function');
    });
  });

  describe('方法调用验证', () => {
    it('getTagGroups 应该正确调用', async () => {
      const result = await service.getTagGroups();
      expect(mockApi.getPromptTagGroups).toHaveBeenCalled();
      expect(result).toEqual([{ id: 1, name: 'Group1' }]);
    });

    it('createGroup 应该正确调用', async () => {
      const result = await service.createGroup('TestGroup', 0);
      expect(mockApi.createPromptTagGroup).toHaveBeenCalledWith('TestGroup', 0);
      expect(result).toEqual({ id: 1, name: 'NewGroup' });
    });

    it('updateGroup 应该正确调用', async () => {
      await service.updateGroup(1, { name: 'Updated', sortOrder: 5 });
      expect(mockApi.updatePromptTagGroupAttrs).toHaveBeenCalledWith(1, { name: 'Updated', sortOrder: 5 });
    });

    it('deleteGroup 应该正确调用', async () => {
      await service.deleteGroup(1);
      expect(mockApi.deletePromptTagGroup).toHaveBeenCalledWith(1);
    });
  });

  describe('错误用法检测', () => {
    it('不应该有 getGroups 方法（之前错误的调用）', () => {
      expect(typeof (service as any).getGroups).toBe('undefined');
    });

    it('调用不存在的方法应该抛出错误', () => {
      expect(() => (service as any).getGroups()).toThrow();
    });
  });
});
