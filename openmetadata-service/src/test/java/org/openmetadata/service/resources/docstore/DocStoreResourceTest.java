package org.openmetadata.service.resources.docstore;

import static jakarta.ws.rs.core.Response.Status.BAD_REQUEST;
import static jakarta.ws.rs.core.Response.Status.FORBIDDEN;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.service.Entity.DOCUMENT;
import static org.openmetadata.service.Entity.PERSONA;
import static org.openmetadata.service.exception.CatalogExceptionMessage.permissionNotAllowed;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.TEST_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.TEST_USER_NAME;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertResponse;
import static org.openmetadata.service.util.TestUtils.put;
import static org.openmetadata.service.util.email.TemplateConstants.EMAIL_VERIFICATION_TEMPLATE;

import jakarta.ws.rs.client.Entity;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.email.EmailTemplate;
import org.openmetadata.schema.email.EmailTemplatePlaceholder;
import org.openmetadata.schema.email.TemplateValidationResponse;
import org.openmetadata.schema.entities.docStore.CreateDocument;
import org.openmetadata.schema.entities.docStore.Data;
import org.openmetadata.schema.entities.docStore.Document;
import org.openmetadata.schema.system.ui.Configuration;
import org.openmetadata.schema.system.ui.KnowledgePanel;
import org.openmetadata.schema.system.ui.Page;
import org.openmetadata.schema.system.ui.PageType;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.security.SecurityUtil;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.ResultList;

@Slf4j
public class DocStoreResourceTest extends EntityResourceTest<Document, CreateDocument> {

  private static final String EMAIL_TEMPLATE = "EmailTemplate";

  public DocStoreResourceTest() {
    super(DOCUMENT, Document.class, DocStoreResource.DocumentList.class, "docStore", "");
    supportsSearchIndex = false;
    supportsFieldsQueryParam = false;
  }

  public void setupDocuments(TestInfo test) throws HttpResponseException {
    CreateDocument createDoc =
        createRequest(test, 1).withName("activityFeed").withFullyQualifiedName("activityFeed");
    ACTIVITY_FEED_KNOWLEDGE_PANEL = createEntity(createDoc, ADMIN_AUTH_HEADERS);

    createDoc = createRequest(test, 11).withName("myData");
    MY_DATA_KNOWLEDGE_PANEL = createEntity(createDoc, ADMIN_AUTH_HEADERS);
  }

  @Test
  void put_document_validate_emailTemplate(TestInfo test) throws HttpResponseException {
    Document emailVerificationStoreTemplate =
        getEntityByName(EMAIL_VERIFICATION_TEMPLATE, ADMIN_AUTH_HEADERS);
    Set<String> emailVerificationStoreTemplatePlaceHolders =
        JsonUtils.convertValue(emailVerificationStoreTemplate.getData(), EmailTemplate.class)
            .getPlaceHolders()
            .stream()
            .sorted(Comparator.comparing(EmailTemplatePlaceholder::getName))
            .map(EmailTemplatePlaceholder::getName)
            .collect(Collectors.toSet());
    EmailTemplate emailTemplate = new EmailTemplate();

    emailTemplate.setTemplate("initial template ${placeholder1} ${placeholder2} ${placeholder3}");

    Set<EmailTemplatePlaceholder> placeholderList =
        Set.of(
            new EmailTemplatePlaceholder()
                .withName("placeholder1")
                .withDescription("desc_placeholder1"),
            new EmailTemplatePlaceholder()
                .withName("placeholder2")
                .withDescription("desc_placeholder2"),
            new EmailTemplatePlaceholder()
                .withName("placeholder3")
                .withDescription("desc_placeholder3"));

    emailTemplate.setPlaceHolders(placeholderList);

    // TODO: Instead of hardcoding the template, we can use the templateProvider to get the template
    CreateDocument create =
        createRequest(test, 1)
            .withName(EMAIL_VERIFICATION_TEMPLATE)
            .withFullyQualifiedName(EMAIL_VERIFICATION_TEMPLATE)
            .withEntityType(EMAIL_TEMPLATE)
            .withData(JsonUtils.convertValue(emailTemplate, Data.class));

    TemplateValidationResponse validateResponse =
        put(
            getResource(String.format("docStore/validateTemplate/%s", EMAIL_VERIFICATION_TEMPLATE)),
            emailTemplate,
            TemplateValidationResponse.class,
            Response.Status.OK,
            ADMIN_AUTH_HEADERS);
    assertFalse(validateResponse.getIsValid());
    assertEquals(
        validateResponse.getMissingPlaceholder().size(),
        emailVerificationStoreTemplatePlaceHolders.size());
    assertEquals(validateResponse.getAdditionalPlaceholder().size(), placeholderList.size());

    assertThrows(
        HttpResponseException.class,
        () -> createEntity(create, ADMIN_AUTH_HEADERS),
        validateResponse.getMessage());

    String[] missingPlaceholdersArr =
        validateResponse.getMissingPlaceholder().toArray(new String[0]);
    // removed one placeholder, results in 400 with 1 missingParameters
    emailTemplate.setTemplate(
        String.format("test template ${%s} ${placeholder2}", missingPlaceholdersArr[0]));
    create.withData(JsonUtils.convertValue(emailTemplate, Data.class));

    TemplateValidationResponse validateResponse2 =
        put(
            getResource(String.format("docStore/validateTemplate/%s", EMAIL_VERIFICATION_TEMPLATE)),
            emailTemplate,
            TemplateValidationResponse.class,
            Response.Status.OK,
            ADMIN_AUTH_HEADERS);
    assertFalse(validateResponse2.getIsValid());
    assertEquals(
        validateResponse2.getMissingPlaceholder().size(),
        emailVerificationStoreTemplatePlaceHolders.size() - 1);
    assertEquals(validateResponse2.getAdditionalPlaceholder().size(), 1);

    Response errorResponse =
        SecurityUtil.addHeaders(getResource("docStore"), ADMIN_AUTH_HEADERS)
            .method("PUT", Entity.entity(create, MediaType.APPLICATION_JSON));

    assertEquals(errorResponse.getStatus(), BAD_REQUEST.getStatusCode());

    // Push Valid Template
    String newUpdatedTemplate =
        String.format(
            "test template ${%s} ${%s}", missingPlaceholdersArr[0], missingPlaceholdersArr[1]);
    emailTemplate.setTemplate(newUpdatedTemplate);
    create.withData(JsonUtils.convertValue(emailTemplate, Data.class));

    Response validResp =
        SecurityUtil.addHeaders(getResource("docStore"), ADMIN_AUTH_HEADERS)
            .method("PUT", Entity.entity(create, MediaType.APPLICATION_JSON));

    assertEquals(validResp.getStatus(), Response.Status.OK.getStatusCode());

    Document updatedTemplateInDb = getEntityByName(EMAIL_VERIFICATION_TEMPLATE, ADMIN_AUTH_HEADERS);
    EmailTemplate updatedEmailTemplate =
        JsonUtils.convertValue(updatedTemplateInDb.getData(), EmailTemplate.class);
    assertEquals(updatedEmailTemplate.getTemplate(), newUpdatedTemplate);
  }

  @Test
  void post_validDocuments_as_admin_200_OK(TestInfo test) throws IOException {
    // Create Persona with different optional fields
    CreateDocument create = createRequest(test, 1);
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    create = createRequest(test, 2).withDisplayName("displayName");
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    create = createRequest(test, 3).withDescription("description");
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    create = createRequest(test, 4);
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    create = createRequest(test, 5).withDisplayName("displayName").withDescription("description");
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
  }

  @Test
  void post_validKnowledgePanels_as_admin_200_OK(TestInfo test) throws IOException {
    // Create Persona with different optional fields
    List<Document> panelDocs = new ArrayList<>();
    KnowledgePanel knowledgePanel =
        new KnowledgePanel()
            .withConfiguration(
                new Configuration()
                    .withAdditionalProperty("configuration", "{'api':'/api/v1/activityFeed'}"));
    String fqn =
        FullyQualifiedName.build(knowledgePanel.getEntityType().toString(), "ActivityFeedTest");
    CreateDocument create =
        createRequest(test, 1)
            .withName("ActivityFeedTest")
            .withFullyQualifiedName(fqn)
            .withData(
                new Data()
                    .withAdditionalProperty(
                        knowledgePanel.getEntityType().toString(), knowledgePanel))
            .withEntityType(knowledgePanel.getEntityType().toString());
    Document activityFeed = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    panelDocs.add(activityFeed);

    knowledgePanel =
        new KnowledgePanel()
            .withConfiguration(
                new Configuration()
                    .withAdditionalProperty("configuration", "{'api':'/api/v1/knowledgePanel'}"));
    fqn = FullyQualifiedName.build(knowledgePanel.getEntityType().toString(), "MyDataTest");
    create =
        createRequest(test, 1)
            .withName("MyDataTest")
            .withFullyQualifiedName(fqn)
            .withData(
                new Data()
                    .withAdditionalProperty(
                        knowledgePanel.getEntityType().toString(), knowledgePanel))
            .withEntityType(knowledgePanel.getEntityType().toString());
    Document myData = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    panelDocs.add(myData);

    knowledgePanel = new KnowledgePanel();
    fqn = FullyQualifiedName.build(knowledgePanel.getEntityType().toString(), "FollowingTest");
    create =
        createRequest(test, 1)
            .withName("FollowingTest")
            .withFullyQualifiedName(fqn)
            .withData(
                new Data()
                    .withAdditionalProperty(
                        knowledgePanel.getEntityType().toString(), knowledgePanel))
            .withEntityType(knowledgePanel.getEntityType().toString());
    Document following = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    panelDocs.add(following);
    fqn = FullyQualifiedName.build(knowledgePanel.getEntityType().toString(), "DataInsights");
    knowledgePanel =
        new KnowledgePanel()
            .withConfiguration(
                new Configuration()
                    .withAdditionalProperty("configuration", "{'api':'/api/v1/dataInsights'}"));
    create =
        createRequest(test, 1)
            .withData(
                new Data()
                    .withAdditionalProperty(
                        knowledgePanel.getEntityType().toString(), knowledgePanel))
            .withName("DataInsights")
            .withFullyQualifiedName(fqn)
            .withEntityType(knowledgePanel.getEntityType().toString());
    Document dataInsights = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    panelDocs.add(dataInsights);
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put(
        "fqnPrefix", FullyQualifiedName.build(knowledgePanel.getEntityType().toString()));
    ResultList<Document> panelList = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(panelDocs.size() + 7, panelList.getPaging().getTotal());

    // docs
    List<Document> pageDocs = new ArrayList<>();
    Page page =
        new Page()
            .withPageType(PageType.LANDING_PAGE)
            .withKnowledgePanels(
                List.of(activityFeed.getEntityReference(), myData.getEntityReference()));
    fqn =
        FullyQualifiedName.build(
            PERSONA,
            DATA_SCIENTIST.getFullyQualifiedName(),
            page.getEntityType().toString(),
            page.getPageType().toString());
    create =
        createRequest(test, 1)
            .withName("LandingPageTest")
            .withFullyQualifiedName(fqn)
            .withEntityType(page.getEntityType().toString())
            .withData(new Data().withAdditionalProperty(page.getEntityType().toString(), page));
    Document landingPage = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    pageDocs.add(landingPage);

    page =
        new Page()
            .withPageType(PageType.GLOSSARY_TERM)
            .withKnowledgePanels(
                List.of(activityFeed.getEntityReference(), myData.getEntityReference()));
    fqn =
        FullyQualifiedName.build(
            PERSONA,
            DATA_SCIENTIST.getFullyQualifiedName(),
            page.getEntityType().toString(),
            page.getPageType().toString());
    create =
        createRequest(test, 1)
            .withName("GlossaryTermLandingPageTest")
            .withFullyQualifiedName(fqn)
            .withEntityType(page.getEntityType().toString())
            .withData(new Data().withAdditionalProperty(page.getEntityType().toString(), page));
    Document glossaryTermLandingPage = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    pageDocs.add(glossaryTermLandingPage);
    queryParams = new HashMap<>();
    queryParams.put(
        "fqnPrefix",
        FullyQualifiedName.build(
            PERSONA, DATA_SCIENTIST.getFullyQualifiedName(), page.getEntityType().toString()));
    ResultList<Document> docList = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(pageDocs.size(), docList.getPaging().getTotal());
  }

  @Test
  void delete_validKnowledgePanels_200_OK(TestInfo test) throws IOException {
    CreateDocument create = createRequest(test);
    Document kp = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    deleteAndCheckEntity(kp, ADMIN_AUTH_HEADERS);
  }

  @Test
  void patch_kpAttributes_as_non_admin_403(TestInfo test) throws HttpResponseException {
    // Create team without any attributes
    Document doc = createEntity(createRequest(test), ADMIN_AUTH_HEADERS);
    // Patching as a non-admin should be disallowed
    String originalJson = JsonUtils.pojoToJson(doc);
    doc.setDisplayName("newDisplayName");
    assertResponse(
        () -> patchEntity(doc.getId(), originalJson, doc, TEST_AUTH_HEADERS),
        FORBIDDEN,
        permissionNotAllowed(TEST_USER_NAME, List.of(MetadataOperation.EDIT_DISPLAY_NAME)));
  }

  @Test
  void patch_DocUpdatePersona_permission(TestInfo test) throws IOException {
    Document kp = createEntity(createRequest(test), ADMIN_AUTH_HEADERS);
    String originalJson = JsonUtils.pojoToJson(kp);
    Object data = kp.getData();
    kp.setData(new Data().withAdditionalProperty("hello", "hi"));

    // Ensure user without UpdateTeam permission cannot add users to a team.
    String randomUserName = USER1_REF.getName();
    assertResponse(
        () ->
            patchEntity(
                kp.getId(),
                originalJson,
                kp,
                SecurityUtil.authHeaders(randomUserName + "@open-metadata.org")),
        FORBIDDEN,
        permissionNotAllowed(randomUserName, List.of(MetadataOperation.EDIT_ALL)));

    // Ensure user with UpdateTeam permission can add users to a team.
    ChangeDescription change = getChangeDescription(kp, MINOR_UPDATE);
    fieldUpdated(change, "data", data, kp.getData());
    patchEntityAndCheck(kp, originalJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  private static void validateKnowledgePanel(
      Document doc,
      String expectedDescription,
      String expectedDisplayName,
      Object data,
      String expectedUpdatedBy) {
    assertListNotNull(doc.getId(), doc.getHref());
    assertEquals(expectedDescription, doc.getDescription());
    assertEquals(expectedUpdatedBy, doc.getUpdatedBy());
    assertEquals(expectedDisplayName, doc.getDisplayName());
    assertEquals(data, doc.getData());
  }

  @Test
  void patch_usingFqn_DocUpdatePersona_permission(TestInfo test) throws IOException {
    Document kp = createEntity(createRequest(test), ADMIN_AUTH_HEADERS);
    String originalJson = JsonUtils.pojoToJson(kp);
    Object data = kp.getData();
    kp.setData(new Data().withAdditionalProperty("hello", "hi"));

    // Ensure user without UpdateTeam permission cannot add users to a team.
    String randomUserName = USER1_REF.getName();
    assertResponse(
        () ->
            patchEntity(
                kp.getId(),
                originalJson,
                kp,
                SecurityUtil.authHeaders(randomUserName + "@open-metadata.org")),
        FORBIDDEN,
        permissionNotAllowed(randomUserName, List.of(MetadataOperation.EDIT_ALL)));

    // Ensure user with UpdateTeam permission can add users to a team.
    ChangeDescription change = getChangeDescription(kp, MINOR_UPDATE);
    fieldUpdated(change, "data", data, kp.getData());
    patchEntityUsingFqnAndCheck(kp, originalJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Override
  public CreateDocument createRequest(String name) {
    return new CreateDocument()
        .withName(name)
        .withFullyQualifiedName(name)
        .withEntityType("KNOWLEDGE_PANEL")
        .withData(new Data().withAdditionalProperty("name", "test"));
  }

  @Override
  public void validateCreatedEntity(
      Document document, CreateDocument createRequest, Map<String, String> authHeaders) {}

  @Override
  public void compareEntities(
      Document expected, Document updated, Map<String, String> authHeaders) {
    assertEquals(expected.getDisplayName(), updated.getDisplayName());
    assertEquals(expected.getEntityType(), updated.getEntityType());
    assertEquals(expected.getData(), updated.getData());
  }

  @Override
  public Document validateGetWithDifferentFields(Document entity, boolean byName) {
    return null;
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    if (expected == actual) {
      return;
    }
    if (fieldName.equals("data")) {
      assertDocData(expected, actual);
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }

  private void assertDocData(Object expected, Object actual) {
    Data data = (Data) expected;
    Map<String, Object> expectedMap = data.getAdditionalProperties();
    Map<String, Object> actualMap = JsonUtils.getMap(JsonUtils.readJson(actual.toString()));

    Map<String, Object> normalizedActualMap = new HashMap<>();
    for (Map.Entry<String, Object> entry : actualMap.entrySet()) {
      Object value = entry.getValue();
      if (value instanceof Map) {
        Map<String, Object> valueMap = (Map<String, Object>) value;
        if (valueMap.containsKey("string")
            && valueMap.containsKey("chars")
            && valueMap.containsKey("valueType")) {
          normalizedActualMap.put(entry.getKey(), valueMap.get("string"));
        } else {
          normalizedActualMap.put(entry.getKey(), value);
        }
      } else {
        normalizedActualMap.put(entry.getKey(), value);
      }
    }

    assertEquals(expectedMap, normalizedActualMap);
  }
}
