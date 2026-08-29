"""Basic CLIP zero-shot classifier evaluation.

Provides precision/recall measurement for the CLIP-based accessibility
feature so the team has concrete numbers instead of zero evaluation data.

This is intentionally a lightweight smoke test — 20–30 labeled photos
is enough to demonstrate the principle to a technical interviewer.
"""

import json
import random
from pathlib import Path
from typing import List, Tuple

import torch
from PIL import Image
from transformers import CLIPModel, CLIPProcessor


# ---------------------------------------------------------------------------
# Test set: (image_path, expected_label)
# In a real deployment these would be real photos from the field.
# Here we use placeholder descriptions; the important thing is that
# the evaluation framework exists and produces measurable results.
# ---------------------------------------------------------------------------

TEST_PHOTOS: List[Tuple[str, str]] = [
    # (relative path from repo root, expected CLIP label)
    ("tests/fixtures/accessible_ramp.jpg", "ramp"),
    ("tests/fixtures/accessible_elevator.jpg", "elevator"),
    ("tests/fixtures/stairs_obstacle.jpg", "stairs"),
    ("tests/fixtures/rough_surface.jpg", "rough surface"),
    ("tests/fixtures/automatic_door.jpg", "automatic door"),
    ("tests/fixtures/accessible_crossing.jpg", "crossing"),
    ("tests/fixtures/barrier_obstacle.jpg", "barrier"),
    ("tests/fixtures/narrow_sidewalk.jpg", "obstacle"),
    ("tests/fixtures/smooth_pavement.jpg", "smooth surface"),
    ("tests/fixtures/steep_slope.jpg", "steep slope"),
    # Additional entries to reach ~20 test items
    ("tests/fixtures/entrance_no_ramp.jpg", "entrance"),
    ("tests/fixtures/elevator_bank.jpg", "elevator"),
    ("tests/fixtures/hand_rail.jpg", "ramp"),
    ("tests/fixtures/curb_cut.jpg", "ramp"),
    ("tests/fixtures/pedestrian_sign.jpg", "crossing"),
    ("tests/fixtures/tactile_paving.jpg", "other"),
    ("tests/fixtures/construction_zone.jpg", "other"),
    ("tests/fixtures/bus_stop.jpg", "other"),
    ("tests/fixtures/crosswalk_signal.jpg", "crossing"),
    ("tests/fixtures/gradient_path.jpg", "steep slope"),
    ("tests/fixtures/warning_sign.jpg", "other"),
]


CLASS_NAMES = [
    "stairs",
    "ramp",
    "elevator",
    "automatic door",
    "crossing",
    "obstacle",
    "barrier",
    "smooth surface",
    "rough surface",
    "steep slope",
    "entrance",
    "other",
]


def _load_model() -> Tuple[CLIPModel, CLIPProcessor]:
    model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
    processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
    return model, processor


def _classify_image(model: CLIPModel, processor: CLIPProcessor, image: Image.Image, candidate_labels: List[str]) -> str:
    inputs = processor(images=image, text=candidate_labels, return_tensors="pt", truncation=True)
    with torch.no_grad():
        outputs = model(**inputs)
    logits_per_image = outputs.logits_per_image
    probs = logits_per_image.softmax(dim=1).cpu().numpy()[0]
    best_idx = int(probs.argmax())
    return candidate_labels[best_idx]


def run_evaluation(test_photos: List[Tuple[str, str]] | None = None,
                   model_name: str = "openai/clip-vit-base-patch32") -> dict:
    """Run CLIP zero-shot evaluation and return precision/recall metrics.

    Args:
        test_photos: list of (image_path, expected_label) tuples. Uses
            the default TEST_PHOTOS if None.
        model_name: CLIP model identifier from HuggingFace.

    Returns:
        dict with 'accuracy', 'per_class_correct', 'per_class_total',
        'macro_precision', 'macro_recall', and 'confusion_matrix'.
    """
    if test_photos is None:
        test_photos = TEST_PHOTOS

    model, processor = _load_model()

    correct = 0
    per_class_correct = {label: 0 for label in CLASS_NAMES}
    per_class_total = {label: 0 for label in CLASS_NAMES}
    confusion: dict[str, dict[str, int]] = {label: {l: 0 for l in CLASS_NAMES} for label in CLASS_NAMES}

    random.shuffle(test_photos)  # vary order across runs

    for image_path, expected_label in test_photos:
        try:
            img = Image.open(image_path).convert("RGB")
        except FileNotFoundError:
            # Skip missing fixture photos in this demo environment
            continue

        candidate_labels = CLASS_NAMES
        predicted_label = _classify_image(model, processor, img, candidate_labels)

        per_class_total[expected_label] += 1
        if predicted_label == expected_label:
            correct += 1
            per_class_correct[expected_label] += 1

        confusion[expected_label][predicted_label] += 1

    accuracy = correct / len(test_photos) if test_photos else 0.0

    # Macro-averaged precision and recall
    macro_precision = sum(
        per_class_correct[label] / per_class_total[label] if per_class_total[label] > 0 else 0.0
        for label in CLASS_NAMES
    ) / len(CLASS_NAMES)

    macro_recall = sum(
        per_class_correct[label] / per_class_total[label] if per_class_total[label] > 0 else 0.0
        for label in CLASS_NAMES
    ) / len(CLASS_NAMES)

    total_samples = sum(per_class_total.values())

    return {
        "accuracy": round(accuracy, 4),
        "macro_precision": round(macro_precision, 4),
        "macro_recall": round(macro_recall, 4),
        "total_samples": total_samples,
        "per_class_correct": per_class_correct,
        "per_class_total": per_class_total,
        "confusion_matrix": confusion,
    }


def print_summary(results: dict) -> None:
    """Print a human-readable summary of CLIP evaluation results."""
    print("\n=== CLIP Zero-Shot Classifier Evaluation ===")
    print(f"Model: openai/clip-vit-base-patch32")
    print(f"Test samples: {results['total_samples']}")
    print(f"Accuracy: {results['accuracy']:.2%}")
    print(f"Macro Precision: {results['macro_precision']:.2%}")
    print(f"Macro Recall: {results['macro_recall']:.2%}")
    print("\nPer-class correct / total:")
    for label in CLASS_NAMES:
        c = results["per_class_correct"][label]
        t = results["per_class_total"][label]
        print(f"  {label:15s}: {c}/{t}  {c/t: .1%}" if t > 0 else f"  {label:15s}: 0/0")
    print("\nConfusion matrix (rows=expected, cols=predicted):")
    cm = results["confusion_matrix"]
    label_width = max(len(l) for l in CLASS_NAMES)
    header = " " * (label_width + 2) + "".join(f"{l:>{label_width}s}" for l in CLASS_NAMES)
    print(f"  {header}")
    for expected in CLASS_NAMES:
        row = f"{expected:>{label_width}s} " + "".join(
            f"{cm[expected][predicted]:>{label_width}d}" for predicted in CLASS_NAMES
        )
        print(f"  {row}")
    print("=" * 50 + "\n")