package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.when;
import static org.openmetadata.schema.utils.JsonUtils.deepCopy;
import static org.openmetadata.service.Entity.FIELD_DOMAINS;
import static org.openmetadata.service.Entity.FIELD_OWNERS;
import static org.openmetadata.service.Entity.FIELD_TAGS;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.schema.api.services.CreateSecurityService;
import org.openmetadata.schema.entity.services.SecurityService;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabel.LabelType;
import org.openmetadata.schema.type.TagLabel.TagSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.EntityUtil.Fields;

@Isolated
class SecurityServiceCsvExportTest {

  private static final String SERVICE_NAME = "svc_export";
  private static final String OWNER_CELL = "user:alice";
  private static final String TAG_FQN = "PII.Sensitive";
  private static final String DOMAIN_FQN = "Marketing";

  private CollectionDAO collectionDAO;

  @BeforeEach
  void setUp() {
    collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.SecurityServiceDAO securityServiceDAO =
        mock(CollectionDAO.SecurityServiceDAO.class);
    when(securityServiceDAO.getEntityClass()).thenReturn(SecurityService.class);
    when(collectionDAO.securityServiceDAO()).thenReturn(securityServiceDAO);
    when(collectionDAO.relationshipDAO())
        .thenReturn(mock(CollectionDAO.EntityRelationshipDAO.class));
    when(collectionDAO.tagUsageDAO()).thenReturn(mock(CollectionDAO.TagUsageDAO.class));
    when(collectionDAO.entityExtensionDAO())
        .thenReturn(mock(CollectionDAO.EntityExtensionDAO.class));
    when(collectionDAO.fieldRelationshipDAO())
        .thenReturn(mock(CollectionDAO.FieldRelationshipDAO.class));
    Entity.setCollectionDAO(collectionDAO);
    Entity.setEntityRelationshipRepository(new EntityRelationshipRepository(collectionDAO));
  }

  @AfterEach
  void tearDown() {
    Entity.cleanup();
  }

  @Test
  void exportToCsvRequestsOwnersTagsAndDomainsFromTheStore() throws Exception {
    SecurityService enriched = enrichedSecurityService();
    AtomicReference<Fields> requestedFields = new AtomicReference<>();
    SecurityServiceRepository repository = spy(new SecurityServiceRepository());

    doAnswer(
            invocation -> {
              Fields fields = invocation.getArgument(2);
              requestedFields.set(fields);
              SecurityService copy = deepCopy(enriched, SecurityService.class);
              if (!fields.contains(FIELD_OWNERS)) {
                copy.setOwners(null);
              }
              if (!fields.contains(FIELD_TAGS)) {
                copy.setTags(null);
              }
              if (!fields.contains(FIELD_DOMAINS)) {
                copy.setDomains(null);
              }
              return copy;
            })
        .when(repository)
        .getByName(isNull(), eq(SERVICE_NAME), any(Fields.class));

    String csv = repository.exportToCsv(SERVICE_NAME, "admin", false);

    Fields fields = requestedFields.get();
    assertNotNull(fields, "exportToCsv must read the service before serializing it");
    assertTrue(fields.contains(FIELD_OWNERS), "export must request owners");
    assertTrue(fields.contains(FIELD_TAGS), "export must request tags");
    assertTrue(fields.contains(FIELD_DOMAINS), "export must request domains");

    assertTrue(csv.contains(OWNER_CELL), "owners column must carry the stored owner: " + csv);
    assertTrue(csv.contains(TAG_FQN), "tags column must carry the stored tag: " + csv);
    assertTrue(csv.contains(DOMAIN_FQN), "domain column must carry the stored domain: " + csv);
  }

  @Test
  void csvWriterPopulatesRelationshipColumnsForAFullyFetchedService() throws Exception {
    SecurityService enriched = enrichedSecurityService();

    String csv =
        new SecurityServiceRepository.SecurityServiceCsv(enriched, "admin")
            .exportCsv(List.of(enriched));

    assertTrue(csv.contains(OWNER_CELL), "owners column must be serialized: " + csv);
    assertTrue(csv.contains(TAG_FQN), "tags column must be serialized: " + csv);
    assertTrue(csv.contains(DOMAIN_FQN), "domain column must be serialized: " + csv);
    assertFalse(
        csv.contains("svc_export,,Security service with relationships,Ranger,,,,"),
        "a fully fetched service must not export with all-relationship columns empty: " + csv);
  }

  @Test
  void csvWriterEmitsEmptyRelationshipColumnsForAStrippedService() throws Exception {
    SecurityService stripped = enrichedSecurityService();
    stripped.setOwners(null);
    stripped.setTags(null);
    stripped.setDomains(null);

    String csv =
        new SecurityServiceRepository.SecurityServiceCsv(stripped, "admin")
            .exportCsv(List.of(stripped));

    assertFalse(csv.contains(OWNER_CELL), "a stripped service must not emit an owner column");
    assertFalse(csv.contains(TAG_FQN), "a stripped service must not emit a tag column");
    assertFalse(csv.contains(DOMAIN_FQN), "a stripped service must not emit a domain column");
  }

  /**
   * Exporting a service that fetched {@code domains} but has none must not throw — the field is an
   * empty list (not null) once {@code exportToCsv} requests it via {@code getFields}. Regression
   * for {@code addRecord} calling {@code get(0)} on an empty list.
   */
  @Test
  void csvWriterHandlesServiceWithoutDomain() throws Exception {
    SecurityService noDomain = enrichedSecurityService();
    noDomain.setDomains(List.of());

    String csv =
        new SecurityServiceRepository.SecurityServiceCsv(noDomain, "admin")
            .exportCsv(List.of(noDomain));

    assertTrue(csv.contains(OWNER_CELL), "owner column must still be serialized: " + csv);
    assertTrue(csv.contains(TAG_FQN), "tag column must still be serialized: " + csv);
    assertFalse(csv.contains(DOMAIN_FQN), "an empty domains list must not emit a domain column");
  }

  private static SecurityService enrichedSecurityService() {
    EntityReference owner =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType("user")
            .withName("alice")
            .withFullyQualifiedName("alice");
    TagLabel tag =
        new TagLabel()
            .withTagFQN(TAG_FQN)
            .withSource(TagSource.CLASSIFICATION)
            .withLabelType(LabelType.MANUAL);
    EntityReference domain =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType(Entity.DOMAIN)
            .withFullyQualifiedName(DOMAIN_FQN)
            .withInherited(false);
    return new SecurityService()
        .withId(UUID.randomUUID())
        .withName(SERVICE_NAME)
        .withFullyQualifiedName(SERVICE_NAME)
        .withDescription("Security service with relationships")
        .withServiceType(CreateSecurityService.SecurityServiceType.Ranger)
        .withOwners(List.of(owner))
        .withTags(List.of(tag))
        .withDomains(List.of(domain));
  }
}
