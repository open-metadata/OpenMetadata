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

package org.openmetadata.service.ontology;

import java.net.URI;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.api.data.OntologyBulkFindReplace;
import org.openmetadata.schema.api.data.OntologyBulkMatchField;
import org.openmetadata.schema.api.data.OntologyBulkMatchMode;
import org.openmetadata.schema.api.data.OntologyBulkOperation;
import org.openmetadata.schema.api.data.OntologyBulkRequest;
import org.openmetadata.schema.api.data.OntologyBulkRetypeRelationships;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.OntologyConfiguration;
import org.openmetadata.schema.type.OntologyLayer;
import org.openmetadata.schema.type.RelationProvenance;
import org.openmetadata.schema.type.TermRelation;

final class OntologyBulkTestFixtures {
  static final long NOW = 1_788_300_000_000L;
  static final String USER = "modeler";
  static final UUID GLOSSARY_ID = UUID.fromString("2c55b4c5-a799-45a5-9cc5-a89dc4a2787c");
  static final UUID CUSTOMER_ID = UUID.fromString("1dfe700f-9172-4872-a2b3-d00f3df54ca6");
  static final UUID ACCOUNT_ID = UUID.fromString("9641755f-e479-438e-a622-a0a691f113c1");
  static final UUID RELATIONSHIP_ID = UUID.fromString("15d21803-fe37-49d7-b83c-a5b9e9dcb692");

  private OntologyBulkTestFixtures() {}

  static Clock clock() {
    return Clock.fixed(Instant.ofEpochMilli(NOW), ZoneOffset.UTC);
  }

  static Glossary glossary() {
    return new Glossary()
        .withId(GLOSSARY_ID)
        .withName("BusinessOntology")
        .withFullyQualifiedName("BusinessOntology")
        .withDescription("Business ontology")
        .withVersion(0.4D)
        .withOntologyConfiguration(configuration(false));
  }

  static Glossary readOnlyGlossary() {
    return glossary().withOntologyConfiguration(configuration(true));
  }

  static GlossaryTerm customer() {
    return term(CUSTOMER_ID, "Customer", "Customer record", null);
  }

  static GlossaryTerm account() {
    return term(ACCOUNT_ID, "Account", "Customer account", null);
  }

  static GlossaryTerm term(
      final UUID id, final String name, final String description, final EntityReference parent) {
    final Glossary glossary = glossary();
    final String parentFqn =
        parent == null ? glossary.getFullyQualifiedName() : parent.getFullyQualifiedName();
    return new GlossaryTerm()
        .withId(id)
        .withName(name)
        .withDisplayName(name)
        .withDescription(description)
        .withFullyQualifiedName(parentFqn + '.' + name)
        .withGlossary(glossary.getEntityReference())
        .withParent(parent)
        .withIri(URI.create("https://example.org/business/" + id))
        .withVersion(0.3D)
        .withEntityStatus(EntityStatus.DRAFT)
        .withAttributes(List.of())
        .withConceptMappings(List.of())
        .withRelatedTerms(List.of());
  }

  static OntologyBulkRequest csvRequest(final String csv, final boolean dryRun) {
    return base(OntologyBulkOperation.CSV_UPSERT, dryRun).withCsv(csv);
  }

  static OntologyBulkRequest findRequest(
      final OntologyBulkMatchField field,
      final OntologyBulkMatchMode mode,
      final String find,
      final String replacement,
      final boolean caseSensitive,
      final boolean dryRun) {
    final OntologyBulkFindReplace findReplace =
        new OntologyBulkFindReplace()
            .withField(field)
            .withMatchMode(mode)
            .withFind(find)
            .withReplacement(replacement)
            .withCaseSensitive(caseSensitive);
    return base(OntologyBulkOperation.FIND_REPLACE, dryRun).withFindReplace(findReplace);
  }

  static OntologyBulkRequest retypeRequest(
      final RelationshipType source, final RelationshipType target) {
    final OntologyBulkRetypeRelationships retype =
        new OntologyBulkRetypeRelationships()
            .withFromRelationshipTypeId(source.getId())
            .withToRelationshipTypeId(target.getId());
    return base(OntologyBulkOperation.RETYPE_RELATIONSHIPS, true).withRetype(retype);
  }

  static RelationshipType relationshipType(final String name) {
    return new RelationshipType()
        .withId(RelationshipTypeIds.stableId(name))
        .withName(name)
        .withFullyQualifiedName(name)
        .withDisplayName(name)
        .withDescription(name + " relation");
  }

  static TermRelation relation(
      final GlossaryTerm target, final RelationshipType type, final RelationProvenance provenance) {
    return new TermRelation()
        .withId(RELATIONSHIP_ID)
        .withTerm(target.getEntityReference())
        .withRelationshipType(type.getEntityReference())
        .withRelationType(type.getName())
        .withProvenance(provenance)
        .withStatus(EntityStatus.DRAFT)
        .withCreatedBy(USER)
        .withCreatedAt(NOW);
  }

  static String header() {
    return String.join(",", OntologyBulkCsvParser.HEADERS);
  }

  private static OntologyBulkRequest base(
      final OntologyBulkOperation operation, final boolean dryRun) {
    return new OntologyBulkRequest()
        .withGlossaryId(GLOSSARY_ID)
        .withOperation(operation)
        .withDryRun(dryRun)
        .withChangeSetName("bulkAuthoring")
        .withChangeSetDisplayName("Bulk authoring")
        .withChangeSetDescription("Review typed bulk ontology changes");
  }

  private static OntologyConfiguration configuration(final boolean readOnly) {
    return new OntologyConfiguration()
        .withBaseIri(URI.create("https://example.org/business/"))
        .withLayer(OntologyLayer.L_2)
        .withImports(List.of())
        .withPrefixes(List.of())
        .withIriMintingPattern("concept/{term}/{uuid}")
        .withReadOnly(readOnly)
        .withInstalledPacks(List.of());
  }
}
