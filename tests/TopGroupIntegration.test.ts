import { describe, it, expect } from 'vitest';
import { TopGroupManager } from '../src/renderer/managers/TopGroupManager';
import { TagInfo, SpecialTagInfo, TagGroupInfo } from '../src/renderer/types/TagTypes';
import { TagUI } from '../src/renderer/managers/TagUI';
import { TagService } from '../src/renderer/managers/TagService';

/**
 * 首位组功能集成测试
 * 测试完整的标签筛选和首位组显示场景
 */
describe('TopGroup Integration', () => {

  /**
   * 模拟完整的标签筛选场景
   * 类似于 PanelManagerBase.renderTagFilters 的实际使用
   */
  describe('完整标签筛选场景', () => {
    it('应正确排序并识别首位组 - 提示词场景', () => {
      // 模拟提示词标签数据
      const tagsWithGroup: TagInfo[] = [
        { name: 'animal', groupId: 1, groupName: '标签组1', groupSortOrder: -6 },
        { name: 'boy', groupId: 1, groupName: '标签组1', groupSortOrder: -6 },
        { name: 'girl', groupId: 1, groupName: '标签组1', groupSortOrder: -6 },
        { name: 'ice8', groupId: 2, groupName: '标签组2', groupSortOrder: -5 },
        { name: '2', groupId: 2, groupName: '标签组2', groupSortOrder: -5 },
        { name: 'cyborg', groupId: 2, groupName: '标签组2', groupSortOrder: -5 },
        { name: 'comfy', groupId: null, groupName: '未分组' },
      ];

      const tagCounts = {
        animal: 5, boy: 3, girl: 4,
        ice8: 2, '2': 1, cyborg: 6,
        comfy: 1
      };

      // 1. 排序标签
      const sortedTags = TopGroupManager.sortTagsWithGroupPriority(
        tagsWithGroup,
        tagCounts,
        { sortBy: 'name', sortOrder: 'asc' }
      );

      // 验证：首位组（标签组1）的标签排在最前面
      expect(sortedTags[0].groupId).toBe(1);
      expect(sortedTags[0].groupName).toBe('标签组1');
      expect(sortedTags[3].groupId).toBe(2);

      // 2. 构建组映射
      const groupMap = TopGroupManager.buildGroupMap(sortedTags, tagCounts);

      // 3. 获取首位组
      const topGroup = TopGroupManager.getTopGroup(groupMap);
      expect(topGroup?.groupId).toBe(1);
      expect(topGroup?.groupName).toBe('标签组1');
      expect(topGroup?.tags.length).toBe(3);
    });

    it('应正确排序并识别首位组 - 图像场景', () => {
      // 模拟图像标签数据
      const tagsWithGroup: TagInfo[] = [
        { name: 'boy', groupId: 1, groupName: '组1', groupSortOrder: -8 },
        { name: 'girl', groupId: 1, groupName: '组1', groupSortOrder: -8 },
        { name: 'cyborg', groupId: 2, groupName: '普1', groupSortOrder: -7 },
        { name: 'ice', groupId: 4, groupName: '3', groupSortOrder: 0 },
        { name: 'ice7', groupId: 4, groupName: '3', groupSortOrder: 0 },
        { name: 'comfy', groupId: null, groupName: '未分组' },
      ];

      const tagCounts = {
        boy: 5, girl: 3, cyborg: 2,
        ice: 4, ice7: 1, comfy: 1
      };

      const sortedTags = TopGroupManager.sortTagsWithGroupPriority(
        tagsWithGroup,
        tagCounts,
        { sortBy: 'name', sortOrder: 'asc' }
      );

      // 验证：首位组（组1）的标签排在最前面
      expect(sortedTags[0].groupId).toBe(1);
      expect(sortedTags[0].groupName).toBe('组1');

      const groupMap = TopGroupManager.buildGroupMap(sortedTags, tagCounts);
      const topGroup = TopGroupManager.getTopGroup(groupMap);
      expect(topGroup?.groupId).toBe(1);
      expect(topGroup?.groupName).toBe('组1');
    });
  });

  /**
   * 测试标签筛选区收起后的头部显示场景
   */
  describe('标签筛选区收起场景', () => {
    it('应正确收集头部显示的标签 - 包含特殊标签和首位组', () => {
      // 特殊标签
      const specialTags: SpecialTagInfo[] = [
        { tag: '收藏', count: 5 },
        { tag: '无图', count: 3 }
      ];

      // 普通标签
      const sortedTags: TagInfo[] = [
        { name: 'boy', groupId: 1, groupName: '人物', groupSortOrder: 1 },
        { name: 'girl', groupId: 1, groupName: '人物', groupSortOrder: 1 },
        { name: 'cat', groupId: 2, groupName: '动物', groupSortOrder: 2 },
      ];

      const tagCounts = {
        '收藏': 5, '无图': 3,
        boy: 10, girl: 8, cat: 5
      };

      const selectedTags = new Set<string>();
      const allSpecialTags = ['收藏', '无图', '无标', '安全'];

      // 收集头部标签
      const headerTags = TopGroupManager.collectHeaderTags(
        specialTags, sortedTags, tagCounts, selectedTags, allSpecialTags
      );

      // 验证：特殊标签在前
      expect(headerTags[0].tag).toBe('收藏');
      expect(headerTags[0].isSpecial).toBe(true);
      expect(headerTags[1].tag).toBe('无图');
      expect(headerTags[1].isSpecial).toBe(true);

      // 验证：首位组标签紧随其后
      expect(headerTags[2].tag).toBe('boy');
      expect(headerTags[2].isTopGroup).toBe(true);
      expect(headerTags[3].tag).toBe('girl');
      expect(headerTags[3].isTopGroup).toBe(true);
    });

    it('应正确显示选中的非首位组标签', () => {
      const specialTags: SpecialTagInfo[] = [];

      const sortedTags: TagInfo[] = [
        { name: 'boy', groupId: 1, groupName: '人物', groupSortOrder: 1 },
        { name: 'cat', groupId: 2, groupName: '动物', groupSortOrder: 2 },
      ];

      const tagCounts = { boy: 10, cat: 5 };

      // 选中了非首位组的标签
      const selectedTags = new Set<string>(['cat']);
      const allSpecialTags: string[] = [];

      const headerTags = TopGroupManager.collectHeaderTags(
        specialTags, sortedTags, tagCounts, selectedTags, allSpecialTags
      );

      // 验证：首位组标签显示
      expect(headerTags.some(t => t.tag === 'boy' && t.isTopGroup)).toBe(true);

      // 验证：选中的非首位组标签也显示
      const selectedCat = headerTags.find(t => t.tag === 'cat');
      expect(selectedCat).toBeDefined();
      expect(selectedCat?.className).toBe('active');
      expect(selectedCat?.isTopGroup).toBe(false); // 不是首位组
    });

    it('应显示计数为0的首位组标签在头部', () => {
      const specialTags: SpecialTagInfo[] = [];

      const sortedTags: TagInfo[] = [
        { name: 'emptyTag', groupId: 1, groupName: '首位组', groupSortOrder: 1 },
        { name: 'normalTag', groupId: 1, groupName: '首位组', groupSortOrder: 1 },
      ];

      // 首位组有标签计数为0
      const tagCounts = { emptyTag: 0, normalTag: 5 };

      const selectedTags = new Set<string>();
      const allSpecialTags: string[] = [];

      const headerTags = TopGroupManager.collectHeaderTags(
        specialTags, sortedTags, tagCounts, selectedTags, allSpecialTags
      );

      // 验证：计数为0的标签也应该显示在头部
      expect(headerTags.length).toBe(2);
      expect(headerTags.some(t => t.tag === 'emptyTag' && t.count === 0)).toBe(true);
      expect(headerTags.some(t => t.tag === 'normalTag' && t.count === 5)).toBe(true);
    });
  });

  /**
   * 测试标签筛选区展开场景
   */
  describe('标签筛选区展开场景', () => {
    it('展开时首位组所有标签都应显示，包括计数为0的', () => {
      const tags: TagInfo[] = [
        { name: 'tag1', groupId: 1, groupName: '首位组', groupSortOrder: 1 },
        { name: 'tag2', groupId: 1, groupName: '首位组', groupSortOrder: 1 },
        { name: 'tag3', groupId: 2, groupName: '其他组', groupSortOrder: 2 }
      ];
      const counts = { tag1: 5, tag2: 0, tag3: 3 };
      const groups = [
        { id: 1, name: '首位组', sortOrder: 1 },
        { id: 2, name: '其他组', sortOrder: 2 }
      ];

      const html = TagUI.generateTagFiltersHtml(tags, counts, {
        specialTags: [],
        selectedTags: new Set(),
        groups: groups,
        isImage: false
      });

      // 首位组的两个标签都应该显示（包括计数为0的tag2）
      expect(html).toContain('tag1');
      expect(html).toContain('tag2');
      expect(html).toContain('tag3');
    });

    it('展开时首位组计数为0的标签应显示计数0', () => {
      const tags: TagInfo[] = [
        { name: 'emptyTag', groupId: 1, groupName: '首位组', groupSortOrder: 1 }
      ];
      const counts = { emptyTag: 0 };
      const groups = [{ id: 1, name: '首位组', sortOrder: 1 }];

      const html = TagUI.generateTagFiltersHtml(tags, counts, {
        specialTags: [],
        selectedTags: new Set(),
        groups: groups,
        isImage: false
      });

      // 应该包含计数0的显示
      expect(html).toContain('emptyTag');
      expect(html).toContain('>0<');
    });

    it('展开时非首位组计数为0的标签不应显示', () => {
      const tags: TagInfo[] = [
        { name: 'topTag', groupId: 1, groupName: '首位组', groupSortOrder: 1 },
        { name: 'emptyTag', groupId: 2, groupName: '其他组', groupSortOrder: 2 }
      ];
      const counts = { topTag: 5, emptyTag: 0 };
      const groups = [
        { id: 1, name: '首位组', sortOrder: 1 },
        { id: 2, name: '其他组', sortOrder: 2 }
      ];

      const html = TagUI.generateTagFiltersHtml(tags, counts, {
        specialTags: [],
        selectedTags: new Set(),
        groups: groups,
        isImage: false
      });

      // 首位组标签显示
      expect(html).toContain('topTag');
      // 非首位组计数为0的标签不显示
      expect(html).not.toContain('emptyTag');
    });

    it('展开时首位组所有标签计数为0时仍应显示该组', () => {
      const tags: TagInfo[] = [
        { name: 'tag1', groupId: 1, groupName: '首位组', groupSortOrder: 1 },
        { name: 'tag2', groupId: 1, groupName: '首位组', groupSortOrder: 1 }
      ];
      const counts = { tag1: 0, tag2: 0 };
      const groups = [{ id: 1, name: '首位组', sortOrder: 1 }];

      const html = TagUI.generateTagFiltersHtml(tags, counts, {
        specialTags: [],
        selectedTags: new Set(),
        groups: groups,
        isImage: false
      });

      // 组标题应该显示
      expect(html).toContain('首位组');
      // 所有标签都应该显示
      expect(html).toContain('tag1');
      expect(html).toContain('tag2');
    });
  });

  /**
   * 测试边界情况
   */
  describe('边界情况', () => {
    it('所有标签都是未分组时，首位组应为 null', () => {
      const tagsWithGroup: TagInfo[] = [
        { name: 'tag1', groupId: null, groupName: '未分组' },
        { name: 'tag2', groupId: null, groupName: '未分组' },
      ];

      const tagCounts = { tag1: 1, tag2: 2 };

      const sortedTags = TopGroupManager.sortTagsWithGroupPriority(
        tagsWithGroup, tagCounts, { sortBy: 'name', sortOrder: 'asc' }
      );

      const groupMap = TopGroupManager.buildGroupMap(sortedTags, tagCounts);
      const topGroup = TopGroupManager.getTopGroup(groupMap);

      expect(topGroup).toBeNull();
    });

    it('首位组所有标签计数为0时，仍应显示首位组标签', () => {
      const specialTags: SpecialTagInfo[] = [];

      const sortedTags: TagInfo[] = [
        { name: 'empty1', groupId: 1, groupName: '空组', groupSortOrder: 1 },
        { name: 'empty2', groupId: 1, groupName: '空组', groupSortOrder: 1 },
      ];

      // 首位组所有标签计数为0
      const tagCounts = { empty1: 0, empty2: 0 };

      const selectedTags = new Set<string>();
      const allSpecialTags: string[] = [];

      const headerTags = TopGroupManager.collectHeaderTags(
        specialTags, sortedTags, tagCounts, selectedTags, allSpecialTags
      );

      // 修改期望：即使计数为0，首位组标签也应该显示
      expect(headerTags.length).toBe(2);
      expect(headerTags[0].tag).toBe('empty1');
      expect(headerTags[0].count).toBe(0);
      expect(headerTags[1].tag).toBe('empty2');
      expect(headerTags[1].count).toBe(0);
    });

    it('相同 groupSortOrder 的组应稳定排序', () => {
      const tagsWithGroup: TagInfo[] = [
        { name: 'tag1', groupId: 1, groupName: '组1', groupSortOrder: 1 },
        { name: 'tag2', groupId: 2, groupName: '组2', groupSortOrder: 1 },
      ];

      const tagCounts = { tag1: 1, tag2: 1 };

      const sortedTags = TopGroupManager.sortTagsWithGroupPriority(
        tagsWithGroup, tagCounts, { sortBy: 'name', sortOrder: 'asc' }
      );

      // 相同 sortOrder 时，按原始顺序或名称排序
      expect(sortedTags[0].groupId).toBe(1);
      expect(sortedTags[1].groupId).toBe(2);
    });
  });

  /**
   * 测试 TagService 集成
   */
  describe('TagService 集成', () => {
    it('TagService.buildTagsWithGroup 应生成正确的 groupSortOrder', () => {
      // 模拟数据库返回的组数据
      const groups: TagGroupInfo[] = [
        { id: 1, name: '组1', sortOrder: -5, tags: ['tag1', 'tag2'] },
        { id: 2, name: '组2', sortOrder: -3, tags: ['tag3'] },
      ];

      const tags = ['tag1', 'tag2', 'tag3', 'ungrouped'];

      // 使用 TagService 构建标签与组的映射
      const tagService = TagService.getInstance('prompt');
      const tagsWithGroup = tagService.buildTagsWithGroup(tags, groups);

      // 验证：有组的标签有正确的 groupSortOrder
      const tag1 = tagsWithGroup.find(t => t.name === 'tag1');
      expect(tag1?.groupSortOrder).toBe(-5);

      const tag3 = tagsWithGroup.find(t => t.name === 'tag3');
      expect(tag3?.groupSortOrder).toBe(-3);

      // 验证：未分组的标签 groupSortOrder 为 Infinity
      const ungrouped = tagsWithGroup.find(t => t.name === 'ungrouped');
      expect(ungrouped?.groupSortOrder).toBe(Infinity);

      // 验证：可以与 TopGroupManager 一起使用
      const tagCounts = { tag1: 1, tag2: 1, tag3: 1, ungrouped: 1 };
      const sorted = TopGroupManager.sortTagsWithGroupPriority(
        tagsWithGroup, tagCounts, { sortBy: 'name', sortOrder: 'asc' }
      );

      // 组1（sortOrder=-5）应在组2（sortOrder=-3）前面
      expect(sorted[0].groupId).toBe(1);
      expect(sorted[2].groupId).toBe(2);
    });
  });

  /**
   * 完整端到端测试
   */
  describe('端到端场景', () => {
    it('完整的标签筛选流程 - 收起和展开都应显示所有首位组标签', () => {
      // 1. 准备数据
      const groups: TagGroupInfo[] = [
        { id: 1, name: '人物', sortOrder: -5, tags: ['boy', 'girl', 'unknown'] },
        { id: 2, name: '场景', sortOrder: -3, tags: ['indoor', 'outdoor'] },
      ];

      const tags = ['boy', 'girl', 'unknown', 'indoor', 'outdoor', 'other'];
      const tagCounts = { boy: 10, girl: 8, unknown: 0, indoor: 5, outdoor: 3, other: 2 };

      // 2. 使用 TagService 构建标签与组的映射
      const tagService = TagService.getInstance('prompt');
      const tagsWithGroup = tagService.buildTagsWithGroup(tags, groups);

      // 3. 排序标签
      const sortedTags = TopGroupManager.sortTagsWithGroupPriority(
        tagsWithGroup, tagCounts, { sortBy: 'name', sortOrder: 'asc' }
      );

      // 4. 验证首位组
      const groupMap = TopGroupManager.buildGroupMap(sortedTags, tagCounts);
      const topGroup = TopGroupManager.getTopGroup(groupMap);
      expect(topGroup?.groupName).toBe('人物');

      // 5. 测试收起状态 - collectHeaderTags
      const specialTags: SpecialTagInfo[] = [{ tag: '收藏', count: 5 }];
      const selectedTags = new Set<string>();
      const allSpecialTags = ['收藏', '无图', '无标'];

      const headerTags = TopGroupManager.collectHeaderTags(
        specialTags, sortedTags, tagCounts, selectedTags, allSpecialTags
      );

      // 验证：收藏标签 + 首位组所有标签（包括unknown计数为0）
      expect(headerTags.some(t => t.tag === '收藏')).toBe(true);
      expect(headerTags.some(t => t.tag === 'boy')).toBe(true);
      expect(headerTags.some(t => t.tag === 'girl')).toBe(true);
      expect(headerTags.some(t => t.tag === 'unknown' && t.count === 0)).toBe(true);
      // 非首位组标签不应在头部显示（除非被选中）
      expect(headerTags.some(t => t.tag === 'indoor')).toBe(false);

      // 6. 测试展开状态 - generateTagFiltersHtml
      const filterHtml = TagUI.generateTagFiltersHtml(sortedTags, tagCounts, {
        specialTags: [],
        selectedTags: new Set(),
        groups: groups,
        isImage: false
      });

      // 验证：首位组所有标签都显示
      expect(filterHtml).toContain('boy');
      expect(filterHtml).toContain('girl');
      expect(filterHtml).toContain('unknown');
      // 验证：非首位组计数>0的标签显示
      expect(filterHtml).toContain('indoor');
      expect(filterHtml).toContain('outdoor');
    });
  });
});
