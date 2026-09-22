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

  String canonicalAliases;
  Set<String> existingAliases;
  Set<String> parentAliases;
}
