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

import jakarta.ws.rs.NotFoundException;
import java.util.List;
import org.openmetadata.schema.api.data.OntologyPatternList;
import org.openmetadata.schema.api.data.OntologyPatternRelationshipRole;
import org.openmetadata.schema.api.data.OntologyPatternTemplate;
import org.openmetadata.schema.api.data.OntologyPatternTermRole;
import org.openmetadata.schema.api.data.OntologyPatternType;

public final class OntologyPatternCatalog {
  private static final String HAS_PART = "hasPart";
  private static final String CALCULATED_FROM = "calculatedFrom";
  private static final String PART_OF = "partOf";
  private static final List<PatternDefinition> DEFINITIONS =
      List.of(regulatoryControl(), measuredKpi(), productHierarchy());

  public OntologyPatternList list() {
    return new OntologyPatternList()
        .withData(DEFINITIONS.stream().map(PatternDefinition::template).toList());
  }

  PatternDefinition require(final OntologyPatternType patternType) {
    return DEFINITIONS.stream()
        .filter(definition -> definition.template().getPatternType() == patternType)
        .findFirst()
        .orElseThrow(
            () -> new NotFoundException("Ontology pattern '" + patternType + "' not found"));
  }

  private static PatternDefinition regulatoryControl() {
    return definition(
        OntologyPatternType.REGULATORY_CONTROL,
        "Regulatory Control",
        "Connect a control to its requirement and supporting evidence.",
        List.of(
            node(PatternRole.CONTROL, null),
            node(PatternRole.REQUIREMENT, PatternRole.CONTROL),
            node(PatternRole.EVIDENCE, PatternRole.REQUIREMENT)),
        List.of(
            edge(PatternRole.CONTROL, PatternRole.REQUIREMENT, HAS_PART),
            edge(PatternRole.REQUIREMENT, PatternRole.EVIDENCE, HAS_PART)));
  }

  private static PatternDefinition measuredKpi() {
    return definition(
        OntologyPatternType.MEASURED_KPI,
        "Measured KPI",
        "Connect a KPI to its source metric and measurement dimension.",
        List.of(
            node(PatternRole.KPI, null),
            node(PatternRole.METRIC, PatternRole.KPI),
            node(PatternRole.DIMENSION, PatternRole.METRIC)),
        List.of(
            edge(PatternRole.KPI, PatternRole.METRIC, CALCULATED_FROM),
            edge(PatternRole.METRIC, PatternRole.DIMENSION, CALCULATED_FROM)));
  }

  private static PatternDefinition productHierarchy() {
    return definition(
        OntologyPatternType.PRODUCT_HIERARCHY,
        "Product Hierarchy",
        "Create a portfolio, product, and feature hierarchy.",
        List.of(
            node(PatternRole.PORTFOLIO, null),
            node(PatternRole.PRODUCT, PatternRole.PORTFOLIO),
            node(PatternRole.FEATURE, PatternRole.PRODUCT)),
        List.of(
            edge(PatternRole.PRODUCT, PatternRole.PORTFOLIO, PART_OF),
            edge(PatternRole.FEATURE, PatternRole.PRODUCT, PART_OF)));
  }

  private static PatternDefinition definition(
      final OntologyPatternType type,
      final String displayName,
      final String description,
      final List<PatternNode> nodes,
      final List<PatternEdge> edges) {
    final OntologyPatternTemplate template =
        new OntologyPatternTemplate()
            .withPatternType(type)
            .withDisplayName(displayName)
            .withDescription(description)
            .withTermRoles(nodes.stream().map(OntologyPatternCatalog::termRole).toList())
            .withRelationshipRoles(edges.stream().map(OntologyPatternCatalog::edgeRole).toList());
    return new PatternDefinition(template, nodes, edges);
  }

  private static OntologyPatternTermRole termRole(final PatternNode node) {
    return new OntologyPatternTermRole()
        .withKey(node.role().key())
        .withDisplayName(node.role().displayName())
        .withDescription(node.role().description());
  }

  private static OntologyPatternRelationshipRole edgeRole(final PatternEdge edge) {
    return new OntologyPatternRelationshipRole()
        .withFromRole(edge.from().key())
        .withToRole(edge.to().key())
        .withRelationshipType(edge.relationshipType());
  }

  private static PatternNode node(final PatternRole role, final PatternRole parent) {
    return new PatternNode(role, parent);
  }

  private static PatternEdge edge(
      final PatternRole from, final PatternRole to, final String relationshipType) {
    return new PatternEdge(from, to, relationshipType);
  }

  enum PatternRole {
    CONTROL("control", "Control", "A policy or control objective."),
    REQUIREMENT("requirement", "Requirement", "A requirement enforced by the control."),
    EVIDENCE("evidence", "Evidence", "Evidence demonstrating that the requirement is met."),
    KPI("kpi", "KPI", "A key performance indicator."),
    METRIC("metric", "Metric", "A metric used to calculate the KPI."),
    DIMENSION("dimension", "Dimension", "A dimension used to segment the metric."),
    PORTFOLIO("portfolio", "Portfolio", "A portfolio grouping related products."),
    PRODUCT("product", "Product", "A product within the portfolio."),
    FEATURE("feature", "Feature", "A feature delivered by the product.");

    private final String key;
    private final String displayName;
    private final String description;

    PatternRole(final String key, final String displayName, final String description) {
      this.key = key;
      this.displayName = displayName;
      this.description = description;
    }

    String key() {
      return key;
    }

    String displayName() {
      return displayName;
    }

    String description() {
      return description;
    }
  }

  record PatternNode(PatternRole role, PatternRole parent) {}

  record PatternEdge(PatternRole from, PatternRole to, String relationshipType) {}

  record PatternDefinition(
      OntologyPatternTemplate template, List<PatternNode> nodes, List<PatternEdge> edges) {}
}
