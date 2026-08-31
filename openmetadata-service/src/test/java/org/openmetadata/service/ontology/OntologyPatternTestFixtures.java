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
import org.openmetadata.schema.api.data.InstantiateOntologyPattern;
import org.openmetadata.schema.api.data.MeasuredKpiPatternInput;
import org.openmetadata.schema.api.data.OntologyPatternTermInput;
import org.openmetadata.schema.api.data.OntologyPatternType;
import org.openmetadata.schema.api.data.ProductHierarchyPatternInput;
import org.openmetadata.schema.api.data.RegulatoryControlPatternInput;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.OntologyConfiguration;
import org.openmetadata.schema.type.OntologyLayer;

final class OntologyPatternTestFixtures {
  static final long NOW = 1_788_000_000_000L;
  static final Clock CLOCK = Clock.fixed(Instant.ofEpochMilli(NOW), ZoneOffset.UTC);

  private OntologyPatternTestFixtures() {}

  static Glossary glossary() {
    return new Glossary()
        .withId(UUID.fromString("bdc30a0b-d151-496e-99ee-bf74f8269912"))
        .withName("Governance")
        .withFullyQualifiedName("Governance")
        .withDescription("Governed concepts")
        .withOntologyConfiguration(
            new OntologyConfiguration()
                .withBaseIri(URI.create("https://example.org/governance/"))
                .withLayer(OntologyLayer.L_3)
                .withImports(List.of())
                .withPrefixes(List.of())
                .withIriMintingPattern("concept/{term}/{uuid}")
                .withReadOnly(false)
                .withInstalledPacks(List.of()));
  }

  static InstantiateOntologyPattern regulatoryRequest() {
    return request(OntologyPatternType.REGULATORY_CONTROL)
        .withRegulatoryControl(
            new RegulatoryControlPatternInput()
                .withControl(term("AccessControl"))
                .withRequirement(term("MfaRequirement"))
                .withEvidence(term("MfaEvidence")));
  }

  static InstantiateOntologyPattern measuredKpiRequest() {
    return request(OntologyPatternType.MEASURED_KPI)
        .withMeasuredKpi(
            new MeasuredKpiPatternInput()
                .withKpi(term("ActiveCustomersKpi"))
                .withMetric(term("ActiveCustomersMetric"))
                .withDimension(term("CustomerRegion")));
  }

  static InstantiateOntologyPattern productHierarchyRequest() {
    return request(OntologyPatternType.PRODUCT_HIERARCHY)
        .withProductHierarchy(
            new ProductHierarchyPatternInput()
                .withPortfolio(term("DataPortfolio"))
                .withProduct(term("MetadataProduct"))
                .withFeature(term("OntologyStudio")));
  }

  static OntologyPatternDraftFactory factory() {
    return new OntologyPatternDraftFactory(
        new OntologyPatternCatalog(),
        new OntologyPatternRequestValidator(),
        new OntologyIriMinter(),
        OntologyPatternTestFixtures::relationshipType,
        CLOCK);
  }

  static OntologyPatternTermInput term(final String name) {
    return new OntologyPatternTermInput()
        .withName(name)
        .withDisplayName(name + " display")
        .withDescription(name + " description");
  }

  private static InstantiateOntologyPattern request(final OntologyPatternType patternType) {
    return new InstantiateOntologyPattern()
        .withPatternType(patternType)
        .withGlossaryId(glossary().getId())
        .withChangeSetName("governedPattern")
        .withChangeSetDisplayName("Governed pattern")
        .withChangeSetDescription("Pattern-generated draft");
  }

  private static RelationshipType relationshipType(final String name) {
    return new RelationshipType()
        .withId(RelationshipTypeIds.stableId(name))
        .withName(name)
        .withDisplayName(name)
        .withFullyQualifiedName(name)
        .withDescription(name + " relationship");
  }
}
