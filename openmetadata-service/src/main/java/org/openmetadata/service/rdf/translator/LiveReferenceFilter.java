/*
 *  Copyright 2026 Collate
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
package org.openmetadata.service.rdf.translator;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.service.Entity;

/**
 * Prepares an entity document for mapping to RDF. For the graph ({@link ReferenceScope#LIVE}) it
 * drops references to soft-deleted entities and labels whose tag or glossary term is not live: the
 * graph holds no soft-deleted entity, and either would put back a node the delete removed. In every
 * scope each live label gets the IRI of its tag or term under {@value #LABEL_IRI}, so the mapper
 * links to it without another lookup.
 */
final class LiveReferenceFilter {
  static final String LABEL_IRI = "@id";
  private static final String TAG_FQN = "tagFQN";
  private static final String SOURCE = "source";
  private static final String GLOSSARY_SOURCE = "Glossary";

  private final String baseUri;
  private final LiveTagLookup tagLookup;
  private final ReferenceScope scope;

  LiveReferenceFilter(
      final String baseUri, final LiveTagLookup tagLookup, final ReferenceScope scope) {
    this.baseUri = baseUri;
    this.tagLookup = tagLookup;
    this.scope = scope;
  }

  /** Resolves, in place, the labels of {@code document} and drops what its scope excludes. */
  void apply(final JsonNode document) {
    apply(document, tagLookup);
  }

  /** As {@link #apply(JsonNode)}, resolving labels through {@code labels}. */
  void apply(final JsonNode document, final LiveTagLookup labels) {
    final Map<String, Map<String, UUID>> liveLabels = new HashMap<>();
    labelFqnsByType(List.of(document))
        .forEach((type, fqns) -> liveLabels.put(type, labels.liveIds(type, fqns)));
    retainLive(document, liveLabels);
  }

  /**
   * Resolves the labels of every document with one lookup per label type. The result answers for
   * these documents only and is dropped with them, so it never outlives the read it reflects.
   */
  LiveTagLookup resolveTogether(final Collection<JsonNode> documents) {
    final Map<String, Map<String, UUID>> resolved = new HashMap<>();
    labelFqnsByType(documents)
        .forEach((type, fqns) -> resolved.put(type, tagLookup.liveIds(type, fqns)));
    return (type, fqns) -> {
      final Map<String, UUID> live = resolved.getOrDefault(type, Map.of());
      final Map<String, UUID> requested = new HashMap<>();
      fqns.stream().filter(live::containsKey).forEach(fqn -> requested.put(fqn, live.get(fqn)));
      return requested;
    };
  }

  private static Map<String, Set<String>> labelFqnsByType(final Collection<JsonNode> documents) {
    final Map<String, Set<String>> labelFqnsByType = new HashMap<>();
    documents.forEach(document -> collectLabels(document, labelFqnsByType));
    return labelFqnsByType;
  }

  private static void collectLabels(
      final JsonNode node, final Map<String, Set<String>> labelFqnsByType) {
    if (isLabel(node)) {
      labelFqnsByType
          .computeIfAbsent(labelType(node), ignored -> new HashSet<>())
          .add(node.get(TAG_FQN).asText());
    }
    node.forEach(child -> collectLabels(child, labelFqnsByType));
  }

  private void retainLive(final JsonNode node, final Map<String, Map<String, UUID>> liveLabels) {
    if (node instanceof ArrayNode array) {
      for (int index = array.size() - 1; index >= 0; index--) {
        if (!isLive(array.get(index), liveLabels)) {
          array.remove(index);
        }
      }
    } else if (node instanceof ObjectNode object) {
      final List<String> fieldNames = new ArrayList<>();
      object.fieldNames().forEachRemaining(fieldNames::add);
      for (final String fieldName : fieldNames) {
        if (!isLive(object.get(fieldName), liveLabels)) {
          object.remove(fieldName);
        }
      }
    }
  }

  private boolean isLive(final JsonNode node, final Map<String, Map<String, UUID>> liveLabels) {
    final boolean live;
    if (isDeletedReference(node)) {
      live = scope == ReferenceScope.ALL;
    } else if (isLabel(node)) {
      live = resolveLabel((ObjectNode) node, liveLabels) || scope == ReferenceScope.ALL;
    } else {
      retainLive(node, liveLabels);
      live = true;
    }
    return live;
  }

  private boolean resolveLabel(
      final ObjectNode label, final Map<String, Map<String, UUID>> liveLabels) {
    final String type = labelType(label);
    final UUID id = liveLabels.getOrDefault(type, Map.of()).get(label.get(TAG_FQN).asText());
    if (id != null) {
      label.put(LABEL_IRI, baseUri + "entity/" + type + "/" + id);
    }
    return id != null;
  }

  private static boolean isDeletedReference(final JsonNode node) {
    return node.isObject()
        && node.path("id").isTextual()
        && node.path("type").isTextual()
        && node.path("deleted").asBoolean(false);
  }

  private static boolean isLabel(final JsonNode node) {
    return node.isObject() && node.path(TAG_FQN).isTextual();
  }

  private static String labelType(final JsonNode label) {
    return GLOSSARY_SOURCE.equalsIgnoreCase(label.path(SOURCE).asText())
        ? Entity.GLOSSARY_TERM
        : Entity.TAG;
  }
}
