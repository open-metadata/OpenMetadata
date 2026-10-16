/*
 *  Copyright 2024 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.search;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Iterator;

/**
 * Walks the {@code properties} tree of an index mapping, handing each field its dotted path.
 *
 * <p>Several callers need the same traversal for different verdicts — which fields cannot be
 * highlighted, which {@code extension} nodes are mapped wrongly, which nested objects are missing
 * {@code type: nested}. Only the visitor differs, so the walk lives here once rather than being
 * re-implemented (with its own off-by-one prefix handling) in each.
 */
public final class IndexMappingProperties {

  private static final String MAPPINGS = "mappings";
  private static final String PROPERTIES = "properties";
  private static final char PATH_SEPARATOR = '.';

  /** Receives each mapped field in the tree. */
  @FunctionalInterface
  public interface PropertyVisitor {
    /**
     * @param path dotted path of this field, e.g. {@code columns.children.name}
     * @param field the mapping node for it
     * @return whether to descend into this field's own {@code properties}
     */
    boolean visit(String path, JsonNode field);
  }

  private IndexMappingProperties() {}

  /**
   * The top-level {@code properties} node, accepting either a whole mapping file (which nests them
   * under {@code mappings}) or a bare mapping body. Returns a missing node when neither is present.
   */
  public static JsonNode topLevel(JsonNode mappingRoot) {
    JsonNode result = mappingRoot.path(MAPPINGS).path(PROPERTIES);
    if (result.isMissingNode()) {
      result = mappingRoot.path(PROPERTIES);
    }
    return result;
  }

  /** Walks {@code properties}, visiting every field the visitor descends into. */
  public static void walk(JsonNode properties, PropertyVisitor visitor) {
    walk(properties, "", visitor);
  }

  private static void walk(JsonNode properties, String prefix, PropertyVisitor visitor) {
    Iterator<String> fieldNames = properties.fieldNames();
    while (fieldNames.hasNext()) {
      String name = fieldNames.next();
      JsonNode field = properties.path(name);
      String path = prefix.isEmpty() ? name : prefix + PATH_SEPARATOR + name;
      if (visitor.visit(path, field) && !field.path(PROPERTIES).isMissingNode()) {
        walk(field.path(PROPERTIES), path, visitor);
      }
    }
  }
}
