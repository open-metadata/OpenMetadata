package org.openmetadata.catalog.security.policyevaluator;

import lombok.Builder;
import lombok.Getter;
import org.openmetadata.catalog.EntityInterface;

@Builder
@Getter
public class ResourceContext {
  private String resource;
  private String fields;
  private String id;
  private String name;
  private EntityInterface entity; // Will be lazily initialized
}
