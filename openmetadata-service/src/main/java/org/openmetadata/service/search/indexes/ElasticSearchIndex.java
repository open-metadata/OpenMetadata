package org.openmetadata.service.search.indexes;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.openmetadata.service.util.FullyQualifiedName;

public interface ElasticSearchIndex {
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
}
