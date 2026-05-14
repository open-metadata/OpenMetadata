package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.openmetadata.schema.type.Include.NON_DELETED;

import jakarta.json.JsonPatch;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.AssetCertification;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabel.TagSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.resources.tags.TagLabelUtil;

class EntityFieldUtilsTest {

  @Test
  void setEntityFieldCreatesPatchAndChangeEventWhenEntityChanges() {
    TestEntity entity = entity();
    EntityRepository<?> repository = mock(EntityRepository.class);
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.ChangeEventDAO changeEventDAO = mock(CollectionDAO.ChangeEventDAO.class);

    when(collectionDAO.changeEventDAO()).thenReturn(changeEventDAO);

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedEntity.when(() -> Entity.getEntityRepository("table")).thenReturn(repository);
      mockedEntity.when(Entity::getCollectionDAO).thenReturn(collectionDAO);

      EntityFieldUtils.setEntityField(
          entity, "table", "alice", "description", "fresh description", true, "workflow-bot");

      verify(repository)
          .patch(
              isNull(),
              eq(entity.getId()),
              eq("alice"),
              any(JsonPatch.class),
              isNull(),
              eq("workflow-bot"));

      ArgumentCaptor<String> jsonCaptor = ArgumentCaptor.forClass(String.class);
      verify(changeEventDAO).insert(jsonCaptor.capture());
      ChangeEvent changeEvent = JsonUtils.readValue(jsonCaptor.getValue(), ChangeEvent.class);
      assertEquals(EventType.ENTITY_UPDATED, changeEvent.getEventType());
      assertEquals(entity.getId(), changeEvent.getEntityId());
      assertEquals("table", changeEvent.getEntityType());
      assertEquals("service.db.orders", changeEvent.getEntityFullyQualifiedName());
      assertEquals("alice", changeEvent.getUserName());
      assertEquals("workflow-bot", changeEvent.getImpersonatedBy());
      assertEquals("fresh description", entity.getDescription());
    }
  }

  @Test
  void setEntityFieldSkipsPatchWhenEntityIsUnchanged() {
    TestEntity entity = entity();
    entity.setDescription("same description");
    EntityRepository<?> repository = mock(EntityRepository.class);
    CollectionDAO.ChangeEventDAO changeEventDAO = mock(CollectionDAO.ChangeEventDAO.class);

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedEntity.when(() -> Entity.getEntityRepository("table")).thenReturn(repository);
      mockedEntity
          .when(Entity::getCollectionDAO)
          .thenThrow(new AssertionError("Should not be called"));

      EntityFieldUtils.setEntityField(
          entity, "table", "alice", "description", "same description", true);

      verifyNoInteractions(repository, changeEventDAO);
    }
  }

  @Test
  void setEntityFieldRoutesSpecializedMutatorsWithoutPatch() {
    TestEntity entity = entity();
    User alice = user("alice");
    Team dataTeam = team("data");

    try (MockedStatic<TagLabelUtil> mockedTagLabelUtil = mockStatic(TagLabelUtil.class);
        MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      stubTagLabelUtilities(mockedTagLabelUtil);
      mockedTagLabelUtil
          .when(() -> TagLabelUtil.getTag("PII.Sensitive"))
          .thenReturn(tag("PII.Sensitive"));
      mockedTagLabelUtil
          .when(() -> TagLabelUtil.getGlossaryTerm("Business.Critical"))
          .thenReturn(glossaryTerm("Business.Critical"));
      mockedTagLabelUtil
          .when(() -> TagLabelUtil.getTag("Certification.Gold"))
          .thenReturn(tag("Certification.Gold"));
      mockedTagLabelUtil
          .when(() -> TagLabelUtil.getTag("Tier.Tier1"))
          .thenReturn(tag("Tier.Tier1"));

      mockedEntity
          .when(() -> Entity.getEntityByName(Entity.USER, "alice", "", NON_DELETED))
          .thenReturn(alice);
      mockedEntity
          .when(() -> Entity.getEntityByName(Entity.TEAM, "data", "", NON_DELETED))
          .thenReturn(dataTeam);

      EntityFieldUtils.setEntityField(entity, "table", "alice", "tags", "PII.Sensitive", false);
      EntityFieldUtils.setEntityField(
          entity, "table", "alice", "glossaryTerms", "Business.Critical", false);
      EntityFieldUtils.setEntityField(
          entity, "table", "alice", "certification", "Certification.Gold", false);
      EntityFieldUtils.setEntityField(entity, "table", "alice", "tier", "Tier.Tier1", false);
      EntityFieldUtils.setEntityField(
          entity, "table", "alice", "owners", "user:alice,team:data", false);
      EntityFieldUtils.setEntityField(
          entity, "table", "alice", "reviewers", "user:alice,team:data", false);
      EntityFieldUtils.setEntityField(
          entity, "table", "alice", "entityStatus", EntityStatus.APPROVED.value(), false);
      EntityFieldUtils.setEntityField(
          entity, "table", "alice", "customField", "manual override", false);

      assertTrue(
          entity.getTags().stream()
              .anyMatch(
                  tag ->
                      "PII.Sensitive".equals(tag.getTagFQN())
                          && tag.getSource() == TagSource.CLASSIFICATION));
      assertTrue(
          entity.getTags().stream()
              .anyMatch(
                  tag ->
                      "Business.Critical".equals(tag.getTagFQN())
                          && tag.getSource() == TagSource.GLOSSARY));
      assertEquals("Certification.Gold", entity.getCertification().getTagLabel().getTagFQN());
      assertEquals(2, entity.getOwners().size());
      assertEquals(2, entity.getReviewers().size());
      assertEquals(EntityStatus.APPROVED, entity.getEntityStatus());
      assertEquals("manual override", entity.getCustomField());
    }
  }

  @Test
  void setSimpleStringFieldUsesReflectionFallbackForCustomFields() {
    TestEntity entity = entity();

    EntityFieldUtils.setSimpleStringField(entity, "customField", "assigned via reflection");
    EntityFieldUtils.setSimpleStringField(entity, "missingField", "ignored");

    assertEquals("assigned via reflection", entity.getCustomField());
  }

  @Test
  void appendTagsAddsResolvedTagsSkipsDuplicatesAndLookupFailures() {
    TestEntity entity = entity();
    entity.setTags(List.of(tagLabel("PII.Existing", TagSource.CLASSIFICATION)));

    try (MockedStatic<TagLabelUtil> mockedTagLabelUtil = mockStatic(TagLabelUtil.class)) {
      stubTagLabelUtilities(mockedTagLabelUtil);
      mockedTagLabelUtil
          .when(() -> TagLabelUtil.getTag("PII.Sensitive"))
          .thenReturn(tag("PII.Sensitive"));
      mockedTagLabelUtil
          .when(() -> TagLabelUtil.getTag("broken"))
          .thenThrow(new IllegalArgumentException("missing"));

      EntityFieldUtils.appendTags(entity, "PII.Existing, PII.Sensitive, broken");

      assertEquals(2, entity.getTags().size());
      assertTrue(entity.getTags().stream().anyMatch(tag -> "PII.Existing".equals(tag.getTagFQN())));
      TagLabel addedTag =
          entity.getTags().stream()
              .filter(tag -> "PII.Sensitive".equals(tag.getTagFQN()))
              .findFirst()
              .orElseThrow();
      assertEquals(TagLabel.LabelType.AUTOMATED, addedTag.getLabelType());
      assertEquals(TagLabel.State.CONFIRMED, addedTag.getState());
      assertEquals(TagSource.CLASSIFICATION, addedTag.getSource());
    }
  }

  @Test
  void appendTagsReplacesConflictingClassificationTagsButKeepsGlossaryTerms() {
    TestEntity entity = entity();
    entity.setTags(
        List.of(
            tagLabel("PII.Restricted", TagSource.CLASSIFICATION),
            tagLabel("Business.Legacy", TagSource.GLOSSARY)));

    try (MockedStatic<TagLabelUtil> mockedTagLabelUtil = mockStatic(TagLabelUtil.class)) {
      mockedTagLabelUtil
          .when(() -> TagLabelUtil.getTag("PII.Sensitive"))
          .thenReturn(tag("PII.Sensitive"));
      mockedTagLabelUtil
          .when(() -> TagLabelUtil.checkMutuallyExclusive(Mockito.anyList()))
          .thenAnswer(
              invocation -> {
                @SuppressWarnings("unchecked")
                List<TagLabel> labels = invocation.getArgument(0);
                boolean hasRestricted =
                    labels.stream().anyMatch(tag -> "PII.Restricted".equals(tag.getTagFQN()));
                boolean hasSensitive =
                    labels.stream().anyMatch(tag -> "PII.Sensitive".equals(tag.getTagFQN()));
                if (hasRestricted && hasSensitive) {
                  throw new IllegalArgumentException("conflict");
                }
                return null;
              });

      EntityFieldUtils.appendTags(entity, "PII.Sensitive");

      assertEquals(2, entity.getTags().size());
      assertTrue(
          entity.getTags().stream()
              .anyMatch(
                  tag ->
                      "Business.Legacy".equals(tag.getTagFQN())
                          && tag.getSource() == TagSource.GLOSSARY));
      assertTrue(
          entity.getTags().stream().anyMatch(tag -> "PII.Sensitive".equals(tag.getTagFQN())));
      assertFalse(
          entity.getTags().stream().anyMatch(tag -> "PII.Restricted".equals(tag.getTagFQN())));
    }
  }

  @Test
  void appendGlossaryTermsAddsResolvedTermsAndSkipsDuplicates() {
    TestEntity entity = entity();
    entity.setTags(List.of(tagLabel("Business.Legacy", TagSource.GLOSSARY)));

    try (MockedStatic<TagLabelUtil> mockedTagLabelUtil = mockStatic(TagLabelUtil.class)) {
      stubTagLabelUtilities(mockedTagLabelUtil);
      mockedTagLabelUtil
          .when(() -> TagLabelUtil.getGlossaryTerm("Business.Critical"))
          .thenReturn(glossaryTerm("Business.Critical"));

      EntityFieldUtils.appendGlossaryTerms(entity, "Business.Legacy, Business.Critical");

      assertEquals(2, entity.getTags().size());
      assertTrue(
          entity.getTags().stream()
              .anyMatch(
                  tag ->
                      "Business.Critical".equals(tag.getTagFQN())
                          && tag.getSource() == TagSource.GLOSSARY));
    }
  }

  @Test
  void appendGlossaryTermsReplacesConflictingTerms() {
    TestEntity entity = entity();
    entity.setTags(
        List.of(
            tagLabel("PII.Sensitive", TagSource.CLASSIFICATION),
            tagLabel("Business.Legacy", TagSource.GLOSSARY)));

    try (MockedStatic<TagLabelUtil> mockedTagLabelUtil = mockStatic(TagLabelUtil.class)) {
      mockedTagLabelUtil
          .when(() -> TagLabelUtil.getGlossaryTerm("Business.Critical"))
          .thenReturn(glossaryTerm("Business.Critical"));
      mockedTagLabelUtil
          .when(() -> TagLabelUtil.checkMutuallyExclusive(Mockito.anyList()))
          .thenAnswer(
              invocation -> {
                @SuppressWarnings("unchecked")
                List<TagLabel> labels = invocation.getArgument(0);
                boolean hasLegacy =
                    labels.stream().anyMatch(tag -> "Business.Legacy".equals(tag.getTagFQN()));
                boolean hasCritical =
                    labels.stream().anyMatch(tag -> "Business.Critical".equals(tag.getTagFQN()));
                if (hasLegacy && hasCritical) {
                  throw new IllegalArgumentException("conflict");
                }
                return null;
              });

      EntityFieldUtils.appendGlossaryTerms(entity, "Business.Critical");

      assertEquals(2, entity.getTags().size());
      assertTrue(
          entity.getTags().stream().anyMatch(tag -> "PII.Sensitive".equals(tag.getTagFQN())));
      assertTrue(
          entity.getTags().stream().anyMatch(tag -> "Business.Critical".equals(tag.getTagFQN())));
      assertFalse(
          entity.getTags().stream().anyMatch(tag -> "Business.Legacy".equals(tag.getTagFQN())));
    }
  }

  @Test
  void setCertificationSetsAndClearsCertification() {
    TestEntity entity = entity();

    try (MockedStatic<TagLabelUtil> mockedTagLabelUtil = mockStatic(TagLabelUtil.class)) {
      mockedTagLabelUtil
          .when(() -> TagLabelUtil.getTag("Certification.Gold"))
          .thenReturn(tag("Certification.Gold"));

      EntityFieldUtils.setCertification(entity, "Certification.Gold");
      assertNotNull(entity.getCertification());
      assertEquals("Certification.Gold", entity.getCertification().getTagLabel().getTagFQN());
      assertEquals(
          TagLabel.LabelType.AUTOMATED, entity.getCertification().getTagLabel().getLabelType());

      EntityFieldUtils.setCertification(entity, null);
      assertNull(entity.getCertification());
    }
  }

  @Test
  void setTierReplacesExistingTierOnImmutableTagList() {
    TestEntity entity = entity();
    entity.setTags(
        List.of(
            tagLabel("Tier.Tier2", TagSource.CLASSIFICATION),
            tagLabel("PII.Sensitive", TagSource.CLASSIFICATION)));

    try (MockedStatic<TagLabelUtil> mockedTagLabelUtil = mockStatic(TagLabelUtil.class)) {
      mockedTagLabelUtil
          .when(() -> TagLabelUtil.getTag("Tier.Tier1"))
          .thenReturn(tag("Tier.Tier1"));

      assertDoesNotThrow(() -> EntityFieldUtils.setTier(entity, "Tier.Tier1"));

      assertEquals(2, entity.getTags().size());
      assertTrue(
          entity.getTags().stream().anyMatch(tag -> "PII.Sensitive".equals(tag.getTagFQN())));
      assertTrue(entity.getTags().stream().anyMatch(tag -> "Tier.Tier1".equals(tag.getTagFQN())));
      assertFalse(entity.getTags().stream().anyMatch(tag -> "Tier.Tier2".equals(tag.getTagFQN())));
    }
  }

  @Test
  void setOwnersResolvesUsersAndTeamsAndClearsWhenEmpty() {
    TestEntity entity = entity();
    entity.setOwners(List.of(new EntityReference().withName("legacyOwner")));

    EntityFieldUtils.setOwners(entity, null);
    assertNull(entity.getOwners());

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedEntity
          .when(() -> Entity.getEntityByName(Entity.USER, "alice", "", NON_DELETED))
          .thenReturn(user("alice"));
      mockedEntity
          .when(() -> Entity.getEntityByName(Entity.TEAM, "data", "", NON_DELETED))
          .thenReturn(team("data"));
      mockedEntity
          .when(() -> Entity.getEntityByName(Entity.USER, "missing", "", NON_DELETED))
          .thenThrow(new IllegalArgumentException("missing"));

      EntityFieldUtils.setOwners(
          entity, "user:alice, team:data, invalid, bot:daemon, user:missing");

      assertEquals(2, entity.getOwners().size());
      assertTrue(entity.getOwners().stream().anyMatch(ref -> "alice".equals(ref.getName())));
      assertTrue(entity.getOwners().stream().anyMatch(ref -> "data".equals(ref.getName())));
    }
  }

  @Test
  void setReviewersResolvesUsersAndTeamsAndClearsWhenEmpty() {
    TestEntity entity = entity();
    entity.setReviewers(List.of(new EntityReference().withName("legacyReviewer")));

    EntityFieldUtils.setReviewers(entity, "");
    assertNull(entity.getReviewers());

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedEntity
          .when(() -> Entity.getEntityByName(Entity.USER, "alice", "", NON_DELETED))
          .thenReturn(user("alice"));
      mockedEntity
          .when(() -> Entity.getEntityByName(Entity.TEAM, "governance", "", NON_DELETED))
          .thenReturn(team("governance"));
      mockedEntity
          .when(() -> Entity.getEntityByName(Entity.USER, "missing", "", NON_DELETED))
          .thenThrow(new IllegalArgumentException("missing"));

      EntityFieldUtils.setReviewers(
          entity, "user:alice, team:governance, invalid, bot:daemon, user:missing");

      assertEquals(2, entity.getReviewers().size());
      assertTrue(entity.getReviewers().stream().anyMatch(ref -> "alice".equals(ref.getName())));
      assertTrue(
          entity.getReviewers().stream().anyMatch(ref -> "governance".equals(ref.getName())));
    }
  }

  @Test
  void setEntityStatusSupportsEnumAndLegacyFallbacks() {
    TestEntity entity = entity();
    LegacyStatusEntity legacyEntity = new LegacyStatusEntity();
    String approvedValue = EntityStatus.APPROVED.value();

    EntityFieldUtils.setEntityStatus(entity, approvedValue);
    EntityFieldUtils.setEntityStatus(entity, "legacy-state");
    EntityFieldUtils.setEntityStatus(legacyEntity, approvedValue);

    assertEquals(EntityStatus.APPROVED, entity.getEntityStatus());
    assertEquals("legacy-state", entity.getStatus());
    assertEquals(approvedValue, legacyEntity.getStatus());
  }

  private static void stubTagLabelUtilities(MockedStatic<TagLabelUtil> mockedTagLabelUtil) {
    mockedTagLabelUtil
        .when(() -> TagLabelUtil.checkMutuallyExclusive(Mockito.anyList()))
        .thenAnswer(invocation -> null);
  }

  private static TestEntity entity() {
    TestEntity entity = new TestEntity();
    entity.setId(UUID.randomUUID());
    entity.setName("orders");
    entity.setFullyQualifiedName("service.db.orders");
    entity.setUpdatedAt(1234L);
    entity.setVersion(1.0);
    return entity;
  }

  private static Tag tag(String fqn) {
    return new Tag()
        .withName(fqn.substring(fqn.lastIndexOf('.') + 1))
        .withDisplayName(fqn)
        .withFullyQualifiedName(fqn);
  }

  private static GlossaryTerm glossaryTerm(String fqn) {
    return new GlossaryTerm()
        .withName(fqn.substring(fqn.lastIndexOf('.') + 1))
        .withDisplayName(fqn)
        .withFullyQualifiedName(fqn);
  }

  private static User user(String name) {
    return new User().withId(UUID.randomUUID()).withName(name).withFullyQualifiedName(name);
  }

  private static Team team(String name) {
    return new Team().withId(UUID.randomUUID()).withName(name).withFullyQualifiedName(name);
  }

  private static TagLabel tagLabel(String fqn, TagSource source) {
    return new TagLabel().withTagFQN(fqn).withSource(source);
  }

  private static class LegacyStatusEntity extends TestEntity {
    @Override
    public void setEntityStatus(EntityStatus approvalStatus) {
      throw new UnsupportedOperationException("Legacy status only");
    }
  }

  private static class TestEntity implements EntityInterface {
    private UUID id;
    private String description;
    private String displayName;
    private String name;
    private Double version;
    private String updatedBy;
    private Long updatedAt;
    private URI href;
    private ChangeDescription changeDescription;
    private ChangeDescription incrementalChangeDescription;
    private String fullyQualifiedName;
    private List<TagLabel> tags;
    private AssetCertification certification;
    private List<EntityReference> owners;
    private List<EntityReference> reviewers;
    private EntityStatus entityStatus;
    private String status;
    private String customField;

    @Override
    public UUID getId() {
      return id;
    }

    @Override
    public String getDescription() {
      return description;
    }

    @Override
    public String getDisplayName() {
      return displayName;
    }

    @Override
    public String getName() {
      return name;
    }

    @Override
    public Double getVersion() {
      return version;
    }

    @Override
    public String getUpdatedBy() {
      return updatedBy;
    }

    @Override
    public Long getUpdatedAt() {
      return updatedAt;
    }

    @Override
    public URI getHref() {
      return href;
    }

    @Override
    public ChangeDescription getChangeDescription() {
      return changeDescription;
    }

    @Override
    public ChangeDescription getIncrementalChangeDescription() {
      return incrementalChangeDescription;
    }

    @Override
    public List<EntityReference> getOwners() {
      return owners;
    }

    @Override
    public List<TagLabel> getTags() {
      return tags;
    }

    @Override
    public EntityStatus getEntityStatus() {
      return entityStatus;
    }

    @Override
    public String getFullyQualifiedName() {
      return fullyQualifiedName;
    }

    @Override
    public List<EntityReference> getReviewers() {
      return reviewers;
    }

    @Override
    public AssetCertification getCertification() {
      return certification;
    }

    @Override
    public void setId(UUID id) {
      this.id = id;
    }

    @Override
    public void setDescription(String description) {
      this.description = description;
    }

    @Override
    public void setDisplayName(String displayName) {
      this.displayName = displayName;
    }

    @Override
    public void setName(String name) {
      this.name = name;
    }

    @Override
    public void setVersion(Double newVersion) {
      this.version = newVersion;
    }

    @Override
    public void setChangeDescription(ChangeDescription changeDescription) {
      this.changeDescription = changeDescription;
    }

    @Override
    public void setIncrementalChangeDescription(ChangeDescription incrementalChangeDescription) {
      this.incrementalChangeDescription = incrementalChangeDescription;
    }

    @Override
    public void setFullyQualifiedName(String fullyQualifiedName) {
      this.fullyQualifiedName = fullyQualifiedName;
    }

    @Override
    public void setUpdatedBy(String admin) {
      this.updatedBy = admin;
    }

    @Override
    public void setUpdatedAt(Long updatedAt) {
      this.updatedAt = updatedAt;
    }

    @Override
    public void setHref(URI href) {
      this.href = href;
    }

    @Override
    public TestEntity withHref(URI href) {
      this.href = href;
      return this;
    }

    @Override
    public void setTags(List<TagLabel> tags) {
      this.tags = tags;
    }

    @Override
    public void setEntityStatus(EntityStatus approvalStatus) {
      this.entityStatus = approvalStatus;
    }

    @Override
    public void setOwners(List<EntityReference> owners) {
      this.owners = owners;
    }

    @Override
    public void setReviewers(List<EntityReference> reviewers) {
      this.reviewers = reviewers;
    }

    @Override
    public void setCertification(AssetCertification certification) {
      this.certification = certification;
    }

    public String getStatus() {
      return status;
    }

    public void setStatus(String status) {
      this.status = status;
    }

    public String getCustomField() {
      return customField;
    }
  }
}
