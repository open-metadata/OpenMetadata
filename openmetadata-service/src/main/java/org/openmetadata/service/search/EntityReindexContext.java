package org.openmetadata.service.search;

import java.util.Set;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Builder
public class EntityReindexContext {
  String entityType;
  String canonicalIndex;
  String originalIndex;
  String activeIndex;
  String stagedIndex;

  /** Staged vector-chunk generation of the run this callback belongs to; null outside staged
   * chunk recreates. Binds per-type completion marks to their run (a later, unrelated run's
   * callbacks must never complete or promote a stale staged generation). */
  String stagedChunkIndex;

  /** The same, for the staged ontology chunk generation of the run. */
  String stagedOntologyChunkIndex;

  /** A node could not record a delete it missed in {@link #stagedChunkIndex} and failed one of
   * this type's partitions instead, so the run's chunk generation must keep its live chunks. */
  boolean stagedChunkDeleteUnrecorded;

  String canonicalAliases;
  Set<String> existingAliases;
  Set<String> parentAliases;
}
