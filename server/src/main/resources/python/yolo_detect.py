import argparse
import json
import sys
from pathlib import Path


def build_parser():
    parser = argparse.ArgumentParser(description="YOLOv8 视频检测脚本")
    parser.add_argument("--input", required=True, help="输入视频路径")
    parser.add_argument("--output-dir", required=True, help="输出目录")
    parser.add_argument("--model", required=True, help="YOLOv8 模型路径")
    parser.add_argument("--request-id", required=True, help="请求编号")
    parser.add_argument("--conf", type=float, default=0.25, help="置信度阈值")
    parser.add_argument("--iou", type=float, default=0.45, help="交并比阈值")
    parser.add_argument("--imgsz", type=int, default=640, help="推理尺寸")
    return parser


VIDEO_SUFFIXES = {".mp4", ".avi", ".mov", ".mkv", ".webm", ".m4v"}


def find_annotated_file(run_dir: Path, original_name: str):
    direct_file = run_dir / original_name
    if direct_file.exists():
        return str(direct_file.resolve())

    candidates = sorted(run_dir.glob("*"))
    for candidate in candidates:
        if candidate.is_file():
            return str(candidate.resolve())
    return None


def main():
    parser = build_parser()
    args = parser.parse_args()

    input_path = Path(args.input).expanduser().resolve()
    output_dir = Path(args.output_dir).expanduser().resolve()
    model_path = Path(args.model).expanduser().resolve()
    run_dir = output_dir / "annotated"

    try:
        from ultralytics import YOLO
    except Exception as exc:
        print(json.dumps({
            "success": False,
            "message": f"未安装 ultralytics 或依赖加载失败: {exc}"
        }, ensure_ascii=False))
        return 1

    if not input_path.exists():
        print(json.dumps({
            "success": False,
            "message": "输入视频不存在"
        }, ensure_ascii=False))
        return 1

    if not model_path.exists():
        print(json.dumps({
            "success": False,
            "message": "模型文件不存在"
        }, ensure_ascii=False))
        return 1

    try:
        output_dir.mkdir(parents=True, exist_ok=True)
        model = YOLO(str(model_path))
        results = model.predict(
            source=str(input_path),
            conf=args.conf,
            iou=args.iou,
            imgsz=args.imgsz,
            save=True,
            project=str(output_dir),
            name="annotated",
            exist_ok=True,
            verbose=False,
        )

        total_frames = 0
        total_detections = 0
        class_counts = {}
        detections = []
        input_suffix = input_path.suffix.lower()
        should_collect_boxes = input_suffix not in VIDEO_SUFFIXES

        for result in results:
            total_frames += 1
            boxes = getattr(result, "boxes", None)
            if boxes is None or boxes.cls is None:
                continue

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

                if should_collect_boxes and index < len(xyxy_list):
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

        annotated_path = find_annotated_file(run_dir, input_path.name)
        annotated_video_path = annotated_path if input_suffix in VIDEO_SUFFIXES else None
        annotated_image_path = annotated_path if input_suffix not in VIDEO_SUFFIXES else None

        print(json.dumps({
            "success": True,
            "message": "检测完成",
            "requestId": args.request_id,
            "summary": {
                "totalFrames": total_frames,
                "totalDetections": total_detections,
                "classCounts": class_counts,
                "detections": detections
            },
            "artifact": {
                "inputPath": str(input_path),
                "outputDir": str(run_dir),
                "annotatedVideoPath": annotated_video_path,
                "annotatedImagePath": annotated_image_path
            }
        }, ensure_ascii=False))
        return 0
    except Exception as exc:
        print(json.dumps({
            "success": False,
            "message": f"YOLOv8 推理失败: {exc}"
        }, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    sys.exit(main())
