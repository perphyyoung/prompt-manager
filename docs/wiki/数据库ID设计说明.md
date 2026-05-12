# 数据库 ID 设计说明

## 概述

本文档说明 prompt-manager 项目中各数据表的 ID 字段类型选择及设计原因。

## 各表 ID 类型一览

| 表名 | ID 字段 | 类型 | 生成方式 |
|------|---------|------|----------|
| `prompts` | `id` | `TEXT` | 应用程序生成（UUID） |
| `images` | `id` | `TEXT` | 应用程序生成（UUID） |
| `prompt_tag_groups` | `id` | `INTEGER` | 数据库自增（AUTOINCREMENT） |
| `prompt_tags` | `id` | `INTEGER` | 数据库自增（AUTOINCREMENT） |
| `image_tag_groups` | `id` | `INTEGER` | 数据库自增（AUTOINCREMENT） |
| `image_tags` | `id` | `INTEGER` | 数据库自增（AUTOINCREMENT） |
| `prompt_tag_relations` | `(prompt_id, tag_id)` | 复合主键 | - |
| `prompt_image_relations` | `(prompt_id, image_id)` | 复合主键 | - |
| `image_tag_relations` | `(image_id, tag_id)` | 复合主键 | - |

## 设计原因

### 1. prompts 和 images 表使用 TEXT (UUID)

**原因：**

- 支持客户端预生成 ID，便于离线操作和批量导入
- 支持数据导出/导入时保持 ID 不变
- 避免在分布式场景下的 ID 冲突

**建表语句：**

```sql
CREATE TABLE IF NOT EXISTS prompts (
  id TEXT PRIMARY KEY,
  ...
);

CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  ...
);
```

### 2. 标签相关表使用 INTEGER (AUTOINCREMENT)

**原因：**

- 纯内部数据，无需全局唯一性
- 自增整数性能更好，索引更小
- 不暴露数据规模（标签数量通常不重要）

**建表语句：**

```sql
CREATE TABLE IF NOT EXISTS prompt_tag_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ...
);

CREATE TABLE IF NOT EXISTS prompt_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ...
);
```

## 行业规范参考

### 主流数据库规范

| 数据库 | 推荐类型 | 说明 |
|--------|----------|------|
| **SQLite** | `INTEGER PRIMARY KEY` | 自增整数，性能最优 |
| **MySQL** | `INT/BIGINT AUTO_INCREMENT` | 阿里巴巴规范推荐 |
| **PostgreSQL** | `SERIAL/BIGSERIAL` | 官方推荐 |

### 互联网大厂实践

| 产品 | ID 类型 | 说明 |
|------|---------|------|
| **Twitter/X** | `BIGINT` (Snowflake) | 64位分布式ID |
| **Discord** | `BIGINT` (Snowflake) | 64位分布式ID |
| **Instagram** | `INTEGER` (PostgreSQL) | 单机自增 |
| **GitHub** | `INTEGER` (PostgreSQL) | 单机自增 |

## 混合设计的合理性

本项目采用混合 ID 策略是合理的：

1. **用户数据**（prompts, images）使用 TEXT/UUID
   - 支持离线生成
   - 支持数据迁移
   - 适合导出/导入场景

2. **系统数据**（tags, tag_groups）使用 INTEGER
   - 性能优先
   - 内部使用，无需全局唯一
   - 节省存储空间

这种设计在 Notion、Figma 等现代应用中也很常见。

## 关联关系说明

### 外键类型对应

| 关联表 | 主表 ID 类型 | 外键字段 | 外键类型 |
|--------|--------------|----------|----------|
| `prompt_tag_relations` | TEXT | `prompt_id` | TEXT |
| `prompt_tag_relations` | INTEGER | `tag_id` | INTEGER |
| `prompt_image_relations` | TEXT | `prompt_id` | TEXT |
| `prompt_image_relations` | TEXT | `image_id` | TEXT |
| `image_tag_relations` | TEXT | `image_id` | TEXT |
| `image_tag_relations` | INTEGER | `tag_id` | INTEGER |

**注意：** 外键类型必须与主表 ID 类型一致，以确保关联正确。

## 性能对比

| ID 类型 | 存储空间 | 索引性能 | 可读性 | 分布式支持 |
|---------|----------|----------|--------|------------|
| INTEGER | 8 bytes | ⭐⭐⭐ 最优 | 好 | ❌ 不支持 |
| TEXT (UUID) | 36+ bytes | ⭐⭐ 良好 | 差 | ✅ 支持 |

## 总结

- **当前设计符合行业实践**
- **混合策略兼顾性能和灵活性**
- **外键类型与主表保持一致**
