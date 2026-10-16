/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.SlaDefinition;
import org.openmetadata.schema.entity.domains.odps.Details;
import org.openmetadata.schema.entity.domains.odps.ODPSDataProduct;
import org.openmetadata.schema.entity.domains.odps.ODPSProduct;
import org.openmetadata.schema.entity.domains.odps.ODPSProductDetails;
import org.openmetadata.schema.type.EntityReference;

class ODPSConverterTest {

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------

  @Test
  void toODPS_populatesSchemaVersionAndProduct() {
    DataProduct dp = basicDataProduct();

    ODPSDataProduct odps = ODPSConverter.toODPS(dp);

    assertNotNull(odps);
    assertEquals(ODPSDataProduct.OdpsApiVersion._4_1, odps.getVersion());
    assertEquals(ODPSConverter.DEFAULT_SCHEMA_URL, odps.getSchema());
    assertNotNull(odps.getProduct());
    assertNotNull(odps.getProduct().getDetails());
  }

  @Test
  void toODPS_placesDetailsUnderEnLanguageKey() {
    DataProduct dp = basicDataProduct();

    ODPSDataProduct odps = ODPSConverter.toODPS(dp);

    ODPSProductDetails details = odps.getProduct().getDetails().getAdditionalProperties().get("en");
    assertNotNull(details);
    assertEquals(dp.getDisplayName(), details.getName());
    assertEquals(dp.getFullyQualifiedName(), details.getProductID());
    assertEquals(dp.getDescription(), details.getDescription());
  }

  @Test
  void toODPS_mapsEachOmEnumValueToCorrespondingOdpsEnum() {
    for (CreateDataProduct.DataProductType omType : CreateDataProduct.DataProductType.values()) {
      DataProduct dp = basicDataProduct();
      dp.setDataProductType(omType);

      ODPSDataProduct odps = ODPSConverter.toODPS(dp);
      ODPSProductDetails details =
          odps.getProduct().getDetails().getAdditionalProperties().get("en");

      assertNotNull(details.getType(), "Type must be set for OM enum " + omType);
    }
  }

  @Test
  void toODPS_mapsLifecycleStageToOdpsStatus() {
    DataProduct dp = basicDataProduct();
    dp.setLifecycleStage(DataProduct.LifecycleStage.PRODUCTION);

    ODPSDataProduct odps = ODPSConverter.toODPS(dp);

    ODPSProductDetails details = odps.getProduct().getDetails().getAdditionalProperties().get("en");
    assertEquals(ODPSProductDetails.OdpsStatus.PRODUCTION, details.getStatus());
  }

  @Test
  void toODPS_mapsSlaAvailabilityToUptimeDimension() {
    DataProduct dp = basicDataProduct();
    SlaDefinition sla = new SlaDefinition();
    sla.setAvailability(99.9);
    sla.setResponseTime(250);
    dp.setSla(sla);

    ODPSDataProduct odps = ODPSConverter.toODPS(dp);

    assertNotNull(odps.getProduct().getSla());
    assertNotNull(odps.getProduct().getSla().getDeclarative());
    assertEquals(2, odps.getProduct().getSla().getDeclarative().size());
    boolean hasUptime =
        odps.getProduct().getSla().getDeclarative().stream()
            .anyMatch(d -> "uptime".equals(d.getDimension()) && d.getObjective() == 99.9);
    assertTrue(hasUptime);
  }

  @Test
  void toODPS_nullInputThrows() {
    assertThrows(IllegalArgumentException.class, () -> ODPSConverter.toODPS(null));
  }

  // ---------------------------------------------------------------------------
  // Import
  // ---------------------------------------------------------------------------

  @Test
  void fromODPS_requiresProduct() {
    ODPSDataProduct empty = new ODPSDataProduct();
    IllegalArgumentException ex =
        assertThrows(IllegalArgumentException.class, () -> ODPSConverter.fromODPS(empty));
    assertTrue(ex.getMessage().contains("product"));
  }

  @Test
  void fromODPS_requiresVersionWhenExplicitlyNulled() {
    ODPSDataProduct empty = new ODPSDataProduct();
    empty.setVersion(null);
    IllegalArgumentException ex =
        assertThrows(IllegalArgumentException.class, () -> ODPSConverter.fromODPS(empty));
    assertTrue(ex.getMessage().contains("version"));
  }

  @Test
  void fromODPS_requiresProductDetailsName() {
    ODPSDataProduct odps = new ODPSDataProduct();
    odps.setVersion(ODPSDataProduct.OdpsApiVersion._4_1);
    ODPSProduct product = new ODPSProduct();
    Details details = new Details();
    ODPSProductDetails productDetails = new ODPSProductDetails();
    productDetails.setName(null);
    productDetails.setProductID("pid-1");
    details.setAdditionalProperty("en", productDetails);
    product.setDetails(details);
    odps.setProduct(product);

    IllegalArgumentException ex =
        assertThrows(IllegalArgumentException.class, () -> ODPSConverter.fromODPS(odps));
    assertTrue(ex.getMessage().contains("name"));
  }

  @Test
  void fromODPS_mapsBasicFields() {
    ODPSDataProduct odps = basicODPS();

    DataProduct dp = ODPSConverter.fromODPS(odps);

    assertEquals("sales-analytics", dp.getName());
    assertEquals("Description here", dp.getDescription());
    assertEquals(CreateDataProduct.DataProductType.DATASET, dp.getDataProductType());
    assertEquals(CreateDataProduct.Visibility.ORGANISATION, dp.getVisibility());
  }

  @Test
  void fromODPS_doesNotWriteUnregisteredOdpsMetadataExtension() {
    // `odpsMetadata` is not a registered custom property on the dataProduct
    // entity type, so writing it into the extension would make every API import
    // fail validation ("Unknown custom field odpsMetadata"). The converter maps
    // all meaningful ODPS fields onto native attributes instead and leaves the
    // extension untouched.
    ODPSDataProduct odps = basicODPS();

    DataProduct dp = ODPSConverter.fromODPS(odps);

    assertNull(dp.getExtension());
  }

  @Test
  void fromODPS_selectsRequestedLanguageOverDefault() {
    ODPSDataProduct odps = basicODPS();
    ODPSProductDetails frDetails = new ODPSProductDetails();
    frDetails.setName("ventes-analytiques");
    frDetails.setProductID("sales-analytics");
    odps.getProduct().getDetails().setAdditionalProperty("fr", frDetails);

    DataProduct dp = ODPSConverter.fromODPS(odps, "fr");

    assertEquals("ventes-analytiques", dp.getName());
  }

  @Test
  void fromODPS_fallsBackToEnIfRequestedLanguageMissing() {
    ODPSDataProduct odps = basicODPS();

    DataProduct dp = ODPSConverter.fromODPS(odps, "de");

    assertEquals("sales-analytics", dp.getName());
  }

  // ---------------------------------------------------------------------------
  // Round-trip
  // ---------------------------------------------------------------------------

  @Test
  void roundTrip_preservesDataProductTypeVisibilityAndPriority() {
    DataProduct original = basicDataProduct();
    original.setDataProductType(CreateDataProduct.DataProductType.ANALYTIC_VIEW);
    original.setVisibility(CreateDataProduct.Visibility.PUBLIC);
    original.setPortfolioPriority(CreateDataProduct.PortfolioPriority.HIGH);

    ODPSDataProduct odps = ODPSConverter.toODPS(original);
    DataProduct reimported = ODPSConverter.fromODPS(odps);

    assertEquals(CreateDataProduct.DataProductType.ANALYTIC_VIEW, reimported.getDataProductType());
    assertEquals(CreateDataProduct.Visibility.PUBLIC, reimported.getVisibility());
    assertEquals(CreateDataProduct.PortfolioPriority.HIGH, reimported.getPortfolioPriority());
  }

  @Test
  void roundTrip_3DVisualisationEnumNameRoundsTripsCleanly() {
    DataProduct original = basicDataProduct();
    original.setDataProductType(CreateDataProduct.DataProductType.VISUALISATION_3_D);

    ODPSDataProduct odps = ODPSConverter.toODPS(original);
    DataProduct reimported = ODPSConverter.fromODPS(odps);

    assertEquals(
        CreateDataProduct.DataProductType.VISUALISATION_3_D, reimported.getDataProductType());
  }

  // ---------------------------------------------------------------------------
  // Merge strategies
  // ---------------------------------------------------------------------------

  @Test
  void smartMerge_preservesIdentityAndWorkflowFieldsFromExisting() {
    DataProduct existing = basicDataProduct();
    existing.setId(UUID.randomUUID());
    existing.setLifecycleStage(DataProduct.LifecycleStage.PRODUCTION);

    DataProduct imported = new DataProduct();
    imported.setDisplayName("NewName");
    imported.setLifecycleStage(DataProduct.LifecycleStage.IDEATION);
    imported.setDataProductType(CreateDataProduct.DataProductType.ALGORITHM);

    DataProduct merged = ODPSConverter.smartMerge(existing, imported);

    assertEquals(existing.getId(), merged.getId());
    assertEquals(existing.getName(), merged.getName());
    assertEquals(DataProduct.LifecycleStage.PRODUCTION, merged.getLifecycleStage());
    assertEquals("NewName", merged.getDisplayName());
    assertEquals(CreateDataProduct.DataProductType.ALGORITHM, merged.getDataProductType());
  }

  @Test
  void smartMerge_nullImportedFieldsKeepsExistingValues() {
    DataProduct existing = basicDataProduct();
    existing.setDisplayName("Existing Display");
    existing.setDataProductType(CreateDataProduct.DataProductType.DATASET);

    DataProduct imported = new DataProduct();

    DataProduct merged = ODPSConverter.smartMerge(existing, imported);

    assertEquals("Existing Display", merged.getDisplayName());
    assertEquals(CreateDataProduct.DataProductType.DATASET, merged.getDataProductType());
  }

  @Test
  void fullReplace_replacesDeclarativeFieldsButPreservesIdentityAndWorkflow() {
    DataProduct existing = basicDataProduct();
    existing.setId(UUID.randomUUID());
    existing.setLifecycleStage(DataProduct.LifecycleStage.PRODUCTION);

    DataProduct imported = new DataProduct();
    imported.setDisplayName("Replacement");
    imported.setDataProductType(CreateDataProduct.DataProductType.REPORTS);
    imported.setLifecycleStage(DataProduct.LifecycleStage.IDEATION);

    DataProduct replaced = ODPSConverter.fullReplace(existing, imported);

    assertEquals(existing.getId(), replaced.getId());
    assertEquals(existing.getName(), replaced.getName());
    assertEquals(DataProduct.LifecycleStage.PRODUCTION, replaced.getLifecycleStage());
    assertEquals("Replacement", replaced.getDisplayName());
    assertEquals(CreateDataProduct.DataProductType.REPORTS, replaced.getDataProductType());
  }

  @Test
  void smartMergeAndFullReplace_handleNullArgumentsGracefully() {
    DataProduct dp = basicDataProduct();
    assertEquals(dp, ODPSConverter.smartMerge(null, dp));
    assertEquals(dp, ODPSConverter.smartMerge(dp, null));
    assertEquals(dp, ODPSConverter.fullReplace(null, dp));
    assertEquals(dp, ODPSConverter.fullReplace(dp, null));
  }

  @Test
  void fromODPS_doesNotPropagateOdpsStatusToLifecycleStage() {
    ODPSDataProduct odps = basicODPS();
    ODPSProductDetails details = odps.getProduct().getDetails().getAdditionalProperties().get("en");
    details.setStatus(ODPSProductDetails.OdpsStatus.PRODUCTION);

    DataProduct dp = ODPSConverter.fromODPS(odps);

    assertNotEquals(
        DataProduct.LifecycleStage.PRODUCTION,
        dp.getLifecycleStage(),
        "lifecycleStage must not be set to imported ODPS status — it is workflow-driven");
  }

  // ---------------------------------------------------------------------------
  // fullReplace: governance fields must be preserved
  // ODPS has no representation for owners/experts/reviewers, so a replace
  // import must never silently wipe them.
  // ---------------------------------------------------------------------------

  @Test
  void fullReplace_preservesOwnersExpertsAndReviewers() {
    DataProduct existing = basicDataProduct();
    EntityReference owner =
        new EntityReference().withId(UUID.randomUUID()).withType("user").withName("alice");
    EntityReference expert =
        new EntityReference().withId(UUID.randomUUID()).withType("user").withName("bob");
    EntityReference reviewer =
        new EntityReference().withId(UUID.randomUUID()).withType("user").withName("carol");
    existing.setOwners(List.of(owner));
    existing.setExperts(List.of(expert));
    existing.setReviewers(List.of(reviewer));

    DataProduct imported = new DataProduct();
    imported.setDisplayName("Replaced");

    DataProduct replaced = ODPSConverter.fullReplace(existing, imported);

    assertEquals(List.of(owner), replaced.getOwners(), "owners must be preserved across replace");
    assertEquals(
        List.of(expert), replaced.getExperts(), "experts must be preserved across replace");
    assertEquals(
        List.of(reviewer), replaced.getReviewers(), "reviewers must be preserved across replace");
  }

  // ---------------------------------------------------------------------------
  // Name sanitization
  // OM entity names must be URL/FQN-safe. ODPS product names can contain
  // spaces, slashes, ampersands, and exceed 64 chars — fromODPS must
  // sanitize the name while preserving the original as displayName.
  // ---------------------------------------------------------------------------

  @Test
  void fromODPS_sanitizesNameWithSpacesAndSpecialChars() {
    ODPSDataProduct odps = basicODPS();
    odps.getProduct()
        .getDetails()
        .getAdditionalProperties()
        .get("en")
        .setName("Sales & Analytics / Q1 (2026)");

    DataProduct dp = ODPSConverter.fromODPS(odps);

    assertFalse(dp.getName().contains(" "), "name must not contain spaces: " + dp.getName());
    assertFalse(dp.getName().contains("&"), "name must not contain &: " + dp.getName());
    assertFalse(dp.getName().contains("/"), "name must not contain /: " + dp.getName());
    assertFalse(dp.getName().contains("("), "name must not contain (: " + dp.getName());
    assertEquals(
        "Sales & Analytics / Q1 (2026)",
        dp.getDisplayName(),
        "displayName must preserve the raw ODPS product name");
  }

  @Test
  void fromODPS_truncatesNameExceeding64Chars() {
    String longName = "a".repeat(100);
    ODPSDataProduct odps = basicODPS();
    odps.getProduct().getDetails().getAdditionalProperties().get("en").setName(longName);

    DataProduct dp = ODPSConverter.fromODPS(odps);

    assertTrue(
        dp.getName().length() <= 64,
        "name must be truncated to 64 chars, got " + dp.getName().length());
    assertEquals(longName, dp.getDisplayName(), "displayName must preserve the full original name");
  }

  @Test
  void fromODPS_collapsesConsecutiveUnderscores() {
    ODPSDataProduct odps = basicODPS();
    odps.getProduct().getDetails().getAdditionalProperties().get("en").setName("Sales   Analytics");

    DataProduct dp = ODPSConverter.fromODPS(odps);

    assertFalse(
        dp.getName().contains("__"), "consecutive underscores must be collapsed: " + dp.getName());
  }

  @Test
  void fromODPS_trimsLeadingAndTrailingUnderscores() {
    ODPSDataProduct odps = basicODPS();
    odps.getProduct().getDetails().getAdditionalProperties().get("en").setName("  Sales  ");

    DataProduct dp = ODPSConverter.fromODPS(odps);

    assertFalse(
        dp.getName().startsWith("_"), "leading underscore must be trimmed: " + dp.getName());
    assertFalse(dp.getName().endsWith("_"), "trailing underscore must be trimmed: " + dp.getName());
  }

  @Test
  void fromODPS_leavesAlreadyValidNameUnchanged() {
    ODPSDataProduct odps = basicODPS();
    odps.getProduct().getDetails().getAdditionalProperties().get("en").setName("sales-analytics");

    DataProduct dp = ODPSConverter.fromODPS(odps);

    assertEquals("sales-analytics", dp.getName());
    assertEquals("sales-analytics", dp.getDisplayName());
  }

  @Test
  void fromODPS_rejectsNameThatSanitizesToEmptyFromPunctuationOnly() {
    ODPSDataProduct odps = basicODPS();
    odps.getProduct().getDetails().getAdditionalProperties().get("en").setName("///");

    IllegalArgumentException ex =
        assertThrows(IllegalArgumentException.class, () -> ODPSConverter.fromODPS(odps));
    assertTrue(
        ex.getMessage().toLowerCase().contains("name"),
        "Expected error to mention the name field: " + ex.getMessage());
    assertTrue(
        ex.getMessage().contains("///"),
        "Expected error to include the original unsanitizable value: " + ex.getMessage());
  }

  @Test
  void fromODPS_rejectsNameThatSanitizesToEmptyFromWhitespaceOnly() {
    ODPSDataProduct odps = basicODPS();
    odps.getProduct().getDetails().getAdditionalProperties().get("en").setName("   ");

    // Whitespace-only is caught by the validateRequiredODPSFields check (name.isBlank) — but
    // if that guard is ever relaxed, sanitizeEntityName must still refuse to emit an empty
    // name. Covered by the punctuation case and by sanitizeEntityName_throwsOnEmptyResult.
    assertThrows(IllegalArgumentException.class, () -> ODPSConverter.fromODPS(odps));
  }

  @Test
  void fromODPS_rejectsNameThatSanitizesToEmptyFromNonAsciiOnly() {
    ODPSDataProduct odps = basicODPS();
    // CJK-only name has no chars in the [a-zA-Z0-9_\-.] allow-list.
    odps.getProduct().getDetails().getAdditionalProperties().get("en").setName("数据产品");

    IllegalArgumentException ex =
        assertThrows(IllegalArgumentException.class, () -> ODPSConverter.fromODPS(odps));
    assertTrue(
        ex.getMessage().contains("数据产品"),
        "Expected error to include the original unsanitizable value: " + ex.getMessage());
  }

  @Test
  void sanitizeEntityName_returnsNullForNull() {
    assertEquals(null, ODPSConverter.sanitizeEntityName(null));
  }

  @Test
  void sanitizeEntityName_throwsForAllInvalidChars() {
    IllegalArgumentException ex =
        assertThrows(IllegalArgumentException.class, () -> ODPSConverter.sanitizeEntityName("///"));
    assertTrue(ex.getMessage().contains("///"));
  }

  // ---------------------------------------------------------------------------
  // Enum round-trip — guards against silent misses if entity/create enums
  // diverge or new values are added without updating the converter.
  // ---------------------------------------------------------------------------

  @Test
  void roundTrip_everyDataProductTypeValue() {
    for (CreateDataProduct.DataProductType value : CreateDataProduct.DataProductType.values()) {
      DataProduct original = basicDataProduct();
      original.setDataProductType(value);

      DataProduct reimported = ODPSConverter.fromODPS(ODPSConverter.toODPS(original));

      assertEquals(
          value,
          reimported.getDataProductType(),
          "DataProductType." + value + " must round-trip cleanly");
    }
  }

  @Test
  void roundTrip_everyVisibilityValue() {
    for (CreateDataProduct.Visibility value : CreateDataProduct.Visibility.values()) {
      DataProduct original = basicDataProduct();
      original.setVisibility(value);

      DataProduct reimported = ODPSConverter.fromODPS(ODPSConverter.toODPS(original));

      assertEquals(
          value, reimported.getVisibility(), "Visibility." + value + " must round-trip cleanly");
    }
  }

  @Test
  void roundTrip_everyPortfolioPriorityValue() {
    for (CreateDataProduct.PortfolioPriority value : CreateDataProduct.PortfolioPriority.values()) {
      DataProduct original = basicDataProduct();
      original.setPortfolioPriority(value);

      DataProduct reimported = ODPSConverter.fromODPS(ODPSConverter.toODPS(original));

      assertEquals(
          value,
          reimported.getPortfolioPriority(),
          "PortfolioPriority." + value + " must round-trip cleanly");
    }
  }

  @Test
  void dataProductGetterReturnsSameEnumClassTheConverterAccepts() {
    // Guards against future schema refactors that accidentally split the
    // entity-side and create-side enums. If DataProduct.getDataProductType()
    // ever returns a different class than the one toODPSType accepts, this
    // test breaks at compile time (assignability) and signals that the
    // converter must be updated to use the entity-level enum.
    DataProduct dp = new DataProduct();
    dp.setDataProductType(CreateDataProduct.DataProductType.DATASET);
    CreateDataProduct.DataProductType fromEntity = dp.getDataProductType();
    assertSame(CreateDataProduct.DataProductType.DATASET, fromEntity);
  }

  // ---------------------------------------------------------------------------
  // Fixtures
  // ---------------------------------------------------------------------------

  private static DataProduct basicDataProduct() {
    DataProduct dp = new DataProduct();
    dp.setId(UUID.randomUUID());
    dp.setName("sales-analytics");
    dp.setDisplayName("Sales Analytics");
    dp.setFullyQualifiedName("marketing.sales-analytics");
    dp.setDescription("Description here");
    dp.setDataProductType(CreateDataProduct.DataProductType.DATASET);
    dp.setVisibility(CreateDataProduct.Visibility.ORGANISATION);
    dp.setPortfolioPriority(CreateDataProduct.PortfolioPriority.MEDIUM);
    return dp;
  }

  private static ODPSDataProduct basicODPS() {
    ODPSDataProduct odps = new ODPSDataProduct();
    odps.setVersion(ODPSDataProduct.OdpsApiVersion._4_1);

    ODPSProduct product = new ODPSProduct();
    Details details = new Details();
    ODPSProductDetails pd = new ODPSProductDetails();
    pd.setName("sales-analytics");
    pd.setProductID("marketing.sales-analytics");
    pd.setDescription("Description here");
    pd.setType(ODPSProductDetails.OdpsType.DATASET);
    pd.setVisibility(ODPSProductDetails.OdpsVisibility.ORGANISATION);
    pd.setTags(List.of("sales", "analytics"));
    details.setAdditionalProperty("en", pd);
    product.setDetails(details);
    odps.setProduct(product);
    return odps;
  }
}
