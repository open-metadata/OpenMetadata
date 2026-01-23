package org.openmetadata.it.tests.repositories;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.DatabaseTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.PredefinedRecognizer;
import org.openmetadata.schema.type.Recognizer;
import org.openmetadata.schema.type.RecognizerException;
import org.openmetadata.schema.type.RecognizerFeedback;
import org.openmetadata.schema.type.Resolution;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.fluent.DatabaseSchemas;
import org.openmetadata.sdk.fluent.Databases;
import org.openmetadata.sdk.fluent.Tables;
import org.openmetadata.sdk.fluent.Tags;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.RecognizerFeedbackRepository;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.jdbi3.TagRepository;

@ExtendWith(TestNamespaceExtension.class)
class RecognizerFeedbackRepositoryTest {

  private static RecognizerFeedbackRepository repository;
  private static TagRepository tagRepository;
  private static TableRepository tableRepository;

  @BeforeAll
  static void setupAll() {
    SdkClients.adminClient();
    repository = new RecognizerFeedbackRepository(Entity.getCollectionDAO());
    tagRepository = (TagRepository) Entity.getEntityRepository(Entity.TAG);
    tableRepository = (TableRepository) Entity.getEntityRepository(Entity.TABLE);
  }

  protected SharedEntities shared() {
    return SharedEntities.get();
  }

  @Test
  void testCreate_shouldSetDefaultValues(TestNamespace ns) {
    RecognizerFeedback feedback = new RecognizerFeedback();
    feedback.setEntityLink("<#E::table::testTable>");
    feedback.setTagFQN("PII.Sensitive");
    feedback.setFeedbackType(RecognizerFeedback.FeedbackType.FALSE_POSITIVE);
    feedback.setUserReason(RecognizerFeedback.UserReason.NOT_SENSITIVE_DATA);
    feedback.setCreatedBy(shared().USER1_REF);

    RecognizerFeedback result = repository.create(feedback);

    assertNotNull(result.getId());
    assertNotNull(result.getCreatedAt());
    assertEquals(RecognizerFeedback.Status.PENDING, result.getStatus());
  }

  @Test
  void testCreate_shouldPreserveProvidedValues(TestNamespace ns) {
    UUID providedId = UUID.randomUUID();
    long providedTime = System.currentTimeMillis();

    RecognizerFeedback feedback = new RecognizerFeedback();
    feedback.setId(providedId);
    feedback.setCreatedAt(providedTime);
    feedback.setStatus(RecognizerFeedback.Status.APPLIED);
    feedback.setEntityLink("<#E::table::testTable>");
    feedback.setTagFQN("PII.Sensitive");
    feedback.setFeedbackType(RecognizerFeedback.FeedbackType.FALSE_POSITIVE);
    feedback.setUserReason(RecognizerFeedback.UserReason.NOT_SENSITIVE_DATA);
    feedback.setCreatedBy(shared().USER1.getEntityReference());

    RecognizerFeedback result = repository.create(feedback);

    assertEquals(providedId, result.getId());
    assertEquals(providedTime, result.getCreatedAt());
    assertEquals(RecognizerFeedback.Status.APPLIED, result.getStatus());
  }

  @Test
  void testGetAndUpdate(TestNamespace ns) {
    RecognizerFeedback feedback = new RecognizerFeedback();
    feedback.setEntityLink("<#E::table::testTable>");
    feedback.setTagFQN("PII.Sensitive");
    feedback.setFeedbackType(RecognizerFeedback.FeedbackType.FALSE_POSITIVE);
    feedback.setUserReason(RecognizerFeedback.UserReason.NOT_SENSITIVE_DATA);
    feedback.setCreatedBy(shared().USER1_REF);

    RecognizerFeedback created = repository.create(feedback);
    UUID id = created.getId();

    RecognizerFeedback retrieved = repository.get(id);
    assertNotNull(retrieved);
    assertEquals(id, retrieved.getId());

    retrieved.setStatus(RecognizerFeedback.Status.APPLIED);
    RecognizerFeedback updated = repository.update(retrieved);

    assertEquals(RecognizerFeedback.Status.APPLIED, updated.getStatus());
  }

  @Test
  void testGet_shouldThrowExceptionWhenNotFound(TestNamespace ns) {
    UUID nonExistentId = UUID.randomUUID();
    assertThrows(EntityNotFoundException.class, () -> repository.get(nonExistentId));
  }

  @Test
  void testApplyFeedback_shouldThrowExceptionWhenNotPending(TestNamespace ns) {
    RecognizerFeedback feedback = new RecognizerFeedback();
    feedback.setStatus(RecognizerFeedback.Status.APPLIED);

    IllegalStateException exception =
        assertThrows(
            IllegalStateException.class, () -> repository.applyFeedback(feedback, "testUser"));

    assertTrue(exception.getMessage().contains("Cannot apply feedback in status"));
  }

  @Test
  void testApplyFeedback_shouldAddExceptionToRecognizer(TestNamespace ns) {
    String tagFqn = createTagWithRecognizer(ns);
    Table table = createTableWithGeneratedTag(ns, tagFqn);

    RecognizerFeedback feedback = createValidFeedback(table, tagFqn);
    feedback.setStatus(RecognizerFeedback.Status.PENDING);
    feedback.setFeedbackType(RecognizerFeedback.FeedbackType.FALSE_POSITIVE);

    RecognizerFeedback result = repository.applyFeedback(feedback, "admin");

    assertEquals(RecognizerFeedback.Status.APPLIED, result.getStatus());
    assertNotNull(result.getResolution());
    assertEquals(Resolution.Action.ADDED_TO_EXCEPTION_LIST, result.getResolution().getAction());

    Tag updatedTag = tagRepository.getByName(null, tagFqn, tagRepository.getFields("recognizers"));
    assertNotNull(updatedTag.getRecognizers());
    assertTrue(updatedTag.getRecognizers().size() > 0);
    Recognizer recognizer = updatedTag.getRecognizers().get(0);
    assertTrue(recognizer.getExceptionList().size() > 0);
  }

  @Test
  void testApplyFeedback_columnOrderingMismatch_shouldNotCorruptTags(TestNamespace ns) {
    String tagFqn = createTagWithRecognizer(ns);

    DatabaseService svc = DatabaseServiceTestFactory.create(ns, "Postgres");
    Database db = DatabaseTestFactory.create(ns, svc.getFullyQualifiedName());
    DatabaseSchema schema = DatabaseSchemaTestFactory.create(ns, db.getFullyQualifiedName());

    TagLabel generatedTag = new TagLabel();
    generatedTag.setTagFQN(tagFqn);
    generatedTag.setLabelType(TagLabel.LabelType.GENERATED);

    TagLabel manualTag = new TagLabel();
    manualTag.setTagFQN("PersonalData.Personal");
    manualTag.setLabelType(TagLabel.LabelType.MANUAL);

    Column col1 =
        new Column()
            .withName(ns.uniqueShortId() + "_col1")
            .withDataType(ColumnDataType.STRING)
            .withTags(Arrays.asList(manualTag));

    Column col2 =
        new Column()
            .withName(ns.uniqueShortId() + "_col2")
            .withDataType(ColumnDataType.STRING)
            .withTags(Arrays.asList(generatedTag));

    Column col3 =
        new Column().withName(ns.uniqueShortId() + "_col3").withDataType(ColumnDataType.STRING);

    List<Column> columns = Arrays.asList(col1, col2, col3);

    Table table =
        Tables.create()
            .name(ns.uniqueShortId() + "_table")
            .inSchema(schema.getFullyQualifiedName())
            .withColumns(columns)
            .execute();

    String columnLink =
        String.format(
            "<#E::table::%s::columns::%s>", table.getFullyQualifiedName(), col2.getName());

    RecognizerFeedback feedback = new RecognizerFeedback();
    feedback.setEntityLink(columnLink);
    feedback.setTagFQN(tagFqn);
    feedback.setFeedbackType(RecognizerFeedback.FeedbackType.FALSE_POSITIVE);
    feedback.setUserReason(RecognizerFeedback.UserReason.NOT_SENSITIVE_DATA);
    feedback.setCreatedBy(createUserReference("admin"));
    feedback.setStatus(RecognizerFeedback.Status.PENDING);

    RecognizerFeedback created = repository.create(feedback);
    repository.applyFeedback(created, "admin");

    Table updatedTable =
        Tables.find(table.getId().toString()).withFields("columns,tags").fetch().get();

    Column updatedCol1 = findColumnByName(updatedTable.getColumns(), col1.getName());
    Column updatedCol2 = findColumnByName(updatedTable.getColumns(), col2.getName());
    Column updatedCol3 = findColumnByName(updatedTable.getColumns(), col3.getName());

    assertNotNull(updatedCol1);
    assertNotNull(updatedCol2);
    assertNotNull(updatedCol3);

    boolean col2HasGeneratedTag =
        updatedCol2.getTags().stream()
            .anyMatch(
                t ->
                    t.getTagFQN().equals(tagFqn)
                        && t.getLabelType() == TagLabel.LabelType.GENERATED);
    assertFalse(col2HasGeneratedTag, "Generated tag should be removed from col2");

    boolean col1StillHasManualTag =
        updatedCol1.getTags().stream().anyMatch(t -> t.getTagFQN().equals("PersonalData.Personal"));
    assertTrue(col1StillHasManualTag, "Manual tag should remain on col1");

    assertTrue(
        updatedCol3.getTags() == null || updatedCol3.getTags().isEmpty(),
        "col3 should have no tags");
  }

  @Test
  void testApplyFeedback_shouldNotDuplicateException(TestNamespace ns) {
    String tagFqn = createTagWithRecognizer(ns);
    Table table = createTableWithGeneratedTag(ns, tagFqn);

    String entityLink = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    RecognizerFeedback feedback =
        repository.create(
            new RecognizerFeedback()
                .withId(UUID.randomUUID())
                .withTagFQN(tagFqn)
                .withEntityLink(entityLink)
                .withFeedbackType(RecognizerFeedback.FeedbackType.FALSE_POSITIVE)
                .withUserReason(RecognizerFeedback.UserReason.NOT_SENSITIVE_DATA)
                .withStatus(RecognizerFeedback.Status.PENDING)
                .withCreatedBy(createUserReference("admin")));
    repository.applyFeedback(feedback, "reviewer");

    feedback =
        repository.create(
            new RecognizerFeedback()
                .withId(UUID.randomUUID())
                .withTagFQN(tagFqn)
                .withEntityLink(entityLink)
                .withFeedbackType(RecognizerFeedback.FeedbackType.FALSE_POSITIVE)
                .withUserReason(RecognizerFeedback.UserReason.NOT_SENSITIVE_DATA)
                .withStatus(RecognizerFeedback.Status.PENDING)
                .withCreatedBy(createUserReference("admin")));
    repository.applyFeedback(feedback, "reviewer");

    Tag updatedTag = tagRepository.getByName(null, tagFqn, tagRepository.getFields("recognizers"));
    assertEquals(1, updatedTag.getRecognizers().getFirst().getExceptionList().size());
  }

  @Test
  void testRejectFeedback_shouldUpdateStatusAndResolution(TestNamespace ns) {
    RecognizerFeedback feedback = new RecognizerFeedback();
    feedback.setEntityLink("<#E::table::testTable>");
    feedback.setTagFQN("PII.Sensitive");
    feedback.setFeedbackType(RecognizerFeedback.FeedbackType.FALSE_POSITIVE);
    feedback.setUserReason(RecognizerFeedback.UserReason.NOT_SENSITIVE_DATA);
    feedback.setStatus(RecognizerFeedback.Status.PENDING);
    feedback.setCreatedBy(shared().USER1_REF);

    RecognizerFeedback created = repository.create(feedback);

    RecognizerFeedback result = repository.rejectFeedback(created, "admin", "Not valid");

    assertEquals(RecognizerFeedback.Status.REJECTED, result.getStatus());
    assertNotNull(result.getResolution());
    assertEquals(Resolution.Action.NO_ACTION_NEEDED, result.getResolution().getAction());
    assertEquals("Not valid", result.getResolution().getResolutionNotes());
  }

  @Test
  void testRejectFeedback_shouldThrowExceptionWhenNotPending(TestNamespace ns) {
    RecognizerFeedback feedback = new RecognizerFeedback();
    feedback.setStatus(RecognizerFeedback.Status.REJECTED);

    IllegalStateException exception =
        assertThrows(
            IllegalStateException.class,
            () -> repository.rejectFeedback(feedback, "admin", "Invalid"));

    assertTrue(exception.getMessage().contains("Cannot reject feedback in status"));
  }

  @Test
  void testGetPendingFeedback(TestNamespace ns) {
    RecognizerFeedback feedback1 = new RecognizerFeedback();
    feedback1.setEntityLink("<#E::table::testTable1>");
    feedback1.setTagFQN("PII.Sensitive");
    feedback1.setFeedbackType(RecognizerFeedback.FeedbackType.FALSE_POSITIVE);
    feedback1.setUserReason(RecognizerFeedback.UserReason.NOT_SENSITIVE_DATA);
    feedback1.setCreatedBy(shared().USER1_REF);

    RecognizerFeedback feedback2 = new RecognizerFeedback();
    feedback2.setEntityLink("<#E::table::testTable2>");
    feedback2.setTagFQN("PII.Sensitive");
    feedback2.setFeedbackType(RecognizerFeedback.FeedbackType.FALSE_POSITIVE);
    feedback2.setUserReason(RecognizerFeedback.UserReason.NOT_SENSITIVE_DATA);
    feedback2.setCreatedBy(shared().USER1_REF);

    repository.create(feedback1);
    repository.create(feedback2);

    List<RecognizerFeedback> results = repository.getPendingFeedback();

    assertTrue(results.size() >= 2);
  }

  @Test
  void testProcessFeedback_shouldValidateAutoAppliedTags(TestNamespace ns) {
    String tagFqn = createTagWithRecognizer(ns);
    Table table = createTableWithManualTag(ns, tagFqn);

    String entityLink = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    RecognizerFeedback feedback = new RecognizerFeedback();
    feedback.setEntityLink(entityLink);
    feedback.setTagFQN(tagFqn);
    feedback.setFeedbackType(RecognizerFeedback.FeedbackType.FALSE_POSITIVE);
    feedback.setUserReason(RecognizerFeedback.UserReason.NOT_SENSITIVE_DATA);

    IllegalArgumentException exception =
        assertThrows(
            IllegalArgumentException.class, () -> repository.processFeedback(feedback, "admin"));

    assertTrue(exception.getMessage().contains("auto-applied tags"));
  }

  @Test
  void testUserReferenceWithComments_shouldCombineReasonAndComments(TestNamespace ns) {
    String tagFqn = createTagWithRecognizer(ns);
    Table table = createTableWithGeneratedTag(ns, tagFqn);

    RecognizerFeedback feedback = createValidFeedback(table, tagFqn);
    feedback.setStatus(RecognizerFeedback.Status.PENDING);
    feedback.setFeedbackType(RecognizerFeedback.FeedbackType.FALSE_POSITIVE);
    feedback.setUserComments("This is test data");

    repository.applyFeedback(feedback, "admin");

    Tag updatedTag = tagRepository.getByName(null, tagFqn, tagRepository.getFields("recognizers"));
    Recognizer recognizer = updatedTag.getRecognizers().get(0);
    RecognizerException exception = recognizer.getExceptionList().get(0);

    assertTrue(exception.getReason().contains("NOT_SENSITIVE_DATA"));
    assertTrue(exception.getReason().contains("This is test data"));
  }

  private String createTagWithRecognizer(TestNamespace ns) {
    String tagName = ns.uniqueShortId() + "_pii-tag";
    CreateTag createTag =
        new CreateTag().withName(tagName).withClassification("PII").withDescription("Test PII tag");

    Recognizer recognizer =
        new Recognizer()
            .withName(ns.uniqueShortId() + "_pii-recognizer")
            .withRecognizerConfig(
                new PredefinedRecognizer().withName(PredefinedRecognizer.Name.EMAIL_RECOGNIZER));

    createTag.withRecognizers(Collections.singletonList(recognizer));

    Tag tag = Tags.create(createTag);
    return tag.getFullyQualifiedName();
  }

  private Table createTableWithGeneratedTag(TestNamespace ns, String tagFqn) {
    DatabaseService svc = DatabaseServiceTestFactory.create(ns, "Postgres");
    Database db =
        Databases.create()
            .name(ns.uniqueShortId() + "_db")
            .in(svc.getFullyQualifiedName())
            .withDescription("Test database created by integration test")
            .execute();
    DatabaseSchema schema =
        DatabaseSchemas.create()
            .name(ns.uniqueShortId() + "_schema")
            .in(db.getFullyQualifiedName())
            .execute();

    TagLabel generatedTag = new TagLabel();
    generatedTag.setTagFQN(tagFqn);
    generatedTag.setLabelType(TagLabel.LabelType.GENERATED);

    Table table = TableTestFactory.createSimple(ns, schema.getFullyQualifiedName());
    table.setTags(Arrays.asList(generatedTag));

    Table updated =
        Tables.find(table.getId().toString()).fetch().withTags(table.getTags()).save().get();
    return updated;
  }

  private Table createTableWithManualTag(TestNamespace ns, String tagFqn) {
    DatabaseService svc = DatabaseServiceTestFactory.create(ns, "Postgres");
    Database db = DatabaseTestFactory.create(ns, svc.getFullyQualifiedName());
    DatabaseSchema schema = DatabaseSchemaTestFactory.create(ns, db.getFullyQualifiedName());

    TagLabel manualTag = new TagLabel();
    manualTag.setTagFQN(tagFqn);
    manualTag.setLabelType(TagLabel.LabelType.MANUAL);

    Table table = TableTestFactory.createSimple(ns, schema.getFullyQualifiedName());
    table.setTags(Arrays.asList(manualTag));

    Table updated =
        Tables.find(table.getId().toString()).fetch().withTags(table.getTags()).save().get();
    return updated;
  }

  private RecognizerFeedback createValidFeedback(Table table, String tagFqn) {
    String entityLink = String.format("<#E::table::%s>", table.getFullyQualifiedName());

    RecognizerFeedback feedback = new RecognizerFeedback();
    feedback.setEntityLink(entityLink);
    feedback.setTagFQN(tagFqn);
    feedback.setFeedbackType(RecognizerFeedback.FeedbackType.FALSE_POSITIVE);
    feedback.setUserReason(RecognizerFeedback.UserReason.NOT_SENSITIVE_DATA);
    feedback.setCreatedBy(createUserReference("admin"));

    return repository.create(feedback);
  }

  private EntityReference createUserReference(String userName) {
    EntityReference userRef = new EntityReference();
    userRef.setName(userName);
    userRef.setType("user");
    return userRef;
  }

  private Column findColumnByName(List<Column> columns, String name) {
    return columns.stream().filter(c -> c.getName().equals(name)).findFirst().orElse(null);
  }
}
