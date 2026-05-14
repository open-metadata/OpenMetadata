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
    RAW_REPLACE
  }
}
