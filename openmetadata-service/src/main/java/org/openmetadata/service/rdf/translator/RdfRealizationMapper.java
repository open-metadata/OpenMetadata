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
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.Resource;
import org.openmetadata.schema.type.AssetRealizationRole;

/**
 * Projects each realization of a concept as a predicate naming the asset's role. The plain {@code
 * om:mappedTo} edge comes from the MAPPED_TO relationship row, which the relationship writers own;
 * this mapper adds the role that row leaves out.
 */
public final class RdfRealizationMapper {
  private static final String OM_NS = "https://open-metadata.org/ontology/";
  public static final String HAS_PRIMARY_STORE = OM_NS + "hasPrimaryStore";
  public static final String HAS_DERIVED_ASSET = OM_NS + "hasDerivedAsset";
  public static final String HAS_REPLICA = OM_NS + "hasReplica";

  private RdfRealizationMapper() {}

  /** The predicate for a role; a realization without one is the primary store, as in the schema. */
  public static String rolePredicate(final AssetRealizationRole role) {
    final AssetRealizationRole resolved = role == null ? AssetRealizationRole.PRIMARY_STORE : role;
    return switch (resolved) {
      case PRIMARY_STORE -> HAS_PRIMARY_STORE;
      case DERIVED -> HAS_DERIVED_ASSET;
      case REPLICA -> HAS_REPLICA;
    };
  }

  static void emit(
      final JsonNode realizations,
      final Resource concept,
      final Model model,
      final String baseUri) {
    for (final JsonNode realization : realizations) {
      final JsonNode asset = realization.path("asset");
      if (asset.hasNonNull("id") && asset.hasNonNull("type")) {
        concept.addProperty(
            model.createProperty(rolePredicate(role(realization))),
            model.createResource(
                baseUri + "entity/" + asset.get("type").asText() + "/" + asset.get("id").asText()));
      }
    }
  }

  private static AssetRealizationRole role(final JsonNode realization) {
    final JsonNode role = realization.path("role");
    return role.isTextual() ? AssetRealizationRole.fromValue(role.asText()) : null;
  }
}
