# Context file metadata edits preserve the stored content references

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `DriveMapperTest`, `ContextFileRepositoryTest`, `ContextFileIT`, `DriveFileUploadIT`
- **Related:** Context Center Drive upload and metadata endpoints

## Context

Context Center uploads create the stored asset and content snapshot together. Metadata requests
do not create that content, and a PUT that omits content fields must keep the uploaded document.

## Decision

The upload path assigns `ContextFile.assetId` and `ContextFile.headContentId` after request mapping.
POST and PUT metadata requests supplying the legacy `CreateContextFile.assetId` field receive 400
and must use the upload endpoint to add content. PUT and PATCH updates always preserve both stored
references, including when the submitted fields are absent or null. Processing and moves keep
using the existing references.

## Consequences

Metadata edits return and index the same content references that remain in the stored file.
Any future flow that attaches content must establish the references through a server-owned
operation, rather than a metadata request.
