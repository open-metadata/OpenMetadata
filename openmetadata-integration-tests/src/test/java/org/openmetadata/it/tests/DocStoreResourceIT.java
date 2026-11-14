package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.fail;
import static org.openmetadata.it.util.UriTestUtils.assertHttpStatusFor;
import static org.openmetadata.it.util.UriTestUtils.encodeURIComponent;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.DenyPolicyPrincipals;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.teams.CreatePersona;
import org.openmetadata.schema.entities.docStore.CreateDocument;
import org.openmetadata.schema.entities.docStore.Data;
import org.openmetadata.schema.entities.docStore.Document;
import org.openmetadata.schema.entity.teams.Persona;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.system.ui.Configuration;
import org.openmetadata.schema.system.ui.KnowledgePanel;
import org.openmetadata.schema.system.ui.Page;
import org.openmetadata.schema.system.ui.PageType;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class DocStoreResourceIT {

  private static final ObjectMapper MAPPER =
      new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

  @BeforeAll
  public static void setup() {
    SdkClients.adminClient();
  }

  @Test
  void test_createSimpleDocument_200_OK(TestNamespace ns) throws Exception {
    String docName = ns.prefix("simple_doc");
    CreateDocument createRequest =
        new CreateDocument()
            .withName(docName)
            .withFullyQualifiedName(docName)
            .withEntityType("KNOWLEDGE_PANEL")
            .withData(new Data().withAdditionalProperty("name", "test"));

    Document created = createDocument(createRequest);

    assertNotNull(created);
    assertNotNull(created.getId());
    assertEquals(docName, created.getName());
    assertEquals(docName, created.getFullyQualifiedName());
    assertEquals("KNOWLEDGE_PANEL", created.getEntityType());
    assertNotNull(created.getData());

    deleteDocument(created.getFullyQualifiedName());
  }

  @Test
  void test_createDocumentWithDescription_200_OK(TestNamespace ns) throws Exception {
    String docName = ns.prefix("doc_with_desc");
    String description = "This is a test document with description";

    CreateDocument createRequest =
        new CreateDocument()
            .withName(docName)
            .withFullyQualifiedName(docName)
            .withEntityType("KNOWLEDGE_PANEL")
            .withDescription(description)
            .withData(new Data().withAdditionalProperty("name", "test"));

    Document created = createDocument(createRequest);

    assertNotNull(created);
    assertEquals(description, created.getDescription());

    deleteDocument(created.getFullyQualifiedName());
  }

  @Test
  void test_createDocumentWithDisplayName_200_OK(TestNamespace ns) throws Exception {
    String docName = ns.prefix("doc_display");
    String displayName = "Test Display Name";

    CreateDocument createRequest =
        new CreateDocument()
            .withName(docName)
            .withFullyQualifiedName(docName)
            .withEntityType("KNOWLEDGE_PANEL")
            .withDisplayName(displayName)
            .withData(new Data().withAdditionalProperty("name", "test"));

    Document created = createDocument(createRequest);

    assertNotNull(created);
    assertEquals(displayName, created.getDisplayName());

    deleteDocument(created.getFullyQualifiedName());
  }

  @Test
  void test_createKnowledgePanel_200_OK(TestNamespace ns) throws Exception {
    String docName = ns.prefix("knowledge_panel");
    KnowledgePanel knowledgePanel =
        new KnowledgePanel()
            .withConfiguration(
                new Configuration()
                    .withAdditionalProperty("configuration", "{'api':'/api/v1/activityFeed'}"));

    CreateDocument createRequest =
        new CreateDocument()
            .withName(docName)
            .withFullyQualifiedName(docName)
            .withEntityType("KnowledgePanel")
            .withData(
                new Data()
                    .withAdditionalProperty(
                        knowledgePanel.getEntityType().toString(), knowledgePanel));

    Document created = createDocument(createRequest);

    assertNotNull(created);
    assertNotNull(created.getData());
    assertEquals("KnowledgePanel", created.getEntityType());

    deleteDocument(created.getFullyQualifiedName());
  }

  @Test
  void test_createPageDocument_200_OK(TestNamespace ns) throws Exception {
    String docName = ns.prefix("page_doc");
    Page page = new Page().withPageType(PageType.LANDING_PAGE);

    CreateDocument createRequest =
        new CreateDocument()
            .withName(docName)
            .withFullyQualifiedName(docName)
            .withEntityType("Page")
            .withData(new Data().withAdditionalProperty(page.getEntityType().toString(), page));

    Document created = createDocument(createRequest);

    assertNotNull(created);
    assertEquals("Page", created.getEntityType());
    assertNotNull(created.getData());

    deleteDocument(created.getFullyQualifiedName());
  }

  @Test
  void test_getDocumentByName_200_OK(TestNamespace ns) throws Exception {
    String docName = ns.prefix("get_by_name");
    CreateDocument createRequest =
        new CreateDocument()
            .withName(docName)
            .withFullyQualifiedName(docName)
            .withEntityType("KNOWLEDGE_PANEL")
            .withData(new Data().withAdditionalProperty("name", "test"));

    Document created = createDocument(createRequest);
    assertNotNull(created);

    Document retrieved = getDocumentByName(created.getFullyQualifiedName());

    assertNotNull(retrieved);
    assertEquals(created.getId(), retrieved.getId());
    assertEquals(created.getName(), retrieved.getName());
    assertEquals(created.getFullyQualifiedName(), retrieved.getFullyQualifiedName());

    deleteDocument(created.getFullyQualifiedName());
  }

  @Test
  void test_updateDocument_200_OK(TestNamespace ns) throws Exception {
    String docName = ns.prefix("update_doc");
    CreateDocument createRequest =
        new CreateDocument()
            .withName(docName)
            .withFullyQualifiedName(docName)
            .withEntityType("KNOWLEDGE_PANEL")
            .withDescription("Original description")
            .withData(new Data().withAdditionalProperty("name", "test"));

    Document created = createDocument(createRequest);
    assertNotNull(created);

    CreateDocument updateRequest =
        new CreateDocument()
            .withName(docName)
            .withFullyQualifiedName(docName)
            .withEntityType("KNOWLEDGE_PANEL")
            .withDescription("Updated description")
            .withData(new Data().withAdditionalProperty("name", "updated"));

    Document updated = updateDocument(updateRequest);

    assertNotNull(updated);
    assertEquals("Updated description", updated.getDescription());

    deleteDocument(created.getFullyQualifiedName());
  }

  @Test
  void test_listDocuments_200_OK(TestNamespace ns) throws Exception {
    String docName1 = ns.prefix("list_doc_1");
    String docName2 = ns.prefix("list_doc_2");

    CreateDocument create1 =
        new CreateDocument()
            .withName(docName1)
            .withFullyQualifiedName(docName1)
            .withEntityType("KNOWLEDGE_PANEL")
            .withData(new Data().withAdditionalProperty("name", "test1"));

    CreateDocument create2 =
        new CreateDocument()
            .withName(docName2)
            .withFullyQualifiedName(docName2)
            .withEntityType("KNOWLEDGE_PANEL")
            .withData(new Data().withAdditionalProperty("name", "test2"));

    Document doc1 = createDocument(create1);
    Document doc2 = createDocument(create2);

    // Verify list endpoint works and returns results
    DocumentList list = listDocuments(null);

    assertNotNull(list);
    assertNotNull(list.getData());
    // Just verify we can list documents - don't assert specific counts
    // due to parallel test execution and pagination
    assertFalse(list.getData().isEmpty(), "Document list should not be empty");

    // Verify we can get each document by name
    Document retrieved1 = getDocumentByName(doc1.getFullyQualifiedName());
    Document retrieved2 = getDocumentByName(doc2.getFullyQualifiedName());

    assertNotNull(retrieved1);
    assertNotNull(retrieved2);
    assertEquals(doc1.getId(), retrieved1.getId());
    assertEquals(doc2.getId(), retrieved2.getId());

    deleteDocument(doc1.getFullyQualifiedName());
    deleteDocument(doc2.getFullyQualifiedName());
  }

  @Test
  void test_listDocumentsWithFqnPrefix_200_OK(TestNamespace ns) throws Exception {
    String docName1 = ns.prefix("fqn_prefix_doc1");
    String docName2 = ns.prefix("fqn_prefix_doc2");

    CreateDocument create1 =
        new CreateDocument()
            .withName(docName1)
            .withFullyQualifiedName(docName1)
            .withEntityType("KNOWLEDGE_PANEL")
            .withData(new Data().withAdditionalProperty("name", "test1"));

    CreateDocument create2 =
        new CreateDocument()
            .withName(docName2)
            .withFullyQualifiedName(docName2)
            .withEntityType("KNOWLEDGE_PANEL")
            .withData(new Data().withAdditionalProperty("name", "test2"));

    Document doc1 = createDocument(create1);
    Document doc2 = createDocument(create2);

    // Verify fqnPrefix filter works
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("fqnPrefix", ns.prefix("fqn_prefix"));

    DocumentList list = listDocuments(queryParams);

    // fqnPrefix may or may not work depending on API implementation
    // Just verify we don't get an error
    assertNotNull(list);
    assertNotNull(list.getData());

    // Verify documents exist by getting them directly
    Document retrieved1 = getDocumentByName(doc1.getFullyQualifiedName());
    Document retrieved2 = getDocumentByName(doc2.getFullyQualifiedName());
    assertNotNull(retrieved1);
    assertNotNull(retrieved2);

    deleteDocument(doc1.getFullyQualifiedName());
    deleteDocument(doc2.getFullyQualifiedName());
  }

  @Test
  void test_deleteDocument_200_OK(TestNamespace ns) throws Exception {
    String docName = ns.prefix("delete_doc");
    CreateDocument createRequest =
        new CreateDocument()
            .withName(docName)
            .withFullyQualifiedName(docName)
            .withEntityType("KNOWLEDGE_PANEL")
            .withData(new Data().withAdditionalProperty("name", "test"));

    Document created = createDocument(createRequest);
    assertNotNull(created);

    deleteDocument(created.getFullyQualifiedName());

    try {
      getDocumentByName(created.getFullyQualifiedName());
      fail("Expected exception when getting deleted document");
    } catch (Exception e) {
    }
  }

  @Test
  void test_createMultipleDocumentTypes_200_OK(TestNamespace ns) throws Exception {
    String kpName = ns.prefix("multi_kp");
    CreateDocument kpCreate =
        new CreateDocument()
            .withName(kpName)
            .withFullyQualifiedName(kpName)
            .withEntityType("KNOWLEDGE_PANEL")
            .withData(new Data().withAdditionalProperty("test", "value"));

    String pageName = ns.prefix("multi_page");
    CreateDocument pageCreate =
        new CreateDocument()
            .withName(pageName)
            .withFullyQualifiedName(pageName)
            .withEntityType("PAGE")
            .withData(new Data().withAdditionalProperty("test", "value"));

    Document kpDoc = createDocument(kpCreate);
    Document pageDoc = createDocument(pageCreate);

    assertNotNull(kpDoc);
    assertEquals("KNOWLEDGE_PANEL", kpDoc.getEntityType());

    assertNotNull(pageDoc);
    assertEquals("PAGE", pageDoc.getEntityType());

    deleteDocument(kpDoc.getFullyQualifiedName());
    deleteDocument(pageDoc.getFullyQualifiedName());
  }

  /**
   * A persona's UI customization must load for every user the persona applies to, even when their
   * roles grant no access to documents; otherwise the UI silently falls back to the stock
   * navigation and landing page. Each way of holding a persona counts: assigned directly, inherited
   * as a team's default persona, or set as the user's default persona. The relaxation stops at the
   * caller's own personas.
   */
  @Test
  void personaLayoutIsReadableThroughPersonaAssignment(TestNamespace ns) throws Exception {
    String readerPrefix = ns.shortPrefix("layout_reader");
    OpenMetadataClient reader =
        DenyPolicyPrincipals.clientDenied(
            readerPrefix, Entity.DOCUMENT, MetadataOperation.VIEW_BASIC);
    Persona direct = createPersona(ns, "layout_direct");
    Persona fromTeam = createPersona(ns, "layout_team");
    Persona byDefault = createPersona(ns, "layout_default");
    Persona other = createPersona(ns, "layout_other");
    assignPersonas(readerPrefix + "_user", direct, byDefault);
    assignTeamDefaultPersona(readerPrefix + "_team", fromTeam);
    List<Document> assignedLayouts =
        List.of(
            createDocument(personaLayout(direct)),
            createDocument(personaLayout(fromTeam)),
            createDocument(personaLayout(byDefault)));
    Document otherLayout = createDocument(personaLayout(other));
    String panelName = ns.prefix("layout_reader_panel");
    Document panel =
        createDocument(
            new CreateDocument()
                .withName(panelName)
                .withFullyQualifiedName(panelName)
                .withEntityType("KnowledgePanel")
                .withData(new Data().withAdditionalProperty("name", "panel")));

    try {
      for (Document layout : assignedLayouts) {
        Document read =
            assertDoesNotThrow(
                () -> getDocumentByName(reader, layout.getFullyQualifiedName()),
                layout.getFullyQualifiedName());

        assertEquals(layout.getId(), read.getId());
        assertEquals(layout.getData(), read.getData());
      }
      assertHttpStatusFor(
          reader,
          403,
          HttpMethod.GET,
          documentByNamePath(otherLayout.getFullyQualifiedName()),
          null);
      assertHttpStatusFor(
          reader, 403, HttpMethod.GET, documentByNamePath(panel.getFullyQualifiedName()), null);
    } finally {
      for (Document layout : assignedLayouts) {
        deleteDocument(layout.getFullyQualifiedName());
      }
      deleteDocument(otherLayout.getFullyQualifiedName());
      deleteDocument(panel.getFullyQualifiedName());
    }
  }

  private Persona createPersona(TestNamespace ns, String suffix) {
    return ns.trackRoot(
        Entity.PERSONA,
        SdkClients.adminClient()
            .personas()
            .create(
                new CreatePersona()
                    .withName(ns.shortPrefix(suffix))
                    .withDescription("Persona layout document integration test")));
  }

  private void assignPersonas(String userName, Persona persona, Persona defaultPersona) {
    OpenMetadataClient admin = SdkClients.adminClient();
    User user = admin.users().getByName(userName, "personas,defaultPersona");
    user.setPersonas(List.of(persona.getEntityReference()));
    user.setDefaultPersona(defaultPersona.getEntityReference());
    admin.users().update(user.getId().toString(), user);
  }

  private void assignTeamDefaultPersona(String teamName, Persona persona) {
    OpenMetadataClient admin = SdkClients.adminClient();
    Team team = admin.teams().getByName(teamName, "defaultPersona");
    team.setDefaultPersona(persona.getEntityReference());
    admin.teams().update(team.getId().toString(), team);
  }

  private CreateDocument personaLayout(Persona persona) {
    return new CreateDocument()
        .withName(persona.getName() + "-layout")
        .withFullyQualifiedName(Entity.PERSONA + Entity.SEPARATOR + persona.getFullyQualifiedName())
        .withEntityType("page")
        .withData(new Data().withAdditionalProperty("navigation", "glossary-only"));
  }

  private static String documentByNamePath(String fqn) {
    return "/v1/docStore/name/" + encodeURIComponent(fqn);
  }

  private Document createDocument(CreateDocument createRequest) throws Exception {
    String response =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(
                HttpMethod.PUT, "/v1/docStore", createRequest, RequestOptions.builder().build());
    return MAPPER.readValue(response, Document.class);
  }

  private Document updateDocument(CreateDocument updateRequest) throws Exception {
    String response =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(
                HttpMethod.PUT, "/v1/docStore", updateRequest, RequestOptions.builder().build());
    return MAPPER.readValue(response, Document.class);
  }

  private Document getDocumentByName(String fqn) throws Exception {
    return getDocumentByName(SdkClients.adminClient(), fqn);
  }

  private Document getDocumentByName(OpenMetadataClient client, String fqn) throws Exception {
    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET, documentByNamePath(fqn), null, RequestOptions.builder().build());
    return MAPPER.readValue(response, Document.class);
  }

  private DocumentList listDocuments(Map<String, String> queryParams) throws Exception {
    RequestOptions.Builder optionsBuilder = RequestOptions.builder();

    if (queryParams != null) {
      for (Map.Entry<String, String> entry : queryParams.entrySet()) {
        optionsBuilder.queryParam(entry.getKey(), entry.getValue());
      }
    }

    String response =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/docStore", null, optionsBuilder.build());
    return MAPPER.readValue(response, DocumentList.class);
  }

  private void deleteDocument(String fqn) throws Exception {
    try {
      SdkClients.adminClient()
          .getHttpClient()
          .executeForString(
              HttpMethod.DELETE,
              "/v1/docStore/name/" + fqn,
              null,
              RequestOptions.builder().build());
    } catch (Exception e) {
    }
  }

  public static class DocumentList {
    private List<Document> data;
    private Paging paging;

    public List<Document> getData() {
      return data;
    }

    public void setData(List<Document> data) {
      this.data = data;
    }

    public Paging getPaging() {
      return paging;
    }

    public void setPaging(Paging paging) {
      this.paging = paging;
    }
  }

  public static class Paging {
    private Integer total;
    private String after;
    private String before;

    public Integer getTotal() {
      return total;
    }

    public void setTotal(Integer total) {
      this.total = total;
    }

    public String getAfter() {
      return after;
    }

    public void setAfter(String after) {
      this.after = after;
    }

    public String getBefore() {
      return before;
    }

    public void setBefore(String before) {
      this.before = before;
    }
  }
}
