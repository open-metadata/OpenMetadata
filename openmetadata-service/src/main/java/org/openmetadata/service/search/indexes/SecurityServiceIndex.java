package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.entity.services.SecurityService;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.ParseTags;

public class SecurityServiceIndex implements SearchIndex {
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
  public Set<String> getExcludedFields() {
    return excludeSecurityServiceFields;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    ParseTags parseTags =
        new ParseTags(Entity.getEntityTags(Entity.SECURITY_SERVICE, securityService));
    List<TagLabel> tags = new ArrayList<>();

    Map<String, Object> commonAttributes =
        getCommonAttributesMap(securityService, Entity.SECURITY_SERVICE);
    doc.putAll(commonAttributes);
    doc.put("tags", tags);
    doc.put("serviceType", securityService.getServiceType());
    doc.put("entityType", Entity.SECURITY_SERVICE);
    doc.put("upstreamLineage", SearchIndex.getLineageData(securityService.getEntityReference()));

    return doc;
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = SearchIndex.getDefaultFields();
    fields.put("serviceType", 5.0f);
    return fields;
  }
}
