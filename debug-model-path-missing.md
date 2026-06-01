[OPEN] model-path-missing

# 问题概述

- 现象：`ClassCameraDetectPage` 检测后前端显示“当前未找到基于 glassess 数据集训练的眼镜识别模型，请先执行 glassess/train_glasses_model.sh 生成 best.pt”
- 预期：后端应成功加载 `/Users/bytedance/Desktop/homeWork/毕设/item/glassess/runs/detect/glasses-count/weights/best.pt` 并返回检测结果

# 当前已知事实

- `application.properties` 中默认模型路径已配置为上述 `best.pt`
- 本地文件系统中该 `best.pt` 已存在
- 前端错误文案来自后端错误码 `MODEL_PATH_NOT_CONFIGURED` 或 `MODEL_FILE_NOT_FOUND` 的映射

# 待验证假设

1. 运行中的后端进程未读取当前工作区最新配置，仍在使用旧的模型路径配置。
2. 环境变量 `YOLO_MODEL_PATH` 覆盖了 `application.properties` 中的默认值，并指向空值或错误路径。
3. 运行时访问模型路径的进程用户、启动目录或文件可见性与当前终端检查结果不一致，导致 `Files.exists()` 失败。
4. 前端展示的是历史错误状态，实际后端当前错误已变化但未被正确清空或覆盖。
5. 后端在抛错时没有输出足够的路径细节，导致“文件存在但仍报不存在”的根因被掩盖。

# 下一步

- 检查运行时环境变量与启动方式
- 在后端模型路径解析处增加最小日志插桩
- 复现并比对插桩结果

# 证据结论

- 假设 1：部分成立。此前命令行重启失败，导致排查过程中存在旧进程干扰。
- 假设 2：不成立。运行时日志显示 `env.YOLO_MODEL_PATH=null`。
- 假设 3：不成立。真正失败点不是进程可见性，而是配置值本身已乱码。
- 假设 4：不成立。后端实时日志与前端文案一致，属于真实后端报错。
- 假设 5：成立。补充日志后确认 `modelPath` 中中文目录“毕设”在运行时被解析成 `æ¯è®¾`，进而触发 `MODEL_FILE_NOT_FOUND`。

# 修复方案

- 去掉 `application.properties` 中带中文绝对路径的默认模型配置
- 在 `init/init.js` 中通过 `path.join(...)` 运行时构造 `YOLO_MODEL_PATH` 并注入后端环境变量
- 启动时打印实际模型路径，便于二次验证
