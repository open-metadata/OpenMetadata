package org.openmetadata.service.search.indexes;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;

public interface SearchIndex {
  Map<String, Object> buildESDoc();

  default Set<String> getFQNParts(String fqn, List<String> fqnSplits) {
    Set<String> fqnParts = new HashSet<>();
    fqnParts.add(fqn);
    String parent = FullyQualifiedName.getParentFQN(fqn);
    while (parent != null) {
      fqnParts.add(parent);
      parent = FullyQualifiedName.getParentFQN(parent);
    }
    fqnParts.addAll(fqnSplits);
    return fqnParts;
  }

  default EntityReference getOwnerWithDisplayName(EntityReference owner) {
    EntityReference cloneOwner = JsonUtils.deepCopy(owner, EntityReference.class);
    cloneOwner.setDisplayName(
        CommonUtil.nullOrEmpty(cloneOwner.getDisplayName()) ? cloneOwner.getName() : cloneOwner.getDisplayName());
    return cloneOwner;
  }

  default EntityReference getDomainWithDisplayName(EntityReference domain) {
    EntityReference cloneDomain = JsonUtils.deepCopy(domain, EntityReference.class);
    cloneDomain.setDisplayName(
        CommonUtil.nullOrEmpty(cloneDomain.getDisplayName()) ? cloneDomain.getName() : cloneDomain.getDisplayName());
    return cloneDomain;
  }
}
