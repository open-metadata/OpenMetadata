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
package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.apache.jena.query.QueryExecution;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.Property;
import org.apache.jena.rdf.model.RDFNode;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.shacl.validation.ReportEntry;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.configuration.rdf.InferenceRule;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.ColumnLineage;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.rdf.storage.RdfStorageInterface;
import org.openmetadata.service.rdf.translator.JsonLdTranslator;

/** The starter inference rules can only derive facts if the projection writes what they read. */
class RdfRuleInputProjectionTest {
  private static final String BASE = "https://open-metadata.org/";
  private static final String OM = BASE + "ontology/";
  private static final String SOURCE_TABLE = "service.db.schema.customers";
  private static final String TARGET_TABLE = "service.db.schema.contacts";
  private static final String SOURCE_COLUMN = SOURCE_TABLE + ".email";
  private static final String TARGET_COLUMN = TARGET_TABLE + ".email";
  private static final Set<String> COLUMN_LINEAGE_PATHS =
      Set.of("<" + OM + "fromColumn>", "<" + OM + "toColumn>");
  private final UUID sourceId = UUID.randomUUID();
  private final UUID targetId = UUID.randomUUID();

  @Test
  void reindexedColumnLineageReferencesColumnResources() {
    final Model model = lineageModel();
    final Resource columnLineage = onlyColumnLineage(model);

    assertTrue(
        model.contains(columnLineage, property(model, "fromColumn"), column(model, SOURCE_COLUMN)));
    assertTrue(
        model.contains(columnLineage, property(model, "toColumn"), column(model, TARGET_COLUMN)));
    assertTrue(model.contains(columnLineage, property(model, "fromColumnFqn"), SOURCE_COLUMN));
    assertTrue(model.contains(columnLineage, property(model, "toColumnFqn"), TARGET_COLUMN));
    assertFalse(model.contains(columnLineage, property(model, "fromColumn"), SOURCE_COLUMN));
    assertFalse(model.contains(columnLineage, property(model, "toColumn"), TARGET_COLUMN));
  }

  @Test
  void columnLineageBetweenProjectedTablesConformsToColumnLineageShape() {
    final Model catalog = lineageModel();
    catalog.add(tableModel(sourceId, "customers", SOURCE_TABLE, List.of()));
    catalog.add(tableModel(targetId, "contacts", TARGET_TABLE, List.of()));

    final List<ReportEntry> violations = columnLineageViolations(catalog);

    assertTrue(violations.isEmpty(), violations::toString);
  }

  @Test
  void literalColumnLineageEndpointsViolateColumnLineageShape() {
    final Model catalog = lineageModel();
    final Resource columnLineage = onlyColumnLineage(catalog);
    catalog.removeAll(columnLineage, property(catalog, "fromColumn"), null);
    catalog.add(columnLineage, property(catalog, "fromColumn"), SOURCE_COLUMN);

    assertFalse(columnLineageViolations(catalog).isEmpty());
  }

  @Test
  void piiRulePropagatesAcrossReindexedColumnLineage() {
    final Model model = lineageModel();
    final Resource piiTag = model.createResource(BASE + "entity/tag/" + UUID.randomUUID());
    model.add(column(model, SOURCE_COLUMN), property(model, "hasTag"), piiTag);
    model.add(piiTag, property(model, "tagFQN"), "PII.Sensitive");

    final Model inferred = construct("pii-propagation-via-lineage", model);

    assertTrue(
        inferred.contains(column(inferred, TARGET_COLUMN), property(inferred, "hasTag"), piiTag));
  }

  @Test
  void assetDomainsAreProjectedAsDomainMembership() {
    final UUID domainId = UUID.randomUUID();
    final Model model = tableModel(domainId);
    final Resource table = model.createResource(BASE + "entity/table/" + sourceId);
    final Resource domain = model.createResource(BASE + "entity/domain/" + domainId);

    assertTrue(model.contains(table, property(model, "belongsToDomain"), domain));
    assertFalse(model.contains(table, property(model, "domains"), (RDFNode) null));
  }

  @Test
  void domainRuleGivesColumnsTheirTablesDomain() {
    final UUID domainId = UUID.randomUUID();
    final Model inferred = construct("domain-membership-inheritance", tableModel(domainId));

    assertTrue(
        inferred.contains(
            column(inferred, SOURCE_COLUMN),
            property(inferred, "belongsToDomain"),
            inferred.createResource(BASE + "entity/domain/" + domainId)));
  }

  private Model lineageModel() {
    final ColumnLineage columnLineage =
        new ColumnLineage().withFromColumns(List.of(SOURCE_COLUMN)).withToColumn(TARGET_COLUMN);
    final LineageDetails details = new LineageDetails().withColumnsLineage(List.of(columnLineage));
    return repository().buildLineageModel(Entity.TABLE, sourceId, Entity.TABLE, targetId, details);
  }

  private Model tableModel(final UUID domainId) {
    final EntityReference domain =
        new EntityReference()
            .withId(domainId)
            .withType(Entity.DOMAIN)
            .withName("Sales")
            .withFullyQualifiedName("Sales");
    return tableModel(sourceId, "customers", SOURCE_TABLE, List.of(domain));
  }

  private static Model tableModel(
      final UUID id, final String name, final String fqn, final List<EntityReference> domains) {
    EntityInterface.CANONICAL_ENTITY_NAME_MAP.put("table", Entity.TABLE);
    final Table table =
        new Table()
            .withId(id)
            .withName(name)
            .withFullyQualifiedName(fqn)
            .withColumns(
                List.of(
                    new Column()
                        .withName("email")
                        .withFullyQualifiedName(fqn + ".email")
                        .withDataType(ColumnDataType.VARCHAR)))
            .withDomains(domains);
    return new JsonLdTranslator(new ObjectMapper(), BASE).toRdf(table);
  }

  private static Model construct(final String ruleName, final Model input) {
    try (QueryExecution execution = QueryExecution.create(ruleBody(ruleName), input)) {
      return execution.execConstruct(ModelFactory.createDefaultModel());
    }
  }

  private static List<ReportEntry> columnLineageViolations(final Model catalog) {
    return RdfShaclValidator.validate(catalog).getEntries().stream()
        .filter(entry -> COLUMN_LINEAGE_PATHS.contains(String.valueOf(entry.resultPath())))
        .toList();
  }

  private static String ruleBody(final String ruleName) {
    final String resource = "/rdf/inference-rules/" + ruleName + ".json";
    try (InputStream input = RdfRuleInputProjectionTest.class.getResourceAsStream(resource)) {
      return JsonUtils.getObjectMapper().readValue(input, InferenceRule.class).getRuleBody();
    } catch (IOException exception) {
      throw new IllegalStateException("Unable to read starter rule " + resource, exception);
    }
  }

  private static Resource onlyColumnLineage(final Model model) {
    final List<Resource> columnLineages =
        model
            .listSubjectsWithProperty(
                model.createProperty("http://www.w3.org/1999/02/22-rdf-syntax-ns#", "type"),
                model.createResource(OM + "ColumnLineage"))
            .toList();
    assertEquals(1, columnLineages.size(), "expected one column lineage, got " + columnLineages);
    return columnLineages.getFirst();
  }

  private static Resource column(final Model model, final String columnFqn) {
    return model.createResource(RdfUtils.columnUri(BASE, columnFqn));
  }

  private static Property property(final Model model, final String localName) {
    return model.createProperty(OM, localName);
  }

  private static RdfRepository repository() {
    return new RdfRepository(
        new RdfConfiguration().withEnabled(true).withBaseUri(URI.create(BASE)),
        mock(RdfStorageInterface.class),
        null);
  }
}
