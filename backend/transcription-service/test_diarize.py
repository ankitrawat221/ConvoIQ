import unittest

from diarize import assign_speaker_ids, extract_turns, label_turns


class Segment:
    def __init__(self, start, end):
        self.start = start
        self.end = end


class Annotation:
    def __init__(self, turns):
        self.turns = turns

    def itertracks(self, yield_label=False):
        for index, (start, end, speaker) in enumerate(self.turns):
            yield Segment(start, end), index, speaker


class DiarizationOutputTests(unittest.TestCase):
    def test_speakers_are_renumbered_by_first_occurrence_and_reused(self):
        turns = extract_turns(Annotation([
            (2.0, 3.0, "model-b"),
            (0.0, 1.0, "model-a"),
            (0.5, 1.5, "model-b"),
        ]))
        speaker_ids = assign_speaker_ids(turns)

        self.assertEqual(speaker_ids, {"model-a": "SPEAKER_00", "model-b": "SPEAKER_01"})
        self.assertEqual(
            label_turns(turns, speaker_ids),
            [
                {"start": 0.0, "end": 1.0, "speaker_id": "SPEAKER_00"},
                {"start": 0.5, "end": 1.5, "speaker_id": "SPEAKER_01"},
                {"start": 2.0, "end": 3.0, "speaker_id": "SPEAKER_01"},
            ],
        )

    def test_speaker_ids_are_shared_between_regular_and_exclusive_turns(self):
        regular = extract_turns(Annotation([(0.0, 1.0, "model-a"), (1.0, 2.0, "model-b")]))
        exclusive = extract_turns(Annotation([(0.2, 0.9, "model-a"), (1.1, 1.8, "model-b")]))
        speaker_ids = assign_speaker_ids(regular, exclusive)

        self.assertEqual(
            label_turns(exclusive, speaker_ids),
            [
                {"start": 0.2, "end": 0.9, "speaker_id": "SPEAKER_00"},
                {"start": 1.1, "end": 1.8, "speaker_id": "SPEAKER_01"},
            ],
        )

    def test_invalid_timestamps_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "invalid speaker timestamp"):
            extract_turns(Annotation([(1.0, 1.0, "model-a")]))


if __name__ == "__main__":
    unittest.main()
