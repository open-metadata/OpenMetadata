from pyparsing import Combine, LineEnd, Literal, Optional, Suppress, Word, alphanums

urn_word = Word(alphanums + "_$?=%.&,")
ge_metrics_urn = Combine(
    Suppress(Literal("urn:great_expectations:"))
    + Literal("metrics").setResultsName("urn_type")
    + Suppress(":")
    + urn_word.setResultsName("run_id")
    + Suppress(":")
    + urn_word.setResultsName("expectation_suite_name")
    + Suppress(":")
    + urn_word.setResultsName("metric_name")
    + Optional(Suppress(":") + urn_word.setResultsName("metric_kwargs"))
    + Suppress(LineEnd())
)
ge_validations_urn = Combine(
    Suppress(Literal("urn:great_expectations:"))
    + Literal("validations").setResultsName("urn_type")
    + Suppress(":")
    + urn_word.setResultsName("expectation_suite_name")
    + Suppress(":")
    + urn_word.setResultsName("metric_name")
    + Optional(Suppress(":") + urn_word.setResultsName("metric_kwargs"))
    + Suppress(LineEnd())
)
ge_stores_urn = Combine(
    Suppress(Literal("urn:great_expectations:"))
    + Literal("stores").setResultsName("urn_type")
    + Suppress(":")
    + urn_word.setResultsName("store_name")
    + Suppress(":")
    + urn_word.setResultsName("metric_name")
    + Optional(Suppress(":") + urn_word.setResultsName("metric_kwargs"))
    + Suppress(LineEnd())
)

ge_urn = ge_metrics_urn | ge_validations_urn | ge_stores_urn
