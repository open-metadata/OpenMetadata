package org.openmetadata.service.search.indexes;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.AssetCertification;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.Votes;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchRepository;

/**
 * Tests for {@link SearchIndex#populateCommonFields(Map, org.openmetadata.schema.EntityInterface,
 * String)} covering every branch.
 */
class PopulateCommonFieldsTest {

  private static MockedStatic<Entity> entityStaticMock;

  @BeforeAll
  static void setUp() {
    SearchRepository mockSearchRepo =
        Mockito.mock(SearchRepository.class, Mockito.RETURNS_DEEP_STUBS);
    entityStaticMock = Mockito.mockStatic(Entity.class);
    entityStaticMock.when(Entity::getSearchRepository).thenReturn(mockSearchRepo);
    entityStaticMock
        .when(() -> Entity.getEntityTags(anyString(), any()))
        .thenReturn(Collections.emptyList());
  }

  @AfterAll
  static void tearDown() {
    entityStaticMock.close();
  }

  private SearchIndex createIndex(Dashboard dashboard) {
    return new DashboardIndex(dashboard);
  }

  // ==================== displayName branches ====================

  @Test
  void testDisplayName_usesDisplayNameWhenPresent() {
    Dashboard d =
        new Dashboard()
            .withId(UUID.randomUUID())
            .withName("internal-name")
            .withDisplayName("Pretty Display Name")
            .withFullyQualifiedName("svc.internal-name");

    Map<String, Object> doc = new HashMap<>();
    createIndex(d).populateCommonFields(doc, d, Entity.DASHBOARD);

    assertEquals("Pretty Display Name", doc.get("displayName"));
  }

  @Test
  void testDisplayName_fallsBackToNameWhenDisplayNameNull() {
    Dashboard d =
        new Dashboard()
            .withId(UUID.randomUUID())
            .withName("fallback-name")
            .withFullyQualifiedName("svc.fallback-name");

    Map<String, Object> doc = new HashMap<>();
    createIndex(d).populateCommonFields(doc, d, Entity.DASHBOARD);

    assertEquals("fallback-name", doc.get("displayName"));
  }

  @Test
  void testDisplayName_fallsBackToNameWhenDisplayNameBlank() {
    Dashboard d =
        new Dashboard()
            .withId(UUID.randomUUID())
            .withName("blank-display")
            .withDisplayName("   ")
            .withFullyQualifiedName("svc.blank-display");

    Map<String, Object> doc = new HashMap<>();
    createIndex(d).populateCommonFields(doc, d, Entity.DASHBOARD);

    assertEquals("blank-display", doc.get("displayName"));
  }

  // ==================== entityType ====================

  @Test
  void testEntityType_setCorrectly() {
    Dashboard d =
        new Dashboard().withId(UUID.randomUUID()).withName("t").withFullyQualifiedName("s.t");

    Map<String, Object> doc = new HashMap<>();
    createIndex(d).populateCommonFields(doc, d, Entity.DASHBOARD);

    assertEquals(Entity.DASHBOARD, doc.get("entityType"));
  }

  // ==================== owners, ownerDisplayName, ownerName ====================

  @Test
  void testOwners_withDisplayNames() {
    EntityReference owner1 =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType("user")
            .withName("john")
            .withDisplayName("John Doe");
    EntityReference owner2 =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType("team")
            .withName("data-team")
            .withDisplayName("Data Team");

    Dashboard d =
        new Dashboard()
            .withId(UUID.randomUUID())
            .withName("d")
            .withFullyQualifiedName("s.d")
            .withOwners(List.of(owner1, owner2));

    Map<String, Object> doc = new HashMap<>();
    createIndex(d).populateCommonFields(doc, d, Entity.DASHBOARD);

    @SuppressWarnings("unchecked")
    List<EntityReference> owners = (List<EntityReference>) doc.get("owners");
    assertEquals(2, owners.size());
    assertEquals("John Doe", owners.get(0).getDisplayName());

    @SuppressWarnings("unchecked")
    List<String> ownerDisplayNames = (List<String>) doc.get("ownerDisplayName");
    assertTrue(ownerDisplayNames.contains("John Doe"));
    assertTrue(ownerDisplayNames.contains("Data Team"));

    @SuppressWarnings("unchecked")
    List<String> ownerNames = (List<String>) doc.get("ownerName");
    assertTrue(ownerNames.contains("john"));
    assertTrue(ownerNames.contains("data-team"));
  }

  @Test
  void testOwners_nullDisplayNameFallsBackToName() {
    EntityReference owner =
        new EntityReference().withId(UUID.randomUUID()).withType("user").withName("jane");
    // displayName is null

    Dashboard d =
        new Dashboard()
            .withId(UUID.randomUUID())
            .withName("d")
            .withFullyQualifiedName("s.d")
            .withOwners(List.of(owner));

    Map<String, Object> doc = new HashMap<>();
    createIndex(d).populateCommonFields(doc, d, Entity.DASHBOARD);

    @SuppressWarnings("unchecked")
    List<EntityReference> owners = (List<EntityReference>) doc.get("owners");
    assertEquals("jane", owners.get(0).getDisplayName());
  }

  @Test
  void testOwners_nullOwnersReturnsEmptyList() {
    Dashboard d =
        new Dashboard().withId(UUID.randomUUID()).withName("d").withFullyQualifiedName("s.d");
    // owners is null

    Map<String, Object> doc = new HashMap<>();
    createIndex(d).populateCommonFields(doc, d, Entity.DASHBOARD);

    @SuppressWarnings("unchecked")
    List<EntityReference> owners = (List<EntityReference>) doc.get("owners");
    assertTrue(owners.isEmpty());

    @SuppressWarnings("unchecked")
    List<String> ownerDisplayNames = (List<String>) doc.get("ownerDisplayName");
    assertTrue(ownerDisplayNames.isEmpty());
  }

  // ==================== domains, reviewers, followers ====================

  @Test
  void testDomains_populatedWithDisplayNames() {
    EntityReference domain =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType("domain")
            .withName("engineering")
            .withDisplayName("Engineering");

    Dashboard d =
        new Dashboard()
            .withId(UUID.randomUUID())
            .withName("d")
            .withFullyQualifiedName("s.d")
            .withDomains(List.of(domain));

    Map<String, Object> doc = new HashMap<>();
    createIndex(d).populateCommonFields(doc, d, Entity.DASHBOARD);

    @SuppressWarnings("unchecked")
    List<EntityReference> domains = (List<EntityReference>) doc.get("domains");
    assertEquals(1, domains.size());
    assertEquals("Engineering", domains.get(0).getDisplayName());
  }

  @Test
  void testDomains_nullReturnsEmptyList() {
    Dashboard d =
        new Dashboard().withId(UUID.randomUUID()).withName("d").withFullyQualifiedName("s.d");

    Map<String, Object> doc = new HashMap<>();
    createIndex(d).populateCommonFields(doc, d, Entity.DASHBOARD);

    @SuppressWarnings("unchecked")
    List<EntityReference> domains = (List<EntityReference>) doc.get("domains");
    assertTrue(domains.isEmpty());
  }

  @Test
  void testReviewers_populated() {
    EntityReference reviewer =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType("user")
            .withName("alice")
            .withDisplayName("Alice");

    GlossaryTerm gt =
        new GlossaryTerm()
            .withId(UUID.randomUUID())
            .withName("term1")
            .withFullyQualifiedName("glossary.term1")
            .withReviewers(List.of(reviewer));

    GlossaryTermIndex index = new GlossaryTermIndex(gt);
    Map<String, Object> doc = new HashMap<>();
    index.populateCommonFields(doc, gt, Entity.GLOSSARY_TERM);

    @SuppressWarnings("unchecked")
    List<EntityReference> reviewers = (List<EntityReference>) doc.get("reviewers");
    assertEquals(1, reviewers.size());
  }

  @Test
  void testFollowers_populated() {
    EntityReference follower =
        new EntityReference().withId(UUID.randomUUID()).withType("user").withName("bob");

    Dashboard d =
        new Dashboard()
            .withId(UUID.randomUUID())
            .withName("d")
            .withFullyQualifiedName("s.d")
            .withFollowers(List.of(follower));

    Map<String, Object> doc = new HashMap<>();
    createIndex(d).populateCommonFields(doc, d, Entity.DASHBOARD);

    assertNotNull(doc.get("followers"));
  }

  // ==================== entityStatus ====================

  @Test
  void testEntityStatus_presentWhenSet() {
    Dashboard d =
        new Dashboard()
            .withId(UUID.randomUUID())
            .withName("d")
            .withFullyQualifiedName("s.d")
            .withEntityStatus(EntityStatus.APPROVED);

    Map<String, Object> doc = new HashMap<>();
    createIndex(d).populateCommonFields(doc, d, Entity.DASHBOARD);

    assertEquals("Approved", doc.get("entityStatus"));
  }

  @Test
  void testEntityStatus_defaultsToUnprocessed() {
    Dashboard d =
        new Dashboard().withId(UUID.randomUUID()).withName("d").withFullyQualifiedName("s.d");

    Map<String, Object> doc = new HashMap<>();
    createIndex(d).populateCommonFields(doc, d, Entity.DASHBOARD);

    // Dashboard defaults entityStatus to "Unprocessed"
    assertEquals("Unprocessed", doc.get("entityStatus"));
  }

  // ==================== votes and totalVotes ====================

  @Test
  void testVotes_withUpAndDownVotes() {
    Votes votes = new Votes().withUpVotes(10).withDownVotes(3);
    Dashboard d =
        new Dashboard()
            .withId(UUID.randomUUID())
            .withName("d")
            .withFullyQualifiedName("s.d")
            .withVotes(votes);

    Map<String, Object> doc = new HashMap<>();
    createIndex(d).populateCommonFields(doc, d, Entity.DASHBOARD);

    assertEquals(7, doc.get("totalVotes"));

    @SuppressWarnings("unchecked")
    Map<String, Object> votesMap = (Map<String, Object>) doc.get("votes");
    assertNotNull(votesMap);
    assertEquals(10, votesMap.get("upVotes"));
    assertEquals(3, votesMap.get("downVotes"));
  }

  @Test
  void testVotes_moreDownThanUpClampsToZero() {
    Votes votes = new Votes().withUpVotes(2).withDownVotes(10);
    Dashboard d =
        new Dashboard()
            .withId(UUID.randomUUID())
            .withName("d")
            .withFullyQualifiedName("s.d")
            .withVotes(votes);

    Map<String, Object> doc = new HashMap<>();
    createIndex(d).populateCommonFields(doc, d, Entity.DASHBOARD);

    assertEquals(0, doc.get("totalVotes"));
  }

  @Test
  void testVotes_nullVotes() {
    Dashboard d =
        new Dashboard().withId(UUID.randomUUID()).withName("d").withFullyQualifiedName("s.d");

    Map<String, Object> doc = new HashMap<>();
    createIndex(d).populateCommonFields(doc, d, Entity.DASHBOARD);

    assertEquals(0, doc.get("totalVotes"));
    assertFalse(doc.containsKey("votes"));
  }

  @Test
  void testVotes_nullUpVotesDefaultsToZero() {
    Votes votes = new Votes().withDownVotes(5);
    // upVotes is null
    Dashboard d =
        new Dashboard()
            .withId(UUID.randomUUID())
            .withName("d")
            .withFullyQualifiedName("s.d")
            .withVotes(votes);

    Map<String, Object> doc = new HashMap<>();
    createIndex(d).populateCommonFields(doc, d, Entity.DASHBOARD);

    @SuppressWarnings("unchecked")
    Map<String, Object> votesMap = (Map<String, Object>) doc.get("votes");
    assertEquals(0, votesMap.get("upVotes"));
    assertEquals(5, votesMap.get("downVotes"));
  }

  @Test
  void testVotes_nullDownVotesDefaultsToZero() {
    Votes votes = new Votes().withUpVotes(7);
    // downVotes is null
    Dashboard d =
        new Dashboard()
            .withId(UUID.randomUUID())
            .withName("d")
            .withFullyQualifiedName("s.d")
            .withVotes(votes);

    Map<String, Object> doc = new HashMap<>();
    createIndex(d).populateCommonFields(doc, d, Entity.DASHBOARD);

    @SuppressWarnings("unchecked")
    Map<String, Object> votesMap = (Map<String, Object>) doc.get("votes");
    assertEquals(7, votesMap.get("upVotes"));
    assertEquals(0, votesMap.get("downVotes"));
  }

  // ==================== descriptionStatus ====================

  @Test
  void testDescriptionStatus_completeWhenDescriptionPresent() {
    Dashboard d =
        new Dashboard()
            .withId(UUID.randomUUID())
            .withName("d")
            .withFullyQualifiedName("s.d")
            .withDescription("A dashboard for sales metrics");

    Map<String, Object> doc = new HashMap<>();
    createIndex(d).populateCommonFields(doc, d, Entity.DASHBOARD);

    assertEquals("COMPLETE", doc.get("descriptionStatus"));
  }

  @Test
  void testDescriptionStatus_incompleteWhenDescriptionNull() {
    Dashboard d =
        new Dashboard().withId(UUID.randomUUID()).withName("d").withFullyQualifiedName("s.d");

    Map<String, Object> doc = new HashMap<>();
    createIndex(d).populateCommonFields(doc, d, Entity.DASHBOARD);

    assertEquals("INCOMPLETE", doc.get("descriptionStatus"));
  }

  @Test
  void testDescriptionStatus_incompleteWhenDescriptionEmpty() {
    Dashboard d =
        new Dashboard()
            .withId(UUID.randomUUID())
            .withName("d")
            .withFullyQualifiedName("s.d")
            .withDescription("");

    Map<String, Object> doc = new HashMap<>();
    createIndex(d).populateCommonFields(doc, d, Entity.DASHBOARD);

    assertEquals("INCOMPLETE", doc.get("descriptionStatus"));
  }

  // ==================== fqnParts ====================

  @Test
  void testFqnParts_populatedFromFQN() {
    Dashboard d =
        new Dashboard()
            .withId(UUID.randomUUID())
            .withName("sales")
            .withFullyQualifiedName("looker.sales");

    Map<String, Object> doc = new HashMap<>();
    createIndex(d).populateCommonFields(doc, d, Entity.DASHBOARD);

    @SuppressWarnings("unchecked")
    Set<String> fqnParts = (Set<String>) doc.get("fqnParts");
    assertNotNull(fqnParts);
    assertTrue(fqnParts.contains("looker"));
  }

  // ==================== deleted ====================

  @Test
  void testDeleted_trueWhenEntityDeleted() {
    Dashboard d =
        new Dashboard()
            .withId(UUID.randomUUID())
            .withName("d")
            .withFullyQualifiedName("s.d")
            .withDeleted(true);

    Map<String, Object> doc = new HashMap<>();
    createIndex(d).populateCommonFields(doc, d, Entity.DASHBOARD);

    assertEquals(true, doc.get("deleted"));
  }

  @Test
  void testDeleted_falseWhenEntityNotDeleted() {
    Dashboard d =
        new Dashboard()
            .withId(UUID.randomUUID())
            .withName("d")
            .withFullyQualifiedName("s.d")
            .withDeleted(false);

    Map<String, Object> doc = new HashMap<>();
    createIndex(d).populateCommonFields(doc, d, Entity.DASHBOARD);

    assertEquals(false, doc.get("deleted"));
  }

  @Test
  void testDeleted_falseWhenDeletedNull() {
    Dashboard d =
        new Dashboard().withId(UUID.randomUUID()).withName("d").withFullyQualifiedName("s.d");

    Map<String, Object> doc = new HashMap<>();
    createIndex(d).populateCommonFields(doc, d, Entity.DASHBOARD);

    assertEquals(false, doc.get("deleted"));
  }

  // ==================== certification ====================

  @Test
  void testCertification_setWhenPresent() {
    TagLabel certTag = new TagLabel().withTagFQN("Certification.Gold");
    AssetCertification cert = new AssetCertification().withTagLabel(certTag);
    Dashboard d =
        new Dashboard()
            .withId(UUID.randomUUID())
            .withName("d")
            .withFullyQualifiedName("s.d")
            .withCertification(cert);

    Map<String, Object> doc = new HashMap<>();
    createIndex(d).populateCommonFields(doc, d, Entity.DASHBOARD);

    assertEquals(cert, doc.get("certification"));
  }

  @Test
  void testCertification_nullWhenAbsent() {
    Dashboard d =
        new Dashboard().withId(UUID.randomUUID()).withName("d").withFullyQualifiedName("s.d");

    Map<String, Object> doc = new HashMap<>();
    createIndex(d).populateCommonFields(doc, d, Entity.DASHBOARD);

    assertNull(doc.get("certification"));
  }

  // ==================== changeSummary/sources + customPropertiesTyped ====================

  @Test
  void testDescriptionSourcesAndTagSources_populated() {
    Dashboard d =
        new Dashboard().withId(UUID.randomUUID()).withName("d").withFullyQualifiedName("s.d");

    Map<String, Object> doc = new HashMap<>();
    createIndex(d).populateCommonFields(doc, d, Entity.DASHBOARD);

    assertTrue(doc.containsKey("descriptionSources"));
    assertTrue(doc.containsKey("tagSources"));
    assertTrue(doc.containsKey("tierSources"));
  }

  @Test
  void testCustomPropertiesTyped_populated() {
    Dashboard d =
        new Dashboard().withId(UUID.randomUUID()).withName("d").withFullyQualifiedName("s.d");

    Map<String, Object> doc = new HashMap<>();
    createIndex(d).populateCommonFields(doc, d, Entity.DASHBOARD);

    assertTrue(doc.containsKey("customPropertiesTyped"));
  }

  // ==================== all fields present in a single call ====================

  @Test
  void testAllFieldsPopulated() {
    Dashboard d =
        new Dashboard()
            .withId(UUID.randomUUID())
            .withName("all-fields")
            .withDisplayName("All Fields")
            .withFullyQualifiedName("svc.all-fields")
            .withDescription("desc")
            .withDeleted(false)
            .withVotes(new Votes().withUpVotes(5).withDownVotes(1));

    Map<String, Object> doc = new HashMap<>();
    createIndex(d).populateCommonFields(doc, d, Entity.DASHBOARD);

    assertNotNull(doc.get("displayName"));
    assertNotNull(doc.get("entityType"));
    assertNotNull(doc.get("owners"));
    assertNotNull(doc.get("ownerDisplayName"));
    assertNotNull(doc.get("ownerName"));
    assertNotNull(doc.get("domains"));
    assertNotNull(doc.get("reviewers"));
    assertNotNull(doc.get("followers"));
    assertNotNull(doc.get("totalVotes"));
    assertNotNull(doc.get("votes"));
    assertNotNull(doc.get("descriptionStatus"));
    assertNotNull(doc.get("descriptionSources"));
    assertNotNull(doc.get("tagSources"));
    assertNotNull(doc.get("tierSources"));
    assertNotNull(doc.get("fqnParts"));
    assertNotNull(doc.get("deleted"));
    // tier is set by TaggableIndex.applyTagFields(), not by populateCommonFields
    assertTrue(doc.containsKey("certification"));
    assertTrue(doc.containsKey("customPropertiesTyped"));
  }
}
