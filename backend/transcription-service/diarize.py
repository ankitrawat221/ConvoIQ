import argparse
import json
import math
import os
import sys
from pathlib import Path
from typing import Any


MODEL_ID = "pyannote/speaker-diarization-community-1"
SUPPORTED_SUFFIXES = {".mp3", ".wav"}


def extract_turns(annotation: Any) -> list[dict[str, Any]]:
    if annotation is None:
        return []

    turns = []
    for segment, _, speaker in annotation.itertracks(yield_label=True):
        start = float(segment.start)
        end = float(segment.end)
        if not math.isfinite(start) or not math.isfinite(end) or start < 0 or end <= start:
            raise ValueError("The diarization model returned an invalid speaker timestamp.")
        turns.append({"start": start, "end": end, "model_speaker": str(speaker)})
    return sorted(turns, key=lambda turn: (turn["start"], turn["end"], turn["model_speaker"]))


def assign_speaker_ids(*turn_groups: list[dict[str, Any]]) -> dict[str, str]:
    first_occurrence: dict[str, float] = {}
    for turns in turn_groups:
        for turn in turns:
            speaker = turn["model_speaker"]
            first_occurrence[speaker] = min(
                first_occurrence.get(speaker, turn["start"]),
                turn["start"],
            )

    ordered_speakers = sorted(first_occurrence, key=lambda speaker: (first_occurrence[speaker], speaker))
    return {speaker: f"SPEAKER_{index:02d}" for index, speaker in enumerate(ordered_speakers)}


def label_turns(turns: list[dict[str, Any]], speaker_ids: dict[str, str]) -> list[dict[str, Any]]:
    return [
        {
            "start": turn["start"],
            "end": turn["end"],
            "speaker_id": speaker_ids[turn["model_speaker"]],
        }
        for turn in turns
    ]


def select_device(requested_device: str) -> str:
    if requested_device not in {"auto", "cpu", "cuda"}:
        raise ValueError("Device must be auto, cpu, or cuda.")

    import torch

    if requested_device == "cuda" and not torch.cuda.is_available():
        raise RuntimeError("CUDA was requested but is not available in this Python environment.")
    if requested_device == "auto":
        return "cuda" if torch.cuda.is_available() else "cpu"
    return requested_device


def diarize(audio_path: Path, device: str | None = None) -> dict[str, Any]:
    if audio_path.suffix.lower() not in SUPPORTED_SUFFIXES:
        raise ValueError("Only MP3 and WAV recordings are supported.")
    if not audio_path.is_file():
        raise FileNotFoundError("The audio recording was not found.")

    import torch
    from pyannote.audio import Pipeline

    selected_device = select_device(device or os.environ.get("DIARIZATION_DEVICE", "auto"))
    token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGINGFACE_HUB_TOKEN")
    pipeline = Pipeline.from_pretrained(MODEL_ID, token=token)
    if pipeline is None:
        raise RuntimeError("The diarization model could not be loaded.")
    pipeline.to(torch.device(selected_device))

    output = pipeline(str(audio_path))
    regular_turns = extract_turns(output.speaker_diarization)
    exclusive_annotation = getattr(output, "exclusive_speaker_diarization", None)
    exclusive_turns = extract_turns(exclusive_annotation)
    speaker_ids = assign_speaker_ids(regular_turns, exclusive_turns)

    return {
        "model": MODEL_ID,
        "device": selected_device,
        "speaker_count": len(speaker_ids),
        "segments": label_turns(regular_turns, speaker_ids),
        "exclusive_segments": label_turns(exclusive_turns, speaker_ids),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Run local pyannote speaker diarization.")
    parser.add_argument("audio", type=Path, help="Path to an MP3 or WAV recording.")
    parser.add_argument(
        "--device",
        choices=("auto", "cpu", "cuda"),
        default=os.environ.get("DIARIZATION_DEVICE", "auto"),
        help="Inference device (default: DIARIZATION_DEVICE or auto).",
    )
    args = parser.parse_args()

    try:
        result = diarize(args.audio, args.device)
    except FileNotFoundError as error:
        print(f"AUDIO_NOT_FOUND: {error}", file=sys.stderr)
        return 2
    except ValueError as error:
        print(f"INVALID_AUDIO: {error}", file=sys.stderr)
        return 2
    except Exception as error:
        message = str(error).strip() or "The local diarization model failed."
        access_error = any(
            marker in message.lower()
            for marker in ("401", "403", "gated", "unauthorized", "repository not found")
        )
        if access_error and not (os.environ.get("HF_TOKEN") or os.environ.get("HUGGINGFACE_HUB_TOKEN")):
            message = (
                "Hugging Face model access is required. Accept the Community-1 model conditions "
                "and set HF_TOKEN in this environment before running diarization."
            )
        print(f"DIARIZATION_FAILED: {message}", file=sys.stderr)
        return 1

    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
