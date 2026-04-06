/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

import java.io.IOException;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;

/**
 * Validates that the EntityLink.g4 ANTLR grammar stays in sync with entity types defined in {@link
 * Entity}. When a new entity type is added, it must be added either to the ENTITY_TYPE rule in
 * EntityLink.g4 or to {@link #ENTITIES_EXCLUDED_FROM_GRAMMAR} with a reason.
 *
 * @see <a href="https://github.com/open-metadata/OpenMetadata/issues/26578">Issue #26578</a>
 */
class EntityLinkGrammarTest {

  private static final Path GRAMMAR_FILE =
      Path.of("openmetadata-spec/src/main/antlr4/org/openmetadata/schema/EntityLink.g4");

  /**
   * Field names in {@link Entity} that are NOT entity type constants. These are filtered out when
   * collecting entity types via reflection. Fields starting with {@code FIELD_} are automatically
   * excluded.
   */
  private static final Set<String> NON_ENTITY_TYPE_FIELD_NAMES =
      Set.of(
          "SEPARATOR",
          "ADMIN_ROLE",
          "ADMIN_USER_NAME",
          "ORGANIZATION_NAME",
          "ORGANIZATION_POLICY_NAME",
          "INGESTION_BOT_NAME",
          "ALL_RESOURCES");

  /**
   * Entity types that are intentionally excluded from the EntityLink grammar. Each entry should have
   * a comment explaining why.
   */
  private static final Set<String> ENTITIES_EXCLUDED_FROM_GRAMMAR =
      Set.of(
          // Time series entities - internal data, not linkable via EntityLinks
          Entity.ENTITY_REPORT_DATA,
          Entity.TEST_CASE_RESOLUTION_STATUS,
          Entity.TEST_CASE_RESULT,
          Entity.TEST_CASE_DIMENSION_RESULT,
          Entity.PIPELINE_EXECUTION,
          Entity.ENTITY_PROFILE,
          Entity.WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA,
          Entity.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA,
          Entity.RAW_COST_ANALYSIS_REPORT_DATA,
          Entity.AGGREGATED_COST_ANALYSIS_REPORT_DATA,
          Entity.WORKFLOW_INSTANCE,
          Entity.WORKFLOW_INSTANCE_STATE,
          Entity.AUDIT_LOG,
          Entity.QUERY_COST_RECORD,
          Entity.AGENT_EXECUTION,
          Entity.DATA_CONTRACT_RESULT,
          // Internal entities - used for feeds/suggestions, not linkable targets
          Entity.THREAD,
          Entity.SUGGESTION,
          // Column entity types - sub-entity types for custom properties, not top-level
          Entity.TABLE_COLUMN,
          Entity.DASHBOARD_DATA_MODEL_COLUMN,
          // Sub-entity of Pipeline, not independently linkable
          Entity.TASK,
          // Plural alias for policy field, not an entity type
          Entity.POLICIES,
          // Generic API parent type, not a standalone linkable entity
          Entity.API,
          // Not stored via EntityRepository, uses standalone repository
          Entity.RECOGNIZER_FEEDBACK);

  @Test
  void testAllEntityTypesHaveGrammarOrExclusion() throws Exception {
    Set<String> grammarEntityTypes = parseGrammarEntityTypes();
    Set<String> entityTypeConstants = getEntityTypeConstants();

    Set<String> missingFromGrammar = new TreeSet<>();
    for (String entityType : entityTypeConstants) {
      if (!grammarEntityTypes.contains(entityType)
          && !ENTITIES_EXCLUDED_FROM_GRAMMAR.contains(entityType)) {
        missingFromGrammar.add(entityType);
      }
    }

    assertTrue(
        missingFromGrammar.isEmpty(),
        "Entity types defined in Entity.java are missing from EntityLink.g4 ENTITY_TYPE rule. "
            + "Add them to ENTITY_TYPE in EntityLink.g4 or to ENTITIES_EXCLUDED_FROM_GRAMMAR "
            + "in this test with a reason: "
            + missingFromGrammar);
  }

  @Test
  void testExcludedEntitiesAreValidConstants() throws Exception {
    Set<String> entityTypeConstants = getEntityTypeConstants();

    Set<String> staleExclusions = new TreeSet<>();
    for (String excluded : ENTITIES_EXCLUDED_FROM_GRAMMAR) {
      if (!entityTypeConstants.contains(excluded)) {
        staleExclusions.add(excluded);
      }
    }

    assertTrue(
        staleExclusions.isEmpty(),
        "ENTITIES_EXCLUDED_FROM_GRAMMAR contains entries that are not Entity.java constants. "
            + "Remove stale entries: "
            + staleExclusions);
  }

  @Test
  void testExcludedEntitiesAreNotInGrammar() throws Exception {
    Set<String> grammarEntityTypes = parseGrammarEntityTypes();

    Set<String> redundantExclusions = new TreeSet<>();
    for (String excluded : ENTITIES_EXCLUDED_FROM_GRAMMAR) {
      if (grammarEntityTypes.contains(excluded)) {
        redundantExclusions.add(excluded);
      }
    }

    assertTrue(
        redundantExclusions.isEmpty(),
        "ENTITIES_EXCLUDED_FROM_GRAMMAR contains entries that are already in the grammar. "
            + "Remove them from the exclusion set since they have grammar support: "
            + redundantExclusions);
  }

  private Set<String> parseGrammarEntityTypes() throws IOException {
    Path grammarPath = resolveGrammarPath();
    String content = Files.readString(grammarPath);

    Pattern entityTypeBlock = Pattern.compile("ENTITY_TYPE\\s*:\\s*(.*?)\\s*;", Pattern.DOTALL);
    Matcher blockMatcher = entityTypeBlock.matcher(content);
    assertTrue(blockMatcher.find(), "Could not find ENTITY_TYPE rule in EntityLink.g4");

    String block = blockMatcher.group(1);
    Set<String> types = new HashSet<>();
    Pattern typePattern = Pattern.compile("'([^']+)'");
    Matcher typeMatcher = typePattern.matcher(block);
    while (typeMatcher.find()) {
      types.add(typeMatcher.group(1));
    }
    return types;
  }

  private Set<String> getEntityTypeConstants() throws IllegalAccessException {
    Set<String> entityTypes = new HashSet<>();
    for (Field field : Entity.class.getDeclaredFields()) {
      if (Modifier.isPublic(field.getModifiers())
          && Modifier.isStatic(field.getModifiers())
          && Modifier.isFinal(field.getModifiers())
          && field.getType() == String.class
          && !field.getName().startsWith("FIELD_")
          && !NON_ENTITY_TYPE_FIELD_NAMES.contains(field.getName())) {
        entityTypes.add((String) field.get(null));
      }
    }
    return entityTypes;
  }

  private Path resolveGrammarPath() {
    if (Files.exists(GRAMMAR_FILE)) {
      return GRAMMAR_FILE;
    }
    Path fromModule = Path.of("..").resolve(GRAMMAR_FILE);
    if (Files.exists(fromModule)) {
      return fromModule;
    }
    return fail(
        "Cannot find EntityLink.g4. Tried: "
            + GRAMMAR_FILE
            + " and "
            + fromModule.toAbsolutePath());
  }
}
