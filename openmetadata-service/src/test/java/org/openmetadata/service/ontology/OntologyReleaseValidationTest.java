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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.github.benmanes.caffeine.cache.Cache;
import java.lang.reflect.Field;
import java.net.URI;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.OntologyReleaseValidation;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.OntologyConceptBindingsResponse;
import org.openmetadata.schema.type.OntologyHydratedAssetBinding;
import org.openmetadata.schema.type.OntologyLiteral;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.schema.type.OntologyReleaseMember;
import org.openmetadata.schema.type.OntologyReleaseMember.MemberKind;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.OntologyReleaseDAO;
import org.openmetadata.service.jdbi3.OntologyReleaseRepository;

class OntologyReleaseValidationTest {
  @Test
  void bindingImpactDrainsBeyondOneHundredAndContinuesAfterAnEmptyDeniedPage() {
    final var assets =
        IntStream.range(1, 152)
            .mapToObj(
                index ->
                    new OntologyHydratedAssetBinding()
                        .withAsset(
                            new EntityReference()
                                .withId(new UUID(0, index))
                                .withType("table")
                                .withName("asset" + index)))
            .toList();
    final var pages = new ArrayDeque<OntologyConceptBindingsResponse>();
    pages.add(
        new OntologyConceptBindingsResponse()
            .withRevision(1L)
            .withAssets(assets.subList(51, 151))
            .withAfter("first"));
    pages.add(
        new OntologyConceptBindingsResponse()
            .withRevision(1L)
            .withAssets(List.of())
            .withAfter("second"));
    pages.add(
        new OntologyConceptBindingsResponse().withRevision(1L).withAssets(assets.subList(0, 51)));
    final var result = OntologyReleaseValidationService.boundAssets(ignored -> pages.removeFirst());
    assertEquals(151, result.size());
    assertEquals(
        assets.stream().map(asset -> asset.getAsset().getId()).toList(),
        result.stream().map(asset -> asset.getId()).toList());
    assertTrue(pages.isEmpty());
  }

  @Test
  void equalDigestsRestoreEachReleaseIdAndReauthorizeCacheHits() {
    final Ontology ontology =
        new Ontology()
            .withId(UUID.randomUUID())
            .withName("model")
            .withFullyQualifiedName("model")
            .withIri(URI.create("https://example.org/model/"))
            .withNamespace(URI.create("https://example.org/model/"));
    final OntologyProperty property =
        new OntologyProperty()
            .withId(UUID.randomUUID())
            .withName("code")
            .withIri(URI.create("https://example.org/model/code"))
            .withOntology(ontology.getEntityReference())
            .withKind(OntologyPropertyKind.DATA)
            .withRange(List.of(URI.create("urn:UnknownDatatype")));
    final Bundle first = bundle(ontology, property);
    final Bundle second = bundle(ontology, property);
    assertEquals(first.release().getContentDigest(), second.release().getContentDigest());

    final Map<UUID, List<OntologyReleaseMember>> stored =
        Map.of(
            first.release().getId(), first.members(), second.release().getId(), second.members());
    final OntologyReleaseValidationService validation = validation(stored);
    final OntologyConceptBindingService.Access access =
        new OntologyConceptBindingService.Access(null, null);

    final OntologyReleaseValidation firstReport =
        validation.report(first.release(), null, ignored -> {}, access);
    final OntologyReleaseValidation secondReport =
        validation.report(second.release(), null, ignored -> {}, access);
    assertFalse(firstReport.getValid());
    assertEquals(first.release().getId(), firstReport.getStructure().getReleaseId());
    assertEquals(second.release().getId(), secondReport.getStructure().getReleaseId());
    assertEquals(
        second.release().getId(),
        secondReport.getStructure().getViolations().getFirst().getReleaseId());
    firstReport.getStructure().getViolations().clear();
    assertEquals(
        1,
        validation
            .report(first.release(), null, ignored -> {}, access)
            .getStructure()
            .getViolations()
            .size());
    assertThrows(
        IllegalStateException.class,
        () ->
            validation.report(
                first.release(),
                null,
                ignored -> {
                  throw new IllegalStateException("view denied");
                },
                access));
  }

  @Test
  void equalDigestsKeepDeprecationSelectionTiedToTheLiteralBase() {
    final Ontology ontology = ontology("baseSelection");
    final OntologyProperty property =
        new OntologyProperty()
            .withId(UUID.randomUUID())
            .withName("code")
            .withIri(URI.create("https://example.org/baseSelection/code"))
            .withOntology(ontology.getEntityReference())
            .withKind(OntologyPropertyKind.DATA);
    final Bundle base = bundle(ontology, property);
    property.withDeprecated(true);
    final Bundle changed = bundle(ontology, property);
    final Bundle unrelated = bundle(ontology, property);
    changed.release().withBaseReleaseId(base.release().getId());
    assertEquals(changed.release().getContentDigest(), unrelated.release().getContentDigest());
    final Map<UUID, List<OntologyReleaseMember>> stored =
        Map.of(
            base.release().getId(),
            base.members(),
            changed.release().getId(),
            changed.members(),
            unrelated.release().getId(),
            unrelated.members());
    final var validation = validation(stored);
    final var access = new OntologyConceptBindingService.Access(null, null);

    final var changedReport =
        validation.report(changed.release(), base.release(), ignored -> {}, access);
    final var unrelatedReport = validation.report(unrelated.release(), null, ignored -> {}, access);
    assertEquals(base.release().getId(), changedReport.getBaseReleaseId());
    assertEquals(1, changedReport.getDeprecationImpacts().size());
    assertEquals(
        property.getId(), changedReport.getDeprecationImpacts().getFirst().getDefinition().getId());
    assertTrue(unrelatedReport.getDeprecationImpacts().isEmpty());
  }

  @Test
  void cacheEvictsAfterItsMaximumAndDoesNotAdmitOversizedFindings() throws Exception {
    final Map<UUID, List<OntologyReleaseMember>> stored = new HashMap<>();
    final List<Bundle> small = new ArrayList<>();
    for (int index = 0; index < 257; index++) {
      final Ontology ontology = ontology("model" + index);
      final Bundle bundle = bundle(ontology);
      stored.put(bundle.release().getId(), bundle.members());
      small.add(bundle);
    }
    final Ontology ontology = ontology("large");
    final List<OntologyProperty> properties = new ArrayList<>();
    for (int index = 0; index < 1_000; index++) {
      properties.add(
          new OntologyProperty()
              .withId(UUID.randomUUID())
              .withName("status" + index)
              .withIri(URI.create("https://example.org/" + "long".repeat(35) + "/status" + index))
              .withOntology(ontology.getEntityReference())
              .withKind(OntologyPropertyKind.DATA)
              .withEnumValues(List.of(new OntologyLiteral().withValue("one"))));
    }
    final Bundle large = bundle(ontology, properties.toArray(OntologyProperty[]::new));
    stored.put(large.release().getId(), large.members());
    final var validation = validation(stored);
    final var access = new OntologyConceptBindingService.Access(null, null);

    for (final Bundle bundle : small) {
      assertTrue(validation.report(bundle.release(), null, ignored -> {}, access).getValid());
    }
    final Cache<?, ?> cache = cache(validation);
    cache.cleanUp();
    assertEquals(256, cache.estimatedSize());

    final var largeReport = validation.report(large.release(), null, ignored -> {}, access);
    assertEquals(1_000, largeReport.getShacl().getViolationCount());
    assertEquals(1_000, largeReport.getShacl().getFindings().size());
    assertFalse(cache.asMap().containsKey(large.release().getContentDigest()));
    assertEquals(256, cache.estimatedSize());
  }

  private static OntologyReleaseValidationService validation(
      final Map<UUID, List<OntologyReleaseMember>> stored) {
    final OntologyReleaseDAO dao = mock(OntologyReleaseDAO.class);
    when(dao.listMembers(any(UUID.class), anyString(), anyString(), eq(100)))
        .thenAnswer(
            invocation -> {
              final String kind = invocation.getArgument(1);
              final String after = invocation.getArgument(2);
              return stored.get(invocation.getArgument(0, UUID.class)).stream()
                  .filter(member -> member.getMemberKind().value().equals(kind))
                  .filter(
                      member ->
                          after.isEmpty() || member.getMemberId().toString().compareTo(after) > 0)
                  .sorted(Comparator.comparing(member -> member.getMemberId().toString()))
                  .limit(100)
                  .toList();
            });
    final CollectionDAO collection = mock(CollectionDAO.class);
    when(collection.ontologyReleaseDAO()).thenReturn(dao);
    final OntologyReleaseRepository releases = mock(OntologyReleaseRepository.class);
    when(releases.getDaoCollection()).thenReturn(collection);
    return new OntologyReleaseValidationService(releases, null);
  }

  private static Cache<?, ?> cache(final OntologyReleaseValidationService validation)
      throws ReflectiveOperationException {
    final Field field = OntologyReleaseValidationService.class.getDeclaredField("cache");
    field.setAccessible(true);
    return (Cache<?, ?>) field.get(validation);
  }

  private static Ontology ontology(final String name) {
    return new Ontology()
        .withId(UUID.randomUUID())
        .withName(name)
        .withFullyQualifiedName(name)
        .withIri(URI.create("https://example.org/" + name + "/"))
        .withNamespace(URI.create("https://example.org/" + name + "/"));
  }

  private static Bundle bundle(final Ontology ontology, final OntologyProperty... properties) {
    final UUID id = UUID.randomUUID();
    final List<OntologyReleaseMember> members = new ArrayList<>();
    members.add(
        OntologyReleaseManifest.member(
            id, MemberKind.ONTOLOGY, ontology.getId(), OntologyReleaseContent.project(ontology)));
    for (final OntologyProperty property : properties) {
      members.add(
          OntologyReleaseManifest.member(
              id, MemberKind.PROPERTY, property.getId(), OntologyReleaseContent.project(property)));
    }
    final OntologyRelease release =
        new OntologyRelease()
            .withId(id)
            .withOntology(ontology.getEntityReference())
            .withOntologyIri(ontology.getIri())
            .withVersionIri(URI.create("urn:openmetadata:ontology-release:" + id))
            .withSealedAt(1L)
            .withEncodingVersion(
                OntologyRelease.EncodingVersion.fromValue(OntologyReleaseManifest.ENCODING_VERSION))
            .withMemberCount(members.size())
            .withTotalBytes(
                members.stream().mapToLong(OntologyReleaseMember::getPayloadBytes).sum())
            .withContentDigest(OntologyReleaseManifest.digest(members));
    return new Bundle(release, members);
  }

  private record Bundle(OntologyRelease release, List<OntologyReleaseMember> members) {}
}
