package org.openmetadata.service.entity.read;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.schema.type.Include.DELETED;
import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.service.Entity.FIELD_CERTIFICATION;
import static org.openmetadata.service.Entity.FIELD_CHILDREN;
import static org.openmetadata.service.Entity.FIELD_DATA_CONTRACT;
import static org.openmetadata.service.Entity.FIELD_DATA_PRODUCTS;
import static org.openmetadata.service.Entity.FIELD_DOMAINS;
import static org.openmetadata.service.Entity.FIELD_EXPERTS;
import static org.openmetadata.service.Entity.FIELD_EXTENSION;
import static org.openmetadata.service.Entity.FIELD_FOLLOWERS;
import static org.openmetadata.service.Entity.FIELD_OWNERS;
import static org.openmetadata.service.Entity.FIELD_REVIEWERS;
import static org.openmetadata.service.Entity.FIELD_TAGS;
import static org.openmetadata.service.Entity.FIELD_VOTES;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.AssetCertification;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.Votes;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

class EntityMetadataHydratorTest {
  private static final Set<String> ALL_FIELDS =
      Set.of(
          FIELD_OWNERS,
          FIELD_TAGS,
          FIELD_CERTIFICATION,
          FIELD_EXTENSION,
          FIELD_DOMAINS,
          FIELD_DATA_PRODUCTS,
          FIELD_DATA_CONTRACT,
          FIELD_FOLLOWERS,
          FIELD_CHILDREN,
          FIELD_EXPERTS,
          FIELD_REVIEWERS,
          FIELD_VOTES);

  @Test
  void detailHydrationKeepsTheSharedFieldOrderAndPerRelationIncludes() {
    final Fixture fixture = new Fixture();
    final Table entity = new Table();
    final Fields fields = new Fields(ALL_FIELDS);
    final RelationIncludes includes =
        new RelationIncludes(NON_DELETED, Map.of(FIELD_OWNERS, ALL, FIELD_REVIEWERS, DELETED));
    assertSame(entity, fixture.hydrator.hydrate(entity, fields, includes));
    assertEquals(
        List.of(
            FIELD_OWNERS,
            FIELD_TAGS,
            FIELD_CERTIFICATION,
            FIELD_EXTENSION,
            FIELD_DOMAINS,
            FIELD_DATA_PRODUCTS,
            FIELD_DATA_CONTRACT,
            FIELD_FOLLOWERS,
            FIELD_CHILDREN,
            FIELD_EXPERTS,
            FIELD_REVIEWERS,
            FIELD_VOTES),
        fixture.reads);
    assertEquals(
        List.of(
            ALL,
            NON_DELETED,
            NON_DELETED,
            NON_DELETED,
            NON_DELETED,
            NON_DELETED,
            NON_DELETED,
            DELETED),
        fixture.includes);
    assertEquals(List.of(fixture.reference), entity.getOwners());
    assertEquals(List.of(fixture.reference), entity.getDomains());
    assertSame(fixture.reference, entity.getDataContract());
    assertSame(fixture.tags, entity.getTags());
    assertSame(fixture.certification, entity.getCertification());
    assertSame(fixture.votes, entity.getVotes());
    assertSame(fixture.extension, entity.getExtension());
    assertSame(fields, fixture.specificFields);
    assertSame(includes, fixture.specificIncludes);
    assertEquals("custom:1", entity.getDescription());
  }

  @Test
  void omittedMetadataRetainsItsExistingValuesWithoutReadingAndResetsCertification() {
    final Fixture fixture = new Fixture();
    final Table entity = fixture.populated();
    fixture.hydrator.hydrate(entity, new Fields(Set.of()), RelationIncludes.fromInclude(ALL));
    assertTrue(fixture.reads.isEmpty());
    assertSame(fixture.tags, entity.getTags());
    assertSame(fixture.extension, entity.getExtension());
    assertSame(fixture.votes, entity.getVotes());
    assertEquals(List.of(fixture.reference), entity.getOwners());
    assertNull(entity.getCertification());
  }

  @Test
  void tagsAlsoLoadCertificationWhileCertificationAloneKeepsExistingTags() {
    final Fixture fixture = new Fixture();
    final Table entity = fixture.populated();
    fixture.hydrator.hydrate(
        entity, new Fields(Set.of(FIELD_CERTIFICATION)), RelationIncludes.fromInclude(ALL));
    assertEquals(List.of(FIELD_CERTIFICATION), fixture.reads);
    assertSame(fixture.tags, entity.getTags());
    assertSame(fixture.certification, entity.getCertification());
    fixture.reads.clear();
    fixture.hydrator.hydrate(
        entity, new Fields(Set.of(FIELD_TAGS)), RelationIncludes.fromInclude(ALL));
    assertEquals(List.of(FIELD_TAGS, FIELD_CERTIFICATION), fixture.reads);
    assertSame(fixture.certification, entity.getCertification());
  }

  @Test
  void nullAndEmptyLoadedValuesReplacePriorValuesWithoutNormalization() {
    final Fixture fixture = new Fixture();
    final Table entity = fixture.populated();
    fixture.tags = null;
    fixture.extension = null;
    fixture.votes = null;
    fixture.certification = null;
    fixture.relationships = List.of();
    fixture.hydrator.hydrate(entity, new Fields(ALL_FIELDS), RelationIncludes.fromInclude(ALL));
    assertTrue(entity.getOwners().isEmpty());
    assertTrue(entity.getDomains().isEmpty());
    assertNull(entity.getTags());
    assertNull(entity.getExtension());
    assertNull(entity.getVotes());
    assertNull(entity.getCertification());
  }

  @Test
  void clearingOmittedMetadataPreservesCertificationAndRunsTheSpecificPolicyLast() {
    final Fixture fixture = new Fixture();
    final Table entity = fixture.populated();
    final Fields fields = new Fields(Set.of(FIELD_OWNERS, FIELD_TAGS));
    fixture.hydrator.clear(entity, fields);
    assertSame(fixture.tags, entity.getTags());
    assertEquals(List.of(fixture.reference), entity.getOwners());
    assertNull(entity.getDomains());
    assertNull(entity.getDataProducts());
    assertNull(entity.getDataContract());
    assertNull(entity.getFollowers());
    assertNull(entity.getExtension());
    assertNull(entity.getVotes());
    assertSame(fixture.certification, entity.getCertification());
    assertSame(fields, fixture.specificFields);
    assertEquals("cleared", entity.getDescription());
    assertTrue(fixture.reads.isEmpty());
  }

  @Test
  void clearingRequestedFieldsKeepsTheirOriginalValuesAndDoesNotRead() {
    final Fixture fixture = new Fixture();
    final Table entity = fixture.populated();
    fixture.hydrator.clear(entity, new Fields(ALL_FIELDS));
    assertSame(fixture.extension, entity.getExtension());
    assertSame(fixture.votes, entity.getVotes());
    assertSame(fixture.reference, entity.getDataContract());
    assertEquals(List.of(fixture.reference), entity.getFollowers());
    assertEquals(List.of(fixture.reference), entity.getDataProducts());
    assertTrue(fixture.reads.isEmpty());
  }

  @Test
  void failedMetadataReadStopsBeforeLaterFieldsOrTheSpecificPolicy() {
    final Fixture fixture = new Fixture();
    final Table entity = fixture.populated();
    fixture.failField = FIELD_TAGS;
    assertThrows(
        IllegalArgumentException.class,
        () ->
            fixture.hydrator.hydrate(
                entity, new Fields(ALL_FIELDS), RelationIncludes.fromInclude(ALL)));
    assertEquals(List.of(FIELD_OWNERS, FIELD_TAGS), fixture.reads);
    assertSame(fixture.certification, entity.getCertification());
    assertNull(fixture.specificFields);
  }

  private static final class Fixture {
    private final EntityReference reference = new EntityReference().withId(UUID.randomUUID());
    private final List<String> reads = new ArrayList<>();
    private final List<Include> includes = new ArrayList<>();
    private List<TagLabel> tags = List.of(new TagLabel().withTagFQN("PII.Sensitive"));
    private AssetCertification certification = new AssetCertification().withExpiryDate(42L);
    private Object extension = Map.of("property", "value");
    private Votes votes = new Votes().withUpVotes(2);
    private List<EntityReference> relationships = List.of(reference);
    private String failField;
    private Fields specificFields;
    private RelationIncludes specificIncludes;
    private final EntityMetadataHydrator<Table> hydrator =
        new EntityMetadataHydrator<>(
            new EntityMetadataHydrator.CoreReferences<>(
                (entity, include) -> relationships(FIELD_OWNERS, include),
                (entity, include) -> relationships(FIELD_DOMAINS, include),
                (entity, include) -> relationships(FIELD_DATA_PRODUCTS, include),
                (entity, include) -> {
                  relationships(FIELD_DATA_CONTRACT, include);
                  return reference;
                }),
            new EntityMetadataHydrator.AccessReferences<>(
                (entity, include) -> relationships(FIELD_FOLLOWERS, include),
                (entity, include) -> relationships(FIELD_CHILDREN, include),
                (entity, include) -> relationships(FIELD_EXPERTS, include),
                (entity, include) -> relationships(FIELD_REVIEWERS, include)),
            new EntityMetadataHydrator.Values<>(
                entity -> value(FIELD_TAGS, tags),
                    entity -> value(FIELD_CERTIFICATION, certification),
                entity -> value(FIELD_EXTENSION, extension), entity -> value(FIELD_VOTES, votes)),
            new EntityMetadataHydrator.EntityFields<>(
                (entity, fields, relationIncludes) -> {
                  specificFields = fields;
                  specificIncludes = relationIncludes;
                  entity.setDescription(
                      "custom:" + (entity.getOwners() == null ? 0 : entity.getOwners().size()));
                },
                (entity, fields) -> {
                  specificFields = fields;
                  if (!fields.contains(FIELD_DOMAINS)) {
                    assertNull(entity.getDomains());
                  }
                  entity.setDescription("cleared");
                }));

    private List<EntityReference> relationships(final String field, final Include include) {
      includes.add(include);
      return value(field, relationships);
    }

    private <V> V value(final String field, final V value) {
      reads.add(field);
      if (field.equals(failField)) {
        throw new IllegalArgumentException("Injected metadata read failure");
      }
      return value;
    }

    private Table populated() {
      return new Table()
          .withOwners(relationships)
          .withDomains(relationships)
          .withDataProducts(relationships)
          .withDataContract(reference)
          .withFollowers(relationships)
          .withTags(tags)
          .withCertification(certification)
          .withExtension(extension)
          .withVotes(votes);
    }
  }
}
