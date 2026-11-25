# Card prefix recovery requires explicit fields and a complete valid remainder

- **Status:** Accepted
- **Revisions:** v1 2026-10-15 (initial)
- **Deciders:** Issue #34386 implementation scope approved by the requester
- **Guard:** `test_card_recovers_complete_remainder_after_explicit_prefix`, `test_card_prefix_recovery_requires_entire_valid_remainder`, and `test_shipped_card_prefix_recovery_preserves_spans_and_label_metadata`
- **Related:** #34386, #34674

## Context

A numeric candidate can contain a date or quantity followed by a card. Recovering arbitrary
substrings can also mistake part of a longer card or operational number for a complete card.

## Decision

Try the whole candidate first. Within the existing bounded numeric candidate, recover a card
only after a valid calendar `YYYY-MM-DD` date, or an integer preceded by a case-insensitive
`Qty` or `Quantity` label. The complete remainder must satisfy the existing grouping, issuer,
and Luhn checks. Preserve original offsets and recognizer metadata.

Do not slide numeric windows or discard trailing fields after prefix recovery. In particular,
a valid 16-digit card followed by three digits remains rejected. Preserve the separate existing
year recovery and complete 19-digit-card priority, explicit-plus exclusions, embedded-token
exclusions, and 5,000-character candidate bound.

## Consequences

Clearly identified fields no longer hide complete cards. Unlabeled numeric prefixes and invalid
calendar dates cannot trigger new recovery. Existing candidate segmentation remains unchanged:
tabs and newlines may already separate a card from another numeric field, even an invalid date.
Further prefix or suffix recovery needs its own evidence and acceptance cases.
