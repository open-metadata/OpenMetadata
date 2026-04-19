package org.openmetadata.service.search.indexes;

import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.entity.services.SecurityService;
import org.openmetadata.service.Entity;

public class SecurityServiceIndex implements TaggableIndex, ServiceBackedIndex, LineageIndex {
  final Set<String> excludeSecurityServiceFields =
      Set.of("connection", "changeDescription", "incrementalChangeDescription");
  final SecurityService securityService;

  public SecurityServiceIndex(SecurityService securityService) {
    this.securityService = securityService;
  }

  @Override
  public Object getEntity() {
    return securityService;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.SECURITY_SERVICE;
  }

  @Override
  public Set<String> getExcludedFields() {
    return excludeSecurityServiceFields;
  }

  @Override
  public Object getIndexServiceType() {
    return securityService.getServiceType();
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    return doc;
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = SearchIndex.getDefaultFields();
    fields.put("serviceType", 5.0f);
    return fields;
  }
}
