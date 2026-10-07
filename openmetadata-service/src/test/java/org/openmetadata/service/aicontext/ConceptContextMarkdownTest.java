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
package org.openmetadata.service.aicontext;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.AIContext;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.OntologyAttribute;
import org.openmetadata.schema.type.OntologyAttributeDataType;
import org.openmetadata.schema.type.TermRelation;
import org.openmetadata.schema.type.aicontext.AssetContext;
import org.openmetadata.schema.type.aicontext.ColumnProfileSummary;
import org.openmetadata.schema.type.aicontext.ConceptBinding;
import org.openmetadata.schema.type.aicontext.ConceptContext;
import org.openmetadata.schema.type.aicontext.ConceptEvidence;
import org.openmetadata.schema.type.personaContext.ContextSection;
import org.openmetadata.service.Entity;

class ConceptContextMarkdownTest {
  @Test
  void preservesSynonymsDeclaredUnitsEnumValuesAndTypedRelations() {
    String markdown = AIContextMarkdown.render(context(concept()));

    assertTrue(markdown.contains("**Synonyms:** Revenue, Sales"));
    assertTrue(markdown.contains("| amount | DECIMAL | cents |"));
    assertTrue(markdown.contains("Active"));
    assertTrue(markdown.contains("on\\|hold"));
    assertTrue(markdown.contains("broader → `Business.Finance`"));
  }

  @Test
  void distinguishesQueryExcerptsAndRecordedStatusFromUnknownExecutionStatus() {
    ConceptContext concept =
        concept()
            .withEvidence(
                List.of(
                    new ConceptEvidence()
                        .withFullyQualifiedName("saved.failed")
                        .withQuery("SELECT amount FROM orders")
                        .withQueryTruncated(true)
                        .withLastRunAt(123L)
                        .withLastRunStatus("failed"),
                    new ConceptEvidence()
                        .withFullyQualifiedName("saved.unknown")
                        .withQuery("SELECT amount FROM orders")));

    String markdown = AIContextMarkdown.render(context(concept));

    assertTrue(markdown.contains("25%"));
    assertTrue(markdown.contains("NULL, 100"));
    assertTrue(markdown.contains("1970-01-01T00:00:00.123Z"));
    assertTrue(markdown.contains("Status: failed"));
    assertTrue(markdown.contains("Query excerpt; fetch the saved Query"));
    assertFalse(markdown.substring(markdown.indexOf("saved.unknown")).contains("Status:"));
  }

  @Test
  void honorsRequestedSectionsWhenRenderingAConcept() {
    StringBuilder markdown = new StringBuilder();

    AIContextMarkdown.appendEntitySections(
        markdown, context(concept()), Set.of(ContextSection.SCHEMA), "##");

    String rendered = markdown.toString();
    assertTrue(rendered.contains("Concept Definition"));
    assertTrue(rendered.contains("Ontology Attributes"));
    assertTrue(rendered.contains("Concept Bindings"));
    assertFalse(rendered.contains("Related Terms"));
    assertFalse(rendered.contains("Bound Column Profiles"));
    assertFalse(rendered.contains("Saved Query Evidence"));
  }

  private static AIContext context(ConceptContext concept) {
    return new AIContext()
        .withEntityType(Entity.GLOSSARY_TERM)
        .withFullyQualifiedName("Business.Amount")
        .withAssetContext(new AssetContext().withConceptContext(concept));
  }

  private static ConceptContext concept() {
    return new ConceptContext()
        .withDefinition("An amount stored in cents.")
        .withSynonyms(List.of("Revenue", "Sales"))
        .withAttributes(
            List.of(
                new OntologyAttribute()
                    .withId(UUID.randomUUID())
                    .withName("amount")
                    .withDataType(OntologyAttributeDataType.DECIMAL)
                    .withUnit("cents"),
                new OntologyAttribute()
                    .withId(UUID.randomUUID())
                    .withName("status")
                    .withDataType(OntologyAttributeDataType.ENUM)
                    .withEnumValues(Set.of("Active", "on|hold"))))
        .withRelatedTerms(
            List.of(
                new TermRelation()
                    .withRelationType("broader")
                    .withTerm(
                        new EntityReference()
                            .withType(Entity.GLOSSARY_TERM)
                            .withFullyQualifiedName("Business.Finance"))))
        .withBindings(
            List.of(
                new ConceptBinding()
                    .withAssetFqn("svc.db.schema.orders")
                    .withAssetType(Entity.TABLE)
                    .withColumn("svc.db.schema.orders.amount")
                    .withProfile(
                        new ColumnProfileSummary()
                            .withName("amount")
                            .withNullProportion(0.25)
                            .withDistinctCount(3.0)
                            .withMin("0")
                            .withMax("500"))
                    .withSampleValues(Arrays.asList(null, 100))))
        .withEvidence(
            List.of(
                new ConceptEvidence()
                    .withFullyQualifiedName("saved.amount")
                    .withQuery("SELECT amount FROM orders")));
  }
}
