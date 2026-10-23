# Context Center image uploads do not run OCR

- **Status:** Accepted
- **Revisions:** v1 2026-10-23 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** ContextFileTextExtractorTest#extractImageReturnsUnsupported; DriveFileUploadIT#testUploadedImageRemainsAvailableWithoutTextExtraction
- **Related:** [#36102](https://github.com/open-metadata/OpenMetadata/issues/36102)

## Context

Context Center used Apache Tika only to invoke an externally installed Tesseract executable for
image OCR. The server Dockerfiles do not install Tesseract, so this feature was unavailable in the
standard images while the Tika dependencies still shipped in the server distribution.

## Decision

Remove Apache Tika and the optional image OCR implementation. Image uploads remain available as
reference material, with text extraction returning `Unsupported`. PDF text extraction continues
through PDFBox and Office/spreadsheet extraction through Apache POI.

## Consequences

Images no longer supply OCR text to search or AI context, including on installations that provide
Tesseract separately. Revisit OCR when a customer requires it, with an explicit plan for packaging
and supporting its runtime dependencies.
