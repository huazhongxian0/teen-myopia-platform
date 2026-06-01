import argparse
import base64
import json
import sys
from io import BytesIO


def build_parser():
    parser = argparse.ArgumentParser(description="YOLOv8 实时检测常驻工作进程")
    parser.add_argument("--model", required=True, help="YOLOv8 模型路径")
    parser.add_argument("--conf", type=float, default=0.25, help="置信度阈值")
    parser.add_argument("--iou", type=float, default=0.45, help="交并比阈值")
    parser.add_argument("--imgsz", type=int, default=640, help="推理尺寸")
    return parser


def emit(payload):
    print(json.dumps(payload, ensure_ascii=False), flush=True)


def normalize_payload(frame_data_url: str):
    if frame_data_url is None:
        return None
    value = str(frame_data_url).strip()
    return value or None


def decode_frame(frame_data_url: str):
    payload = normalize_payload(frame_data_url)
    if payload is None:
        raise ValueError("EMPTY_FRAME")
    comma_index = payload.find(",")
    if payload.startswith("data:") and comma_index >= 0:
        payload = payload[comma_index + 1:]
    try:
        return base64.b64decode(payload)
    except Exception as exc:
        raise ValueError(f"INVALID_FRAME_DATA: {exc}") from exc


def build_summary(result):
    total_detections = 0
    class_counts = {}
    detections = []

    boxes = getattr(result, "boxes", None)
    if boxes is None or boxes.cls is None:
        return total_detections, class_counts, detections

    names = getattr(result, "names", {}) or {}
    orig_shape = getattr(result, "orig_shape", None) or (0, 0)
    image_height = int(orig_shape[0]) if len(orig_shape) > 0 else 0
    image_width = int(orig_shape[1]) if len(orig_shape) > 1 else 0
    xyxy_list = boxes.xyxy.tolist() if getattr(boxes, "xyxy", None) is not None else []
    conf_list = boxes.conf.tolist() if getattr(boxes, "conf", None) is not None else []
    class_list = boxes.cls.tolist()

    for index, cls_idx in enumerate(class_list):
        class_id = int(cls_idx)
        class_name = names.get(class_id, str(class_id))
        class_counts[class_name] = class_counts.get(class_name, 0) + 1
        total_detections += 1

        if index < len(xyxy_list):
            xyxy = xyxy_list[index]
            confidence = float(conf_list[index]) if index < len(conf_list) else 0.0
            detections.append({
                "classId": class_id,
                "className": class_name,
                "confidence": round(confidence, 4),
                "x1": round(float(xyxy[0]), 2),
                "y1": round(float(xyxy[1]), 2),
                "x2": round(float(xyxy[2]), 2),
                "y2": round(float(xyxy[3]), 2),
                "imageWidth": image_width,
                "imageHeight": image_height
            })

    return total_detections, class_counts, detections


def main():
    parser = build_parser()
    args = parser.parse_args()

    try:
        import numpy as np
        from PIL import Image
        from ultralytics import YOLO
    except Exception as exc:
        emit({
            "type": "ready",
            "success": False,
            "message": f"实时检测工作进程依赖加载失败: {exc}"
        })
        return 1

    try:
        model = YOLO(args.model)
        emit({
            "type": "ready",
            "success": True,
            "message": "实时检测工作进程已启动"
        })
    except Exception as exc:
        emit({
            "type": "ready",
            "success": False,
            "message": f"实时检测模型加载失败: {exc}"
        })
        return 1

    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue
        try:
            payload = json.loads(line)
        except Exception as exc:
            emit({
                "success": False,
                "message": f"工作进程收到非法请求: {exc}"
            })
            continue

        action_type = str(payload.get("type") or "detect").strip()
        if action_type == "shutdown":
            emit({
                "type": "shutdown",
                "success": True,
                "message": "实时检测工作进程已关闭"
            })
            break

        request_id = str(payload.get("requestId") or "").strip()
        try:
            frame_bytes = decode_frame(payload.get("frameDataUrl"))
            image = Image.open(BytesIO(frame_bytes)).convert("RGB")
            image_array = np.array(image)
            results = model.predict(
                source=image_array,
                conf=args.conf,
                iou=args.iou,
                imgsz=args.imgsz,
                save=False,
                verbose=False,
            )
            result = results[0] if results else None
            total_detections, class_counts, detections = build_summary(result)
            emit({
                "success": True,
                "requestId": request_id,
                "message": "检测完成",
                "summary": {
                    "totalFrames": 1,
                    "totalDetections": total_detections,
                    "classCounts": class_counts,
                    "detections": detections
                }
            })
        except Exception as exc:
            emit({
                "success": False,
                "requestId": request_id,
                "message": f"YOLOv8 实时推理失败: {exc}"
            })

    return 0


if __name__ == "__main__":
    sys.exit(main())
