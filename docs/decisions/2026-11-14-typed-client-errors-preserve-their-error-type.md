# Typed client errors preserve their error type

- **Status:** Accepted
- **Revisions:** v1 2026-11-14 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `CatalogGenericExceptionMapperTest`
- **Related:** `docs/settings-config-source-design.md`, open-metadata/OpenMetadata#35368

## Context

Clients distinguish environment-managed settings from other conflicts using
`SETTINGS_MANAGED_BY_ENVIRONMENT`. The generic exception mapper discarded that discriminator,
leaving only the HTTP code and message. Other typed client errors use the same exception model.

## Decision

A 4xx `WebServiceException` with a non-null error type returns the JSON body
`{code, errorType, message}`. This applies to all typed client errors, including ingestion
pipeline errors, rather than only settings conflicts. An untyped exception retains
`{code, message}`. HTTP status and response headers are preserved.

The error type is the machine-readable discriminator clients may branch on; the message is
for people. The additional field is additive, and clients must tolerate unknown error types
and additional fields. This rule does not change the handling of server errors.

## Consequences

Callers can offer the appropriate recovery action without parsing messages. Exceptions that
introduce a new error type must keep its meaning stable for clients that recognize it.
