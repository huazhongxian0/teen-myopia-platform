---
name: create-interface-skill
description: "用于设计/重构后端接口（API）并强制约束为单一职责 CRUD 分离。只要用户提到：接口、API、后端、controller、路由、增删改查、分页筛选排序、管理页接口对齐等，就必须使用此技能。强制规则：所有接口统一使用 POST；每个接口只做一个动作（create/read/update/delete）；请求只包含当前动作所需字段；响应只返回该动作结果；列表接口必须返回 { total, list } 且由后端完成分页/筛选/排序。"
license: Proprietary. LICENSE.txt has complete terms
---

# Create Interfaces (Single-responsibility CRUD, POST-only)

## What this skill does

输出一套可落地的接口设计与实现规范，核心目标：

- 接口职责清晰（一个接口一个动作）
- 命名可读（从名字就能看出动作）
- 参数最小化（只传必需字段）
- 返回结构一致（可复用前端/调用方逻辑）
- 默认适配管理页场景（分页/筛选/排序）

## Compatibility

- Backend: 语言/框架不限（Spring / Express / FastAPI 等都可）
- 强制约束：接口必须 POST JSON body（不使用 GET/PUT/DELETE）

## Workflow

按顺序执行（不要跳步）：

1. **确定资源模型**：资源名、主键、核心字段、唯一约束
2. **拆分动作**：create / list / getById / update / delete（每个动作一个接口）
3. **定义入参/出参**：最小字段集；统一错误码策略
4. **实现接口**：保持幂等/事务一致性；避免把筛选分页留给前端
5. **联调要点**：常见边界（重复、不存在、权限不足、参数非法）

## Rules (non-negotiable)

### 1) Single responsibility

- 一个接口只做一个动作
- 禁止任何“顺带做另一件事”的逻辑（例如 update 顺便 delete）

### 2) POST only

- 所有接口统一 `POST`
- 查询也使用 `POST`（例如 `/list`、`/getById`）

### 3) Minimal IO

- **Request** 只包含当前动作必需字段
- **Response** 只返回当前动作需要的信息

### 4) List response contract

- 列表接口必须返回：
  - `total`: 总数（满足筛选条件后的总量）
  - `list`: 当前页数据
- 分页/筛选/排序必须由后端完成，前端禁止切片分页

## Naming conventions

接口名要从名字就能看出动作：

- Create：`/create`
- Read (list)：`/list`
- Read (single)：`/getById`（或 `/get`）
- Update：`/update`
- Delete：`/delete`

## Request/Response templates

### List

**Request**

```json
{
  "pageNo": 1,
  "pageSize": 20,
  "filters": {},
  "sort": { "field": "id", "order": "desc" }
}
```

**Response**

```json
{
  "total": 0,
  "list": []
}
```

### Create

**Request**：只传创建所需字段  
**Response**：返回新资源 id（或资源本身）+ 必要字段

### Update

**Request**：主键 + 要更新的字段  
**Response**：返回 success 或更新后的资源

### Delete

**Request**：主键  
**Response**：`{ "success": true }`

## Common status codes

- 200：成功（查询/更新/删除）
- 201：成功（创建）
- 400：参数错误
- 401：未登录
- 403：无权限
- 404：资源不存在
- 409：冲突（重复创建/唯一键冲突）

## Anti-patterns (avoid)

- `saveXxx`：既新增又修改，职责不清
- `createAndList`：一次请求做多个动作
- 列表接口返回全量数据再让前端切片

## Test prompts (2–3)

用于验证触发与输出结构是否符合规范：

1. “做一个账号管理后台的接口：要支持列表分页筛选、新增、编辑、删除，全部用 POST。”
2. “把这个 controller 的接口设计推翻重建，要求单一职责，列表返回 total+list。”
3. “给我设计一个订单接口：按订单号/状态筛选，排序按创建时间倒序。”
