package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.lang.reflect.Method;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.Type;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.entity.type.Category;
import org.openmetadata.schema.entity.type.CustomProperty;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.TypeRegistry;
import org.openmetadata.service.jdbi3.ClassificationTagDAOs.TagUsageDAO;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

/**
 * Guards the bot-PUT rule on {@code extension}: a scheduled re-sync must not clobber custom
 * properties a user curated in the UI, but an explicit force-sync (overrideMetadata) must be able
 * to refresh the values a connector owns. See issue #33324.
 */
class EntityRepositoryExtensionTest {

  private static final String BOT_NAME = "ingestion-bot";

  private CollectionDAO daoCollection;
  private CollectionDAO.PipelineDAO pipelineDAO;
  private TestPipelineRepo repo;

  private static class TestPipelineRepo extends EntityRepository<Pipeline> {
    TestPipelineRepo(CollectionDAO.PipelineDAO dao) {
      super("pipelines", Entity.PIPELINE, Pipeline.class, dao, "extension", "extension");
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
    pipelineDAO = mock(CollectionDAO.PipelineDAO.class);

    when(daoCollection.tagUsageDAO()).thenReturn(mock(TagUsageDAO.class));
    when(daoCollection.relationshipDAO())
        .thenReturn(mock(CollectionDAO.EntityRelationshipDAO.class));
    when(daoCollection.entityExtensionDAO())
        .thenReturn(mock(CollectionDAO.EntityExtensionDAO.class));

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
    Entity.setSystemRepository(null);
    Entity.cleanup();
  }

  @SuppressWarnings("unchecked")
  private static void registerBotUser() {
    EntityRepository<User> mockUserRepo = mock(EntityRepository.class);
    User bot = new User().withName(BOT_NAME).withIsBot(true);
    when(mockUserRepo.findByNameOrNull(anyString(), any()))
        .thenAnswer(inv -> BOT_NAME.equals(inv.getArgument(0)) ? bot : null);
    Entity.registerEntity(User.class, Entity.USER, mockUserRepo);
  }

  @SuppressWarnings("unchecked")
  private static void registerNoUsersFound() {
    EntityRepository<User> mockUserRepo = mock(EntityRepository.class);
    when(mockUserRepo.findByNameOrNull(anyString(), any())).thenReturn(null);
    Entity.registerEntity(User.class, Entity.USER, mockUserRepo);
  }

  private static Map<String, Object> extension(String key, String value) {
    Map<String, Object> fields = new LinkedHashMap<>();
    fields.put(key, value);
    return fields;
  }

  private static Pipeline pipelineWithExtension(String updatedBy, Object extension) {
    return new Pipeline()
        .withId(UUID.randomUUID())
        .withName("my-pipeline")
        .withFullyQualifiedName("service.my-pipeline")
        .withUpdatedBy(updatedBy)
        .withExtension(extension);
  }

  private EntityRepository<Pipeline>.EntityUpdater updater(
      Pipeline original, Pipeline updated, boolean overrideMetadata) {
    EntityRepository<Pipeline>.EntityUpdater updater =
        repo.new EntityUpdater(original, updated, EntityRepository.Operation.PUT);
    updater.setOverrideMetadata(overrideMetadata);
    return updater;
  }

  private static void invokeUpdateExtension(EntityRepository<Pipeline>.EntityUpdater updater)
      throws Exception {
    Method method =
        EntityRepository.EntityUpdater.class.getDeclaredMethod("updateExtension", boolean.class);
    method.setAccessible(true);
    method.invoke(updater, true);
  }

  @SuppressWarnings("unchecked")
  private static String extensionValue(Pipeline pipeline, String key) {
    assertNotNull(pipeline.getExtension(), "extension was unexpectedly null");
    return String.valueOf(((Map<String, Object>) pipeline.getExtension()).get(key));
  }

  @Test
  void botPutWithoutOverrideMetadataKeepsStoredExtension() throws Exception {
    registerBotUser();

    Pipeline original = pipelineWithExtension(BOT_NAME, extension("owner_team", "curated"));
    Pipeline updated = pipelineWithExtension(BOT_NAME, extension("owner_team", "from-source"));

    invokeUpdateExtension(updater(original, updated, false));

    assertEquals("curated", extensionValue(updated, "owner_team"));
  }

  @Test
  void botPutWithOverrideMetadataAppliesIncomingExtension() throws Exception {
    registerBotUser();

    Pipeline original = pipelineWithExtension(BOT_NAME, extension("owner_team", "stale"));
    Pipeline updated = pipelineWithExtension(BOT_NAME, extension("owner_team", "refreshed"));

    invokeUpdateExtension(updater(original, updated, true));

    assertEquals("refreshed", extensionValue(updated, "owner_team"));
  }

  @Test
  void botPutWithOverrideMetadataAddsNewlyIntroducedProperty() throws Exception {
    registerBotUser();

    Pipeline original = pipelineWithExtension(BOT_NAME, extension("owner_team", "team-alpha"));
    Map<String, Object> incoming = extension("owner_team", "team-alpha");
    incoming.put("retention_days", "30");
    Pipeline updated = pipelineWithExtension(BOT_NAME, incoming);

    invokeUpdateExtension(updater(original, updated, true));

    assertEquals("30", extensionValue(updated, "retention_days"));
  }

  @Test
  void botPutWithOverrideMetadataKeepsPropertyTheConnectorDoesNotSend() throws Exception {
    // Ingestion sends only the properties its own source produces, and the server records no
    // ownership per property, so a curated one the connector knows nothing about must survive.
    registerBotUser();

    Map<String, Object> stored = extension("owner_team", "stale");
    stored.put("curated_note", "set by a human in the UI");
    Pipeline original = pipelineWithExtension(BOT_NAME, stored);
    Pipeline updated = pipelineWithExtension(BOT_NAME, extension("owner_team", "refreshed"));

    invokeUpdateExtension(updater(original, updated, true));

    assertEquals("refreshed", extensionValue(updated, "owner_team"));
    assertEquals("set by a human in the UI", extensionValue(updated, "curated_note"));
  }

  @Test
  void botPutOmittingExtensionWithOverrideMetadataKeepsStoredExtension() throws Exception {
    registerBotUser();

    Pipeline original = pipelineWithExtension(BOT_NAME, extension("owner_team", "curated"));
    Pipeline updated = pipelineWithExtension(BOT_NAME, null);

    invokeUpdateExtension(updater(original, updated, true));

    assertEquals("curated", extensionValue(updated, "owner_team"));
  }

  @Test
  void botPutWithEmptyExtensionAndOverrideMetadataKeepsStoredExtension() throws Exception {
    registerBotUser();

    Pipeline original = pipelineWithExtension(BOT_NAME, extension("owner_team", "curated"));
    Pipeline updated = pipelineWithExtension(BOT_NAME, new LinkedHashMap<String, Object>());

    invokeUpdateExtension(updater(original, updated, true));

    assertEquals("curated", extensionValue(updated, "owner_team"));
  }

  @Test
  void botPutWithOverrideMetadataPassesANonObjectExtensionThrough() throws Exception {
    // extension is schema-typed as an object; a non-object is malformed input. The merge must not
    // try to combine it with the stored object, it just hands it on to the normal diff.
    registerBotUser();

    Pipeline original = pipelineWithExtension(BOT_NAME, extension("owner_team", "curated"));
    Pipeline updated = pipelineWithExtension(BOT_NAME, "not-an-object");

    invokeUpdateExtension(updater(original, updated, true));

    assertEquals("not-an-object", updated.getExtension());
  }

  @Test
  void humanPutAppliesIncomingExtensionWithoutOverrideMetadata() throws Exception {
    registerNoUsersFound();

    Pipeline original = pipelineWithExtension("a-human", extension("owner_team", "old"));
    Pipeline updated = pipelineWithExtension("a-human", extension("owner_team", "new"));

    invokeUpdateExtension(updater(original, updated, false));

    assertEquals("new", extensionValue(updated, "owner_team"));
  }

  private static void seedStringCustomProperties(String... propertyNames) {
    TypeRegistry.instance()
        .addType(new Type().withName("string").withSchema("{\"type\":\"string\"}"));
    TypeRegistry.instance()
        .addType(
            new Type()
                .withName(Entity.PIPELINE)
                .withCategory(Category.Entity)
                .withCustomProperties(
                    java.util.Arrays.stream(propertyNames)
                        .map(
                            n ->
                                new CustomProperty()
                                    .withName(n)
                                    .withPropertyType(new EntityReference().withName("string")))
                        .toList()));
  }

  private static void invokeUpdateExtensionOnRealPath(
      EntityRepository<Pipeline>.EntityUpdater updater) throws Exception {
    Method method =
        EntityRepository.EntityUpdater.class.getDeclaredMethod("updateExtension", boolean.class);
    method.setAccessible(true);
    method.invoke(updater, false);
  }

  @Test
  void forceSyncOnTheRealUpdatePathKeepsTheCuratedPropertyAndRefreshesTheConnectorOne()
      throws Exception {
    // consolidatingChanges=false is the path bulk ingestion takes: it re-derives the extension,
    // runs validateAndTransformExtension over each changed property against the registered
    // definitions, and applies deletions. The merge must survive all of it.
    registerBotUser();
    seedStringCustomProperties("owner_team", "curated_note");

    Map<String, Object> stored = extension("owner_team", "stale");
    stored.put("curated_note", "set by a human in the UI");
    Pipeline original = pipelineWithExtension(BOT_NAME, stored);
    Pipeline updated = pipelineWithExtension(BOT_NAME, extension("owner_team", "refreshed"));

    invokeUpdateExtensionOnRealPath(updater(original, updated, true));

    assertEquals("refreshed", extensionValue(updated, "owner_team"));
    assertEquals("set by a human in the UI", extensionValue(updated, "curated_note"));
  }
}
