package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.json.Json;
import jakarta.json.JsonPatch;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.CustomProperty;
import org.openmetadata.schema.type.Type;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;

@Execution(ExecutionMode.CONCURRENT)
public class GlossaryTermCustomPropertiesIT extends BaseEntityIT<GlossaryTerm, CreateGlossaryTerm> {

  {
    supportsFollowers = false;
    supportsImportExport = false;
  }

  private Glossary lastCreatedGlossary;
  private final ObjectMapper mapper = new ObjectMapper();

  @Override
  protected CreateGlossaryTerm createMinimalRequest(TestNamespace ns) {
    Glossary glossary = (lastCreatedGlossary != null) ? lastCreatedGlossary : getOrCreateGlossary(ns);
    return new CreateGlossaryTerm()
        .withName(ns.prefix("term"))
        .withGlossary(glossary.getFullyQualifiedName())
        .withDescription("Test glossary term");
  }

  @Override
  protected CreateGlossaryTerm createRequest(String name, TestNamespace ns) {
    Glossary glossary = getOrCreateGlossary(ns);
    return new CreateGlossaryTerm()
        .withName(name)
        .withGlossary(glossary.getFullyQualifiedName())
        .withDescription("Test glossary term: " + name);
  }

  @Override
  protected String getEntityType() {
    return "glossaryTerm";
  }

  @Override
  protected String getCreateRequestWithoutFields() {
    return "{\"name\":\"test\",\"glossary\":\"test\"}";
  }

  protected Glossary getOrCreateGlossary(TestNamespace ns) {
    if (lastCreatedGlossary != null) {
      return lastCreatedGlossary;
    }
    OpenMetadataClient client = SdkClients.adminClient();
    CreateGlossary createGlossary = new CreateGlossary()
        .withName(ns.prefix("glossary"))
        .withDescription("Test glossary for custom properties");
    lastCreatedGlossary = client.getGlossaryClient().createOrUpdate(createGlossary);
    return lastCreatedGlossary;
  }

  @Test
  void test_bug1_initializeCustomPropertiesOnFreshTerm_addOperation(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    String propertyName = ns.prefix("customProp_str");

    try {
      Type stringType = client.getTypeClient().getByName("string", "");
      addCustomPropertyToGlossaryTermType(client, propertyName, stringType);

      Glossary glossary = getOrCreateGlossary(ns);
      CreateGlossaryTerm createReq = new CreateGlossaryTerm()
          .withName(ns.prefix("term_fresh_add"))
          .withGlossary(glossary.getFullyQualifiedName())
          .withDescription("Fresh term for add operation test");

      GlossaryTerm term = client.getGlossaryTermClient().createOrUpdate(createReq);
      assertNotNull(term);
      assertNull(term.getExtension(), "Extension should be null on fresh term");

      // BUG 1: Try to ADD a custom property to extension when extension is null
      String termId = term.getId().toString();
      JsonPatch patch = Json.createPatch(Json.createReader(new java.io.StringReader(
          "[{\"op\":\"add\",\"path\":\"/extension/" + propertyName + "\",\"value\":\"test-value\"}]"
      )).readArray());

      GlossaryTerm updated = client.getGlossaryTermClient().patch(termId, patch);
      assertNotNull(updated.getExtension(), "Extension should not be null after patch");
      @SuppressWarnings("unchecked")
      Map<String, Object> ext = (Map<String, Object>) updated.getExtension();
      assertEquals("test-value", ext.get(propertyName), "Custom property value mismatch");

    } finally {
      deleteCustomPropertyFromGlossaryTermType(client, propertyName);
    }
  }

  @Test
  void test_bug1_initializeCustomPropertiesOnFreshTerm_replaceOperation(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    String propertyName = ns.prefix("customProp_int");

    try {
      Type intType = client.getTypeClient().getByName("int", "");
      addCustomPropertyToGlossaryTermType(client, propertyName, intType);

      Glossary glossary = getOrCreateGlossary(ns);
      CreateGlossaryTerm createReq = new CreateGlossaryTerm()
          .withName(ns.prefix("term_fresh_replace"))
          .withGlossary(glossary.getFullyQualifiedName())
          .withDescription("Fresh term for replace operation test");

      GlossaryTerm term = client.getGlossaryTermClient().createOrUpdate(createReq);
      assertNull(term.getExtension(), "Extension should be null on fresh term");

      // BUG 1: Try to REPLACE with custom property when extension is null
      String termId = term.getId().toString();
      JsonPatch patch = Json.createPatch(Json.createReader(new java.io.StringReader(
          "[{\"op\":\"replace\",\"path\":\"/extension/" + propertyName + "\",\"value\":42}]"
      )).readArray());

      GlossaryTerm updated = client.getGlossaryTermClient().patch(termId, patch);
      assertNotNull(updated.getExtension(), "Extension should not be null after patch");
      @SuppressWarnings("unchecked")
      Map<String, Object> ext = (Map<String, Object>) updated.getExtension();
      assertEquals(42, ext.get(propertyName), "Custom property value mismatch");

    } finally {
      deleteCustomPropertyFromGlossaryTermType(client, propertyName);
    }
  }

  @Test
  void test_bug2_staleInstanceReferencesAfterWrite(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    String propertyName = ns.prefix("customProp_staleness");

    try {
      Type stringType = client.getTypeClient().getByName("string", "");
      addCustomPropertyToGlossaryTermType(client, propertyName, stringType);

      Glossary glossary = getOrCreateGlossary(ns);
      CreateGlossaryTerm createReq = new CreateGlossaryTerm()
          .withName(ns.prefix("term_stale_ref"))
          .withGlossary(glossary.getFullyQualifiedName())
          .withDescription("Fresh term for stale reference test");

      GlossaryTerm term = client.getGlossaryTermClient().createOrUpdate(createReq);
      String termId = term.getId().toString();

      // First write: replace with custom property
      JsonPatch patch1 = Json.createPatch(Json.createReader(new java.io.StringReader(
          "[{\"op\":\"replace\",\"path\":\"/extension/" + propertyName + "\",\"value\":\"first-value\"}]"
      )).readArray());

      GlossaryTerm updated1 = client.getGlossaryTermClient().patch(termId, patch1);
      assertNotNull(updated1.getExtension());
      @SuppressWarnings("unchecked")
      Map<String, Object> ext1 = (Map<String, Object>) updated1.getExtension();
      assertEquals("first-value", ext1.get(propertyName));

      // BUG 2: Subsequent GET or PATCH with extension field fails
      GlossaryTerm retrieved = client.getGlossaryTermClient().getById(termId, "extension");
      assertNotNull(retrieved.getExtension(), "Extension should exist after successful write");
      @SuppressWarnings("unchecked")
      Map<String, Object> extRetrieved = (Map<String, Object>) retrieved.getExtension();
      assertTrue(extRetrieved.containsKey(propertyName),
          "Retrieved extension should contain the property that was just written");

      // Try another PATCH to the same property
      JsonPatch patch2 = Json.createPatch(Json.createReader(new java.io.StringReader(
          "[{\"op\":\"replace\",\"path\":\"/extension/" + propertyName + "\",\"value\":\"second-value\"}]"
      )).readArray());

      GlossaryTerm updated2 = client.getGlossaryTermClient().patch(termId, patch2);
      assertNotNull(updated2.getExtension());
      @SuppressWarnings("unchecked")
      Map<String, Object> ext2 = (Map<String, Object>) updated2.getExtension();
      assertEquals("second-value", ext2.get(propertyName));

    } finally {
      deleteCustomPropertyFromGlossaryTermType(client, propertyName);
    }
  }

  private void addCustomPropertyToGlossaryTermType(
      OpenMetadataClient client, String propertyName, Type propertyType) throws Exception {
    Type glossaryTermType = client.getTypeClient().getByName("glossaryTerm", "");

    CustomProperty customProperty = new CustomProperty()
        .withName(propertyName)
        .withDescription("Test custom property: " + propertyName)
        .withPropertyType(propertyType.getEntityReference());

    client.getHttpClient().execute(
        HttpMethod.PUT,
        "/v1/metadata/types/" + glossaryTermType.getId(),
        customProperty,
        Type.class);
  }

  private void deleteCustomPropertyFromGlossaryTermType(
      OpenMetadataClient client, String propertyName) {
    try {
      Type glossaryTermType = client.getTypeClient().getByName("glossaryTerm", "");
      client.getHttpClient().execute(
          HttpMethod.DELETE,
          "/v1/metadata/types/" + glossaryTermType.getId() + "/" + propertyName,
          null,
          Void.class);
    } catch (Exception e) {
      // Ignore cleanup errors
    }
  }
}
