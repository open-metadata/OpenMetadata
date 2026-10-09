package org.openmetadata.service.search;

import java.util.Set;

/**
 * A field whose change on an entity is copied onto the search entries of its children. {@code
 * skippedChildAliases} names the child indexes it must not reach, because their entries take that
 * field from elsewhere.
 */
public record PropagationDescriptor(
    String fieldName,
    PropagationType propagationType,
    String nestPath, // nullable - only NESTED_FIELD
    Set<String> skippedChildAliases) {

  public PropagationDescriptor(String fieldName, PropagationType propagationType, String nestPath) {
    this(fieldName, propagationType, nestPath, Set.of());
  }

  /** The same propagation, kept off the given child indexes. */
  public PropagationDescriptor skipping(String... childAliases) {
    return new PropagationDescriptor(fieldName, propagationType, nestPath, Set.of(childAliases));
  }

  public boolean reaches(String childAlias) {
    return !skippedChildAliases.contains(childAlias);
  }

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
