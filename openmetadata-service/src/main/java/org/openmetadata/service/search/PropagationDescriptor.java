package org.openmetadata.service.search;

public record PropagationDescriptor(
    String fieldName,
    PropagationType propagationType,
    String nestPath // nullable - only NESTED_FIELD
    ) {
  public enum PropagationType {
    ENTITY_REFERENCE_LIST,
    ENTITY_REFERENCE,
    TAG_LABEL_LIST,
    NESTED_FIELD,
    SIMPLE_VALUE,
    RAW_REPLACE,
    // Field is gated for propagation but the actual cascade is driven by a dedicated handler
    // in SearchRepository (e.g. propagateCertificationTags / cascadeCertificationToChildren),
    // because the generic descriptor-driven scripts can't express its semantics — cert, for
    // example, needs full-object replace on add/update and explicit removal on delete, which
    // RAW_REPLACE can't do (RAW_REPLACE restores the old value on delete).
    EXTERNAL_HANDLER
  }
}
