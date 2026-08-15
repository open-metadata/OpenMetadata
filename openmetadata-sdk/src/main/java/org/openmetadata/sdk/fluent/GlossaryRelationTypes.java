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
package org.openmetadata.sdk.fluent;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Consumer;
import org.openmetadata.schema.configuration.GlossaryTermRelationSettings;
import org.openmetadata.schema.configuration.GlossaryTermRelationType;
import org.openmetadata.schema.configuration.RelationCategory;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Pure Fluent API for the glossary term relation type vocabulary.
 *
 * <p>Relation types are the vocabulary {@link GlossaryTerms}{@code .relateTo(...).as(type)} draws
 * from. Reading them is open to any authenticated user; defining a new one requires admin.
 *
 * <p>Usage:
 *
 * <pre>
 * import static org.openmetadata.sdk.fluent.GlossaryRelationTypes.*;
 *
 * // List every configured relation type
 * list().forEach(type -&gt; System.out.println(type.getName()));
 *
 * // Just the names, to populate a picker
 * List&lt;String&gt; names = list().names();
 *
 * // Only the associative ones
 * list().inCategory(RelationCategory.ASSOCIATIVE).fetch();
 *
 * // Look one up before using it in a relation
 * if (exists("prescribes")) {
 *   GlossaryTerms.find(hcpId).relateTo(drugFqn).as("prescribes").apply();
 * }
 *
 * // How often each type is used across all terms
 * Map&lt;String, Integer&gt; usage = usage();
 *
 * // Register a new type (admin only)
 * define(new GlossaryTermRelationType().withName("prescribes")
 *     .withDisplayName("Prescribes").withCategory(RelationCategory.ASSOCIATIVE));
 * </pre>
 */
public final class GlossaryRelationTypes {
  private static OpenMetadataClient defaultClient;

  private GlossaryRelationTypes() {} // Prevent instantiation

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "Client not initialized. Call GlossaryRelationTypes.setDefaultClient() first.");
    }
    return defaultClient;
  }

  // ==================== Listing ====================

  public static GlossaryRelationTypeLister list() {
    return new GlossaryRelationTypeLister(getClient());
  }

  /** The full relation configuration, not just the relation types. */
  public static GlossaryTermRelationSettings settings() {
    return getClient().settings().getGlossaryRelationSettings();
  }

  // ==================== Lookup ====================

  /** Look up a single relation type by name, empty when it is not configured. */
  public static Optional<GlossaryTermRelationType> find(String name) {
    return list().fetch().stream().filter(type -> matchesName(type, name)).findFirst();
  }

  public static boolean exists(String name) {
    return find(name).isPresent();
  }

  /** Per-relation-type usage counts across all glossary terms. */
  public static Map<String, Integer> usage() {
    return getClient().glossaryTerms().relationTypeUsage();
  }

  // ==================== Definition (admin only) ====================

  /**
   * Register a relation type, preserving the ones already configured. No-op when a type of the same
   * name already exists. Requires admin — non-admin callers get a 403.
   */
  public static GlossaryTermRelationSettings define(GlossaryTermRelationType relationType) {
    return getClient().settings().defineGlossaryRelationType(relationType);
  }

  private static boolean matchesName(GlossaryTermRelationType type, String name) {
    return type.getName() != null && type.getName().equals(name);
  }

  // ==================== Lister ====================

  public static class GlossaryRelationTypeLister {
    private final OpenMetadataClient client;
    private RelationCategory category;

    GlossaryRelationTypeLister(OpenMetadataClient client) {
      this.client = client;
    }

    /** Keep only the relation types in the given category. */
    public GlossaryRelationTypeLister inCategory(RelationCategory category) {
      this.category = category;
      return this;
    }

    public List<GlossaryTermRelationType> fetch() {
      List<GlossaryTermRelationType> relationTypes = client.settings().glossaryRelationTypes();
      List<GlossaryTermRelationType> selected = new ArrayList<>();
      for (GlossaryTermRelationType relationType : relationTypes) {
        if (category == null || category.equals(relationType.getCategory())) {
          selected.add(relationType);
        }
      }
      return selected;
    }

    /** The relation type names, in configuration order — enough to populate a picker. */
    public List<String> names() {
      List<String> names = new ArrayList<>();
      for (GlossaryTermRelationType relationType : fetch()) {
        names.add(relationType.getName());
      }
      return names;
    }

    public void forEach(Consumer<GlossaryTermRelationType> action) {
      fetch().forEach(action);
    }
  }
}
