/**
 * PyTagGroups dataAccess 模块单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ElectronTagDataAccess, createDataAccess } from '../../src/pyTagGroups/dataAccess.ts';

describe('ElectronTagDataAccess', () => {
  let mockElectronAPI: any;

  beforeEach(() => {
    mockElectronAPI = {
      getPromptTags: vi.fn().mockResolvedValue(['tag1', 'tag2']),
      getImageTags: vi.fn().mockResolvedValue(['img1', 'img2']),
      addPromptTag: vi.fn().mockResolvedValue(undefined),
      addImageTag: vi.fn().mockResolvedValue(undefined),
      renamePromptTag: vi.fn().mockResolvedValue(undefined),
      renameImageTag: vi.fn().mockResolvedValue(undefined),
      deletePromptTag: vi.fn().mockResolvedValue(undefined),
      deleteImageTag: vi.fn().mockResolvedValue(undefined),
      getPromptTagGroups: vi.fn().mockResolvedValue([{ id: 1, name: 'Group 1', sortOrder: 1 }]),
      getImageTagGroups: vi.fn().mockResolvedValue([{ id: 1, name: 'Image Group 1', sortOrder: 1 }]),
      createPromptTagGroup: vi.fn().mockResolvedValue({ id: 2, name: 'New Group', sortOrder: 2 }),
      createImageTagGroup: vi.fn().mockResolvedValue({ id: 2, name: 'New Image Group', sortOrder: 2 }),
      updatePromptTagGroupAttrs: vi.fn().mockResolvedValue(undefined),
      updateImageTagGroupAttrs: vi.fn().mockResolvedValue(undefined),
      deletePromptTagGroup: vi.fn().mockResolvedValue(undefined),
      deleteImageTagGroup: vi.fn().mockResolvedValue(undefined),
      assignPromptTagToBelongGroup: vi.fn().mockResolvedValue(undefined),
      assignImageTagToBelongGroup: vi.fn().mockResolvedValue(undefined),
      getPromptsByTag: vi.fn().mockResolvedValue(['prompt1', 'prompt2']),
      getImagesByTag: vi.fn().mockResolvedValue(['image1', 'image2']),
      removeTagFromPrompt: vi.fn().mockResolvedValue(true),
      removeTagFromImage: vi.fn().mockResolvedValue(true),
    };
    (global as any).window = { electronAPI: mockElectronAPI };
  });

  describe('getTags', () => {
    it('should get tags for prompt type', async () => {
      const dataAccess = new ElectronTagDataAccess('prompt');
      const tags = await dataAccess.getTags();

      expect(tags).toEqual(['tag1', 'tag2']);
      expect(mockElectronAPI.getPromptTags).toHaveBeenCalled();
    });

    it('should get tags for image type', async () => {
      const dataAccess = new ElectronTagDataAccess('image');
      const tags = await dataAccess.getTags();

      expect(tags).toEqual(['img1', 'img2']);
      expect(mockElectronAPI.getImageTags).toHaveBeenCalled();
    });
  });

  describe('addTag', () => {
    it('should add tag for prompt type', async () => {
      const dataAccess = new ElectronTagDataAccess('prompt');
      await dataAccess.addTag('newtag');

      expect(mockElectronAPI.addPromptTag).toHaveBeenCalledWith('newtag');
    });

    it('should add tag for image type', async () => {
      const dataAccess = new ElectronTagDataAccess('image');
      await dataAccess.addTag('newtag');

      expect(mockElectronAPI.addImageTag).toHaveBeenCalledWith('newtag');
    });
  });

  describe('renameTag', () => {
    it('should rename tag for prompt type', async () => {
      const dataAccess = new ElectronTagDataAccess('prompt');
      await dataAccess.renameTag('oldtag', 'newtag');

      expect(mockElectronAPI.renamePromptTag).toHaveBeenCalledWith('oldtag', 'newtag');
    });

    it('should rename tag for image type', async () => {
      const dataAccess = new ElectronTagDataAccess('image');
      await dataAccess.renameTag('oldtag', 'newtag');

      expect(mockElectronAPI.renameImageTag).toHaveBeenCalledWith('oldtag', 'newtag');
    });
  });

  describe('deleteTag', () => {
    it('should delete tag for prompt type', async () => {
      const dataAccess = new ElectronTagDataAccess('prompt');
      await dataAccess.deleteTag('tag1');

      expect(mockElectronAPI.deletePromptTag).toHaveBeenCalledWith('tag1');
    });

    it('should delete tag for image type', async () => {
      const dataAccess = new ElectronTagDataAccess('image');
      await dataAccess.deleteTag('tag1');

      expect(mockElectronAPI.deleteImageTag).toHaveBeenCalledWith('tag1');
    });
  });

  describe('getTagGroups', () => {
    it('should get tag groups for prompt type', async () => {
      const dataAccess = new ElectronTagDataAccess('prompt');
      const groups = await dataAccess.getTagGroups();

      expect(groups).toEqual([{ id: 1, name: 'Group 1', sortOrder: 1 }]);
      expect(mockElectronAPI.getPromptTagGroups).toHaveBeenCalled();
    });

    it('should get tag groups for image type', async () => {
      const dataAccess = new ElectronTagDataAccess('image');
      const groups = await dataAccess.getTagGroups();

      expect(groups).toEqual([{ id: 1, name: 'Image Group 1', sortOrder: 1 }]);
      expect(mockElectronAPI.getImageTagGroups).toHaveBeenCalled();
    });
  });

  describe('createTagGroup', () => {
    it('should create tag group for prompt type', async () => {
      const dataAccess = new ElectronTagDataAccess('prompt');
      const group = await dataAccess.createTagGroup('New Group', 2);

      expect(group).toEqual({ id: 2, name: 'New Group', sortOrder: 2 });
      expect(mockElectronAPI.createPromptTagGroup).toHaveBeenCalledWith('New Group', 2);
    });

    it('should create tag group for image type', async () => {
      const dataAccess = new ElectronTagDataAccess('image');
      const group = await dataAccess.createTagGroup('New Group', 2);

      expect(group).toEqual({ id: 2, name: 'New Image Group', sortOrder: 2 });
      expect(mockElectronAPI.createImageTagGroup).toHaveBeenCalledWith('New Group', 2);
    });
  });

  describe('updateTagGroup', () => {
    it('should update tag group for prompt type', async () => {
      const dataAccess = new ElectronTagDataAccess('prompt');
      await dataAccess.updateTagGroup(1, { name: 'Updated' });

      expect(mockElectronAPI.updatePromptTagGroupAttrs).toHaveBeenCalledWith(1, { name: 'Updated' });
    });

    it('should update tag group for image type', async () => {
      const dataAccess = new ElectronTagDataAccess('image');
      await dataAccess.updateTagGroup(1, { name: 'Updated' });

      expect(mockElectronAPI.updateImageTagGroupAttrs).toHaveBeenCalledWith(1, { name: 'Updated' });
    });
  });

  describe('deleteTagGroup', () => {
    it('should delete tag group for prompt type', async () => {
      const dataAccess = new ElectronTagDataAccess('prompt');
      await dataAccess.deleteTagGroup(1);

      expect(mockElectronAPI.deletePromptTagGroup).toHaveBeenCalledWith(1);
    });

    it('should delete tag group for image type', async () => {
      const dataAccess = new ElectronTagDataAccess('image');
      await dataAccess.deleteTagGroup(1);

      expect(mockElectronAPI.deleteImageTagGroup).toHaveBeenCalledWith(1);
    });
  });

  describe('assignTagToGroup', () => {
    it('should assign tag to group for prompt type', async () => {
      const dataAccess = new ElectronTagDataAccess('prompt');
      await dataAccess.assignTagToGroup('tag1', 1);

      expect(mockElectronAPI.assignPromptTagToBelongGroup).toHaveBeenCalledWith('tag1', 1);
    });

    it('should remove tag from group when groupId is null', async () => {
      const dataAccess = new ElectronTagDataAccess('prompt');
      await dataAccess.assignTagToGroup('tag1', null);

      expect(mockElectronAPI.assignPromptTagToBelongGroup).toHaveBeenCalledWith('tag1', null);
    });
  });

  describe('getItemsByTag', () => {
    it('should get prompts by tag for prompt type', async () => {
      const dataAccess = new ElectronTagDataAccess('prompt');
      const items = await dataAccess.getItemsByTag('tag1');

      expect(items).toEqual(['prompt1', 'prompt2']);
      expect(mockElectronAPI.getPromptsByTag).toHaveBeenCalledWith('tag1');
    });

    it('should get images by tag for image type', async () => {
      const dataAccess = new ElectronTagDataAccess('image');
      const items = await dataAccess.getItemsByTag('img1');

      expect(items).toEqual(['image1', 'image2']);
      expect(mockElectronAPI.getImagesByTag).toHaveBeenCalledWith('img1');
    });
  });

  describe('removeTagFromItem', () => {
    it('should remove tag from prompt', async () => {
      const dataAccess = new ElectronTagDataAccess('prompt');
      await dataAccess.removeTagFromItem('prompt1', 'tag1');

      expect(mockElectronAPI.removeTagFromPrompt).toHaveBeenCalledWith('prompt1', 'tag1');
    });

    it('should remove tag from image', async () => {
      const dataAccess = new ElectronTagDataAccess('image');
      await dataAccess.removeTagFromItem('image1', 'tag1');

      expect(mockElectronAPI.removeTagFromImage).toHaveBeenCalledWith('image1', 'tag1');
    });

    it('should throw error when remove fails', async () => {
      mockElectronAPI.removeTagFromPrompt.mockResolvedValue(false);
      const dataAccess = new ElectronTagDataAccess('prompt');

      await expect(dataAccess.removeTagFromItem('prompt1', 'tag1')).rejects.toThrow('Failed to remove tag');
    });
  });
});

describe('createDataAccess', () => {
  it('should create data access instance', () => {
    const dataAccess = createDataAccess('prompt');
    expect(dataAccess).toBeInstanceOf(ElectronTagDataAccess);
  });
});
