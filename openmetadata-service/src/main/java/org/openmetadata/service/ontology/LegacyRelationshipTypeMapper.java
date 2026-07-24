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

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.net.URI;
import java.net.URLEncoder;
import java.time.Clock;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.openmetadata.schema.configuration.GlossaryTermRelationSettings;
import org.openmetadata.schema.configuration.GlossaryTermRelationType;
import org.openmetadata.schema.configuration.RelationCardinality;
import org.openmetadata.schema.configuration.RelationCategory;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.RelationshipCardinality;
import org.openmetadata.schema.type.RelationshipCharacteristic;
import org.openmetadata.schema.type.RelationshipPaletteKey;
import org.openmetadata.schema.type.RelationshipTypeCategory;
import org.openmetadata.schema.type.SemanticReference;
import org.openmetadata.service.Entity;

/** Converts the pre-2.0 settings contract into governed relationship-type entities. */
public final class LegacyRelationshipTypeMapper {
  private static final String DEFAULT_PREDICATE_BASE = "https://open-metadata.org/ontology/";
  private static final String LOCAL_REFERENCE_BASE = "urn:openmetadata:glossary-term:";
  private final Clock clock;

  public LegacyRelationshipTypeMapper(final Clock clock) {
    this.clock = clock;
  }

  public List<RelationshipType> map(
      final GlossaryTermRelationSettings settings, final String updatedBy) {
    final List<RelationshipType> relationshipTypes = new ArrayList<>();
    for (final GlossaryTermRelationType configuredType : listOrEmpty(settings.getRelationTypes())) {
      relationshipTypes.add(map(configuredType, updatedBy));
    }
    resolveInverseReferences(relationshipTypes, settings);
    return List.copyOf(relationshipTypes);
  }

  public RelationshipType map(
      final GlossaryTermRelationType configuredType, final String updatedBy) {
    final URI predicate = predicate(configuredType);
    final boolean isSystemDefined = Boolean.TRUE.equals(configuredType.getIsSystemDefined());
    return new RelationshipType()
        .withId(RelationshipTypeIds.stableId(configuredType.getName()))
        .withName(configuredType.getName())
        .withFullyQualifiedName(configuredType.getName())
        .withDisplayName(configuredType.getDisplayName())
        .withDescription(description(configuredType))
        .withIri(predicate)
        .withRdfPredicate(predicate)
        .withCategory(category(configuredType, predicate))
        .withDomain(semanticReferences(configuredType.getDomain()))
        .withRange(semanticReferences(configuredType.getRange()))
        .withCharacteristics(characteristics(configuredType))
        .withCardinality(cardinality(configuredType))
        .withCrossGlossaryAllowed(!Boolean.FALSE.equals(configuredType.getIsCrossGlossaryAllowed()))
        .withPaletteKey(palette(configuredType.getCategory()))
        .withSystemDefined(isSystemDefined)
        .withEntityStatus(EntityStatus.APPROVED)
        .withVersion(0.1)
        .withUpdatedAt(clock.millis())
        .withUpdatedBy(updatedBy)
        .withDeleted(false)
        .withProvider(isSystemDefined ? ProviderType.SYSTEM : ProviderType.USER);
  }

  private static String description(final GlossaryTermRelationType configuredType) {
    final String description = configuredType.getDescription();
    return description == null ? "" : description;
  }

  private static URI predicate(final GlossaryTermRelationType configuredType) {
    final URI configuredPredicate = configuredType.getRdfPredicate();
    final URI predicate =
        configuredPredicate == null
            ? URI.create(DEFAULT_PREDICATE_BASE + configuredType.getName())
            : configuredPredicate;
    return predicate;
  }

  private static RelationshipTypeCategory category(
      final GlossaryTermRelationType configuredType, final URI predicate) {
    final RelationshipTypeCategory category;
    if (!Boolean.TRUE.equals(configuredType.getIsSystemDefined())) {
      category = RelationshipTypeCategory.CUSTOM;
    } else if ("www.w3.org".equals(predicate.getHost())) {
      category = RelationshipTypeCategory.OWL_SKOS;
    } else {
      category = RelationshipTypeCategory.CORE;
    }
    return category;
  }

  private static RelationshipPaletteKey palette(final RelationCategory category) {
    return switch (category) {
      case HIERARCHICAL -> RelationshipPaletteKey.GREEN;
      case EQUIVALENCE -> RelationshipPaletteKey.ROSE;
      case ASSOCIATIVE -> RelationshipPaletteKey.BLUE;
      case null -> RelationshipPaletteKey.VIOLET;
    };
  }

  private static Set<SemanticReference> semanticReferences(final List<String> references) {
    return listOrEmpty(references).stream()
        .map(LegacyRelationshipTypeMapper::semanticReference)
        .collect(Collectors.toUnmodifiableSet());
  }

  private static SemanticReference semanticReference(final String reference) {
    URI iri;
    try {
      final URI parsed = URI.create(reference);
      iri = parsed.isAbsolute() ? parsed : localReference(reference);
    } catch (IllegalArgumentException exception) {
      iri = localReference(reference);
    }
    return new SemanticReference().withIri(iri);
  }

  private static URI localReference(final String reference) {
    return URI.create(LOCAL_REFERENCE_BASE + URLEncoder.encode(reference, UTF_8));
  }

  private static Set<RelationshipCharacteristic> characteristics(
      final GlossaryTermRelationType configuredType) {
    final Set<RelationshipCharacteristic> characteristics =
        EnumSet.noneOf(RelationshipCharacteristic.class);
    add(characteristics, configuredType.getIsSymmetric(), RelationshipCharacteristic.SYMMETRIC);
    add(characteristics, configuredType.getIsTransitive(), RelationshipCharacteristic.TRANSITIVE);
    add(characteristics, configuredType.getIsFunctional(), RelationshipCharacteristic.FUNCTIONAL);
    add(
        characteristics,
        configuredType.getIsInverseFunctional(),
        RelationshipCharacteristic.INVERSE_FUNCTIONAL);
    add(characteristics, configuredType.getIsReflexive(), RelationshipCharacteristic.REFLEXIVE);
    add(characteristics, configuredType.getIsIrreflexive(), RelationshipCharacteristic.IRREFLEXIVE);
    add(characteristics, configuredType.getIsAsymmetric(), RelationshipCharacteristic.ASYMMETRIC);
    return Set.copyOf(characteristics);
  }

  private static void add(
      final Set<RelationshipCharacteristic> characteristics,
      final Boolean enabled,
      final RelationshipCharacteristic characteristic) {
    if (Boolean.TRUE.equals(enabled)) {
      characteristics.add(characteristic);
    }
  }

  private static RelationshipCardinality cardinality(
      final GlossaryTermRelationType configuredType) {
    final Integer sourceMax = sourceMax(configuredType);
    final Integer targetMax = targetMax(configuredType);
    final RelationshipCardinality cardinality =
        sourceMax == null && targetMax == null
            ? null
            : new RelationshipCardinality().withSourceMax(sourceMax).withTargetMax(targetMax);
    return cardinality;
  }

  private static Integer sourceMax(final GlossaryTermRelationType configuredType) {
    final Integer configuredMax = configuredType.getSourceMax();
    final Integer sourceMax =
        Boolean.TRUE.equals(configuredType.getIsFunctional())
            ? Integer.valueOf(1)
            : configuredMax == null ? sourcePreset(configuredType.getCardinality()) : configuredMax;
    return sourceMax;
  }

  private static Integer targetMax(final GlossaryTermRelationType configuredType) {
    final Integer configuredMax = configuredType.getTargetMax();
    final Integer targetMax =
        Boolean.TRUE.equals(configuredType.getIsInverseFunctional())
            ? Integer.valueOf(1)
            : configuredMax == null ? targetPreset(configuredType.getCardinality()) : configuredMax;
    return targetMax;
  }

  private static Integer sourcePreset(final RelationCardinality preset) {
    return switch (preset) {
      case ONE_TO_ONE, MANY_TO_ONE -> 1;
      case ONE_TO_MANY, MANY_TO_MANY, CUSTOM -> null;
      case null -> null;
    };
  }

  private static Integer targetPreset(final RelationCardinality preset) {
    return switch (preset) {
      case ONE_TO_ONE, ONE_TO_MANY -> 1;
      case MANY_TO_ONE, MANY_TO_MANY, CUSTOM -> null;
      case null -> null;
    };
  }

  private static void resolveInverseReferences(
      final List<RelationshipType> relationshipTypes, final GlossaryTermRelationSettings settings) {
    for (final GlossaryTermRelationType configuredType : listOrEmpty(settings.getRelationTypes())) {
      final RelationshipType relationshipType =
          findType(relationshipTypes, configuredType.getName());
      final String inverseName = configuredType.getInverseRelation();
      if (inverseName != null) {
        relationshipType.setInverse(reference(findType(relationshipTypes, inverseName)));
      } else if (Boolean.TRUE.equals(configuredType.getIsSymmetric())) {
        relationshipType.setInverse(reference(relationshipType));
      }
    }
  }

  private static RelationshipType findType(
      final List<RelationshipType> relationshipTypes, final String name) {
    return relationshipTypes.stream()
        .filter(type -> name.equals(type.getName()))
        .findFirst()
        .orElseThrow(
            () -> new IllegalArgumentException("Relationship type '" + name + "' is not defined"));
  }

  private static EntityReference reference(final RelationshipType relationshipType) {
    return new EntityReference()
        .withId(relationshipType.getId())
        .withType(Entity.RELATIONSHIP_TYPE)
        .withName(relationshipType.getName())
        .withFullyQualifiedName(relationshipType.getFullyQualifiedName())
        .withDisplayName(relationshipType.getDisplayName())
        .withDescription(relationshipType.getDescription());
  }
}
