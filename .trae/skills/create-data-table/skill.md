---
name: create-data-table
description: "用于前端创建“数据列表页/管理页/CRUD 后台页”（Ant Design Table + 搜索筛选 + 分页排序 + 新增/编辑弹窗 + 删除确认），并同步约束后端接口设计。只要用户提到：列表页/管理页/CRUD/后台/表格/筛选/分页/排序/新增编辑删除，就必须使用此技能，即使用户没明确说“用 Table”。强制遵循：前端用 Ant Design + ahooks(useAntdTable)；后端接口单一职责拆分 CRUD，且统一使用 POST；筛选/分页/排序参数通过 POST JSON body 传递；列表接口返回 { total, list } 且由后端完成分页/排序/筛选。"
license: Proprietary. LICENSE.txt has complete terms
---

# Create Data Table Pages (Ant Design + ahooks)

## What this skill does

交付一套可直接落地的“数据列表页”，包含：

- 列表：Ant Design `Table`
- 搜索：Ant Design `Form`（inline）
- 分页/排序：ahooks `useAntdTable` 驱动（前端不做切片）
- 操作：新增/编辑 `Modal` + 删除 `Popconfirm`
- 接口：后端按单一职责拆分 CRUD，统一 POST，并返回标准化数据结构

## Compatibility

- Frontend: React + Ant Design + ahooks（`useAntdTable`）
- Backend: 任意（但必须支持 POST JSON body + 分页返回 total/list）

## Workflow

按顺序执行（不要跳步）：

1. **确定资源与字段**：资源名、主键、列表字段、筛选字段、可编辑字段
2. **设计后端接口**：按单一职责拆分（create / list / getById / update / delete），全部 POST
3. **实现前端页面**：Form + Table + Modal + Popconfirm；用 `useAntdTable` 串联请求与分页
4. **接入路由/权限**：如项目有权限体系，给“新增/编辑/删除”按钮加权限判断
5. **验证**：至少跑 lint/build；必要时补最小的接口联调/空态/错误态检查

## Quick Reference

| 目标 | 推荐实现 |
|------|----------|
| 列表 + 分页 + 筛选 | `useAntdTable(service, { form, defaultPageSize: 20 })` |
| 新增/编辑 | `Modal + Form.useForm()`，保存后 `refresh()` |
| 删除 | `Popconfirm + delete 接口`，成功后 `refresh()` |
| 列表接口返回 | `{ total: number, list: any[] }` |
| 接口传参方式 | POST JSON body（包含 pageNo/pageSize/filters/sort） |

## Page composition (required)

每个数据列表页至少包含：

1. **搜索区**：Form（inline），聚焦用户最常用筛选项；提供“查询/重置”
2. **操作区**：新增按钮（必要时加入批量操作按钮）
3. **列表区**：Table（列定义清晰，操作列含编辑/删除）
4. **弹窗区**：Modal（新增/编辑表单），保存后刷新列表

## Backend API contract (single responsibility)

接口设计必须满足：

- 每个接口只做一个动作（Create / Read / Update / Delete），禁止混合
- 统一使用 POST（包括 list / getById），筛选/分页/排序通过 JSON body 传递
- 列表接口必须返回当前页数据，并返回 `total`

### Recommended Endpoints

以资源 `xxx` 为例：

- `POST /api/xxx/list`：查询列表（分页/排序/筛选）
- `POST /api/xxx/getById`：查询单条（按 id）
- `POST /api/xxx/create`：新增
- `POST /api/xxx/update`：修改
- `POST /api/xxx/delete`：删除

### List request/response shape

**Request**

```json
{
  "pageNo": 1,
  "pageSize": 20,
  "filters": { "keyword": "xxx", "status": "enabled" },
  "sort": { "field": "createTime", "order": "desc" }
}
```

**Response**

```json
{
  "total": 123,
  "list": [
    { "id": 1, "name": "A" }
  ]
}
```

### Filter rules

- 仅传“当前筛选动作必需字段”
- 由后端完成筛选/分页/排序，前端不做切片
- LIKE 查询建议由后端统一 escape（`\`, `%`, `_`）

## Frontend implementation checklist (Ant Design + ahooks)

### Data Fetch (useAntdTable)

- `service({ current, pageSize }, formData)` 中：
  - 从 `formData` 读取筛选项，做 trim/normalize
  - 调用 `POST /api/xxx/list`，传 `pageNo=current`、`pageSize`、筛选字段
  - 返回 `{ total, list }`

### Table Columns

- 固定列宽（ID/时间/操作列建议设置 width）
- 操作列：`编辑` / `删除`（删除按钮必须二次确认）
- 复杂字段展示：优先用 `Typography.Text`/`Tooltip` 做可读性处理

### Create/Edit Modal

- 复用一个 Modal：通过 `editing` 判断“新增/编辑”
- 提交时：
  - 新增：`POST /api/xxx/create`
  - 编辑：`POST /api/xxx/update`
  - 成功后关闭弹窗 + `refresh()`

### Error Handling

- 统一从 httpClient 的 `status/message` 提示用户
- 常见状态码提示：
  - 400：参数错误
  - 401：未登录（必要时跳登录）
  - 404：资源不存在
  - 409：冲突（如唯一键冲突）

## Output expectations

当使用该技能输出实现时，要求同时给出：

- 前端页面文件（Table + Form + Modal 的完整实现）
- 后端接口定义（入参/出参/状态码）
- 与现有项目的路由/权限接入方式（若项目存在权限体系）

## Test prompts (2–3)

写完实现后，用这些真实用户式提示自检是否能触发并产出正确结构（无需写断言）：

1. “给我做一个订单管理页面，要支持按订单号/状态筛选，分页、编辑状态、删除订单。”
2. “新增一个商品列表后台：Table + 新增/编辑弹窗 + 删除确认，接口全部用 POST。”
3. “把现有用户列表重构下：用 useAntdTable，后端 list 接口返回 total+list，不要前端切片。”
