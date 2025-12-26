package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.UUID;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.services.CreateLLMService;
import org.openmetadata.schema.api.services.CreateLLMService.LlmServiceType;
import org.openmetadata.schema.entity.services.LLMService;
import org.openmetadata.schema.services.connections.llm.CustomLLMConnection;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.LLMConnection;
import org.openmetadata.sdk.fluent.LLMServices;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

@Execution(ExecutionMode.CONCURRENT)
public class LLMServiceResourceIT extends BaseServiceIT<LLMService, CreateLLMService> {

  @BeforeAll
  public static void setupLLMServices() {
    LLMServices.setDefaultClient(SdkClients.adminClient());
  }

  @Override
  protected CreateLLMService createMinimalRequest(TestNamespace ns) {
    CustomLLMConnection conn = new CustomLLMConnection().withBaseURL("http://localhost:8080");

    return new CreateLLMService()
        .withName(ns.prefix("llmservice"))
        .withServiceType(LlmServiceType.CustomLLM)
        .withConnection(new LLMConnection().withConfig(conn))
        .withDescription("Test LLM service");
  }

  @Override
  protected CreateLLMService createRequest(String name, TestNamespace ns) {
    CustomLLMConnection conn = new CustomLLMConnection().withBaseURL("http://localhost:8080");

    return new CreateLLMService()
        .withName(name)
        .withServiceType(LlmServiceType.CustomLLM)
        .withConnection(new LLMConnection().withConfig(conn));
  }

  @Override
  protected LLMService createEntity(CreateLLMService createRequest) {
    return SdkClients.adminClient().llmServices().create(createRequest);
  }

  @Override
  protected LLMService getEntity(String id) {
    return SdkClients.adminClient().llmServices().get(id);
  }

  @Override
  protected LLMService getEntityByName(String fqn) {
    return SdkClients.adminClient().llmServices().getByName(fqn);
  }

  @Override
  protected LLMService patchEntity(String id, LLMService entity) {
    return SdkClients.adminClient().llmServices().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().llmServices().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().llmServices().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    params.put("recursive", "true");
    SdkClients.adminClient().llmServices().delete(id, params);
  }

  @Override
  protected String getEntityType() {
    return "llmService";
  }

  @Override
  protected void validateCreatedEntity(LLMService entity, CreateLLMService createRequest) {
    assertEquals(createRequest.getName(), entity.getName());
    assertEquals(createRequest.getServiceType(), entity.getServiceType());

    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }
  }

  @Override
  protected ListResponse<LLMService> listEntities(ListParams params) {
    return SdkClients.adminClient().llmServices().list(params);
  }

  @Override
  protected LLMService getEntityWithFields(String id, String fields) {
    return SdkClients.adminClient().llmServices().get(id, fields);
  }

  @Override
  protected LLMService getEntityByNameWithFields(String fqn, String fields) {
    return SdkClients.adminClient().llmServices().getByName(fqn, fields);
  }

  @Override
  protected LLMService getEntityIncludeDeleted(String id) {
    return SdkClients.adminClient().llmServices().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return SdkClients.adminClient().llmServices().getVersionList(id);
  }

  @Override
  protected LLMService getVersion(UUID id, Double version) {
    return SdkClients.adminClient().llmServices().getVersion(id.toString(), version);
  }

  @Test
  void test_createLLMServiceWithFluentAPI(TestNamespace ns) {
    LLMService service =
        LLMServices.create()
            .name(ns.prefix("fluent_llm_service"))
            .withServiceType(LlmServiceType.CustomLLM)
            .withConnection(
                new LLMConnection()
                    .withConfig(new CustomLLMConnection().withBaseURL("http://localhost:9000")))
            .withDescription("LLM service created with fluent API")
            .execute();

    assertNotNull(service);
    assertEquals(ns.prefix("fluent_llm_service"), service.getName());
    assertEquals(LlmServiceType.CustomLLM, service.getServiceType());
    assertEquals("LLM service created with fluent API", service.getDescription());
  }

  @Test
  void test_getLLMServiceWithFluentAPI(TestNamespace ns) {
    CreateLLMService request = createMinimalRequest(ns);
    request.setName(ns.prefix("service_to_get"));
    LLMService created = createEntity(request);

    LLMService fetched = LLMServices.find(created.getId()).fetch().get();

    assertNotNull(fetched);
    assertEquals(created.getId(), fetched.getId());
    assertEquals(created.getName(), fetched.getName());
  }

  @Test
  void test_getLLMServiceByNameWithFluentAPI(TestNamespace ns) {
    CreateLLMService request = createMinimalRequest(ns);
    request.setName(ns.prefix("service_by_name"));
    LLMService created = createEntity(request);

    LLMService fetched = LLMServices.findByName(created.getFullyQualifiedName()).fetch().get();

    assertNotNull(fetched);
    assertEquals(created.getId(), fetched.getId());
    assertEquals(created.getFullyQualifiedName(), fetched.getFullyQualifiedName());
  }

  @Test
  void test_deleteLLMServiceWithFluentAPI(TestNamespace ns) {
    CreateLLMService request = createMinimalRequest(ns);
    request.setName(ns.prefix("service_to_delete"));
    LLMService created = createEntity(request);

    LLMServices.find(created.getId()).delete().confirm();

    LLMService deleted = getEntityIncludeDeleted(created.getId().toString());
    assertTrue(deleted.getDeleted());
  }

  @Test
  void test_listLLMServicesWithFluentAPI(TestNamespace ns) {
    for (int i = 0; i < 3; i++) {
      CreateLLMService request = createMinimalRequest(ns);
      request.setName(ns.prefix("list_service_fluent_" + i));
      createEntity(request);
    }

    var services = LLMServices.list().limit(10).fetch();
    assertNotNull(services);
    assertTrue(services.size() >= 3);
  }

  @Test
  void post_llmServiceWithCustomConnection_200_OK(TestNamespace ns) {
    CustomLLMConnection conn =
        new CustomLLMConnection()
            .withBaseURL("http://custom-llm.example.com")
            .withApiKey("test_api_key")
            .withTimeout(120);

    CreateLLMService request =
        new CreateLLMService()
            .withName(ns.prefix("custom_llm_service"))
            .withServiceType(LlmServiceType.CustomLLM)
            .withConnection(new LLMConnection().withConfig(conn))
            .withDescription("Test Custom LLM service");

    LLMService service = createEntity(request);
    assertNotNull(service);
    assertEquals(LlmServiceType.CustomLLM, service.getServiceType());
  }

  @Test
  void put_llmServiceDescription_200_OK(TestNamespace ns) {
    CreateLLMService request = createMinimalRequest(ns);
    request.setName(ns.prefix("service_update_desc"));
    request.setDescription("Initial description");

    LLMService service = createEntity(request);
    assertEquals("Initial description", service.getDescription());

    service.setDescription("Updated description");
    LLMService updated = patchEntity(service.getId().toString(), service);
    assertEquals("Updated description", updated.getDescription());
  }

  @Test
  void test_llmServiceVersionHistory(TestNamespace ns) {
    CreateLLMService request = createMinimalRequest(ns);
    request.setName(ns.prefix("service_version"));
    request.setDescription("Initial description");

    LLMService service = createEntity(request);
    Double initialVersion = service.getVersion();

    service.setDescription("Updated description");
    LLMService updated = patchEntity(service.getId().toString(), service);
    assertTrue(updated.getVersion() > initialVersion);

    EntityHistory history = getVersionHistory(service.getId());
    assertNotNull(history);
    assertTrue(history.getVersions().size() >= 1);
  }

  @Test
  void test_llmServiceSoftDeleteRestore(TestNamespace ns) {
    CreateLLMService request = createMinimalRequest(ns);
    request.setName(ns.prefix("service_delete"));

    LLMService service = createEntity(request);
    assertNotNull(service.getId());

    deleteEntity(service.getId().toString());

    LLMService deleted = getEntityIncludeDeleted(service.getId().toString());
    assertTrue(deleted.getDeleted());

    restoreEntity(service.getId().toString());

    LLMService restored = getEntity(service.getId().toString());
    assertFalse(restored.getDeleted());
  }

  @Test
  void test_llmServiceNameUniqueness(TestNamespace ns) {
    String serviceName = ns.prefix("unique_service");
    CreateLLMService request1 = createMinimalRequest(ns);
    request1.setName(serviceName);

    LLMService service1 = createEntity(request1);
    assertNotNull(service1);

    CreateLLMService request2 = createMinimalRequest(ns);
    request2.setName(serviceName);

    assertThrows(
        Exception.class,
        () -> createEntity(request2),
        "Creating duplicate LLM service should fail");
  }

  @Test
  void test_listLLMServices(TestNamespace ns) {
    for (int i = 0; i < 3; i++) {
      CreateLLMService request = createMinimalRequest(ns);
      request.setName(ns.prefix("list_service_" + i));
      createEntity(request);
    }

    ListParams params = new ListParams();
    params.setLimit(10);
    ListResponse<LLMService> response = listEntities(params);
    assertNotNull(response);
    assertTrue(response.getData().size() >= 3);
  }
}
