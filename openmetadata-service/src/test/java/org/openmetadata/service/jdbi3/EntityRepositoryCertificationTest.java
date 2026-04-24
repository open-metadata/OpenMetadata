package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.nullable;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.jdbi.v3.core.statement.StatementContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.type.AssetCertification;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabelMetadata;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO.TagUsageDAO;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FullyQualifiedName;

class EntityRepositoryCertificationTest {

  private CollectionDAO daoCollection;
  private TagUsageDAO tagUsageDAO;
  private CollectionDAO.EntityRelationshipDAO relationshipDAO;
  private CollectionDAO.PipelineDAO pipelineDAO;
  private TestPipelineRepo repo;

  private static class TestPipelineRepo extends EntityRepository<Pipeline> {
    TestPipelineRepo(CollectionDAO.PipelineDAO dao) {
      super(
          "pipelines",
          Entity.PIPELINE,
          Pipeline.class,
          dao,
          "certification,tags,owners",
          "certification,tags,owners");
    }

    @Override
    protected void setFields(Pipeline entity, Fields fields, RelationIncludes r) {}

    @Override
    protected void clearFields(Pipeline entity, Fields fields) {}

    @Override
    protected void prepare(Pipeline entity, boolean update) {}

    @Override
    protected void storeEntity(Pipeline entity, boolean update) {}

    @Override
    protected void storeRelationships(Pipeline entity) {}
  }

  @BeforeEach
  void setUp() {
    daoCollection = mock(CollectionDAO.class);
    tagUsageDAO = mock(TagUsageDAO.class);
    relationshipDAO = mock(CollectionDAO.EntityRelationshipDAO.class);
    pipelineDAO = mock(CollectionDAO.PipelineDAO.class);

    when(daoCollection.tagUsageDAO()).thenReturn(tagUsageDAO);
    when(daoCollection.relationshipDAO()).thenReturn(relationshipDAO);

    Entity.setCollectionDAO(daoCollection);
    Entity.setJobDAO(null);
    Entity.setSearchRepository(null);
    Entity.setEntityRelationshipRepository(null);

    repo = new TestPipelineRepo(pipelineDAO);
  }

  @AfterEach
  void tearDown() {
    Entity.setCollectionDAO(null);
    Entity.setJobDAO(null);
    Entity.setSearchRepository(null);
    Entity.setEntityRelationshipRepository(null);
  }

  @Test
  void getCertificationReturnsCertWhenTagFound() {
    Pipeline entity =
        new Pipeline()
            .withId(UUID.randomUUID())
            .withName("my-pipeline")
            .withFullyQualifiedName("service.my-pipeline");

    CollectionDAO.TagUsageDAO.TagLabelWithFQNHash tagEntry =
        new CollectionDAO.TagUsageDAO.TagLabelWithFQNHash();
    tagEntry.setTagFQN("Certification.Gold");
    tagEntry.setSource(TagLabel.TagSource.CLASSIFICATION.ordinal());
    tagEntry.setLabelType(TagLabel.LabelType.AUTOMATED.ordinal());
    tagEntry.setState(TagLabel.State.CONFIRMED.ordinal());

    when(tagUsageDAO.getCertTagsInternalBatch(anyList(), anyString()))
        .thenReturn(List.of(tagEntry));

    AssetCertification cert = repo.getCertification(entity);

    assertNotNull(cert);
    assertNotNull(cert.getTagLabel());
  }

  @Test
  void getCertificationReturnsNullWhenNoTagFound() {
    Pipeline entity =
        new Pipeline()
            .withId(UUID.randomUUID())
            .withName("my-pipeline")
            .withFullyQualifiedName("service.my-pipeline");

    when(tagUsageDAO.getCertTagsInternalBatch(anyList(), anyString())).thenReturn(List.of());

    AssetCertification cert = repo.getCertification(entity);

    assertNull(cert);
  }

  @Test
  void applyCertificationIsNoOpWhenTagLabelIsNull() {
    AssetCertification certWithNullTag = new AssetCertification().withTagLabel(null);
    Pipeline entity =
        new Pipeline()
            .withId(UUID.randomUUID())
            .withName("my-pipeline")
            .withFullyQualifiedName("service.my-pipeline")
            .withCertification(certWithNullTag);

    assertDoesNotThrow(() -> repo.applyCertification(entity));

    verify(tagUsageDAO, never())
        .applyTag(
            anyInt(),
            anyString(),
            anyString(),
            anyString(),
            anyInt(),
            anyInt(),
            nullable(String.class),
            nullable(String.class),
            nullable(String.class));
  }

  @Test
  void applyCertificationIsNoOpWhenCertificationIsNull() {
    Pipeline entity =
        new Pipeline()
            .withId(UUID.randomUUID())
            .withName("my-pipeline")
            .withFullyQualifiedName("service.my-pipeline")
            .withCertification(null);

    assertDoesNotThrow(() -> repo.applyCertification(entity));

    verify(tagUsageDAO, never())
        .applyTag(
            anyInt(),
            anyString(),
            anyString(),
            anyString(),
            anyInt(),
            anyInt(),
            nullable(String.class),
            nullable(String.class),
            nullable(String.class));
  }

  @Test
  void applyCertificationSkipsWhenSameCertAlreadyExists() {
    TagLabel tagLabel = new TagLabel().withTagFQN("Certification.Gold");
    AssetCertification incoming =
        new AssetCertification().withTagLabel(tagLabel).withExpiryDate(null);

    Pipeline entity =
        new Pipeline()
            .withId(UUID.randomUUID())
            .withName("my-pipeline")
            .withFullyQualifiedName("service.my-pipeline")
            .withCertification(incoming);

    CollectionDAO.TagUsageDAO.TagLabelWithFQNHash existingEntry =
        new CollectionDAO.TagUsageDAO.TagLabelWithFQNHash();
    existingEntry.setTagFQN("Certification.Gold");
    existingEntry.setSource(TagLabel.TagSource.CLASSIFICATION.ordinal());
    existingEntry.setLabelType(TagLabel.LabelType.AUTOMATED.ordinal());
    existingEntry.setState(TagLabel.State.CONFIRMED.ordinal());

    when(tagUsageDAO.getCertTagsInternalBatch(anyList(), anyString()))
        .thenReturn(List.of(existingEntry));

    assertDoesNotThrow(() -> repo.applyCertification(entity));

    verify(tagUsageDAO, never()).deleteTagsByPrefixAndTarget(anyInt(), anyString(), anyString());
  }

  @Test
  void applyCertificationAppliesTagWhenCertIsDifferent() {
    TagLabel incomingLabel = new TagLabel().withTagFQN("Certification.Silver");
    AssetCertification incoming =
        new AssetCertification().withTagLabel(incomingLabel).withExpiryDate(null);

    Pipeline entity =
        new Pipeline()
            .withId(UUID.randomUUID())
            .withName("my-pipeline")
            .withFullyQualifiedName("service.my-pipeline")
            .withCertification(incoming);

    when(tagUsageDAO.getCertTagsInternalBatch(anyList(), anyString())).thenReturn(List.of());

    assertDoesNotThrow(() -> repo.applyCertification(entity));

    verify(tagUsageDAO)
        .applyTag(
            anyInt(),
            anyString(),
            anyString(),
            anyString(),
            anyInt(),
            anyInt(),
            nullable(String.class),
            nullable(String.class),
            nullable(TagLabelMetadata.class));
  }

  @Test
  void deleteCertificationTagIsNoOpWhenEntityFqnIsEmpty() {
    assertDoesNotThrow(() -> repo.deleteCertificationTag(""));
  }

  @Test
  void deleteCertificationTagCallsDeleteWhenClassificationIsSet() {
    assertDoesNotThrow(() -> repo.deleteCertificationTag("service.my-pipeline"));

    verify(tagUsageDAO).deleteTagsByPrefixAndTarget(anyInt(), anyString(), anyString());
  }

  @Test
  void storeRelationshipsInternalEmptyListDoesNotCallDao() {
    assertDoesNotThrow(() -> repo.storeRelationshipsInternal(List.of()));

    verify(tagUsageDAO, never())
        .applyTag(
            anyInt(),
            anyString(),
            anyString(),
            anyString(),
            anyInt(),
            anyInt(),
            nullable(String.class),
            nullable(String.class),
            nullable(String.class));
  }

  @Test
  void storeRelationshipsInternalWithNoCertificationEntityDoesNotThrow() {
    Pipeline entity =
        new Pipeline()
            .withId(UUID.randomUUID())
            .withName("my-pipeline")
            .withFullyQualifiedName("service.my-pipeline")
            .withCertification(null);

    when(tagUsageDAO.getCertTagsInternalBatch(anyList(), anyString())).thenReturn(List.of());

    assertDoesNotThrow(() -> repo.storeRelationshipsInternal(List.of(entity)));
  }

  @Test
  void applyCertificationBatchIsNoOpWhenListIsEmpty() {
    assertDoesNotThrow(() -> repo.applyCertificationBatch(List.of()));

    verify(tagUsageDAO, never()).deleteTagsByPrefixAndTargets(anyInt(), anyString(), anyList());
    verify(tagUsageDAO, never()).applyTagsBatchMultiTarget(any(Map.class));
  }

  @Test
  void applyCertificationBatchIsNoOpWhenNoCertifiedEntities() {
    Pipeline entity =
        new Pipeline()
            .withId(UUID.randomUUID())
            .withName("my-pipeline")
            .withFullyQualifiedName("service.my-pipeline")
            .withCertification(null);

    assertDoesNotThrow(() -> repo.applyCertificationBatch(List.of(entity)));

    verify(tagUsageDAO, never()).deleteTagsByPrefixAndTargets(anyInt(), anyString(), anyList());
    verify(tagUsageDAO, never()).applyTagsBatchMultiTarget(any(Map.class));
  }

  @Test
  void applyCertificationBatchIsNoOpWhenTagLabelIsNull() {
    Pipeline entity =
        new Pipeline()
            .withId(UUID.randomUUID())
            .withName("my-pipeline")
            .withFullyQualifiedName("service.my-pipeline")
            .withCertification(new AssetCertification().withTagLabel(null));

    assertDoesNotThrow(() -> repo.applyCertificationBatch(List.of(entity)));

    verify(tagUsageDAO, never()).deleteTagsByPrefixAndTargets(anyInt(), anyString(), anyList());
  }

  @Test
  void applyCertificationBatchDeletesAndInsertsForCertifiedEntities() {
    TagLabel tagLabel = new TagLabel().withTagFQN("Certification.Gold");
    Pipeline entity =
        new Pipeline()
            .withId(UUID.randomUUID())
            .withName("my-pipeline")
            .withFullyQualifiedName("service.my-pipeline")
            .withCertification(new AssetCertification().withTagLabel(tagLabel));

    assertDoesNotThrow(() -> repo.applyCertificationBatch(List.of(entity)));

    verify(tagUsageDAO).deleteTagsByPrefixAndTargets(anyInt(), anyString(), anyList());
    verify(tagUsageDAO).applyTagsBatchMultiTarget(any(Map.class));
  }

  @Test
  void applyCertificationBatchOnlyProcessesCertifiedEntities() {
    TagLabel tagLabel = new TagLabel().withTagFQN("Certification.Silver");
    Pipeline certified =
        new Pipeline()
            .withId(UUID.randomUUID())
            .withName("certified-pipeline")
            .withFullyQualifiedName("service.certified-pipeline")
            .withCertification(new AssetCertification().withTagLabel(tagLabel));
    Pipeline uncertified =
        new Pipeline()
            .withId(UUID.randomUUID())
            .withName("uncertified-pipeline")
            .withFullyQualifiedName("service.uncertified-pipeline")
            .withCertification(null);

    assertDoesNotThrow(() -> repo.applyCertificationBatch(List.of(certified, uncertified)));

    verify(tagUsageDAO).deleteTagsByPrefixAndTargets(anyInt(), anyString(), anyList());
    verify(tagUsageDAO).applyTagsBatchMultiTarget(any(Map.class));
  }

  @Test
  void getTagsFiltersCertificationTags() {
    TagLabel certTag =
        new TagLabel()
            .withTagFQN("Certification.Gold")
            .withSource(TagLabel.TagSource.CLASSIFICATION)
            .withLabelType(TagLabel.LabelType.AUTOMATED);
    TagLabel regularTag =
        new TagLabel()
            .withTagFQN("PII.Sensitive")
            .withSource(TagLabel.TagSource.CLASSIFICATION)
            .withLabelType(TagLabel.LabelType.MANUAL);

    when(tagUsageDAO.getTags(anyString())).thenReturn(List.of(certTag, regularTag));

    List<TagLabel> tags = repo.getTags("service.my-pipeline");

    assertNotNull(tags);
    assertEquals(1, tags.size());
    assertEquals("PII.Sensitive", tags.get(0).getTagFQN());
  }

  @Test
  void storeRelationshipsInternalSingleEntityWithNoCert() {
    Pipeline entity =
        new Pipeline()
            .withId(UUID.randomUUID())
            .withName("my-pipeline")
            .withFullyQualifiedName("service.my-pipeline")
            .withCertification(null);

    when(tagUsageDAO.getCertTagsInternalBatch(anyList(), anyString())).thenReturn(List.of());

    assertDoesNotThrow(() -> repo.storeRelationshipsInternal(entity));
  }

  @Test
  void fetchAndSetFieldsPopulatesCertification() {
    UUID entityId = UUID.randomUUID();
    Pipeline entity =
        new Pipeline()
            .withId(entityId)
            .withName("my-pipeline")
            .withFullyQualifiedName("service.my-pipeline");

    CollectionDAO.TagUsageDAO.TagLabelWithFQNHash tagEntry =
        new CollectionDAO.TagUsageDAO.TagLabelWithFQNHash();
    tagEntry.setTagFQN("Certification.Gold");
    tagEntry.setSource(TagLabel.TagSource.CLASSIFICATION.ordinal());
    tagEntry.setLabelType(TagLabel.LabelType.AUTOMATED.ordinal());
    tagEntry.setState(TagLabel.State.CONFIRMED.ordinal());
    tagEntry.setTargetFQNHash(FullyQualifiedName.buildHash("service.my-pipeline"));

    when(tagUsageDAO.getCertTagsInternalBatch(anyList(), anyString()))
        .thenReturn(List.of(tagEntry));

    Fields certFields = new Fields(Set.of("certification"));
    repo.fetchAndSetFields(List.of(entity), certFields);

    assertNotNull(entity.getCertification());
    assertEquals("Certification.Gold", entity.getCertification().getTagLabel().getTagFQN());
  }

  @Test
  void fetchAndSetFieldsFallsBackToIndividualFetchOnBatchException() {
    Pipeline entity =
        new Pipeline()
            .withId(UUID.randomUUID())
            .withName("my-pipeline")
            .withFullyQualifiedName("service.my-pipeline");

    when(tagUsageDAO.getCertTagsInternalBatch(anyList(), anyString()))
        .thenThrow(new RuntimeException("DB error"))
        .thenReturn(List.of());

    Fields certFields = new Fields(Set.of("certification"));
    assertDoesNotThrow(() -> repo.fetchAndSetFields(List.of(entity), certFields));
  }

  @Test
  void tagLabelMapperMapsResultSetFields() throws SQLException {
    ResultSet rs = mock(ResultSet.class);
    StatementContext ctx = mock(StatementContext.class);

    when(rs.getInt("source")).thenReturn(TagLabel.TagSource.CLASSIFICATION.ordinal());
    when(rs.getInt("labelType")).thenReturn(TagLabel.LabelType.MANUAL.ordinal());
    when(rs.getInt("state")).thenReturn(TagLabel.State.CONFIRMED.ordinal());
    when(rs.getString("tagFQN")).thenReturn("PII.Sensitive");
    when(rs.getString("reason")).thenReturn(null);
    when(rs.getTimestamp("appliedAt")).thenReturn(null);
    when(rs.getString("appliedBy")).thenReturn(null);
    when(rs.getString("metadata")).thenReturn(null);

    TagLabel label = new CollectionDAO.TagUsageDAO.TagLabelMapper().map(rs, ctx);

    assertEquals("PII.Sensitive", label.getTagFQN());
    assertEquals(TagLabel.TagSource.CLASSIFICATION, label.getSource());
    assertNull(label.getMetadata());
  }

  @Test
  void tagLabelWithFQNHashMapperMapsResultSetFields() throws SQLException {
    ResultSet rs = mock(ResultSet.class);
    StatementContext ctx = mock(StatementContext.class);

    when(rs.getString("targetFQNHash")).thenReturn("abc123");
    when(rs.getInt("source")).thenReturn(TagLabel.TagSource.CLASSIFICATION.ordinal());
    when(rs.getString("tagFQN")).thenReturn("Certification.Gold");
    when(rs.getInt("labelType")).thenReturn(TagLabel.LabelType.AUTOMATED.ordinal());
    when(rs.getInt("state")).thenReturn(TagLabel.State.CONFIRMED.ordinal());
    when(rs.getString("reason")).thenReturn(null);
    when(rs.getTimestamp("appliedAt")).thenReturn(null);
    when(rs.getString("appliedBy")).thenReturn(null);
    when(rs.getString("metadata")).thenReturn(null);

    CollectionDAO.TagUsageDAO.TagLabelWithFQNHash result =
        new CollectionDAO.TagUsageDAO.TagLabelWithFQNHashMapper().map(rs, ctx);

    assertEquals("abc123", result.getTargetFQNHash());
    assertEquals("Certification.Gold", result.getTagFQN());
    assertNull(result.getMetadata());
  }

  @Test
  void toTagLabelUsesDefaultForOutOfBoundsSource() {
    CollectionDAO.TagUsageDAO.TagLabelWithFQNHash hash =
        new CollectionDAO.TagUsageDAO.TagLabelWithFQNHash();
    hash.setSource(-1);
    hash.setLabelType(TagLabel.LabelType.AUTOMATED.ordinal());
    hash.setState(TagLabel.State.CONFIRMED.ordinal());
    hash.setTagFQN("Certification.Gold");

    TagLabel label = hash.toTagLabel();

    assertEquals(TagLabel.TagSource.CLASSIFICATION, label.getSource());
  }

  @Test
  void toTagLabelUsesDefaultForOutOfBoundsLabelType() {
    CollectionDAO.TagUsageDAO.TagLabelWithFQNHash hash =
        new CollectionDAO.TagUsageDAO.TagLabelWithFQNHash();
    hash.setSource(TagLabel.TagSource.CLASSIFICATION.ordinal());
    hash.setLabelType(-1);
    hash.setState(TagLabel.State.CONFIRMED.ordinal());
    hash.setTagFQN("Certification.Gold");

    TagLabel label = hash.toTagLabel();

    assertEquals(TagLabel.LabelType.MANUAL, label.getLabelType());
  }

  @Test
  void toTagLabelUsesDefaultForOutOfBoundsState() {
    CollectionDAO.TagUsageDAO.TagLabelWithFQNHash hash =
        new CollectionDAO.TagUsageDAO.TagLabelWithFQNHash();
    hash.setSource(TagLabel.TagSource.CLASSIFICATION.ordinal());
    hash.setLabelType(TagLabel.LabelType.AUTOMATED.ordinal());
    hash.setState(-1);
    hash.setTagFQN("Certification.Gold");

    TagLabel label = hash.toTagLabel();

    assertEquals(TagLabel.State.CONFIRMED, label.getState());
  }

  @Test
  void batchFetchTagsFiltersCertificationTags() {
    String entityFqn = "service.my-pipeline";

    CollectionDAO.TagUsageDAO.TagLabelWithFQNHash certEntry =
        new CollectionDAO.TagUsageDAO.TagLabelWithFQNHash();
    certEntry.setTagFQN("Certification.Gold");
    certEntry.setTargetFQNHash(FullyQualifiedName.buildHash(entityFqn));
    certEntry.setSource(TagLabel.TagSource.CLASSIFICATION.ordinal());
    certEntry.setLabelType(TagLabel.LabelType.AUTOMATED.ordinal());
    certEntry.setState(TagLabel.State.CONFIRMED.ordinal());

    CollectionDAO.TagUsageDAO.TagLabelWithFQNHash regularEntry =
        new CollectionDAO.TagUsageDAO.TagLabelWithFQNHash();
    regularEntry.setTagFQN("PII.Sensitive");
    regularEntry.setTargetFQNHash(FullyQualifiedName.buildHash(entityFqn));
    regularEntry.setSource(TagLabel.TagSource.CLASSIFICATION.ordinal());
    regularEntry.setLabelType(TagLabel.LabelType.MANUAL.ordinal());
    regularEntry.setState(TagLabel.State.CONFIRMED.ordinal());

    when(tagUsageDAO.getTagsInternalBatch(anyList())).thenReturn(List.of(certEntry, regularEntry));

    Map<String, List<TagLabel>> result = repo.batchFetchTags(List.of(entityFqn));

    List<TagLabel> tags = result.get(entityFqn);
    assertNotNull(tags);
    assertEquals(1, tags.size());
    assertEquals("PII.Sensitive", tags.get(0).getTagFQN());
  }

  @Test
  void applyCertificationUsesEntityUpdatedByAsAppliedBy() {
    TagLabel tagLabel = new TagLabel().withTagFQN("Certification.Gold");
    Pipeline entity =
        new Pipeline()
            .withId(UUID.randomUUID())
            .withName("my-pipeline")
            .withFullyQualifiedName("service.my-pipeline")
            .withUpdatedBy("alice")
            .withCertification(new AssetCertification().withTagLabel(tagLabel));

    when(tagUsageDAO.getCertTagsInternalBatch(anyList(), anyString())).thenReturn(List.of());

    assertDoesNotThrow(() -> repo.applyCertification(entity));

    verify(tagUsageDAO)
        .applyTag(
            anyInt(),
            anyString(),
            anyString(),
            anyString(),
            anyInt(),
            anyInt(),
            nullable(String.class),
            eq("alice"),
            nullable(TagLabelMetadata.class));
  }

  @Test
  void applyCertificationBatchUsesEntityUpdatedByAsAppliedBy() {
    TagLabel tagLabel = new TagLabel().withTagFQN("Certification.Gold");
    Pipeline entity =
        new Pipeline()
            .withId(UUID.randomUUID())
            .withName("my-pipeline")
            .withFullyQualifiedName("service.my-pipeline")
            .withUpdatedBy("bob")
            .withCertification(new AssetCertification().withTagLabel(tagLabel));

    @SuppressWarnings("unchecked")
    ArgumentCaptor<Map<String, List<TagLabel>>> captor = ArgumentCaptor.forClass(Map.class);

    assertDoesNotThrow(() -> repo.applyCertificationBatch(List.of(entity)));

    verify(tagUsageDAO).applyTagsBatchMultiTarget(captor.capture());
    Map<String, List<TagLabel>> applied = captor.getValue();
    assertFalse(applied.isEmpty());
    List<TagLabel> labels = applied.get(entity.getFullyQualifiedName());
    assertNotNull(labels);
    assertEquals(1, labels.size());
    assertEquals("bob", labels.get(0).getAppliedBy());
  }

  @Test
  void toTagLabelMapsFieldsCorrectly() {
    TagLabelMetadata metadata = new TagLabelMetadata().withExpiryDate(12345L);
    CollectionDAO.TagUsageDAO.TagLabelWithFQNHash hash =
        new CollectionDAO.TagUsageDAO.TagLabelWithFQNHash();
    hash.setSource(TagLabel.TagSource.CLASSIFICATION.ordinal());
    hash.setTagFQN("Certification.Gold");
    hash.setLabelType(TagLabel.LabelType.AUTOMATED.ordinal());
    hash.setState(TagLabel.State.CONFIRMED.ordinal());
    hash.setMetadata(metadata);

    TagLabel label = hash.toTagLabel();

    assertEquals(TagLabel.TagSource.CLASSIFICATION, label.getSource());
    assertEquals("Certification.Gold", label.getTagFQN());
    assertEquals(TagLabel.LabelType.AUTOMATED, label.getLabelType());
    assertEquals(TagLabel.State.CONFIRMED, label.getState());
    assertEquals(12345L, label.getMetadata().getExpiryDate());
  }
}
