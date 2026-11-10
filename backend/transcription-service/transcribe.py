import argparse
import json
import sys
from pathlib import Path

from faster_whisper import WhisperModel


MODEL_SIZE = "small"
SUPPORTED_SUFFIXES = {".mp3", ".wav"}


def transcribe(audio_path: Path) -> dict:
    if audio_path.suffix.lower() not in SUPPORTED_SUFFIXES:
        raise ValueError("Only MP3 and WAV recordings are supported.")
    if not audio_path.is_file():
        raise FileNotFoundError("The audio recording was not found.")

    model = WhisperModel(MODEL_SIZE, device="cpu", compute_type="int8")
    segments, info = model.transcribe(
        str(audio_path),
        beam_size=5,
        condition_on_previous_text=False,
        vad_filter=True,
    )

    transcript_segments = [
        {
            "text": segment.text.strip(),
            "start": segment.start,
            "end": segment.end,
        }
        for segment in segments
        if segment.text.strip()
    ]
    transcript = "\n".join(segment["text"] for segment in transcript_segments)
    if not transcript:
        raise ValueError("No speech was detected in the audio recording.")

    return {
        "transcript": transcript,
        "segments": transcript_segments,
        "language": info.language,
        "language_probability": info.language_probability,
        "duration": info.duration,
        "model": MODEL_SIZE,
        "speaker_identification_available": False,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Transcribe an MP3 or WAV with local Faster-Whisper.")
    parser.add_argument("audio", type=Path, help="Path to an MP3 or WAV recording.")
    args = parser.parse_args()

    try:
        result = transcribe(args.audio)
    except (FileNotFoundError, ValueError) as error:
        print(str(error), file=sys.stderr)
        return 2
    except Exception:
        print("Local audio transcription failed.", file=sys.stderr)
        return 1

    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
