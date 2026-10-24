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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import com.fasterxml.jackson.databind.node.ObjectNode;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Consumer;
import org.openmetadata.schema.OntologyDefinition;
import org.openmetadata.schema.api.data.OntologyReleaseStructureReport;
import org.openmetadata.schema.api.data.OntologyReleaseValidation;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.NativeOntologyDeprecationImpact;
import org.openmetadata.schema.type.NativeOntologyShaclReport;
import org.openmetadata.schema.type.OntologyReleaseChangeType;
import org.openmetadata.schema.type.OntologyReleaseLogicalCheck;
import org.openmetadata.schema.type.OntologyReleaseMember;
import org.openmetadata.schema.type.OntologyReleaseMemberChange;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.jdbi3.OntologyReleaseRepository;
import org.openmetadata.service.rdf.NativeOntologyValidation;

/** Combines immutable release findings with fresh authorized bindings and captured dependencies. */
public final class OntologyReleaseValidationService {
  private static final int MAX_CACHE_STRING_LENGTH = 131_072;
  private final OntologyReleaseReader reader;
  private final OntologyConceptBindingService bindings;
  private final NativeOntologyValidation nativeValidation = new NativeOntologyValidation();
  private final Cache<String, FrozenFindings> cache =
      Caffeine.newBuilder().maximumSize(256).build();

  public OntologyReleaseValidationService(
      final OntologyReleaseRepository releases, final OntologyConceptBindingService bindings) {
    reader = new OntologyReleaseReader(releases.getDaoCollection());
    this.bindings = bindings;
  }

  public OntologyReleaseValidation report(
      final OntologyRelease release,
      final OntologyRelease base,
      final Consumer<List<? extends OntologyDefinition>> authorize,
      final OntologyConceptBindingService.Access access) {
    requireCapturedBase(release, base);
    final List<OntologyReleaseMember> members = reader.read(release, authorize);
    final List<OntologyReleaseMember> previous =
        base == null ? List.of() : reader.read(base, authorize);
    FrozenFindings frozen = cache.getIfPresent(release.getContentDigest());
    if (frozen == null) {
      frozen = freeze(release, members);
      if ((long) frozen.structure().length() + frozen.shacl().length() <= MAX_CACHE_STRING_LENGTH) {
        cache.put(release.getContentDigest(), frozen);
      }
    }
    final OntologyReleaseStructureReport structure = structure(release.getId(), frozen);
    final NativeOntologyShaclReport shacl =
        JsonUtils.readValue(frozen.shacl(), NativeOntologyShaclReport.class);
    final List<NativeOntologyDeprecationImpact> impacts =
        impacts(release, previous, members, access);
    return new OntologyReleaseValidation()
        .withReleaseId(release.getId())
        .withContentDigest(release.getContentDigest())
        .withBaseReleaseId(base == null ? null : base.getId())
        .withValid(Boolean.TRUE.equals(structure.getValid()) && shacl.getViolationCount() == 0)
        .withLogicalCheck(OntologyReleaseLogicalCheck.NOT_RUN)
        .withStructure(structure)
        .withShacl(shacl)
        .withDeprecationImpacts(impacts);
  }

  private static void requireCapturedBase(
      final OntologyRelease release, final OntologyRelease base) {
    if (!Objects.equals(release.getBaseReleaseId(), base == null ? null : base.getId())
        || (base != null
            && !Objects.equals(release.getOntology().getId(), base.getOntology().getId()))) {
      throw new BadRequestException(
          "Validation requires the release's captured same-ontology base");
    }
  }

  private FrozenFindings freeze(
      final OntologyRelease release, final List<OntologyReleaseMember> members) {
    final OntologyReleaseStructureReport structure =
        OntologyStructureValidator.validate(release, members);
    final NativeOntologyShaclReport shacl = nativeValidation.validate(release, members);
    final ObjectNode detached = JsonUtils.getObjectMapper().valueToTree(structure);
    detached.remove("releaseId");
    detached.withArray("violations").forEach(issue -> ((ObjectNode) issue).remove("releaseId"));
    return new FrozenFindings(detached.toString(), JsonUtils.pojoToJson(shacl));
  }

  private static OntologyReleaseStructureReport structure(
      final UUID releaseId, final FrozenFindings frozen) {
    final OntologyReleaseStructureReport structure =
        JsonUtils.readValue(frozen.structure(), OntologyReleaseStructureReport.class);
    structure.withReleaseId(releaseId);
    structure.getViolations().forEach(issue -> issue.withReleaseId(releaseId));
    return structure;
  }

  private List<NativeOntologyDeprecationImpact> impacts(
      final OntologyRelease release,
      final List<OntologyReleaseMember> previous,
      final List<OntologyReleaseMember> members,
      final OntologyConceptBindingService.Access access) {
    final List<OntologyReleaseMemberChange> deprecated =
        OntologyReleaseComparison.compareMembers(previous, members).stream()
            .filter(change -> change.getChangeType() == OntologyReleaseChangeType.DEPRECATED)
            .toList();
    if (deprecated.isEmpty()) {
      return List.of();
    }
    final CapturedDependencies dependencies = CapturedDependencies.from(release, members);
    return deprecated.stream().map(change -> impact(change, dependencies, access)).toList();
  }

  private NativeOntologyDeprecationImpact impact(
      final OntologyReleaseMemberChange change,
      final CapturedDependencies dependencies,
      final OntologyConceptBindingService.Access access) {
    final EntityReference definition = change.getEntity();
    final List<EntityReference> assets =
        change.getMemberKind() == OntologyReleaseMember.MemberKind.CONCEPT
            ? bindings.get(access, definition.getId()).getAssets().stream()
                .map(binding -> identity(binding.getAsset()))
                .sorted(CapturedDependencies.REFERENCE_ORDER)
                .toList()
            : List.of();
    final String iri = dependencies.iri(change);
    final boolean concept = change.getMemberKind() == OntologyReleaseMember.MemberKind.CONCEPT;
    return new NativeOntologyDeprecationImpact()
        .withDefinition(definition)
        .withBoundAssetCount(assets.size())
        .withBoundAssets(assets)
        .withSubclasses(concept ? dependencies.subclasses(iri) : List.of())
        .withDomainProperties(concept ? dependencies.domainProperties(iri) : List.of())
        .withRangeProperties(concept ? dependencies.rangeProperties(iri) : List.of());
  }

  private static EntityReference identity(final EntityReference source) {
    return new EntityReference()
        .withId(source.getId())
        .withType(source.getType())
        .withName(source.getName())
        .withFullyQualifiedName(source.getFullyQualifiedName())
        .withDisplayName(source.getDisplayName());
  }

  private record FrozenFindings(String structure, String shacl) {}

  private record CapturedDependencies(
      Map<String, String> irisByMember,
      Map<String, Map<String, EntityReference>> subclassesByParent,
      Map<String, Map<String, EntityReference>> domainByClass,
      Map<String, Map<String, EntityReference>> rangeByClass) {
    private static final Comparator<EntityReference> REFERENCE_ORDER =
        Comparator.comparing(EntityReference::getType)
            .thenComparing(reference -> reference.getId().toString());

    static CapturedDependencies from(
        final OntologyRelease release, final List<OntologyReleaseMember> members) {
      final Map<String, String> irisByMember = new HashMap<>();
      final Map<String, OntologyConcept> concepts = new HashMap<>();
      final List<OntologyDefinition> definitions =
          members.stream()
              .map(member -> OntologyReleaseReader.definition(release, member))
              .toList();
      for (final OntologyDefinition definition : definitions) {
        switch (definition) {
          case OntologyConcept concept -> {
            irisByMember.put(
                key(OntologyReleaseMember.MemberKind.CONCEPT, concept.getId()),
                concept.getIri().toString());
            concepts.put(concept.getIri().toString(), concept);
          }
          case OntologyProperty property -> irisByMember.put(
              key(OntologyReleaseMember.MemberKind.PROPERTY, property.getId()),
              property.getIri().toString());
          default -> {}
        }
      }
      final Map<String, Map<String, EntityReference>> subclasses = new HashMap<>();
      final Map<String, Map<String, EntityReference>> domains = new HashMap<>();
      final Map<String, Map<String, EntityReference>> ranges = new HashMap<>();
      for (final OntologyDefinition definition : definitions) {
        switch (definition) {
          case OntologyAxiom axiom -> {
            final OntologyConcept child = concepts.get(String.valueOf(axiom.getSubjectIri()));
            if (child != null) {
              OntologyClassHierarchy.namedParents(axiom)
                  .forEach(parent -> add(subclasses, parent.toString(), captured(child)));
            }
          }
          case OntologyProperty property -> {
            listOrEmpty(property.getDomain())
                .forEach(domain -> add(domains, domain.toString(), captured(property)));
            listOrEmpty(property.getRange())
                .forEach(range -> add(ranges, range.toString(), captured(property)));
          }
          default -> {}
        }
      }
      return new CapturedDependencies(irisByMember, subclasses, domains, ranges);
    }

    String iri(final OntologyReleaseMemberChange change) {
      final String iri = irisByMember.get(key(change.getMemberKind(), change.getEntity().getId()));
      if (iri == null) {
        throw new BadRequestException(
            "A deprecated definition is missing from its captured release");
      }
      return iri;
    }

    List<EntityReference> subclasses(final String iri) {
      return values(subclassesByParent, iri);
    }

    List<EntityReference> domainProperties(final String iri) {
      return values(domainByClass, iri);
    }

    List<EntityReference> rangeProperties(final String iri) {
      return values(rangeByClass, iri);
    }

    private static EntityReference captured(final OntologyDefinition definition) {
      return definition.getEntityReference().withDescription(null).withHref(null);
    }

    private static void add(
        final Map<String, Map<String, EntityReference>> index,
        final String iri,
        final EntityReference reference) {
      index
          .computeIfAbsent(iri, ignored -> new HashMap<>())
          .put(reference.getType() + ":" + reference.getId(), reference);
    }

    private static List<EntityReference> values(
        final Map<String, Map<String, EntityReference>> index, final String iri) {
      return index.getOrDefault(iri, Map.of()).values().stream().sorted(REFERENCE_ORDER).toList();
    }

    private static String key(final OntologyReleaseMember.MemberKind kind, final UUID id) {
      return kind.value() + ":" + id;
    }
  }
}
