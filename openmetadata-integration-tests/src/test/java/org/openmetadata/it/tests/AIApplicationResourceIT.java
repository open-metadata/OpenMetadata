package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.ai.AIApplication;
import org.openmetadata.schema.entity.ai.ApplicationType;
import org.openmetadata.sdk.fluent.AIApplications;

/**
 * Integration tests for AIApplication entity using SDK fluent API.
 *
 * <p>Tests AIApplication creation, listing, retrieval by name, and update operations using the
 * fluent API pattern from org.openmetadata.sdk.fluent.AIApplications.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class AIApplicationResourceIT {

  @BeforeAll
  static void setup() {
    AIApplications.setDefaultClient(SdkClients.adminClient());
  }

  @Test
  void test_createAIApplication(TestNamespace ns) {
    AIApplication app =
        AIApplications.create()
            .name(ns.prefix("testApp"))
            .withApplicationType(ApplicationType.Chatbot)
            .withDescription("Test AI Application")
            .execute();

    assertNotNull(app);
    assertEquals(ns.prefix("testApp"), app.getName());
    assertEquals("Test AI Application", app.getDescription());
    assertNotNull(app.getId());
    assertNotNull(app.getFullyQualifiedName());
  }

  @Test
  void test_createAIApplicationWithDisplayName(TestNamespace ns) {
    AIApplication app =
        AIApplications.create()
            .name(ns.prefix("displayNameApp"))
            .withApplicationType(ApplicationType.Agent)
            .withDisplayName("My Display Name")
            .withDescription("App with display name")
            .now();

    assertNotNull(app);
    assertEquals("My Display Name", app.getDisplayName());
  }

  @Test
  void test_getAIApplicationById(TestNamespace ns) {
    AIApplication created =
        AIApplications.create()
            .name(ns.prefix("getByIdApp"))
            .withApplicationType(ApplicationType.Copilot)
            .withDescription("App for get by id test")
            .execute();

    AIApplication fetched = AIApplications.get(created.getId().toString());

    assertNotNull(fetched);
    assertEquals(created.getId(), fetched.getId());
    assertEquals(created.getName(), fetched.getName());
  }

  @Test
  void test_getAIApplicationByName(TestNamespace ns) {
    AIApplication created =
        AIApplications.create()
            .name(ns.prefix("getByNameApp"))
            .withApplicationType(ApplicationType.Assistant)
            .withDescription("App for get by name test")
            .execute();

    AIApplication fetched = AIApplications.getByName(created.getFullyQualifiedName());

    assertNotNull(fetched);
    assertEquals(created.getId(), fetched.getId());
    assertEquals(created.getFullyQualifiedName(), fetched.getFullyQualifiedName());
  }

  @Test
  void test_findAIApplication(TestNamespace ns) {
    AIApplication created =
        AIApplications.create()
            .name(ns.prefix("findApp"))
            .withApplicationType(ApplicationType.RAG)
            .withDescription("App for find test")
            .execute();

    AIApplication fetched = AIApplications.find(created.getId()).fetch().get();

    assertNotNull(fetched);
    assertEquals(created.getId(), fetched.getId());
  }

  @Test
  void test_findAIApplicationByName(TestNamespace ns) {
    AIApplication created =
        AIApplications.create()
            .name(ns.prefix("findByNameApp"))
            .withApplicationType(ApplicationType.CodeGenerator)
            .withDescription("App for find by name test")
            .execute();

    AIApplication fetched = AIApplications.findByName(created.getFullyQualifiedName()).get();

    assertNotNull(fetched);
    assertEquals(created.getFullyQualifiedName(), fetched.getFullyQualifiedName());
  }

  @Test
  void test_listAIApplications(TestNamespace ns) {
    AIApplications.create()
        .name(ns.prefix("listApp1"))
        .withApplicationType(ApplicationType.DataAnalyst)
        .withDescription("First app for list test")
        .execute();

    AIApplications.create()
        .name(ns.prefix("listApp2"))
        .withApplicationType(ApplicationType.DataAnalyst)
        .withDescription("Second app for list test")
        .execute();

    AIApplications.create()
        .name(ns.prefix("listApp3"))
        .withApplicationType(ApplicationType.DataAnalyst)
        .withDescription("Third app for list test")
        .execute();

    List<AIApplications.FluentAIApplication> apps = AIApplications.list().limit(100).fetch();

    assertNotNull(apps);
    assertTrue(apps.size() >= 3);
  }

  @Test
  void test_listAIApplicationsWithLimit(TestNamespace ns) {
    AIApplications.create()
        .name(ns.prefix("limitApp1"))
        .withApplicationType(ApplicationType.AutomationBot)
        .withDescription("App 1 for limit test")
        .execute();

    AIApplications.create()
        .name(ns.prefix("limitApp2"))
        .withApplicationType(ApplicationType.AutomationBot)
        .withDescription("App 2 for limit test")
        .execute();

    List<AIApplications.FluentAIApplication> apps = AIApplications.list().limit(1).fetch();

    assertNotNull(apps);
    assertTrue(apps.size() >= 1);
  }

  @Test
  void test_updateAIApplicationDescription(TestNamespace ns) {
    AIApplication created =
        AIApplications.create()
            .name(ns.prefix("updateDescApp"))
            .withApplicationType(ApplicationType.MultiAgent)
            .withDescription("Initial description")
            .execute();

    AIApplication updated =
        AIApplications.find(created.getId())
            .fetch()
            .withDescription("Updated description")
            .save()
            .get();

    assertEquals("Updated description", updated.getDescription());
  }

  @Test
  void test_updateAIApplicationDisplayName(TestNamespace ns) {
    AIApplication created =
        AIApplications.create()
            .name(ns.prefix("updateDisplayApp"))
            .withApplicationType(ApplicationType.Custom)
            .withDisplayName("Initial Display")
            .withDescription("App for display name update")
            .execute();

    AIApplication updated =
        AIApplications.find(created.getId())
            .fetch()
            .withDisplayName("Updated Display")
            .save()
            .get();

    assertEquals("Updated Display", updated.getDisplayName());
  }

  @Test
  void test_deleteAIApplication(TestNamespace ns) {
    AIApplication created =
        AIApplications.create()
            .name(ns.prefix("deleteApp"))
            .withApplicationType(ApplicationType.Chatbot)
            .withDescription("App to delete")
            .execute();

    AIApplications.find(created.getId()).delete().confirm();

    assertThrows(
        Exception.class,
        () -> AIApplications.get(created.getId().toString()),
        "Deleted AI application should not be retrievable");
  }

  @Test
  void test_deleteAIApplicationPermanently(TestNamespace ns) {
    AIApplication created =
        AIApplications.create()
            .name(ns.prefix("hardDeleteApp"))
            .withApplicationType(ApplicationType.Agent)
            .withDescription("App to hard delete")
            .execute();

    AIApplications.find(created.getId()).delete().permanently().confirm();

    assertThrows(
        Exception.class,
        () -> AIApplications.get(created.getId().toString()),
        "Hard deleted AI application should not be retrievable");
  }

  @Test
  void test_findAIApplicationWithFields(TestNamespace ns) {
    AIApplication created =
        AIApplications.create()
            .name(ns.prefix("fieldsApp"))
            .withApplicationType(ApplicationType.Copilot)
            .withDescription("App for fields test")
            .execute();

    AIApplication fetched =
        AIApplications.find(created.getId()).includeOwners().includeTags().fetch().get();

    assertNotNull(fetched);
    assertEquals(created.getId(), fetched.getId());
  }

  @Test
  void test_findAIApplicationIncludeAll(TestNamespace ns) {
    AIApplication created =
        AIApplications.create()
            .name(ns.prefix("includeAllApp"))
            .withApplicationType(ApplicationType.Assistant)
            .withDescription("App for include all test")
            .execute();

    AIApplication fetched = AIApplications.find(created.getId()).includeAll().fetch().get();

    assertNotNull(fetched);
    assertEquals(created.getId(), fetched.getId());
  }

  @Test
  void test_listAIApplicationsForEach(TestNamespace ns) {
    AIApplications.create()
        .name(ns.prefix("forEachApp1"))
        .withApplicationType(ApplicationType.RAG)
        .withDescription("App 1 for forEach test")
        .execute();

    AIApplications.create()
        .name(ns.prefix("forEachApp2"))
        .withApplicationType(ApplicationType.RAG)
        .withDescription("App 2 for forEach test")
        .execute();

    final int[] count = {0};
    AIApplications.list()
        .limit(100)
        .forEach(
            app -> {
              assertNotNull(app);
              count[0]++;
            });

    assertTrue(count[0] >= 2);
  }

  @Test
  void test_updateAIApplicationMultipleFields(TestNamespace ns) {
    AIApplication created =
        AIApplications.create()
            .name(ns.prefix("multiUpdateApp"))
            .withApplicationType(ApplicationType.CodeGenerator)
            .withDescription("Initial description")
            .withDisplayName("Initial Display")
            .execute();

    AIApplication updated =
        AIApplications.find(created.getId())
            .fetch()
            .withDescription("Updated description")
            .withDisplayName("Updated Display")
            .save()
            .get();

    assertEquals("Updated description", updated.getDescription());
    assertEquals("Updated Display", updated.getDisplayName());
    assertTrue(updated.getVersion() > created.getVersion());
  }

  @Test
  void test_AIApplicationVersioning(TestNamespace ns) {
    AIApplication created =
        AIApplications.create()
            .name(ns.prefix("versionApp"))
            .withApplicationType(ApplicationType.DataAnalyst)
            .withDescription("Initial version")
            .execute();

    assertEquals(0.1, created.getVersion(), 0.001);

    AIApplication updated =
        AIApplications.find(created.getId())
            .fetch()
            .withDescription("Updated version")
            .save()
            .get();

    assertEquals(0.2, updated.getVersion(), 0.001);
  }
}
