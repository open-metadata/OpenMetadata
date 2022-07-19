package org.openmetadata.catalog.security.policyevaluator;

import java.util.List;
import lombok.Builder;
import lombok.Getter;
import org.openmetadata.catalog.type.MetadataOperation;

/** OperationContext for Access Control Policy */
@Builder
@Getter
public class OperationContext {
  private String resource;
  private List<MetadataOperation> operations;
}
