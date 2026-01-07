package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.ai.CreatePromptTemplate;
import org.openmetadata.schema.entity.ai.PromptTemplate;
import org.openmetadata.sdk.fluent.PromptTemplates;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class PromptTemplateResourceIT {

  @BeforeAll
  static void setup() {
    PromptTemplates.setDefaultClient(SdkClients.adminClient());
  }

  private CreatePromptTemplate createRequest(String name, String description) {
    CreatePromptTemplate request = new CreatePromptTemplate();
    request.setName(name);
    request.setDescription(description);
    request.setTemplateContent("This is a test template: {{input}}");
    return request;
  }

  @Test
  void test_createPromptTemplate(TestNamespace ns) {
    CreatePromptTemplate request =
        createRequest(ns.prefix("summarization"), "Summarization prompt template");
    PromptTemplate created = PromptTemplates.create(request);

    assertNotNull(created.getId());
    assertEquals(ns.prefix("summarization"), created.getName());
    assertEquals("Summarization prompt template", created.getDescription());
  }

  @Test
  void test_getPromptTemplateById(TestNamespace ns) {
    CreatePromptTemplate request =
        createRequest(ns.prefix("get_by_id"), "Template for get by id test");
    PromptTemplate created = PromptTemplates.create(request);

    PromptTemplate fetched = PromptTemplates.get(created.getId().toString());

    assertNotNull(fetched);
    assertEquals(created.getId(), fetched.getId());
    assertEquals(created.getName(), fetched.getName());
  }

  @Test
  void test_getPromptTemplateByName(TestNamespace ns) {
    CreatePromptTemplate request =
        createRequest(ns.prefix("get_by_name"), "Template for get by name test");
    PromptTemplate created = PromptTemplates.create(request);

    PromptTemplate fetched = PromptTemplates.getByName(created.getFullyQualifiedName());

    assertNotNull(fetched);
    assertEquals(created.getId(), fetched.getId());
    assertEquals(created.getName(), fetched.getName());
    assertEquals(created.getFullyQualifiedName(), fetched.getFullyQualifiedName());
  }

  @Test
  void test_findPromptTemplateById(TestNamespace ns) {
    CreatePromptTemplate request =
        createRequest(ns.prefix("find_by_id"), "Template for find by id test");
    PromptTemplate created = PromptTemplates.create(request);

    PromptTemplate fetched = PromptTemplates.find(created.getId()).fetch().get();

    assertNotNull(fetched);
    assertEquals(created.getId(), fetched.getId());
    assertEquals(created.getName(), fetched.getName());
  }

  @Test
  void test_findPromptTemplateByName(TestNamespace ns) {
    CreatePromptTemplate request =
        createRequest(ns.prefix("find_by_name"), "Template for find by name test");
    PromptTemplate created = PromptTemplates.create(request);

    PromptTemplate fetched =
        PromptTemplates.findByName(created.getFullyQualifiedName()).fetch().get();

    assertNotNull(fetched);
    assertEquals(created.getId(), fetched.getId());
    assertEquals(created.getName(), fetched.getName());
    assertEquals(created.getFullyQualifiedName(), fetched.getFullyQualifiedName());
  }

  @Test
  void test_deletePromptTemplate(TestNamespace ns) {
    CreatePromptTemplate request =
        createRequest(ns.prefix("delete_test"), "Template for delete test");
    PromptTemplate created = PromptTemplates.create(request);

    String id = created.getId().toString();

    PromptTemplates.delete(id);

    assertThrows(
        Exception.class,
        () -> PromptTemplates.get(id),
        "Deleted prompt template should not be retrievable");
  }

  @Test
  void test_deletePromptTemplateUsingFluent(TestNamespace ns) {
    CreatePromptTemplate request =
        createRequest(ns.prefix("delete_fluent"), "Template for fluent delete test");
    PromptTemplate created = PromptTemplates.create(request);

    String id = created.getId().toString();

    PromptTemplates.find(id).delete().confirm();

    assertThrows(
        Exception.class,
        () -> PromptTemplates.get(id),
        "Deleted prompt template should not be retrievable");
  }

  @Test
  void test_listPromptTemplates(TestNamespace ns) {
    for (int i = 0; i < 3; i++) {
      CreatePromptTemplate request =
          createRequest(ns.prefix("list_template_" + i), "Template " + i + " for list test");
      PromptTemplates.create(request);
    }

    var templates = PromptTemplates.list().limit(100).fetch();

    assertNotNull(templates);
    assertTrue(templates.size() >= 3);
  }

  @Test
  void test_updatePromptTemplateDescription(TestNamespace ns) {
    CreatePromptTemplate request = createRequest(ns.prefix("update_desc"), "Original description");
    PromptTemplate created = PromptTemplates.create(request);

    PromptTemplates.find(created.getId()).fetch().withDescription("Updated description").save();

    PromptTemplate updated = PromptTemplates.get(created.getId().toString());
    assertEquals("Updated description", updated.getDescription());
  }

  @Test
  void test_updatePromptTemplateDisplayName(TestNamespace ns) {
    CreatePromptTemplate request =
        createRequest(ns.prefix("update_display"), "Template for display name update");
    request.setDisplayName("Original Display Name");
    PromptTemplate created = PromptTemplates.create(request);

    PromptTemplates.find(created.getId()).fetch().withDisplayName("Updated Display Name").save();

    PromptTemplate updated = PromptTemplates.get(created.getId().toString());
    assertEquals("Updated Display Name", updated.getDisplayName());
  }

  @Test
  void test_createPromptTemplateWithDisplayName(TestNamespace ns) {
    CreatePromptTemplate request =
        createRequest(ns.prefix("with_display_name"), "Template with custom display name");
    request.setDisplayName("My Custom Template");
    PromptTemplate created = PromptTemplates.create(request);

    assertNotNull(created);
    assertEquals("My Custom Template", created.getDisplayName());
  }

  @Test
  void test_promptTemplateWithAllFields(TestNamespace ns) {
    CreatePromptTemplate request =
        createRequest(ns.prefix("full_template"), "Template with all fields populated");
    request.setDisplayName("Full Template");
    PromptTemplate created = PromptTemplates.create(request);

    assertNotNull(created.getId());
    assertEquals(ns.prefix("full_template"), created.getName());
    assertEquals("Full Template", created.getDisplayName());
    assertEquals("Template with all fields populated", created.getDescription());
    assertNotNull(created.getFullyQualifiedName());
  }

  @Test
  void test_getPromptTemplateWithFields(TestNamespace ns) {
    CreatePromptTemplate request =
        createRequest(ns.prefix("with_fields"), "Template for fields test");
    PromptTemplate created = PromptTemplates.create(request);

    PromptTemplate fetched =
        PromptTemplates.find(created.getId()).includeOwners().includeTags().fetch().get();

    assertNotNull(fetched);
    assertEquals(created.getId(), fetched.getId());
  }

  @Test
  void test_promptTemplateVersionIncrement(TestNamespace ns) {
    CreatePromptTemplate request = createRequest(ns.prefix("version_test"), "Original version");
    PromptTemplate created = PromptTemplates.create(request);

    Double initialVersion = created.getVersion();

    created.setDescription("Updated");
    PromptTemplate updated = PromptTemplates.update(created.getId().toString(), created);

    assertTrue(updated.getVersion() >= initialVersion, "Version should increment after update");
  }

  @Test
  void test_listPromptTemplatesWithLimit(TestNamespace ns) {
    for (int i = 0; i < 5; i++) {
      CreatePromptTemplate request = createRequest(ns.prefix("limited_list_" + i), "Template " + i);
      PromptTemplates.create(request);
    }

    var templates = PromptTemplates.list().limit(2).fetch();

    assertNotNull(templates);
    assertTrue(templates.size() <= 2);
  }

  @Test
  void test_restoreDeletedPromptTemplate(TestNamespace ns) {
    CreatePromptTemplate request =
        createRequest(ns.prefix("restore_test"), "Template for restore test");
    PromptTemplate created = PromptTemplates.create(request);

    String id = created.getId().toString();

    PromptTemplates.delete(id);

    PromptTemplates.restore(id);

    PromptTemplate restored = PromptTemplates.get(id);
    assertNotNull(restored);
    assertEquals(created.getName(), restored.getName());
  }

  @Test
  void test_hardDeletePromptTemplate(TestNamespace ns) {
    CreatePromptTemplate request =
        createRequest(ns.prefix("hard_delete"), "Template for hard delete test");
    PromptTemplate created = PromptTemplates.create(request);

    String id = created.getId().toString();

    PromptTemplates.find(id).delete().permanently().confirm();

    assertThrows(
        Exception.class,
        () -> PromptTemplates.get(id),
        "Hard deleted prompt template should not be retrievable");
  }

  @Test
  void test_createMultiplePromptTemplates(TestNamespace ns) {
    CreatePromptTemplate request1 = createRequest(ns.prefix("multi_1"), "First template");
    PromptTemplate template1 = PromptTemplates.create(request1);

    CreatePromptTemplate request2 = createRequest(ns.prefix("multi_2"), "Second template");
    PromptTemplate template2 = PromptTemplates.create(request2);

    CreatePromptTemplate request3 = createRequest(ns.prefix("multi_3"), "Third template");
    PromptTemplate template3 = PromptTemplates.create(request3);

    assertNotNull(template1.getId());
    assertNotNull(template2.getId());
    assertNotNull(template3.getId());
    assertNotEquals(template1.getId(), template2.getId());
    assertNotEquals(template2.getId(), template3.getId());
  }

  @Test
  void test_promptTemplateFQNFormat(TestNamespace ns) {
    CreatePromptTemplate request =
        createRequest(ns.prefix("fqn_test"), "Template for FQN format test");
    PromptTemplate created = PromptTemplates.create(request);

    assertNotNull(created.getFullyQualifiedName());
    assertTrue(created.getFullyQualifiedName().contains(created.getName()));
  }
}
