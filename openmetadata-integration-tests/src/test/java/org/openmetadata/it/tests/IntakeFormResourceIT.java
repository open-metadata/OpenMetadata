/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.api.domains.CreateDataProduct.DataProductType;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.domains.CreateDomain.DomainType;
import org.openmetadata.schema.api.governance.CreateIntakeForm;
import org.openmetadata.schema.api.governance.CreateIntakeForm.TargetEntityType;
import org.openmetadata.schema.entity.Type;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.governance.IntakeForm;
import org.openmetadata.schema.entity.governance.IntakeFormRequiredField;
import org.openmetadata.schema.entity.governance.IntakeFormRequiredField.FieldKind;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.entity.type.CustomProperty;
import org.openmetadata.schema.type.CustomPropertyConfig;
import org.openmetadata.schema.type.customProperties.EnumConfig;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.InvalidRequestException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * Integration tests for the IntakeForm entity and the two-layered validation it enforces on
 * DataProduct and Domain creation/update. Covers the full matrix requested: schema-required vs
 * IntakeForm-required, enable/disable, custom-property vs native fields, add/remove required
 * fields mid-flight, and the update path.
 *
 * <p>Runs single-threaded because IntakeForm is keyed by entityType (only one per type) — parallel
 * tests would collide on the uniqueness constraint.
 */
@Execution(ExecutionMode.SAME_THREAD)
@ExtendWith(TestNamespaceExtension.class)
public class IntakeFormResourceIT {

  private static final String INTAKE_FORMS_PATH = "/v1/governance/intakeForms";
  private static final String RISK_PROPERTY = "intakeRiskAssessment";
  private static final String DOMAIN_OWNER_PROPERTY = "intakeDomainOwner";
  private static final String GLOSSARY_TERM_STEWARD_PROPERTY = "intakeTermSteward";
  private static final String DP_STEWARD_REF_PROPERTY = "intakeStewardUserRef";
  private static final String DP_STEWARDS_REF_LIST_PROPERTY = "intakeStewardsList";
  private static final String DP_PRIORITY_ENUM_PROPERTY = "intakePriorityEnum";
  private static final String DP_COST_INTEGER_PROPERTY = "intakeCostInteger";
  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static Glossary sharedGlossary;

  @BeforeAll
  static void setupCustomProperties() throws Exception {
    ensureStringCustomProperty("dataProduct", RISK_PROPERTY);
    ensureStringCustomProperty("domain", DOMAIN_OWNER_PROPERTY);
    ensureStringCustomProperty("glossaryTerm", GLOSSARY_TERM_STEWARD_PROPERTY);
    ensureEntityReferenceCustomProperty("dataProduct", DP_STEWARD_REF_PROPERTY, "user");
    ensureEntityReferenceListCustomProperty("dataProduct", DP_STEWARDS_REF_LIST_PROPERTY, "user");
    ensureEnumCustomProperty(
        "dataProduct", DP_PRIORITY_ENUM_PROPERTY, List.of("critical", "high", "medium", "low"));
    ensureIntegerCustomProperty("dataProduct", DP_COST_INTEGER_PROPERTY);
    sharedGlossary = ensureGlossary("intake-form-it-glossary");
  }

  /**
   * Defensive cleanup: tests in this suite wrap intake-form creation in try/finally, but if a
   * test fails before the finally runs (timeout, assertion in setup) the form would leak and
   * poison unrelated tests that create DataProduct/Domain/GlossaryTerm entities. Paginate the
   * full intake-form list and hard-delete anything the test class could have produced for the
   * three governance entity types.
   */
  @AfterEach
  void purgeAllIntakeFormsForGovernanceEntities() {
    for (String entityType : List.of("dataProduct", "domain", "glossaryTerm")) {
      hardDeleteAllIntakeFormsForEntityType(entityType);
    }
  }

  private static void hardDeleteAllIntakeFormsForEntityType(String entityType) {
    try {
      IntakeForm form =
          SdkClients.adminClient()
              .getHttpClient()
              .execute(
                  HttpMethod.GET,
                  INTAKE_FORMS_PATH + "/entityType/" + entityType,
                  null,
                  IntakeForm.class);
      if (form != null && form.getId() != null) {
        deleteIntakeForm(form.getId());
      }
    } catch (Exception ignored) {
      // 404 (no form for this entity type) is the expected steady state.
    }
  }

  // ---------------------------------------------------------------------------
  // CRUD on IntakeForm itself
  // ---------------------------------------------------------------------------

  @Test
  void intakeForm_crud_basicLifecycle(TestNamespace ns) throws Exception {
    CreateIntakeForm create = minimalDataProductForm(ns.prefix("dp-intake"));
    IntakeForm created = createIntakeForm(create);
    try {
      assertNotNull(created.getId());
      assertEquals(TargetEntityType.DATA_PRODUCT, created.getEntityType());
      assertTrue(created.getEnabled());

      IntakeForm byId = getIntakeFormById(created.getId());
      assertEquals(created.getId(), byId.getId());

      IntakeForm byName = getIntakeFormByName(created.getName());
      assertEquals(created.getId(), byName.getId());

      IntakeForm byEntityType = getIntakeFormByEntityType("dataProduct");
      assertEquals(created.getId(), byEntityType.getId());
    } finally {
      deleteIntakeForm(created.getId());
    }
  }

  @Test
  void intakeForm_create_rejectsDuplicateEntityType(TestNamespace ns) throws Exception {
    IntakeForm first = createIntakeForm(minimalDataProductForm(ns.prefix("dp-intake-a")));
    try {
      InvalidRequestException ex =
          assertThrows(
              InvalidRequestException.class,
              () -> createIntakeForm(minimalDataProductForm(ns.prefix("dp-intake-b"))));
      assertEquals(400, ex.getStatusCode());
      assertTrue(ex.getMessage().toLowerCase().contains("already exists"));
    } finally {
      deleteIntakeForm(first.getId());
    }
  }

  @Test
  void intakeForm_onePerEntityType_enforcedViaPOSTAndPUT(TestNamespace ns) throws Exception {
    // First: POST creates successfully
    IntakeForm first = createIntakeForm(minimalDataProductForm(ns.prefix("dp-one-a")));
    try {
      // Second POST with a different name but same entityType → rejected
      InvalidRequestException postEx =
          assertThrows(
              InvalidRequestException.class,
              () -> createIntakeForm(minimalDataProductForm(ns.prefix("dp-one-b"))));
      assertEquals(400, postEx.getStatusCode());
      assertTrue(postEx.getMessage().toLowerCase().contains("already exists"));

      // PUT with a DIFFERENT name but the same entityType must also be rejected —
      // createOrUpdate cannot be used to sneak in a second form.
      InvalidRequestException putEx =
          assertThrows(
              InvalidRequestException.class,
              () ->
                  SdkClients.adminClient()
                      .getHttpClient()
                      .execute(
                          HttpMethod.PUT,
                          INTAKE_FORMS_PATH,
                          minimalDataProductForm(ns.prefix("dp-one-c")),
                          IntakeForm.class));
      assertTrue(putEx.getMessage().toLowerCase().contains("already exists"));

      // PUT with the SAME name + entityType as the existing form updates in place → OK
      CreateIntakeForm updateRequest = toCreate(first);
      updateRequest.setDescription("Updated description via PUT");
      IntakeForm updated = putIntakeForm(updateRequest);
      assertEquals(first.getId(), updated.getId());
      assertEquals("Updated description via PUT", updated.getDescription());
    } finally {
      deleteIntakeForm(first.getId());
    }
  }

  @Test
  void intakeForm_differentEntityTypes_canCoexist(TestNamespace ns) throws Exception {
    IntakeForm dpForm = createIntakeForm(minimalDataProductForm(ns.prefix("dp-coexist")));
    IntakeForm domainForm =
        createIntakeForm(
            new CreateIntakeForm()
                .withName(ns.prefix("dom-coexist"))
                .withEntityType(TargetEntityType.DOMAIN)
                .withEnabled(Boolean.TRUE)
                .withRequiredFields(List.of()));
    IntakeForm gtForm =
        createIntakeForm(
            new CreateIntakeForm()
                .withName(ns.prefix("gt-coexist"))
                .withEntityType(TargetEntityType.GLOSSARY_TERM)
                .withEnabled(Boolean.TRUE)
                .withRequiredFields(List.of()));
    try {
      assertNotNull(dpForm.getId());
      assertNotNull(domainForm.getId());
      assertNotNull(gtForm.getId());
      // Each entity type is independently configured
      assertEquals(TargetEntityType.DATA_PRODUCT, dpForm.getEntityType());
      assertEquals(TargetEntityType.DOMAIN, domainForm.getEntityType());
      assertEquals(TargetEntityType.GLOSSARY_TERM, gtForm.getEntityType());
    } finally {
      deleteIntakeForm(dpForm.getId());
      deleteIntakeForm(domainForm.getId());
      deleteIntakeForm(gtForm.getId());
    }
  }

  @Test
  void intakeForm_nonAdmin_cannotCreate(TestNamespace ns) {
    CreateIntakeForm create = minimalDataProductForm(ns.prefix("non-admin-create"));
    Exception ex =
        assertThrows(
            Exception.class,
            () ->
                SdkClients.testUserClient()
                    .getHttpClient()
                    .execute(HttpMethod.POST, INTAKE_FORMS_PATH, create, IntakeForm.class));
    String msg = ex.getMessage() == null ? "" : ex.getMessage().toLowerCase();
    assertTrue(
        msg.contains("admin") || msg.contains("forbidden") || msg.contains("403"),
        "Expected admin-only / 403 error but got: " + ex.getMessage());
  }

  @Test
  void intakeForm_nonAdmin_canRead(TestNamespace ns) throws Exception {
    // Admin creates the form
    IntakeForm form = createIntakeForm(minimalDataProductForm(ns.prefix("non-admin-read")));
    try {
      // Non-admin can list/get it
      IntakeForm fetched =
          SdkClients.testUserClient()
              .getHttpClient()
              .execute(
                  HttpMethod.GET, INTAKE_FORMS_PATH + "/" + form.getId(), null, IntakeForm.class);
      assertEquals(form.getId(), fetched.getId());
    } finally {
      deleteIntakeForm(form.getId());
    }
  }

  @Test
  void intakeForm_nonAdmin_cannotDelete(TestNamespace ns) throws Exception {
    IntakeForm form = createIntakeForm(minimalDataProductForm(ns.prefix("non-admin-delete")));
    try {
      Exception ex =
          assertThrows(
              Exception.class,
              () ->
                  SdkClients.testUserClient()
                      .getHttpClient()
                      .execute(
                          HttpMethod.DELETE,
                          INTAKE_FORMS_PATH + "/" + form.getId() + "?hardDelete=true",
                          null,
                          Void.class));
      String msg = ex.getMessage() == null ? "" : ex.getMessage().toLowerCase();
      assertTrue(
          msg.contains("admin") || msg.contains("forbidden") || msg.contains("403"),
          "Expected admin-only / 403 error but got: " + ex.getMessage());
    } finally {
      deleteIntakeForm(form.getId());
    }
  }

  @Test
  void intakeForm_getByEntityType_returns404WhenNoFormConfigured() {
    // No IntakeForm configured for glossaryTerm by default in a clean test
    Exception ex = assertThrows(Exception.class, () -> getIntakeFormByEntityType("glossaryTerm"));
    String msg = ex.getMessage() == null ? "" : ex.getMessage().toLowerCase();
    assertTrue(
        msg.contains("404") || msg.contains("not found") || msg.contains("no enabled intakeform"),
        "Expected 404-like error but got: " + ex.getMessage());
  }

  // ---------------------------------------------------------------------------
  // DataProduct — Layer 2 enforcement
  // ---------------------------------------------------------------------------

  @Test
  void dataProduct_create_succeedsWhenNoIntakeFormConfigured(TestNamespace ns) {
    Domain domain = createDomain(ns);
    CreateDataProduct req = minimalDataProductRequest(ns, domain, "no-intake");

    DataProduct created = SdkClients.adminClient().dataProducts().create(req);
    assertNotNull(created.getId());
  }

  @Test
  void dataProduct_create_rejectedWhenIntakeFormRequiresNativeFieldAndMissing(TestNamespace ns)
      throws Exception {
    Domain domain = createDomain(ns);
    IntakeForm form =
        createIntakeForm(
            dataProductFormRequiring(
                ns.prefix("intake-req-type"),
                "dataProductType",
                "Data Product Type",
                FieldKind.NATIVE));
    try {
      CreateDataProduct req = minimalDataProductRequest(ns, domain, "missing-type");

      InvalidRequestException ex =
          assertThrows(
              InvalidRequestException.class,
              () -> SdkClients.adminClient().dataProducts().create(req));
      assertEquals(400, ex.getStatusCode());
      assertTrue(ex.getMessage().contains("intake form"));
      assertTrue(ex.getMessage().contains("Data Product Type"));
    } finally {
      deleteIntakeForm(form.getId());
    }
  }

  @Test
  void dataProduct_create_succeedsWhenAllIntakeFormRequiredFieldsSet(TestNamespace ns)
      throws Exception {
    Domain domain = createDomain(ns);
    IntakeForm form =
        createIntakeForm(
            dataProductFormRequiring(
                ns.prefix("intake-req-type-ok"),
                "dataProductType",
                "Data Product Type",
                FieldKind.NATIVE));
    try {
      CreateDataProduct req =
          minimalDataProductRequest(ns, domain, "with-type")
              .withDataProductType(DataProductType.DATASET);

      DataProduct created = SdkClients.adminClient().dataProducts().create(req);
      assertNotNull(created.getId());
    } finally {
      deleteIntakeForm(form.getId());
    }
  }

  @Test
  void dataProduct_create_passesWhenIntakeFormIsDisabled(TestNamespace ns) throws Exception {
    Domain domain = createDomain(ns);
    CreateIntakeForm req =
        dataProductFormRequiring(
                ns.prefix("intake-disabled"), "dataProductType", "Type", FieldKind.NATIVE)
            .withEnabled(Boolean.FALSE);
    IntakeForm form = createIntakeForm(req);
    try {
      CreateDataProduct dpReq = minimalDataProductRequest(ns, domain, "disabled-form");

      DataProduct created = SdkClients.adminClient().dataProducts().create(dpReq);
      assertNotNull(created.getId());
    } finally {
      deleteIntakeForm(form.getId());
    }
  }

  @Test
  void dataProduct_create_startsFailingAfterIntakeFormToggledOn(TestNamespace ns) throws Exception {
    Domain domain = createDomain(ns);
    CreateIntakeForm req =
        dataProductFormRequiring(
                ns.prefix("intake-toggle"), "dataProductType", "Type", FieldKind.NATIVE)
            .withEnabled(Boolean.FALSE);
    IntakeForm form = createIntakeForm(req);
    try {
      // disabled → pass
      assertNotNull(
          SdkClients.adminClient()
              .dataProducts()
              .create(minimalDataProductRequest(ns, domain, "toggle-off-pass")));

      // enable
      form.setEnabled(Boolean.TRUE);
      putIntakeForm(toCreate(form));

      // enabled + missing required → 400
      CreateDataProduct dpReq = minimalDataProductRequest(ns, domain, "toggle-on-fail");
      InvalidRequestException ex =
          assertThrows(
              InvalidRequestException.class,
              () -> SdkClients.adminClient().dataProducts().create(dpReq));
      assertEquals(400, ex.getStatusCode());
    } finally {
      deleteIntakeForm(form.getId());
    }
  }

  @Test
  void dataProduct_create_startsPassingAfterRequiredFieldRemovedFromIntakeForm(TestNamespace ns)
      throws Exception {
    Domain domain = createDomain(ns);
    IntakeForm form =
        createIntakeForm(
            dataProductFormRequiring(
                ns.prefix("intake-remove"), "dataProductType", "Type", FieldKind.NATIVE));
    try {
      // enforced → 400
      CreateDataProduct blocked = minimalDataProductRequest(ns, domain, "remove-before");
      assertThrows(
          InvalidRequestException.class,
          () -> SdkClients.adminClient().dataProducts().create(blocked));

      // drop the required field
      form.setRequiredFields(List.of());
      putIntakeForm(toCreate(form));

      // unblocked → 200
      CreateDataProduct unblocked = minimalDataProductRequest(ns, domain, "remove-after");
      assertNotNull(SdkClients.adminClient().dataProducts().create(unblocked));
    } finally {
      deleteIntakeForm(form.getId());
    }
  }

  @Test
  void dataProduct_create_rejectedWhenCustomPropertyIsRequiredAndMissing(TestNamespace ns)
      throws Exception {
    Domain domain = createDomain(ns);
    IntakeForm form =
        createIntakeForm(
            dataProductFormRequiring(
                ns.prefix("intake-custom"),
                "extension." + RISK_PROPERTY,
                "Risk Assessment",
                FieldKind.CUSTOM_PROPERTY));
    try {
      CreateDataProduct req = minimalDataProductRequest(ns, domain, "missing-custom");

      InvalidRequestException ex =
          assertThrows(
              InvalidRequestException.class,
              () -> SdkClients.adminClient().dataProducts().create(req));
      assertEquals(400, ex.getStatusCode());
      assertTrue(ex.getMessage().contains("Risk Assessment"));
    } finally {
      deleteIntakeForm(form.getId());
    }
  }

  @Test
  void dataProduct_create_succeedsWhenCustomPropertyIsRequiredAndSet(TestNamespace ns)
      throws Exception {
    Domain domain = createDomain(ns);
    IntakeForm form =
        createIntakeForm(
            dataProductFormRequiring(
                ns.prefix("intake-custom-ok"),
                "extension." + RISK_PROPERTY,
                "Risk Assessment",
                FieldKind.CUSTOM_PROPERTY));
    try {
      Map<String, Object> ext = new LinkedHashMap<>();
      ext.put(RISK_PROPERTY, "Low");
      CreateDataProduct req =
          minimalDataProductRequest(ns, domain, "with-custom").withExtension(ext);

      DataProduct created = SdkClients.adminClient().dataProducts().create(req);
      assertNotNull(created.getId());
      assertNotNull(created.getExtension());
    } finally {
      deleteIntakeForm(form.getId());
    }
  }

  @Test
  void dataProduct_update_enforcesSameIntakeFormContract(TestNamespace ns) throws Exception {
    Domain domain = createDomain(ns);

    // First: no IntakeForm → create a minimal DP (no dataProductType)
    DataProduct dp =
        SdkClients.adminClient()
            .dataProducts()
            .create(minimalDataProductRequest(ns, domain, "update-flow"));

    IntakeForm form =
        createIntakeForm(
            dataProductFormRequiring(
                ns.prefix("intake-update-req"),
                "dataProductType",
                "Data Product Type",
                FieldKind.NATIVE));
    try {
      // Update the DP without setting dataProductType → should fail (update still goes through
      // prepare() which invokes IntakeFormValidator).
      dp.setDescription("Updated description without type");
      Exception ex =
          assertThrows(
              Exception.class,
              () -> SdkClients.adminClient().dataProducts().update(dp.getId().toString(), dp));
      assertTrue(
          ex.getMessage().contains("Data Product Type"),
          "Expected IntakeForm error but got: " + ex.getMessage());

      // Now set the required field and retry
      dp.setDataProductType(DataProductType.DATASET);
      DataProduct updated =
          SdkClients.adminClient().dataProducts().update(dp.getId().toString(), dp);
      assertEquals(DataProductType.DATASET, updated.getDataProductType());
    } finally {
      deleteIntakeForm(form.getId());
    }
  }

  // ---------------------------------------------------------------------------
  // Layering: schema-required still enforced independently
  // ---------------------------------------------------------------------------

  @Test
  void dataProduct_create_rejectsMissingSchemaRequiredFieldWhenNoIntakeForm(TestNamespace ns) {
    Domain domain = createDomain(ns);
    CreateDataProduct req =
        new CreateDataProduct()
            .withName(ns.prefix("no-desc"))
            .withDomains(List.of(domain.getFullyQualifiedName()));
    // description is schema-required (required at both the request DTO layer and inside prepare)

    assertThrows(Exception.class, () -> SdkClients.adminClient().dataProducts().create(req));
  }

  // ---------------------------------------------------------------------------
  // Domain — same matrix, minimal coverage
  // ---------------------------------------------------------------------------

  @Test
  void domain_create_rejectedWhenIntakeFormRequiresCustomProperty(TestNamespace ns)
      throws Exception {
    IntakeForm form =
        createIntakeForm(
            domainFormRequiring(
                ns.prefix("dom-intake"),
                "extension." + DOMAIN_OWNER_PROPERTY,
                "Owner Custom Field",
                FieldKind.CUSTOM_PROPERTY));
    try {
      CreateDomain req =
          new CreateDomain()
              .withName(ns.prefix("dom-missing-custom"))
              .withDescription("Test domain")
              .withDomainType(DomainType.AGGREGATE);

      InvalidRequestException ex =
          assertThrows(
              InvalidRequestException.class, () -> SdkClients.adminClient().domains().create(req));
      assertEquals(400, ex.getStatusCode());
      assertTrue(ex.getMessage().contains("Owner Custom Field"));
    } finally {
      deleteIntakeForm(form.getId());
    }
  }

  @Test
  void domain_create_succeedsWhenAllIntakeFormRequiredFieldsSatisfied(TestNamespace ns)
      throws Exception {
    IntakeForm form =
        createIntakeForm(
            domainFormRequiring(
                ns.prefix("dom-intake-ok"),
                "extension." + DOMAIN_OWNER_PROPERTY,
                "Owner Custom Field",
                FieldKind.CUSTOM_PROPERTY));
    try {
      Map<String, Object> ext = new LinkedHashMap<>();
      ext.put(DOMAIN_OWNER_PROPERTY, "finance-team");
      CreateDomain req =
          new CreateDomain()
              .withName(ns.prefix("dom-with-custom"))
              .withDescription("Test domain")
              .withDomainType(DomainType.AGGREGATE)
              .withExtension(ext);

      Domain created = SdkClients.adminClient().domains().create(req);
      assertNotNull(created.getId());
    } finally {
      deleteIntakeForm(form.getId());
    }
  }

  // ---------------------------------------------------------------------------
  // GlossaryTerm — POST, PUT, PATCH matrix
  // ---------------------------------------------------------------------------

  @Test
  void glossaryTerm_POST_rejectedWhenIntakeFormRequiresCustomProperty(TestNamespace ns)
      throws Exception {
    IntakeForm form =
        createIntakeForm(
            glossaryTermFormRequiring(
                ns.prefix("gt-intake-missing"),
                "extension." + GLOSSARY_TERM_STEWARD_PROPERTY,
                "Steward",
                FieldKind.CUSTOM_PROPERTY));
    try {
      CreateGlossaryTerm req = minimalGlossaryTermRequest(ns, "gt-missing-custom");

      InvalidRequestException ex =
          assertThrows(
              InvalidRequestException.class,
              () -> SdkClients.adminClient().glossaryTerms().create(req));
      assertEquals(400, ex.getStatusCode());
      assertTrue(
          ex.getMessage().contains("Steward"),
          "Expected IntakeForm error mentioning Steward, got: " + ex.getMessage());
    } finally {
      deleteIntakeForm(form.getId());
    }
  }

  @Test
  void glossaryTerm_POST_succeedsWhenIntakeFormRequiredCustomPropertySet(TestNamespace ns)
      throws Exception {
    IntakeForm form =
        createIntakeForm(
            glossaryTermFormRequiring(
                ns.prefix("gt-intake-ok"),
                "extension." + GLOSSARY_TERM_STEWARD_PROPERTY,
                "Steward",
                FieldKind.CUSTOM_PROPERTY));
    try {
      Map<String, Object> ext = new LinkedHashMap<>();
      ext.put(GLOSSARY_TERM_STEWARD_PROPERTY, "data-stewards@example.com");
      CreateGlossaryTerm req = minimalGlossaryTermRequest(ns, "gt-with-custom").withExtension(ext);

      GlossaryTerm created = SdkClients.adminClient().glossaryTerms().create(req);
      assertNotNull(created.getId());
      assertNotNull(created.getExtension());
    } finally {
      deleteIntakeForm(form.getId());
    }
  }

  @Test
  void glossaryTerm_POST_succeedsWhenNoIntakeForm(TestNamespace ns) {
    CreateGlossaryTerm req = minimalGlossaryTermRequest(ns, "gt-no-intake");

    GlossaryTerm created = SdkClients.adminClient().glossaryTerms().create(req);
    assertNotNull(created.getId());
  }

  @Test
  void glossaryTerm_PUT_rejectedWhenIntakeFormRequiresCustomProperty(TestNamespace ns)
      throws Exception {
    IntakeForm form =
        createIntakeForm(
            glossaryTermFormRequiring(
                ns.prefix("gt-intake-put"),
                "extension." + GLOSSARY_TERM_STEWARD_PROPERTY,
                "Steward",
                FieldKind.CUSTOM_PROPERTY));
    try {
      CreateGlossaryTerm req = minimalGlossaryTermRequest(ns, "gt-put-missing");

      Exception ex =
          assertThrows(
              Exception.class,
              () ->
                  SdkClients.adminClient()
                      .getHttpClient()
                      .execute(HttpMethod.PUT, "/v1/glossaryTerms", req, GlossaryTerm.class));
      assertTrue(
          ex.getMessage().contains("Steward"),
          "Expected IntakeForm error mentioning Steward, got: " + ex.getMessage());
    } finally {
      deleteIntakeForm(form.getId());
    }
  }

  @Test
  void glossaryTerm_PUT_succeedsWhenIntakeFormSatisfied(TestNamespace ns) throws Exception {
    IntakeForm form =
        createIntakeForm(
            glossaryTermFormRequiring(
                ns.prefix("gt-intake-put-ok"),
                "extension." + GLOSSARY_TERM_STEWARD_PROPERTY,
                "Steward",
                FieldKind.CUSTOM_PROPERTY));
    try {
      Map<String, Object> ext = new LinkedHashMap<>();
      ext.put(GLOSSARY_TERM_STEWARD_PROPERTY, "stewards@example.com");
      CreateGlossaryTerm req = minimalGlossaryTermRequest(ns, "gt-put-ok").withExtension(ext);

      GlossaryTerm upserted =
          SdkClients.adminClient()
              .getHttpClient()
              .execute(HttpMethod.PUT, "/v1/glossaryTerms", req, GlossaryTerm.class);
      assertNotNull(upserted.getId());
    } finally {
      deleteIntakeForm(form.getId());
    }
  }

  @Test
  void glossaryTerm_PATCH_rejectedWhenClearsRequiredCustomProperty(TestNamespace ns)
      throws Exception {
    // Create term WITH the custom property before any IntakeForm exists
    Map<String, Object> ext = new LinkedHashMap<>();
    ext.put(GLOSSARY_TERM_STEWARD_PROPERTY, "initial@example.com");
    GlossaryTerm term =
        SdkClients.adminClient()
            .glossaryTerms()
            .create(minimalGlossaryTermRequest(ns, "gt-patch-clear").withExtension(ext));

    IntakeForm form =
        createIntakeForm(
            glossaryTermFormRequiring(
                ns.prefix("gt-intake-patch"),
                "extension." + GLOSSARY_TERM_STEWARD_PROPERTY,
                "Steward",
                FieldKind.CUSTOM_PROPERTY));
    try {
      // PATCH that clears the required extension property should be rejected
      ArrayNode patch = OBJECT_MAPPER.createArrayNode();
      ObjectNode op = patch.addObject();
      op.put("op", "remove");
      op.put("path", "/extension/" + GLOSSARY_TERM_STEWARD_PROPERTY);

      Exception ex =
          assertThrows(
              Exception.class,
              () -> patchEntity("/v1/glossaryTerms/" + term.getId(), patch.toString()));
      assertTrue(
          ex.getMessage().contains("Steward"),
          "Expected IntakeForm error, got: " + ex.getMessage());
    } finally {
      deleteIntakeForm(form.getId());
    }
  }

  @Test
  void glossaryTerm_PATCH_succeedsWhenRequiredFieldPreserved(TestNamespace ns) throws Exception {
    Map<String, Object> ext = new LinkedHashMap<>();
    ext.put(GLOSSARY_TERM_STEWARD_PROPERTY, "keep@example.com");
    GlossaryTerm term =
        SdkClients.adminClient()
            .glossaryTerms()
            .create(minimalGlossaryTermRequest(ns, "gt-patch-keep").withExtension(ext));

    IntakeForm form =
        createIntakeForm(
            glossaryTermFormRequiring(
                ns.prefix("gt-intake-patch-keep"),
                "extension." + GLOSSARY_TERM_STEWARD_PROPERTY,
                "Steward",
                FieldKind.CUSTOM_PROPERTY));
    try {
      // PATCH that only changes description — required field remains set
      ArrayNode patch = OBJECT_MAPPER.createArrayNode();
      ObjectNode op = patch.addObject();
      op.put("op", "replace");
      op.put("path", "/description");
      op.put("value", "Updated description with required field intact");

      patchEntity("/v1/glossaryTerms/" + term.getId(), patch.toString());

      GlossaryTerm reloaded = SdkClients.adminClient().glossaryTerms().get(term.getId().toString());
      assertEquals("Updated description with required field intact", reloaded.getDescription());
    } finally {
      deleteIntakeForm(form.getId());
    }
  }

  // ---------------------------------------------------------------------------
  // DataProduct — PATCH enforcement
  // ---------------------------------------------------------------------------

  @Test
  void dataProduct_PATCH_rejectedWhenClearsRequiredField(TestNamespace ns) throws Exception {
    Domain domain = createDomain(ns);
    // Create DP with the field set, BEFORE any IntakeForm exists
    DataProduct dp =
        SdkClients.adminClient()
            .dataProducts()
            .create(
                minimalDataProductRequest(ns, domain, "dp-patch-clear")
                    .withDataProductType(DataProductType.DATASET));

    IntakeForm form =
        createIntakeForm(
            dataProductFormRequiring(
                ns.prefix("intake-patch-dp"),
                "dataProductType",
                "Data Product Type",
                FieldKind.NATIVE));
    try {
      // PATCH that removes dataProductType should be rejected
      ArrayNode patch = OBJECT_MAPPER.createArrayNode();
      ObjectNode op = patch.addObject();
      op.put("op", "remove");
      op.put("path", "/dataProductType");

      Exception ex =
          assertThrows(
              Exception.class,
              () -> patchEntity("/v1/dataProducts/" + dp.getId(), patch.toString()));
      assertTrue(
          ex.getMessage().contains("Data Product Type"),
          "Expected IntakeForm error, got: " + ex.getMessage());
    } finally {
      deleteIntakeForm(form.getId());
    }
  }

  @Test
  void dataProduct_PATCH_succeedsWhenRequiredFieldStillSet(TestNamespace ns) throws Exception {
    Domain domain = createDomain(ns);
    DataProduct dp =
        SdkClients.adminClient()
            .dataProducts()
            .create(
                minimalDataProductRequest(ns, domain, "dp-patch-keep")
                    .withDataProductType(DataProductType.DATASET));

    IntakeForm form =
        createIntakeForm(
            dataProductFormRequiring(
                ns.prefix("intake-patch-dp-keep"),
                "dataProductType",
                "Data Product Type",
                FieldKind.NATIVE));
    try {
      ArrayNode patch = OBJECT_MAPPER.createArrayNode();
      ObjectNode op = patch.addObject();
      op.put("op", "replace");
      op.put("path", "/description");
      op.put("value", "Updated description, type preserved");

      patchEntity("/v1/dataProducts/" + dp.getId(), patch.toString());

      DataProduct reloaded = SdkClients.adminClient().dataProducts().get(dp.getId().toString());
      assertEquals("Updated description, type preserved", reloaded.getDescription());
      assertEquals(DataProductType.DATASET, reloaded.getDataProductType());
    } finally {
      deleteIntakeForm(form.getId());
    }
  }

  // ---------------------------------------------------------------------------
  // Domain — PATCH enforcement
  // ---------------------------------------------------------------------------

  @Test
  void domain_PATCH_rejectedWhenClearsRequiredCustomProperty(TestNamespace ns) throws Exception {
    Map<String, Object> ext = new LinkedHashMap<>();
    ext.put(DOMAIN_OWNER_PROPERTY, "initial-owner");
    Domain domain =
        SdkClients.adminClient()
            .domains()
            .create(
                new CreateDomain()
                    .withName(ns.prefix("dom-patch-clear"))
                    .withDescription("Domain for patch test")
                    .withDomainType(DomainType.AGGREGATE)
                    .withExtension(ext));

    IntakeForm form =
        createIntakeForm(
            domainFormRequiring(
                ns.prefix("intake-patch-dom"),
                "extension." + DOMAIN_OWNER_PROPERTY,
                "Owner",
                FieldKind.CUSTOM_PROPERTY));
    try {
      ArrayNode patch = OBJECT_MAPPER.createArrayNode();
      ObjectNode op = patch.addObject();
      op.put("op", "remove");
      op.put("path", "/extension/" + DOMAIN_OWNER_PROPERTY);

      Exception ex =
          assertThrows(
              Exception.class,
              () -> patchEntity("/v1/domains/" + domain.getId(), patch.toString()));
      assertTrue(
          ex.getMessage().contains("Owner"),
          "Expected IntakeForm error mentioning Owner, got: " + ex.getMessage());
    } finally {
      deleteIntakeForm(form.getId());
    }
  }

  // ---------------------------------------------------------------------------
  // IntakeForm lifecycle affects enforcement
  // ---------------------------------------------------------------------------

  @Test
  void intakeForm_deletion_stopsEnforcement(TestNamespace ns) throws Exception {
    Domain domain = createDomain(ns);

    IntakeForm form =
        createIntakeForm(
            dataProductFormRequiring(
                ns.prefix("intake-delete-stop"),
                "dataProductType",
                "Data Product Type",
                FieldKind.NATIVE));

    // Enforcement active → rejected
    assertThrows(
        InvalidRequestException.class,
        () ->
            SdkClients.adminClient()
                .dataProducts()
                .create(minimalDataProductRequest(ns, domain, "before-delete")));

    // Delete the form
    deleteIntakeForm(form.getId());

    // Enforcement gone → create without dataProductType should succeed
    DataProduct created =
        SdkClients.adminClient()
            .dataProducts()
            .create(minimalDataProductRequest(ns, domain, "after-delete"));
    assertNotNull(created.getId());
  }

  @Test
  void intakeForm_disableReenable_flipsEnforcementForDomain(TestNamespace ns) throws Exception {
    CreateIntakeForm req =
        domainFormRequiring(
                ns.prefix("dom-intake-flip"),
                "extension." + DOMAIN_OWNER_PROPERTY,
                "Owner",
                FieldKind.CUSTOM_PROPERTY)
            .withEnabled(Boolean.FALSE);
    IntakeForm form = createIntakeForm(req);
    try {
      // Disabled → create without required custom property succeeds
      Domain d1 =
          SdkClients.adminClient()
              .domains()
              .create(
                  new CreateDomain()
                      .withName(ns.prefix("dom-flip-off"))
                      .withDescription("Domain when disabled")
                      .withDomainType(DomainType.AGGREGATE));
      assertNotNull(d1.getId());

      // Enable it
      form.setEnabled(Boolean.TRUE);
      putIntakeForm(toCreate(form));

      // Now missing required custom property is rejected
      assertThrows(
          InvalidRequestException.class,
          () ->
              SdkClients.adminClient()
                  .domains()
                  .create(
                      new CreateDomain()
                          .withName(ns.prefix("dom-flip-on"))
                          .withDescription("Domain when enabled")
                          .withDomainType(DomainType.AGGREGATE)));
    } finally {
      deleteIntakeForm(form.getId());
    }
  }

  // ---------------------------------------------------------------------------
  // Entity-reference custom property deep validation
  // ---------------------------------------------------------------------------

  @Test
  void dataProduct_create_rejectsEntityReferenceToNonExistentUser(TestNamespace ns)
      throws Exception {
    Domain domain = createDomain(ns);
    IntakeForm form =
        createIntakeForm(
            dataProductFormRequiring(
                ns.prefix("intake-ref-missing"),
                "extension." + DP_STEWARD_REF_PROPERTY,
                "Steward",
                FieldKind.CUSTOM_PROPERTY));
    try {
      Map<String, Object> stewardRef = new LinkedHashMap<>();
      stewardRef.put("id", UUID.randomUUID().toString());
      stewardRef.put("type", "user");
      Map<String, Object> ext = new LinkedHashMap<>();
      ext.put(DP_STEWARD_REF_PROPERTY, stewardRef);
      CreateDataProduct req =
          minimalDataProductRequest(ns, domain, "ref-missing").withExtension(ext);

      InvalidRequestException ex =
          assertThrows(
              InvalidRequestException.class,
              () -> SdkClients.adminClient().dataProducts().create(req));
      assertEquals(400, ex.getStatusCode());
      assertTrue(
          ex.getMessage().toLowerCase().contains("does not exist"),
          "Expected 'does not exist' error, got: " + ex.getMessage());
    } finally {
      deleteIntakeForm(form.getId());
    }
  }

  @Test
  void dataProduct_create_acceptsEntityReferenceToExistingUser(TestNamespace ns) throws Exception {
    Domain domain = createDomain(ns);
    User admin = SdkClients.adminClient().users().getByName("admin");
    IntakeForm form =
        createIntakeForm(
            dataProductFormRequiring(
                ns.prefix("intake-ref-ok"),
                "extension." + DP_STEWARD_REF_PROPERTY,
                "Steward",
                FieldKind.CUSTOM_PROPERTY));
    try {
      Map<String, Object> stewardRef = new LinkedHashMap<>();
      stewardRef.put("id", admin.getId().toString());
      stewardRef.put("type", "user");
      Map<String, Object> ext = new LinkedHashMap<>();
      ext.put(DP_STEWARD_REF_PROPERTY, stewardRef);
      CreateDataProduct req = minimalDataProductRequest(ns, domain, "ref-ok").withExtension(ext);

      DataProduct created = SdkClients.adminClient().dataProducts().create(req);
      assertNotNull(created.getId());
      assertNotNull(created.getExtension());
    } finally {
      deleteIntakeForm(form.getId());
    }
  }

  @Test
  void dataProduct_create_rejectsEntityReferenceMissingIdOrType(TestNamespace ns) throws Exception {
    Domain domain = createDomain(ns);
    IntakeForm form =
        createIntakeForm(
            dataProductFormRequiring(
                ns.prefix("intake-ref-malformed"),
                "extension." + DP_STEWARD_REF_PROPERTY,
                "Steward",
                FieldKind.CUSTOM_PROPERTY));
    try {
      // Missing 'type' key — must reject
      Map<String, Object> stewardRef = new LinkedHashMap<>();
      stewardRef.put("id", UUID.randomUUID().toString());
      Map<String, Object> ext = new LinkedHashMap<>();
      ext.put(DP_STEWARD_REF_PROPERTY, stewardRef);
      CreateDataProduct req =
          minimalDataProductRequest(ns, domain, "ref-malformed").withExtension(ext);

      Exception ex =
          assertThrows(Exception.class, () -> SdkClients.adminClient().dataProducts().create(req));
      assertTrue(
          ex.getMessage().toLowerCase().contains("id")
              || ex.getMessage().toLowerCase().contains("type")
              || ex.getMessage().toLowerCase().contains("required"),
          "Expected malformed-reference error, got: " + ex.getMessage());
    } finally {
      deleteIntakeForm(form.getId());
    }
  }

  @Test
  void dataProduct_create_rejectsEntityReferenceWithInvalidUuid(TestNamespace ns) throws Exception {
    Domain domain = createDomain(ns);
    IntakeForm form =
        createIntakeForm(
            dataProductFormRequiring(
                ns.prefix("intake-ref-bad-uuid"),
                "extension." + DP_STEWARD_REF_PROPERTY,
                "Steward",
                FieldKind.CUSTOM_PROPERTY));
    try {
      Map<String, Object> stewardRef = new LinkedHashMap<>();
      stewardRef.put("id", "not-a-uuid");
      stewardRef.put("type", "user");
      Map<String, Object> ext = new LinkedHashMap<>();
      ext.put(DP_STEWARD_REF_PROPERTY, stewardRef);
      CreateDataProduct req =
          minimalDataProductRequest(ns, domain, "ref-bad-uuid").withExtension(ext);

      Exception ex =
          assertThrows(Exception.class, () -> SdkClients.adminClient().dataProducts().create(req));
      assertTrue(
          ex.getMessage().toLowerCase().contains("uuid")
              || ex.getMessage().toLowerCase().contains("invalid")
              || ex.getMessage().toLowerCase().contains("not-a-uuid"),
          "Expected invalid-UUID error, got: " + ex.getMessage());
    } finally {
      deleteIntakeForm(form.getId());
    }
  }

  @Test
  void dataProduct_create_entityReference_acceptsFqnWithoutId(TestNamespace ns) {
    // The EntityReference JSON Schema treats 'id' and 'fullyQualifiedName' as
    // alternative identifiers (both + type is a valid lookup). Clients (incl.
    // ColumnCustomPropertiesIT) rely on passing only {type, fullyQualifiedName}
    // when the caller doesn't know the UUID yet.
    Domain domain = createDomain(ns);
    Map<String, Object> stewardRef = new LinkedHashMap<>();
    stewardRef.put("type", "user");
    stewardRef.put("fullyQualifiedName", "admin");
    Map<String, Object> ext = new LinkedHashMap<>();
    ext.put(DP_STEWARD_REF_PROPERTY, stewardRef);
    CreateDataProduct req =
        minimalDataProductRequest(ns, domain, "ref-fqn-only").withExtension(ext);

    DataProduct created = SdkClients.adminClient().dataProducts().create(req);
    assertNotNull(created.getId());
    assertNotNull(created.getExtension());
  }

  @Test
  void dataProduct_create_entityReference_rejectsFqnForNonExistentUser(TestNamespace ns) {
    Domain domain = createDomain(ns);
    Map<String, Object> stewardRef = new LinkedHashMap<>();
    stewardRef.put("type", "user");
    stewardRef.put("fullyQualifiedName", "definitely-not-a-real-user-42");
    Map<String, Object> ext = new LinkedHashMap<>();
    ext.put(DP_STEWARD_REF_PROPERTY, stewardRef);
    CreateDataProduct req =
        minimalDataProductRequest(ns, domain, "ref-fqn-missing").withExtension(ext);

    InvalidRequestException ex =
        assertThrows(
            InvalidRequestException.class,
            () -> SdkClients.adminClient().dataProducts().create(req));
    assertTrue(
        ex.getMessage().toLowerCase().contains("does not exist"),
        "Expected 'does not exist' for FQN-only lookup of a missing user, got: " + ex.getMessage());
  }

  @Test
  void dataProduct_create_entityRefValidatedEvenWhenNotRequiredByIntakeForm(TestNamespace ns) {
    Domain domain = createDomain(ns);
    // No IntakeForm — entity reference resolution happens via the general
    // validateAndTransformExtension path (not just IntakeForm enforcement).
    Map<String, Object> stewardRef = new LinkedHashMap<>();
    stewardRef.put("id", UUID.randomUUID().toString());
    stewardRef.put("type", "user");
    Map<String, Object> ext = new LinkedHashMap<>();
    ext.put(DP_STEWARD_REF_PROPERTY, stewardRef);
    CreateDataProduct req =
        minimalDataProductRequest(ns, domain, "ref-no-intake").withExtension(ext);

    InvalidRequestException ex =
        assertThrows(
            InvalidRequestException.class,
            () -> SdkClients.adminClient().dataProducts().create(req));
    assertTrue(
        ex.getMessage().toLowerCase().contains("does not exist"),
        "Expected 'does not exist' error, got: " + ex.getMessage());
  }

  // ---------------------------------------------------------------------------
  // Advanced custom property types: entityReferenceList, enum, integer
  // ---------------------------------------------------------------------------

  @Test
  void dataProduct_create_entityReferenceList_acceptsMultipleExistingUsers(TestNamespace ns)
      throws Exception {
    Domain domain = createDomain(ns);
    User admin = SdkClients.adminClient().users().getByName("admin");
    Map<String, Object> userRef = new LinkedHashMap<>();
    userRef.put("id", admin.getId().toString());
    userRef.put("type", "user");
    Map<String, Object> ext = new LinkedHashMap<>();
    ext.put(DP_STEWARDS_REF_LIST_PROPERTY, List.of(userRef));
    CreateDataProduct req = minimalDataProductRequest(ns, domain, "ref-list-ok").withExtension(ext);

    DataProduct created = SdkClients.adminClient().dataProducts().create(req);
    assertNotNull(created.getId());
    assertNotNull(created.getExtension());
  }

  @Test
  void dataProduct_create_entityReferenceList_rejectsIfAnyEntryMissing(TestNamespace ns) {
    Domain domain = createDomain(ns);
    Map<String, Object> validRef = new LinkedHashMap<>();
    try {
      User admin = SdkClients.adminClient().users().getByName("admin");
      validRef.put("id", admin.getId().toString());
      validRef.put("type", "user");
    } catch (Exception e) {
      throw new RuntimeException(e);
    }
    Map<String, Object> missingRef = new LinkedHashMap<>();
    missingRef.put("id", UUID.randomUUID().toString());
    missingRef.put("type", "user");
    Map<String, Object> ext = new LinkedHashMap<>();
    ext.put(DP_STEWARDS_REF_LIST_PROPERTY, List.of(validRef, missingRef));
    CreateDataProduct req =
        minimalDataProductRequest(ns, domain, "ref-list-bad").withExtension(ext);

    InvalidRequestException ex =
        assertThrows(
            InvalidRequestException.class,
            () -> SdkClients.adminClient().dataProducts().create(req));
    assertEquals(400, ex.getStatusCode());
    assertTrue(
        ex.getMessage().toLowerCase().contains("does not exist"),
        "Expected 'does not exist', got: " + ex.getMessage());
  }

  @Test
  void dataProduct_create_entityReferenceList_rejectsWhenPassedAsObjectNotArray(TestNamespace ns) {
    Domain domain = createDomain(ns);
    Map<String, Object> userRef = new LinkedHashMap<>();
    userRef.put("id", UUID.randomUUID().toString());
    userRef.put("type", "user");
    Map<String, Object> ext = new LinkedHashMap<>();
    // Wrong shape: single object instead of array
    ext.put(DP_STEWARDS_REF_LIST_PROPERTY, userRef);
    CreateDataProduct req =
        minimalDataProductRequest(ns, domain, "ref-list-shape").withExtension(ext);

    Exception ex =
        assertThrows(Exception.class, () -> SdkClients.adminClient().dataProducts().create(req));
    assertTrue(
        ex.getMessage().toLowerCase().contains("array")
            || ex.getMessage().toLowerCase().contains("invalid")
            || ex.getMessage().toLowerCase().contains("must"),
        "Expected shape error for array-expected property, got: " + ex.getMessage());
  }

  @Test
  void dataProduct_create_entityReferenceList_rejectsWhenElementIsString(TestNamespace ns) {
    // Array containing a primitive string instead of an entity-ref object should fail
    // with a message that points at the element shape, not a generic NPE from reading
    // 'id'/'type' on a non-object.
    Domain domain = createDomain(ns);
    Map<String, Object> ext = new LinkedHashMap<>();
    ext.put(DP_STEWARDS_REF_LIST_PROPERTY, List.of("not-an-object"));
    CreateDataProduct req =
        minimalDataProductRequest(ns, domain, "ref-list-str-element").withExtension(ext);

    Exception ex =
        assertThrows(Exception.class, () -> SdkClients.adminClient().dataProducts().create(req));
    String msg = ex.getMessage() == null ? "" : ex.getMessage().toLowerCase();
    assertTrue(
        msg.contains("object")
            || msg.contains("'id'")
            || msg.contains("'type'")
            || msg.contains("index"),
        "Expected non-object element error, got: " + ex.getMessage());
  }

  @Test
  void dataProduct_create_entityReferenceList_rejectsWhenElementIsNumber(TestNamespace ns) {
    Domain domain = createDomain(ns);
    Map<String, Object> ext = new LinkedHashMap<>();
    ext.put(DP_STEWARDS_REF_LIST_PROPERTY, List.of(42));
    CreateDataProduct req =
        minimalDataProductRequest(ns, domain, "ref-list-num-element").withExtension(ext);

    Exception ex =
        assertThrows(Exception.class, () -> SdkClients.adminClient().dataProducts().create(req));
    String msg = ex.getMessage() == null ? "" : ex.getMessage().toLowerCase();
    assertTrue(
        msg.contains("object")
            || msg.contains("'id'")
            || msg.contains("'type'")
            || msg.contains("index"),
        "Expected non-object element error, got: " + ex.getMessage());
  }

  @Test
  void dataProduct_create_enum_acceptsValueFromConfiguredSet(TestNamespace ns) {
    Domain domain = createDomain(ns);
    Map<String, Object> ext = new LinkedHashMap<>();
    ext.put(DP_PRIORITY_ENUM_PROPERTY, List.of("high"));
    CreateDataProduct req = minimalDataProductRequest(ns, domain, "enum-ok").withExtension(ext);

    DataProduct created = SdkClients.adminClient().dataProducts().create(req);
    assertNotNull(created.getId());
  }

  @Test
  void dataProduct_create_enum_rejectsValueOutsideConfiguredSet(TestNamespace ns) {
    Domain domain = createDomain(ns);
    Map<String, Object> ext = new LinkedHashMap<>();
    ext.put(DP_PRIORITY_ENUM_PROPERTY, List.of("not-in-the-list"));
    CreateDataProduct req = minimalDataProductRequest(ns, domain, "enum-bad").withExtension(ext);

    Exception ex =
        assertThrows(Exception.class, () -> SdkClients.adminClient().dataProducts().create(req));
    assertTrue(
        ex.getMessage().toLowerCase().contains("enum")
            || ex.getMessage().toLowerCase().contains("invalid")
            || ex.getMessage().toLowerCase().contains("not-in-the-list"),
        "Expected enum-validation error, got: " + ex.getMessage());
  }

  @Test
  void dataProduct_create_integer_acceptsValidInteger(TestNamespace ns) {
    Domain domain = createDomain(ns);
    Map<String, Object> ext = new LinkedHashMap<>();
    ext.put(DP_COST_INTEGER_PROPERTY, 42);
    CreateDataProduct req = minimalDataProductRequest(ns, domain, "int-ok").withExtension(ext);

    DataProduct created = SdkClients.adminClient().dataProducts().create(req);
    assertNotNull(created.getId());
  }

  @Test
  void dataProduct_create_integer_rejectsNonNumericString(TestNamespace ns) {
    Domain domain = createDomain(ns);
    Map<String, Object> ext = new LinkedHashMap<>();
    ext.put(DP_COST_INTEGER_PROPERTY, "not-a-number");
    CreateDataProduct req = minimalDataProductRequest(ns, domain, "int-bad").withExtension(ext);

    Exception ex =
        assertThrows(Exception.class, () -> SdkClients.adminClient().dataProducts().create(req));
    assertTrue(
        ex.getMessage().toLowerCase().contains("integer")
            || ex.getMessage().toLowerCase().contains("number")
            || ex.getMessage().toLowerCase().contains("invalid"),
        "Expected integer-validation error, got: " + ex.getMessage());
  }

  @Test
  void dataProduct_create_intakeFormRequiredEnum_rejectsWhenMissing(TestNamespace ns)
      throws Exception {
    Domain domain = createDomain(ns);
    IntakeForm form =
        createIntakeForm(
            dataProductFormRequiring(
                ns.prefix("intake-enum-missing"),
                "extension." + DP_PRIORITY_ENUM_PROPERTY,
                "Priority",
                FieldKind.CUSTOM_PROPERTY));
    try {
      CreateDataProduct req = minimalDataProductRequest(ns, domain, "enum-intake-missing");

      InvalidRequestException ex =
          assertThrows(
              InvalidRequestException.class,
              () -> SdkClients.adminClient().dataProducts().create(req));
      assertEquals(400, ex.getStatusCode());
      assertTrue(
          ex.getMessage().contains("Priority"),
          "Expected IntakeForm error mentioning Priority, got: " + ex.getMessage());
    } finally {
      deleteIntakeForm(form.getId());
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers — CustomProperty registration
  // ---------------------------------------------------------------------------

  private static void ensureStringCustomProperty(String entityType, String propertyName)
      throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Type type = getTypeByName(client, entityType);
    if (type.getCustomProperties() != null
        && type.getCustomProperties().stream().anyMatch(cp -> propertyName.equals(cp.getName()))) {
      return;
    }
    Type stringType = getTypeByName(client, "string");
    CustomProperty prop = new CustomProperty();
    prop.setName(propertyName);
    prop.setDescription("Custom property registered by IntakeFormResourceIT tests");
    prop.setPropertyType(stringType.getEntityReference());
    client
        .getHttpClient()
        .execute(HttpMethod.PUT, "/v1/metadata/types/" + type.getId(), prop, Type.class);
  }

  private static void ensureEntityReferenceCustomProperty(
      String entityType, String propertyName, String... allowedTypes) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Type type = getTypeByName(client, entityType);
    if (type.getCustomProperties() != null
        && type.getCustomProperties().stream().anyMatch(cp -> propertyName.equals(cp.getName()))) {
      return;
    }
    Type entityRefType = getTypeByName(client, "entityReference");
    CustomProperty prop = new CustomProperty();
    prop.setName(propertyName);
    prop.setDescription("Entity reference custom property registered by IntakeFormResourceIT");
    prop.setPropertyType(entityRefType.getEntityReference());
    CustomPropertyConfig config = new CustomPropertyConfig();
    config.setConfig(List.of(allowedTypes));
    prop.setCustomPropertyConfig(config);
    client
        .getHttpClient()
        .execute(HttpMethod.PUT, "/v1/metadata/types/" + type.getId(), prop, Type.class);
  }

  private static void ensureEntityReferenceListCustomProperty(
      String entityType, String propertyName, String... allowedTypes) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Type type = getTypeByName(client, entityType);
    if (type.getCustomProperties() != null
        && type.getCustomProperties().stream().anyMatch(cp -> propertyName.equals(cp.getName()))) {
      return;
    }
    Type refListType = getTypeByName(client, "entityReferenceList");
    CustomProperty prop = new CustomProperty();
    prop.setName(propertyName);
    prop.setDescription("Entity reference list registered by IntakeFormResourceIT");
    prop.setPropertyType(refListType.getEntityReference());
    CustomPropertyConfig config = new CustomPropertyConfig();
    config.setConfig(List.of(allowedTypes));
    prop.setCustomPropertyConfig(config);
    client
        .getHttpClient()
        .execute(HttpMethod.PUT, "/v1/metadata/types/" + type.getId(), prop, Type.class);
  }

  private static void ensureEnumCustomProperty(
      String entityType, String propertyName, List<String> values) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Type type = getTypeByName(client, entityType);
    if (type.getCustomProperties() != null
        && type.getCustomProperties().stream().anyMatch(cp -> propertyName.equals(cp.getName()))) {
      return;
    }
    Type enumType = getTypeByName(client, "enum");
    CustomProperty prop = new CustomProperty();
    prop.setName(propertyName);
    prop.setDescription("Enum custom property registered by IntakeFormResourceIT");
    prop.setPropertyType(enumType.getEntityReference());
    EnumConfig enumConfig = new EnumConfig();
    enumConfig.setValues(values);
    CustomPropertyConfig config = new CustomPropertyConfig();
    config.setConfig(enumConfig);
    prop.setCustomPropertyConfig(config);
    client
        .getHttpClient()
        .execute(HttpMethod.PUT, "/v1/metadata/types/" + type.getId(), prop, Type.class);
  }

  private static void ensureIntegerCustomProperty(String entityType, String propertyName)
      throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Type type = getTypeByName(client, entityType);
    if (type.getCustomProperties() != null
        && type.getCustomProperties().stream().anyMatch(cp -> propertyName.equals(cp.getName()))) {
      return;
    }
    Type integerType = getTypeByName(client, "integer");
    CustomProperty prop = new CustomProperty();
    prop.setName(propertyName);
    prop.setDescription("Integer custom property registered by IntakeFormResourceIT");
    prop.setPropertyType(integerType.getEntityReference());
    client
        .getHttpClient()
        .execute(HttpMethod.PUT, "/v1/metadata/types/" + type.getId(), prop, Type.class);
  }

  private static Type getTypeByName(OpenMetadataClient client, String name) throws Exception {
    String json =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/metadata/types/name/" + name + "?fields=customProperties",
                null);
    return OBJECT_MAPPER.readValue(json, Type.class);
  }

  // ---------------------------------------------------------------------------
  // Helpers — IntakeForm CRUD over raw HTTP (no SDK yet)
  // ---------------------------------------------------------------------------

  private static IntakeForm createIntakeForm(CreateIntakeForm request) throws Exception {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(HttpMethod.POST, INTAKE_FORMS_PATH, request, IntakeForm.class);
  }

  private static IntakeForm putIntakeForm(CreateIntakeForm request) throws Exception {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(HttpMethod.PUT, INTAKE_FORMS_PATH, request, IntakeForm.class);
  }

  private static IntakeForm getIntakeFormById(UUID id) throws Exception {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(HttpMethod.GET, INTAKE_FORMS_PATH + "/" + id, null, IntakeForm.class);
  }

  private static IntakeForm getIntakeFormByName(String name) throws Exception {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(HttpMethod.GET, INTAKE_FORMS_PATH + "/name/" + name, null, IntakeForm.class);
  }

  private static IntakeForm getIntakeFormByEntityType(String entityType) throws Exception {
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.GET,
            INTAKE_FORMS_PATH + "/entityType/" + entityType,
            null,
            IntakeForm.class);
  }

  private static void deleteIntakeForm(UUID id) throws Exception {
    try {
      SdkClients.adminClient()
          .getHttpClient()
          .execute(
              HttpMethod.DELETE,
              INTAKE_FORMS_PATH + "/" + id + "?hardDelete=true",
              null,
              Void.class);
    } catch (Exception ignored) {
      // Best-effort cleanup — a follow-up test shouldn't fail because teardown errored.
    }
  }

  private static CreateIntakeForm toCreate(IntakeForm form) {
    return new CreateIntakeForm()
        .withName(form.getName())
        .withDisplayName(form.getDisplayName())
        .withDescription(form.getDescription())
        .withEntityType(form.getEntityType())
        .withEnabled(form.getEnabled())
        .withRequiredFields(form.getRequiredFields());
  }

  // ---------------------------------------------------------------------------
  // Fixtures
  // ---------------------------------------------------------------------------

  private static CreateIntakeForm minimalDataProductForm(String name) {
    return new CreateIntakeForm()
        .withName(name)
        .withEntityType(TargetEntityType.DATA_PRODUCT)
        .withEnabled(Boolean.TRUE)
        .withRequiredFields(List.of());
  }

  private static CreateIntakeForm dataProductFormRequiring(
      String name, String fieldPath, String label, FieldKind kind) {
    return new CreateIntakeForm()
        .withName(name)
        .withEntityType(TargetEntityType.DATA_PRODUCT)
        .withEnabled(Boolean.TRUE)
        .withRequiredFields(
            List.of(
                new IntakeFormRequiredField()
                    .withFieldPath(fieldPath)
                    .withFieldLabel(label)
                    .withFieldKind(kind)));
  }

  private static CreateIntakeForm domainFormRequiring(
      String name, String fieldPath, String label, FieldKind kind) {
    return new CreateIntakeForm()
        .withName(name)
        .withEntityType(TargetEntityType.DOMAIN)
        .withEnabled(Boolean.TRUE)
        .withRequiredFields(
            List.of(
                new IntakeFormRequiredField()
                    .withFieldPath(fieldPath)
                    .withFieldLabel(label)
                    .withFieldKind(kind)));
  }

  private static Domain createDomain(TestNamespace ns) {
    String domainName = ns.prefix("intake-test-domain");
    try {
      return SdkClients.adminClient().domains().getByName(domainName);
    } catch (Exception e) {
      return SdkClients.adminClient()
          .domains()
          .create(
              new CreateDomain()
                  .withName(domainName)
                  .withDescription("Test domain for IntakeForm integration tests")
                  .withDomainType(DomainType.AGGREGATE));
    }
  }

  private static CreateDataProduct minimalDataProductRequest(
      TestNamespace ns, Domain domain, String suffix) {
    return new CreateDataProduct()
        .withName(ns.prefix("dp-" + suffix))
        .withDescription("IntakeForm integration test data product")
        .withDomains(List.of(domain.getFullyQualifiedName()));
  }

  private static Glossary ensureGlossary(String name) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    try {
      return client.glossaries().getByName(name);
    } catch (Exception e) {
      CreateGlossary create =
          new CreateGlossary()
              .withName(name)
              .withDescription("Glossary for IntakeForm integration tests");
      return client.glossaries().create(create);
    }
  }

  private static CreateGlossaryTerm minimalGlossaryTermRequest(TestNamespace ns, String suffix) {
    return new CreateGlossaryTerm()
        .withName(ns.prefix("gt-" + suffix))
        .withDescription("IntakeForm integration test glossary term")
        .withGlossary(sharedGlossary.getFullyQualifiedName());
  }

  private static CreateIntakeForm glossaryTermFormRequiring(
      String name, String fieldPath, String label, FieldKind kind) {
    return new CreateIntakeForm()
        .withName(name)
        .withEntityType(TargetEntityType.GLOSSARY_TERM)
        .withEnabled(Boolean.TRUE)
        .withRequiredFields(
            List.of(
                new IntakeFormRequiredField()
                    .withFieldPath(fieldPath)
                    .withFieldLabel(label)
                    .withFieldKind(kind)));
  }

  private static void patchEntity(String path, String patchJson) throws Exception {
    SdkClients.adminClient()
        .getHttpClient()
        .executeForString(
            HttpMethod.PATCH,
            path,
            patchJson,
            RequestOptions.builder().header("Content-Type", "application/json-patch+json").build());
  }
}
