package org.openmetadata.service.entity.read;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.mock;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.type.AssetCertification;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

class EntityMetadataReadsTest {
  private static final Set<String> FIELDS =
      Set.of("domains", "children", "description", "tags", "certification", "extension");

  @Test
  void entitySpecificReferencesAndFieldsRetainTheirRequestedIncludes() {
    final var reads =
        reads(
            new EntityMetadataReads.Values<>(
                entity -> {
                  throw new AssertionError("Unrequested tags");
                },
                entity -> {
                  throw new AssertionError("Unrequested certification");
                },
                entity -> {
                  throw new AssertionError("Unrequested extensions");
                }));
    final Container container = new Container().withId(UUID.randomUUID());
    final Fields fields = new Fields(FIELDS, "domains,children,description");
    reads.hydrator().hydrate(container, fields, RelationIncludes.fromInclude(Include.DELETED));
    assertEquals("deleted", container.getDomains().getFirst().getName());
    assertEquals("deleted", container.getChildren().getFirst().getName());
    assertEquals("entity-specific field", container.getDescription());
    reads.hydrator().clear(container, fields);
    assertEquals("entity-specific clearing", container.getDisplayName());
  }

  @Test
  void selectedMetadataUsesEachConfiguredSourceOnceWithoutRelationshipReads() {
    final var calls = new AtomicInteger();
    final List<TagLabel> tags = List.of(new TagLabel().withTagFQN("classification.label"));
    final AssetCertification certification =
        new AssetCertification().withTagLabel(new TagLabel().withTagFQN("Certification.Gold"));
    final Map<String, String> extension = Map.of("property", "value");
    final var reads =
        reads(
            new EntityMetadataReads.Values<>(
                entity -> {
                  calls.incrementAndGet();
                  return tags;
                },
                entity -> {
                  calls.incrementAndGet();
                  return certification;
                },
                entity -> {
                  calls.incrementAndGet();
                  return extension;
                }));
    final Container container = new Container().withId(UUID.randomUUID());
    reads
        .hydrator()
        .hydrate(
            container,
            new Fields(FIELDS, "tags,certification,extension"),
            RelationIncludes.fromInclude(Include.ALL));
    assertSame(tags, container.getTags());
    assertSame(certification, container.getCertification());
    assertSame(extension, container.getExtension());
    assertEquals(3, calls.get());
  }

  private static EntityMetadataReads<Container> reads(
      EntityMetadataReads.Values<Container> values) {
    final CollectionDAO dao =
        mock(
            CollectionDAO.class,
            call -> {
              throw new AssertionError("Unexpected database access: " + call.getMethod().getName());
            });
    return new EntityMetadataReads<>(
        new EntityMetadataReads.Schema("container", FIELDS, dao),
        new EntityMetadataReads.Hooks<>(
            (entity, include) -> List.of(reference("domain", include)),
            (entity, include) -> List.of(reference("container", include)),
            new EntityMetadataHydrator.EntityFields<>(
                (entity, fields, include) -> entity.setDescription("entity-specific field"),
                (entity, fields) -> entity.setDisplayName("entity-specific clearing"))),
        values,
        (field, reason) -> {
          throw new AssertionError("Unexpected fallback: " + field);
        });
  }

  private static EntityReference reference(String type, Include include) {
    return new EntityReference().withId(UUID.randomUUID()).withType(type).withName(include.value());
  }
}
