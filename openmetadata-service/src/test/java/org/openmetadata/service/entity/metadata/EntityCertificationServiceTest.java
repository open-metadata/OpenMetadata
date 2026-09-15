package org.openmetadata.service.entity.metadata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Date;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.AssetCertification;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabelMetadata;
import org.openmetadata.service.entity.read.ReadBundle;
import org.openmetadata.service.entity.read.ReadBundleContext;
import org.openmetadata.service.jdbi3.ClassificationTagDAOs.TagUsageDAO;
import org.openmetadata.service.jdbi3.ClassificationTagDAOs.TagUsageDAO.TagLabelWithFQNHash;
import org.openmetadata.service.util.FullyQualifiedName;

class EntityCertificationServiceTest {
  private static final String CLASSIFICATION = "Certification";
  private final TagUsageDAO dao = mock(TagUsageDAO.class);
  private final EntityCertificationService<Table> service =
      new EntityCertificationService<>(
          () -> dao, () -> CLASSIFICATION, true, label -> label.setName("enriched"));
  private final Table first =
      new Table().withId(UUID.randomUUID()).withFullyQualifiedName("service.schema.first");
  private final Table second =
      new Table().withId(UUID.randomUUID()).withFullyQualifiedName("service.schema.second");

  @Test
  void combinedReadsKeepSqlPrefixSourceAndFirstRowSemantics() {
    final var rows =
        List.of(
            row(first, "Certification.Glossary", TagLabel.TagSource.GLOSSARY),
            row(first, "Other.Gold", TagLabel.TagSource.CLASSIFICATION),
            row(first, "Certification.Nested.Gold", TagLabel.TagSource.CLASSIFICATION),
            row(first, "Certification.Silver", TagLabel.TagSource.CLASSIFICATION));

    final var result = service.fromRows(List.of(first, second), rows);

    assertEquals(1, result.size());
    final AssetCertification certification = result.get(first.getId());
    assertEquals("Certification.Nested.Gold", certification.getTagLabel().getTagFQN());
    assertEquals("enriched", certification.getTagLabel().getName());
    assertEquals(100L, certification.getAppliedDate());
    assertEquals(200L, certification.getExpiryDate());
    assertNull(result.get(second.getId()));
  }

  @Test
  void certificationOnlyReadsGroupTargetsAndRetainMissingValues() {
    when(dao.getCertTagsInternalBatch(anyInt(), anyList(), anyString()))
        .thenReturn(List.of(row(first, "Certification.Gold", TagLabel.TagSource.CLASSIFICATION)));

    final var result = service.readMany(List.of(first, second), service::read);

    assertEquals("Certification.Gold", result.get(first.getId()).getTagLabel().getTagFQN());
    assertNull(result.get(second.getId()));
  }

  @Test
  void failedBatchFallsBackToIndividualReads() {
    when(dao.getCertTagsInternalBatch(anyInt(), anyList(), anyString()))
        .thenThrow(new IllegalStateException("Batch unavailable"));
    final AssetCertification fallback = new AssetCertification().withExpiryDate(300L);

    final var result = service.readMany(List.of(first, second), entity -> fallback);

    assertEquals(fallback, result.get(first.getId()));
    assertEquals(fallback, result.get(second.getId()));
  }

  @Test
  void loadedNullCertificationDoesNotFallBackToTheDatabase() {
    final var unreadable =
        new EntityCertificationService<Table>(
            () -> {
              throw new AssertionError("The bundle covers this field");
            },
            () -> CLASSIFICATION,
            true,
            label -> {});
    final ReadBundle bundle = new ReadBundle();
    bundle.putCertification(first.getId(), null);
    ReadBundleContext.push(bundle);
    try {
      assertNull(unreadable.read(first));
      final var certification = new AssetCertification().withExpiryDate(300L);
      bundle.putCertification(first.getId(), certification);
      assertEquals(certification, unreadable.read(first));
    } finally {
      ReadBundleContext.pop();
    }
  }

  @Test
  void unsupportedOrUnconfiguredCertificationAvoidsStorage() {
    final var unsupported =
        new EntityCertificationService<Table>(
            () -> {
              throw new AssertionError("Unsupported certification");
            },
            () -> CLASSIFICATION,
            false,
            label -> {});
    final var unconfigured =
        new EntityCertificationService<Table>(
            () -> {
              throw new AssertionError("No certification classification");
            },
            () -> null,
            true,
            label -> {});

    assertNull(unsupported.read(first));
    assertNull(unconfigured.read(first));
    assertTrue(unsupported.readMany(List.of(first), unsupported::read).isEmpty());
    assertTrue(unconfigured.fromRows(List.of(first), List.of()).isEmpty());
    assertTrue(service.readMany(List.of(), service::read).isEmpty());
  }

  @Test
  void unchangedCertificationKeepsItsAppliedDateAndAvoidsWrites() {
    final var unwritable =
        new EntityCertificationService<Table>(
            () -> {
              throw new AssertionError("An unchanged certification must not be rewritten");
            },
            () -> CLASSIFICATION,
            true,
            label -> {});
    final var certification =
        new AssetCertification()
            .withTagLabel(new TagLabel().withTagFQN("Certification.Gold"))
            .withAppliedDate(100L)
            .withExpiryDate(200L);
    first.setCertification(certification);

    unwritable.apply(first, entity -> certification);

    assertEquals(100L, first.getCertification().getAppliedDate());
  }

  private TagLabelWithFQNHash row(
      final Table table, final String fqn, final TagLabel.TagSource source) {
    final TagLabelWithFQNHash row = new TagLabelWithFQNHash();
    row.setTargetFQNHash(FullyQualifiedName.buildHash(table.getFullyQualifiedName()));
    row.setTagFQN(fqn);
    row.setSource(source.ordinal());
    row.setLabelType(TagLabel.LabelType.AUTOMATED.ordinal());
    row.setState(TagLabel.State.CONFIRMED.ordinal());
    row.setAppliedAt(new Date(100L));
    row.setMetadata(new TagLabelMetadata().withExpiryDate(200L));
    return row;
  }
}
