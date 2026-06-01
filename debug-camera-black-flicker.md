# Debug Session: camera-black-flicker
- **Status**: [CLOSED]
- **Issue**: 班级摄像头实时检测时，实时性已提升，但监控画面仍持续出现一黑一黑的闪烁
- **Debug Server**: http://127.0.0.1:7777/event
- **Log File**: .dbg/trae-debug-log-camera-black-flicker.ndjson

## Reproduction Steps
1. 打开班级摄像头检测页面
2. 点击“启动检测”
3. 观察监控画面区域
4. 画面持续出现周期性黑闪

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | 视频元素本身在高频取帧时发生 `readyState`/尺寸抖动，导致预览层短暂掉帧发黑 | High | Low | Pending |
| B | 高速状态更新引发组件级重渲染，导致 `<video>` 节点被浏览器重新合成或短暂不可见 | High | Low | Pending |
| C | 前端同步编码或绘制耗时过高，主线程阻塞，视频预览无法稳定刷新 | High | Low | Pending |
| D | 页面装饰层或检测框层在运行态叠加时触发视觉上的“黑闪错觉” | Med | Low | Pending |
| E | 摄像头流轨道本身不稳定，浏览器视频轨道发生 `mute`/`ended`/异常恢复 | Med | Med | Pending |

## Log Evidence
- 修复前：日志连续出现“摄像头轨道已创建”与“视频事件:emptied”，说明实时循环期间反复重新申请摄像头并重挂视频流。
- 修复前：编码耗时大多数仅约 2-3ms，个别尖峰约 50ms，但不足以解释稳定规律性的黑闪，故主因不是同步编码阻塞。
- 修复后：运行态心跳持续稳定，`trackReadyState=live`、`trackMuted=false`、`tickScheduled=true`，且用户确认“黑闪已消失”。

## Verification Conclusion
- 已确认根因是前端在已有视频流时仍重复申请摄像头，导致 `<video>` 周期性触发 `emptied` 并产生黑闪。
- 已修复为复用现有摄像头流，不再重复申请；用户已确认摄像头画面黑闪消失。
- 页面偶发整体闪动进一步通过降低运行态页面级特效与重绘压力进行缓解。
