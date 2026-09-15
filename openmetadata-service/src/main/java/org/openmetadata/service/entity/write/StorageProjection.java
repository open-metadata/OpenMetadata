package org.openmetadata.service.entity.write;

import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.utils.JsonUtils;

/** Separates row attributes from relationship projections without mutating the response entity. */
public final class StorageProjection {
  private static final List<String> RELATIONSHIP_FIELDS =
      List.of(
          "href",
          "owners",
          "children",
          "tags",
          "domains",
          "dataProducts",
          "dataContract",
          "followers",
          "experts",
          "reviewers",
          "certification");

  private StorageProjection() {}

  public static ObjectNode attributes(
      final EntityInterface entity, final List<String> strippedFields) {
    final ObjectNode node = (ObjectNode) JsonUtils.valueToTree(entity);
    node.remove(RELATIONSHIP_FIELDS);
    if (strippedFields != null) {
      node.remove(strippedFields);
    }
    return node;
  }
}
