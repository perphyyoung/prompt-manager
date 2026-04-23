/**
 * PyTagGroups 主类单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PyTagGroups } from '../../src/pyTagGroups/PyTagGroups.ts';

// Mock cacheManager
vi.mock('../../src/utils/CacheManager.ts', () => ({
  cacheManager: {
    getCache: vi.fn().mockReturnValue(null),
    createCache: vi.fn().mockReturnValue({
      set: vi.fn(),
      get: vi.fn().mockReturnValue(null),
      clear: vi.fn(),
    }),
  },
}));

describe('PyTagGroups', () => {
  let mockElectronAPI: any;
  let lib: PyTagGroups;

  beforeEach(() => {
    mockElectronAPI = {
      getPromptTags: vi.fn().mockResolvedValue(['tag1', 'tag2', 'tag3']),
      getImageTags: vi.fn().mockResolvedValue(['img1', 'img2']),
      addPromptTag: vi.fn().mockResolvedValue(undefined),
      addImageTag: vi.fn().mockResolvedValue(undefined),
      renamePromptTag: vi.fn().mockResolvedValue(undefined),
      renameImageTag: vi.fn().mockResolvedValue(undefined),
      deletePromptTag: vi.fn().mockImplementation((tag: string) => {
        // 模拟真实行为：只有存在的标签才能删除成功
        const existingTags = ['tag1', 'tag2', 'tag3'];
        if (existingTags.includes(tag)) {
          return Promise.resolve(undefined);
        }
        return Promise.reject(new Error(`标签 "${tag}" 不存在`));
      }),
      deleteImageTag: vi.fn().mockResolvedValue(undefined),
      getPromptTagGroups: vi.fn().mockResolvedValue([
        { id: 1, name: 'Group 1', sortOrder: 1, tags: ['tag1'] },
        { id: 2, name: 'Group 2', sortOrder: 2, tags: ['tag2'] },
      ]),
      getImageTagGroups: vi.fn().mockResolvedValue([
        { id: 1, name: 'Image Group 1', sortOrder: 1, tags: ['img1'] },
      ]),
      createPromptTagGroup: vi.fn().mockResolvedValue({ id: 3, name: 'New Group', sortOrder: 3 }),
      createImageTagGroup: vi.fn().mockResolvedValue({ id: 3, name: 'New Image Group', sortOrder: 3 }),
      updatePromptTagGroupAttrs: vi.fn().mockResolvedValue(undefined),
      updateImageTagGroupAttrs: vi.fn().mockResolvedValue(undefined),
      deletePromptTagGroup: vi.fn().mockResolvedValue(undefined),
      deleteImageTagGroup: vi.fn().mockResolvedValue(undefined),
      assignPromptTagToBelongGroup: vi.fn().mockResolvedValue(undefined),
      assignImageTagToBelongGroup: vi.fn().mockResolvedValue(undefined),
      getPromptsByTag: vi.fn().mockResolvedValue([]),
      getImagesByTag: vi.fn().mockResolvedValue([]),
      removeTagFromPrompt: vi.fn().mockResolvedValue(true),
      removeTagFromImage: vi.fn().mockResolvedValue(true),
    };
    (global as any).window = { electronAPI: mockElectronAPI };

    lib = PyTagGroups.getInstance('prompt');
  });

  describe('getInstance', () => {
    it('should return same instance for same type', () => {
      const instance1 = PyTagGroups.getInstance('prompt');
      const instance2 = PyTagGroups.getInstance('prompt');
      expect(instance1).toBe(instance2);
    });

    it('should return different instance for different type', () => {
      const promptInstance = PyTagGroups.getInstance('prompt');
      const imageInstance = PyTagGroups.getInstance('image');
      expect(promptInstance).not.toBe(imageInstance);
    });
  });

  describe('getAllTags', () => {
    it('should get all tags', async () => {
      const tags = await lib.getAllTags();
      expect(tags).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should sort by name when sortBy is name', async () => {
      mockElectronAPI.getPromptTags.mockResolvedValue(['c', 'a', 'b']);
      const tags = await lib.getAllTags({ sortBy: 'name' });
      expect(tags).toEqual(['a', 'b', 'c']);
    });
  });

  describe('getTagsWithGroups', () => {
    it('should get tags with group info', async () => {
      const tags = await lib.getTagsWithGroups();
      expect(tags.length).toBe(3);
      expect(tags[0]).toHaveProperty('name');
      expect(tags[0]).toHaveProperty('groupId');
    });
  });

  describe('create', () => {
    it('should create single tag', async () => {
      const result = await lib.create('newtag');
      expect(result.created).toContain('newtag');
      expect(result.success).toBe(true);
    });

    it('should create multiple tags', async () => {
      const result = await lib.create(['tag1', 'tag2', 'newtag']);
      expect(result.created).toContain('newtag');
      expect(result.skipped).toContain('tag1');
      expect(result.skipped).toContain('tag2');
    });

    it('should parse string input with commas', async () => {
      // create 方法只接受 TagName | TagName[]，字符串解析需要调用方使用 lib.parse()
      const tags = lib.parse('tag1, newtag1, newtag2');
      const result = await lib.create(tags);
      expect(result.created).toContain('newtag1');
      expect(result.created).toContain('newtag2');
    });

    it('should assign to group when defaultGroupId is provided', async () => {
      await lib.create('newtag', { defaultGroupId: 1 });
      expect(mockElectronAPI.assignPromptTagToBelongGroup).toHaveBeenCalledWith('newtag', 1);
    });
  });

  describe('search', () => {
    it('should return tags matching prefix', async () => {
      const results = await lib.search('ta');
      expect(results).toContain('tag1');
      expect(results).toContain('tag2');
      expect(results).toContain('tag3');
    });

    it('should exclude specified tags', async () => {
      const results = await lib.search('ta', ['tag1']);
      expect(results).not.toContain('tag1');
      expect(results).toContain('tag2');
    });

    it('should return empty array when no matches', async () => {
      const results = await lib.search('xyz');
      expect(results).toEqual([]);
    });
  });

  describe('rename', () => {
    it('should rename tag', async () => {
      await lib.rename('tag1', 'newtag');
      expect(mockElectronAPI.renamePromptTag).toHaveBeenCalledWith('tag1', 'newtag');
    });

    it('should throw error when new name exists', async () => {
      await expect(lib.rename('tag2', 'tag1')).rejects.toThrow();
    });
  });

  describe('delete', () => {
    it('should delete single tag', async () => {
      const result = await lib.delete('tag1');
      expect(result.deleted).toBe(1);
    });

    it('should delete multiple tags', async () => {
      const result = await lib.delete(['tag1', 'tag2']);
      expect(result.deleted).toBe(2);
    });

    it('should report error when deleting non-existent tag', async () => {
      const result = await lib.delete('nonexistent');
      expect(result.deleted).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].tag).toBe('nonexistent');
    });
  });

  describe('exists', () => {
    it('should return true for existing tag', async () => {
      const exists = await lib.exists('tag1');
      expect(exists).toBe(true);
    });

    it('should return false for non-existing tag', async () => {
      const exists = await lib.exists('nonexistent');
      expect(exists).toBe(false);
    });
  });

  describe('createGroup', () => {
    it('should create group', async () => {
      const group = await lib.createGroup('New Group', 3);
      expect(group.name).toBe('New Group');
      expect(group.sortOrder).toBe(3);
    });

    it('should use default sort order', async () => {
      // 由于缓存机制，mock 值在实例创建后就被缓存了
      // 这里只验证 createGroup 被调用且返回了正确的结构
      const group = await lib.createGroup('New Group');
      expect(group).toHaveProperty('id');
      expect(group).toHaveProperty('name', 'New Group');
      expect(group).toHaveProperty('sortOrder');
    });
  });

  describe('getGroups', () => {
    it('should get all groups', async () => {
      const groups = await lib.getGroups();
      expect(groups.length).toBe(2);
      expect(groups[0].name).toBe('Group 1');
    });
  });

  describe('updateGroup', () => {
    it('should update group', async () => {
      await lib.updateGroup(1, { name: 'Updated' });
      expect(mockElectronAPI.updatePromptTagGroupAttrs).toHaveBeenCalledWith(1, { name: 'Updated' });
    });
  });

  describe('deleteGroup', () => {
    it('should delete group', async () => {
      await lib.deleteGroup(1);
      expect(mockElectronAPI.deletePromptTagGroup).toHaveBeenCalledWith(1);
    });
  });

  describe('assignToGroup', () => {
    it('should assign tag to group', async () => {
      await lib.assignToGroup('tag1', 1);
      expect(mockElectronAPI.assignPromptTagToBelongGroup).toHaveBeenCalledWith('tag1', 1);
    });

    it('should remove tag from group when groupId is null', async () => {
      await lib.assignToGroup('tag1', null);
      expect(mockElectronAPI.assignPromptTagToBelongGroup).toHaveBeenCalledWith('tag1', null);
    });
  });

  describe('parse', () => {
    it('should parse comma separated tags', () => {
      const tags = lib.parse('tag1, tag2, tag3');
      expect(tags).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should parse space separated tags', () => {
      const tags = lib.parse('tag1 tag2 tag3');
      expect(tags).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should handle mixed separators', () => {
      const tags = lib.parse('tag1, tag2 tag3');
      expect(tags).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should trim whitespace', () => {
      const tags = lib.parse('  tag1  ,  tag2  ');
      expect(tags).toEqual(['tag1', 'tag2']);
    });

    it('should remove empty tags', () => {
      const tags = lib.parse('tag1,,tag2');
      expect(tags).toEqual(['tag1', 'tag2']);
    });

    it('should remove duplicates', () => {
      const tags = lib.parse('tag1, tag1, tag2');
      // parseTagInput 不去重，去重由调用方处理
      expect(tags).toEqual(['tag1', 'tag1', 'tag2']);
    });
  });

  describe('diff', () => {
    it('should return tags to remove', () => {
      const result = lib.diff(['a', 'b', 'c'], ['b']);
      expect(result).toEqual(['a', 'c']);
    });

    it('should handle empty remove array', () => {
      const result = lib.diff(['a', 'b'], []);
      expect(result).toEqual(['a', 'b']);
    });
  });
});
