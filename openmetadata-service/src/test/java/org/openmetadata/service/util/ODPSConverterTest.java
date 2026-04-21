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
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
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
  void fromODPS_preservesOriginalDocumentInExtension() {
    ODPSDataProduct odps = basicODPS();

    DataProduct dp = ODPSConverter.fromODPS(odps);

    assertNotNull(dp.getExtension());
    assertTrue(dp.getExtension().toString().contains("odpsMetadata"));
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
