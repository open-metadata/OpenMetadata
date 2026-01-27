RECOGNIZER_METADATA_IDENTIFIER = "recognizer_identifier"
RECOGNIZER_METADATA_NAME = "recognizer_name"
DEFAULT_RECOGNIZER_IDENTIFIER = "unknown"

TEXTUAL_EXPLANATION_TEMPLATE = (
    "Detected by `{recognizer_name}` {results_count} {maybe_plural_time} "
    + "with an average score of {results_score:.2f}."
)
TEXTUAL_EXPLANATION_PATTERN_HEADER_TEMPLATE = "Patterns matched:"
TEXTUAL_EXPLANATION_PATTERN_ITEM_TEMPLATE = "\t- `{pattern}` (scored: {score:.2f})"
