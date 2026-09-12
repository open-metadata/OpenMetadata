package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.type.AssetCertification;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ClassificationTagDAOs.TagUsageDAO;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

class BundleWarmupReadPathCertificationTest {

  private CollectionDAO daoCollection;
  private TagUsageDAO tagUsageDAO;
  private CollectionDAO.EntityRelationshipDAO relationshipDAO;
  private CollectionDAO.PipelineDAO pipelineDAO;
  private TestPipelineRepo repo;
  private Pipeline entity;
  private UUID entityId;

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

    entityId = UUID.randomUUID();
    entity =
        new Pipeline()
            .withId(entityId)
            .withName("my-pipeline")
            .withFullyQualifiedName("service.my-pipeline");
  }

  @AfterEach
  void tearDown() {
    ReadBundleContext.clear();
    Entity.setCollectionDAO(null);
    Entity.setJobDAO(null);
    Entity.setSearchRepository(null);
    Entity.setEntityRelationshipRepository(null);
  }

  @Test
  void fixedWarmedBundleServesStrippedTagsAndRecomputesCertification() {
    ReadBundle bundle = new ReadBundle();
    TagLabel piiTag =
        new TagLabel().withTagFQN("PII.Sensitive").withSource(TagLabel.TagSource.CLASSIFICATION);
    bundle.putTags(entityId, List.of(piiTag));

    CollectionDAO.TagUsageDAO.TagLabelWithFQNHash certEntry =
        new CollectionDAO.TagUsageDAO.TagLabelWithFQNHash();
    certEntry.setTagFQN("Certification.Gold");
    certEntry.setSource(TagLabel.TagSource.CLASSIFICATION.ordinal());
    certEntry.setLabelType(TagLabel.LabelType.AUTOMATED.ordinal());
    certEntry.setState(TagLabel.State.CONFIRMED.ordinal());
    when(tagUsageDAO.getCertTagsInternalBatch(anyInt(), anyList(), anyString()))
        .thenReturn(List.of(certEntry));

    ReadBundleContext.push(bundle);
    try {
      List<TagLabel> tags = repo.getTags(entity);
      assertNotNull(tags);
      assertEquals(1, tags.size(), "warmed tags must not surface the Certification.* tag");
      assertEquals("PII.Sensitive", tags.get(0).getTagFQN());

      AssetCertification cert = repo.getCertification(entity);
      assertNotNull(
          cert, "certification must be recomputed from tag_usage, not served as cached null");
      assertNotNull(cert.getTagLabel());
      assertEquals("Certification.Gold", cert.getTagLabel().getTagFQN());
      verify(tagUsageDAO).getCertTagsInternalBatch(anyInt(), anyList(), anyString());
    } finally {
      ReadBundleContext.pop();
    }
  }

  @Test
  void canonicalGetPathStripsCertTagAndBuildsCertification() {
    TagLabel certTag =
        new TagLabel()
            .withTagFQN("Certification.Gold")
            .withSource(TagLabel.TagSource.CLASSIFICATION)
            .withLabelType(TagLabel.LabelType.AUTOMATED);
    TagLabel piiTag =
        new TagLabel()
            .withTagFQN("PII.Sensitive")
            .withSource(TagLabel.TagSource.CLASSIFICATION)
            .withLabelType(TagLabel.LabelType.MANUAL);
    when(tagUsageDAO.getTags(anyString())).thenReturn(List.of(certTag, piiTag));

    CollectionDAO.TagUsageDAO.TagLabelWithFQNHash certEntry =
        new CollectionDAO.TagUsageDAO.TagLabelWithFQNHash();
    certEntry.setTagFQN("Certification.Gold");
    certEntry.setSource(TagLabel.TagSource.CLASSIFICATION.ordinal());
    certEntry.setLabelType(TagLabel.LabelType.AUTOMATED.ordinal());
    certEntry.setState(TagLabel.State.CONFIRMED.ordinal());
    when(tagUsageDAO.getCertTagsInternalBatch(anyInt(), anyList(), anyString()))
        .thenReturn(List.of(certEntry));

    List<TagLabel> tags = repo.getTags(entity);
    assertNotNull(tags);
    assertEquals(1, tags.size(), "canonical getTags must strip the Certification.* tag");
    assertEquals("PII.Sensitive", tags.get(0).getTagFQN());

    AssetCertification cert = repo.getCertification(entity);
    assertNotNull(cert);
    assertEquals("Certification.Gold", cert.getTagLabel().getTagFQN());
  }

  @Test
  void warmedBundleTrustingCachedNullCertShortCircuitsAndDoesNotFilterCertTag() {
    ReadBundle bundle = new ReadBundle();
    TagLabel certTag =
        new TagLabel()
            .withTagFQN("Certification.Gold")
            .withSource(TagLabel.TagSource.CLASSIFICATION);
    TagLabel piiTag =
        new TagLabel().withTagFQN("PII.Sensitive").withSource(TagLabel.TagSource.CLASSIFICATION);
    bundle.putTags(entityId, List.of(certTag, piiTag));
    bundle.putCertification(entityId, null);

    ReadBundleContext.push(bundle);
    try {
      List<TagLabel> tags = repo.getTags(entity);
      assertNotNull(tags);
      assertEquals(
          2, tags.size(), "read path returns warmed tags verbatim, so warmer must strip cert tag");

      AssetCertification cert = repo.getCertification(entity);
      assertNull(
          cert, "read path trusts certificationLoaded=true with null, so warmer must not set it");
      verify(tagUsageDAO, never()).getCertTagsInternalBatch(anyInt(), anyList(), anyString());
    } finally {
      ReadBundleContext.pop();
    }
  }
}
