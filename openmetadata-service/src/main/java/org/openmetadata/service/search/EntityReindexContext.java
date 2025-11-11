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
  String canonicalAliases;
  Set<String> existingAliases;
  Set<String> parentAliases;
}
