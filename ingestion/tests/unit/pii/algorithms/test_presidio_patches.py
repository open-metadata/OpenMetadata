#  Copyright 2025 Collate
#  Licensed under the Collate Community License, Version 1.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
import pytest
from presidio_analyzer import RecognizerResult
from presidio_analyzer.nlp_engine.ner_model_configuration import LABELS_TO_IGNORE
from presidio_analyzer.predefined_recognizers import SpacyRecognizer

from metadata.pii.algorithms.presidio_patches import (
    _NAMED_ENTITIES,
    date_time_patcher,
    named_entity_patcher,
    spells_out_a_date,
)


def date_time_result(text: str) -> RecognizerResult:
    return RecognizerResult(entity_type="DATE_TIME", start=0, end=len(text), score=0.85)


def result_for(entity_type: str, text: str, span: str) -> RecognizerResult:
    start = text.index(span)
    return RecognizerResult(entity_type=entity_type, start=start, end=start + len(span), score=0.85)


@pytest.mark.parametrize(
    "text",
    [
        "2018-01-05",
        "20180105",
        "01/05/2018",
        "Jan 5, 2018",
        "2015-03-14 07:22:31",
    ],
)
def test_spells_out_a_date_accepts_real_dates(text: str):
    assert spells_out_a_date(text) is True


@pytest.mark.parametrize(("text", "named"), [("2018-03", "year and month"), ("March 14", "month and day")])
def test_spells_out_a_date_accepts_partial_dates(text: str, named: str):
    """Naming two of the three parts is a date; naming one is a number that parses as one.

    `2018-03` and `March 14` stay, `1999` and `29.99` go -- see the rejection cases below.
    """
    assert spells_out_a_date(text) is True, named


@pytest.mark.parametrize(
    "text",
    [
        "1001",  # an order id
        "1999",  # an academic year code
        "2018",  # a bare year
        "29.99",  # a price
        "60001",
        "1760000000123",  # epoch milliseconds
        "v1",
    ],
)
def test_spells_out_a_date_rejects_bare_numbers(text: str):
    assert spells_out_a_date(text) is False


def test_date_time_patcher_drops_bare_numbers():
    """spaCy labels bare integers as DATE; without this the column is tagged PII (#29083).

    Under the old sample-size average these stray matches were diluted away. Scoring on the
    strongest single match makes a single one of them enough to tag the column, so the
    false positive has to be dropped at the source instead.
    """
    assert date_time_patcher([date_time_result("1001")], "1001") == []


def test_date_time_patcher_keeps_real_dates():
    result = date_time_result("2018-01-05")

    assert date_time_patcher([result], "2018-01-05") == [result]


def test_date_time_patcher_leaves_other_entities_untouched():
    result = RecognizerResult(entity_type="PERSON", start=0, end=4, score=0.85)

    assert date_time_patcher([result], "1001") == [result]


@pytest.mark.parametrize("entity_type", ["PERSON", "LOCATION", "NRP"])
def test_named_entity_patcher_drops_spans_holding_digits(entity_type: str):
    """spaCy reads chunks of an opaque id as a name; roughly one UUID in three trips it.

    The assertion the DB integration fixture makes -- that a UUID primary key stays untagged --
    is a coin flip without this, now that a single match is enough to tag a column.
    """
    uuid_value = "b1e3a1c2-1111-4222-8333-444455556666"
    result = result_for(entity_type, uuid_value, "b1e3a1c2-1111")

    assert named_entity_patcher([result], uuid_value) == []


@pytest.mark.parametrize(
    ("text", "span"),
    [
        ("John", "John"),
        ("7192 Kalanianaole Hwy", "Kalanianaole Hwy"),
        ("2220 Coit Rd", "Coit"),
    ],
)
def test_named_entity_patcher_keeps_real_names(text: str, span: str):
    result = result_for("PERSON", text, span)

    assert named_entity_patcher([result], text) == [result]


def test_named_entity_patcher_leaves_dates_untouched():
    """Dates are spelled with digits; date_time_patcher is what vets those."""
    result = result_for("DATE_TIME", "2018-01-05", "2018-01-05")

    assert named_entity_patcher([result], "2018-01-05") == [result]


def test_every_ner_entity_is_vetted_by_a_patcher():
    """A new spaCy entity type has to be routed to a patcher, not left to score unchecked.

    Content is scored on the strongest single match, so one stray NER hit of an unvetted
    entity type is enough to tag a whole column. Presidio drops the labels in
    LABELS_TO_IGNORE before they ever reach a recognizer; everything else has to be vetted
    here. This fails when Presidio widens SpacyRecognizer.ENTITIES.
    """
    vetted = _NAMED_ENTITIES | {"DATE_TIME"}

    assert set(SpacyRecognizer.ENTITIES) - vetted - set(LABELS_TO_IGNORE) == set()
