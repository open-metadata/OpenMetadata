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

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.SlaDefinition;
import org.openmetadata.schema.entity.domains.odps.Details;
import org.openmetadata.schema.entity.domains.odps.ODPSDataProduct;
import org.openmetadata.schema.entity.domains.odps.ODPSProduct;
import org.openmetadata.schema.entity.domains.odps.ODPSProductDetails;
import org.openmetadata.schema.entity.domains.odps.ODPSSLA;
import org.openmetadata.schema.entity.domains.odps.ODPSSLADimension;
import org.openmetadata.schema.type.TagLabel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Utility class for converting between OpenMetadata DataProduct and ODPS (Open Data Product
 * Standard) v4.1 format. Mirrors the design of ODCSConverter.
 *
 * <p>Governance-workflow-driven fields (entityStatus, lifecycleStage) are exported but NOT
 * overwritten on import — these must transition through the governance workflow.
 */
public final class ODPSConverter {

  private static final Logger LOG = LoggerFactory.getLogger(ODPSConverter.class);
  private static final ObjectMapper MAPPER = new ObjectMapper();

  public static final String DEFAULT_LANGUAGE = "en";
  public static final String DEFAULT_SCHEMA_URL =
      "https://opendataproducts.org/v4.1/schema/odps.json";
  public static final String ODPS_EXTENSION_KEY = "odpsMetadata";

  private ODPSConverter() {}

  // -------------------------------------------------------------------------
  // Export: OpenMetadata → ODPS
  // -------------------------------------------------------------------------

  public static ODPSDataProduct toODPS(DataProduct dataProduct) {
    if (dataProduct == null) {
      throw new IllegalArgumentException("DataProduct cannot be null");
    }

    ODPSDataProduct odps = new ODPSDataProduct();
    odps.setSchema(DEFAULT_SCHEMA_URL);
    odps.setVersion(ODPSDataProduct.OdpsApiVersion._4_1);
    odps.setProduct(buildODPSProduct(dataProduct));
    return odps;
  }

  private static ODPSProduct buildODPSProduct(DataProduct dp) {
    ODPSProduct product = new ODPSProduct();
    Details details = new Details();
    details.setAdditionalProperty(DEFAULT_LANGUAGE, buildProductDetails(dp));
    product.setDetails(details);

    if (dp.getSla() != null) {
      product.setSla(buildODPSSla(dp.getSla()));
    }
    return product;
  }

  private static ODPSProductDetails buildProductDetails(DataProduct dp) {
    ODPSProductDetails details = new ODPSProductDetails();
    details.setName(dp.getDisplayName() != null ? dp.getDisplayName() : dp.getName());
    details.setProductID(
        dp.getFullyQualifiedName() != null
            ? dp.getFullyQualifiedName()
            : (dp.getId() != null ? dp.getId().toString() : dp.getName()));
    details.setDescription(dp.getDescription());

    details.setType(toODPSType(dp.getDataProductType()));
    details.setVisibility(toODPSVisibility(dp.getVisibility()));
    details.setStatus(toODPSStatus(dp.getLifecycleStage()));
    details.setPortfolioPriority(toODPSPortfolioPriority(dp.getPortfolioPriority()));

    if (dp.getTags() != null && !dp.getTags().isEmpty()) {
      details.setTags(extractTagNames(dp.getTags()));
    }

    if (dp.getUpdatedAt() != null) {
      details.setUpdated(new Date(dp.getUpdatedAt()));
    }
    return details;
  }

  private static ODPSSLA buildODPSSla(SlaDefinition omSla) {
    ODPSSLA sla = new ODPSSLA();
    List<ODPSSLADimension> dims = new ArrayList<>();
    if (omSla.getAvailability() != null) {
      dims.add(newSlaDim("uptime", omSla.getAvailability(), "%"));
    }
    if (omSla.getResponseTime() != null) {
      dims.add(newSlaDim("responseTime", omSla.getResponseTime().doubleValue(), "ms"));
    }
    if (omSla.getDataFreshness() != null) {
      dims.add(newSlaDim("updateFrequency", omSla.getDataFreshness().doubleValue(), "minutes"));
    }
    if (!dims.isEmpty()) {
      sla.setDeclarative(dims);
    }
    return sla;
  }

  private static ODPSSLADimension newSlaDim(String dimension, Double objective, String unit) {
    ODPSSLADimension d = new ODPSSLADimension();
    d.setDimension(dimension);
    d.setObjective(objective);
    d.setUnit(unit);
    return d;
  }

  private static List<String> extractTagNames(List<TagLabel> tags) {
    List<String> names = new ArrayList<>();
    for (TagLabel t : tags) {
      if (t.getTagFQN() != null) {
        names.add(t.getTagFQN());
      }
    }
    return names;
  }

  // -------------------------------------------------------------------------
  // Import: ODPS → OpenMetadata
  // -------------------------------------------------------------------------

  public static DataProduct fromODPS(ODPSDataProduct odps) {
    return fromODPS(odps, DEFAULT_LANGUAGE);
  }

  public static DataProduct fromODPS(ODPSDataProduct odps, String languageCode) {
    validateRequiredODPSFields(odps);

    ODPSProductDetails details = selectDetails(odps.getProduct(), languageCode);
    if (details == null) {
      throw new IllegalArgumentException(
          "ODPS product.details is missing or empty — cannot derive product metadata");
    }

    DataProduct dp = new DataProduct();
    dp.setName(details.getName());
    dp.setDisplayName(details.getName());
    dp.setDescription(buildDescription(details));
    dp.setDataProductType(fromODPSType(details.getType()));
    dp.setVisibility(fromODPSVisibility(details.getVisibility()));
    dp.setPortfolioPriority(fromODPSPortfolioPriority(details.getPortfolioPriority()));

    if (details.getTags() != null && !details.getTags().isEmpty()) {
      dp.setTags(wrapTagsAsLabels(details.getTags()));
    }

    if (odps.getProduct() != null && odps.getProduct().getSla() != null) {
      dp.setSla(fromODPSSla(odps.getProduct().getSla()));
    }

    dp.setExtension(preserveOdpsMetadata(odps));
    return dp;
  }

  private static ODPSProductDetails selectDetails(ODPSProduct product, String languageCode) {
    if (product == null || product.getDetails() == null) {
      return null;
    }
    Map<String, ODPSProductDetails> details = product.getDetails().getAdditionalProperties();
    if (details == null || details.isEmpty()) {
      return null;
    }
    String effectiveLang = languageCode != null ? languageCode : DEFAULT_LANGUAGE;
    if (details.containsKey(effectiveLang)) {
      return details.get(effectiveLang);
    }
    if (details.containsKey(DEFAULT_LANGUAGE)) {
      return details.get(DEFAULT_LANGUAGE);
    }
    return details.values().iterator().next();
  }

  private static String buildDescription(ODPSProductDetails details) {
    if (details.getDescription() != null && !details.getDescription().isBlank()) {
      return details.getDescription();
    }
    return details.getValueProposition();
  }

  private static List<TagLabel> wrapTagsAsLabels(List<String> names) {
    List<TagLabel> labels = new ArrayList<>();
    for (String name : names) {
      TagLabel label = new TagLabel();
      label.setTagFQN(name);
      label.setSource(TagLabel.TagSource.CLASSIFICATION);
      label.setLabelType(TagLabel.LabelType.MANUAL);
      label.setState(TagLabel.State.CONFIRMED);
      labels.add(label);
    }
    return labels;
  }

  private static SlaDefinition fromODPSSla(ODPSSLA odpsSla) {
    if (odpsSla == null || odpsSla.getDeclarative() == null) return null;
    SlaDefinition sla = new SlaDefinition();
    for (ODPSSLADimension dim : odpsSla.getDeclarative()) {
      if (dim.getDimension() == null || dim.getObjective() == null) continue;
      switch (dim.getDimension()) {
        case "uptime", "availability" -> sla.setAvailability(dim.getObjective());
        case "responseTime" -> sla.setResponseTime(dim.getObjective().intValue());
        case "updateFrequency" -> sla.setDataFreshness(dim.getObjective().intValue());
        default -> LOG.debug("Unmapped ODPS SLA dimension: {}", dim.getDimension());
      }
    }
    return sla;
  }

  @SuppressWarnings("unchecked")
  private static Object preserveOdpsMetadata(ODPSDataProduct odps) {
    Map<String, Object> extension = new LinkedHashMap<>();
    extension.put(ODPS_EXTENSION_KEY, MAPPER.convertValue(odps, Map.class));
    return extension;
  }

  // -------------------------------------------------------------------------
  // Merge strategies
  // -------------------------------------------------------------------------

  public static DataProduct smartMerge(DataProduct existing, DataProduct imported) {
    if (existing == null) return imported;
    if (imported == null) return existing;

    DataProduct merged = new DataProduct();
    merged.setId(existing.getId());
    merged.setName(existing.getName());
    merged.setFullyQualifiedName(existing.getFullyQualifiedName());
    merged.setVersion(existing.getVersion());
    merged.setUpdatedAt(existing.getUpdatedAt());
    merged.setUpdatedBy(existing.getUpdatedBy());
    merged.setOwners(existing.getOwners());
    merged.setExperts(existing.getExperts());
    merged.setReviewers(existing.getReviewers());
    merged.setDomains(existing.getDomains());
    merged.setLifecycleStage(existing.getLifecycleStage());
    merged.setEntityStatus(existing.getEntityStatus());
    merged.setCertification(existing.getCertification());

    merged.setDisplayName(preferImported(imported.getDisplayName(), existing.getDisplayName()));
    merged.setDescription(preferImported(imported.getDescription(), existing.getDescription()));
    merged.setDataProductType(
        preferImported(imported.getDataProductType(), existing.getDataProductType()));
    merged.setVisibility(preferImported(imported.getVisibility(), existing.getVisibility()));
    merged.setPortfolioPriority(
        preferImported(imported.getPortfolioPriority(), existing.getPortfolioPriority()));
    merged.setSla(imported.getSla() != null ? imported.getSla() : existing.getSla());
    merged.setTags(
        imported.getTags() != null && !imported.getTags().isEmpty()
            ? imported.getTags()
            : existing.getTags());
    merged.setExtension(
        imported.getExtension() != null ? imported.getExtension() : existing.getExtension());
    return merged;
  }

  public static DataProduct fullReplace(DataProduct existing, DataProduct imported) {
    if (existing == null) return imported;
    if (imported == null) return existing;

    DataProduct replaced = new DataProduct();
    replaced.setId(existing.getId());
    replaced.setName(existing.getName());
    replaced.setFullyQualifiedName(existing.getFullyQualifiedName());
    replaced.setVersion(existing.getVersion());
    replaced.setUpdatedAt(existing.getUpdatedAt());
    replaced.setUpdatedBy(existing.getUpdatedBy());
    replaced.setDomains(existing.getDomains());
    replaced.setLifecycleStage(existing.getLifecycleStage());
    replaced.setEntityStatus(existing.getEntityStatus());
    replaced.setCertification(existing.getCertification());

    replaced.setDisplayName(imported.getDisplayName());
    replaced.setDescription(imported.getDescription());
    replaced.setDataProductType(imported.getDataProductType());
    replaced.setVisibility(imported.getVisibility());
    replaced.setPortfolioPriority(imported.getPortfolioPriority());
    replaced.setSla(imported.getSla());
    replaced.setTags(imported.getTags());
    replaced.setExtension(imported.getExtension());
    return replaced;
  }

  private static <T> T preferImported(T imported, T existing) {
    return imported != null ? imported : existing;
  }

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  public static void validateRequiredODPSFields(ODPSDataProduct odps) {
    if (odps == null) {
      throw new IllegalArgumentException("ODPS document cannot be null");
    }
    List<String> missing = new ArrayList<>();
    if (odps.getVersion() == null) missing.add("version");
    if (odps.getProduct() == null) missing.add("product");
    else if (odps.getProduct().getDetails() == null
        || odps.getProduct().getDetails().getAdditionalProperties() == null
        || odps.getProduct().getDetails().getAdditionalProperties().isEmpty()) {
      missing.add("product.details");
    }
    if (!missing.isEmpty()) {
      throw new IllegalArgumentException(
          "Missing required ODPS fields: " + String.join(", ", missing));
    }
    ODPSProductDetails details =
        odps.getProduct().getDetails().getAdditionalProperties().values().iterator().next();
    List<String> detailMissing = new ArrayList<>();
    if (details.getName() == null || details.getName().isBlank()) detailMissing.add("name");
    if (details.getProductID() == null || details.getProductID().isBlank()) {
      detailMissing.add("productID");
    }
    if (!detailMissing.isEmpty()) {
      throw new IllegalArgumentException(
          "Missing required ODPS product.details fields: " + String.join(", ", detailMissing));
    }
  }

  // -------------------------------------------------------------------------
  // Enum mapping — OM ↔ ODPS
  // -------------------------------------------------------------------------

  private static ODPSProductDetails.OdpsType toODPSType(CreateDataProduct.DataProductType t) {
    if (t == null) return null;
    return switch (t) {
      case RAW_DATA -> ODPSProductDetails.OdpsType.RAW_DATA;
      case DERIVED_DATA -> ODPSProductDetails.OdpsType.DERIVED_DATA;
      case DATASET -> ODPSProductDetails.OdpsType.DATASET;
      case REPORTS -> ODPSProductDetails.OdpsType.REPORTS;
      case ANALYTIC_VIEW -> ODPSProductDetails.OdpsType.ANALYTIC_VIEW;
      case VISUALISATION_3_D -> ODPSProductDetails.OdpsType._3_D_VISUALISATION;
      case ALGORITHM -> ODPSProductDetails.OdpsType.ALGORITHM;
      case DECISION_SUPPORT -> ODPSProductDetails.OdpsType.DECISION_SUPPORT;
      case AUTOMATED_DECISION_MAKING -> ODPSProductDetails.OdpsType.AUTOMATED_DECISION_MAKING;
      case DATA_ENHANCED_PRODUCT -> ODPSProductDetails.OdpsType.DATA_ENHANCED_PRODUCT;
      case DATA_DRIVEN_SERVICE -> ODPSProductDetails.OdpsType.DATA_DRIVEN_SERVICE;
      case DATA_ENABLED_PERFORMANCE -> ODPSProductDetails.OdpsType.DATA_ENABLED_PERFORMANCE;
      case BI_DIRECTIONAL -> ODPSProductDetails.OdpsType.BI_DIRECTIONAL;
    };
  }

  private static CreateDataProduct.DataProductType fromODPSType(ODPSProductDetails.OdpsType t) {
    if (t == null) return null;
    return switch (t) {
      case RAW_DATA -> CreateDataProduct.DataProductType.RAW_DATA;
      case DERIVED_DATA -> CreateDataProduct.DataProductType.DERIVED_DATA;
      case DATASET -> CreateDataProduct.DataProductType.DATASET;
      case REPORTS -> CreateDataProduct.DataProductType.REPORTS;
      case ANALYTIC_VIEW -> CreateDataProduct.DataProductType.ANALYTIC_VIEW;
      case _3_D_VISUALISATION -> CreateDataProduct.DataProductType.VISUALISATION_3_D;
      case ALGORITHM -> CreateDataProduct.DataProductType.ALGORITHM;
      case DECISION_SUPPORT -> CreateDataProduct.DataProductType.DECISION_SUPPORT;
      case AUTOMATED_DECISION_MAKING -> CreateDataProduct.DataProductType.AUTOMATED_DECISION_MAKING;
      case DATA_ENHANCED_PRODUCT -> CreateDataProduct.DataProductType.DATA_ENHANCED_PRODUCT;
      case DATA_DRIVEN_SERVICE -> CreateDataProduct.DataProductType.DATA_DRIVEN_SERVICE;
      case DATA_ENABLED_PERFORMANCE -> CreateDataProduct.DataProductType.DATA_ENABLED_PERFORMANCE;
      case BI_DIRECTIONAL -> CreateDataProduct.DataProductType.BI_DIRECTIONAL;
    };
  }

  private static ODPSProductDetails.OdpsVisibility toODPSVisibility(
      CreateDataProduct.Visibility v) {
    if (v == null) return null;
    return switch (v) {
      case PRIVATE -> ODPSProductDetails.OdpsVisibility.PRIVATE;
      case INVITATION -> ODPSProductDetails.OdpsVisibility.INVITATION;
      case ORGANISATION -> ODPSProductDetails.OdpsVisibility.ORGANISATION;
      case DATASPACE -> ODPSProductDetails.OdpsVisibility.DATASPACE;
      case PUBLIC -> ODPSProductDetails.OdpsVisibility.PUBLIC;
    };
  }

  private static CreateDataProduct.Visibility fromODPSVisibility(
      ODPSProductDetails.OdpsVisibility v) {
    if (v == null) return null;
    return switch (v) {
      case PRIVATE -> CreateDataProduct.Visibility.PRIVATE;
      case INVITATION -> CreateDataProduct.Visibility.INVITATION;
      case ORGANISATION -> CreateDataProduct.Visibility.ORGANISATION;
      case DATASPACE -> CreateDataProduct.Visibility.DATASPACE;
      case PUBLIC -> CreateDataProduct.Visibility.PUBLIC;
    };
  }

  private static ODPSProductDetails.OdpsPortfolioPriority toODPSPortfolioPriority(
      CreateDataProduct.PortfolioPriority p) {
    if (p == null) return null;
    return switch (p) {
      case CRITICAL -> ODPSProductDetails.OdpsPortfolioPriority.CRITICAL;
      case HIGH -> ODPSProductDetails.OdpsPortfolioPriority.HIGH;
      case MEDIUM -> ODPSProductDetails.OdpsPortfolioPriority.MEDIUM;
      case LOW -> ODPSProductDetails.OdpsPortfolioPriority.LOW;
    };
  }

  private static CreateDataProduct.PortfolioPriority fromODPSPortfolioPriority(
      ODPSProductDetails.OdpsPortfolioPriority p) {
    if (p == null) return null;
    return switch (p) {
      case CRITICAL -> CreateDataProduct.PortfolioPriority.CRITICAL;
      case HIGH -> CreateDataProduct.PortfolioPriority.HIGH;
      case MEDIUM -> CreateDataProduct.PortfolioPriority.MEDIUM;
      case LOW -> CreateDataProduct.PortfolioPriority.LOW;
    };
  }

  /**
   * Map OpenMetadata lifecycleStage → ODPS status. lifecycleStage is workflow-driven; we export its
   * current value but the caller must never *write* this via ODPS import.
   */
  private static ODPSProductDetails.OdpsStatus toODPSStatus(DataProduct.LifecycleStage stage) {
    if (stage == null) return null;
    return switch (stage) {
      case IDEATION -> ODPSProductDetails.OdpsStatus.ANNOUNCEMENT;
      case DESIGN -> ODPSProductDetails.OdpsStatus.DRAFT;
      case DEVELOPMENT -> ODPSProductDetails.OdpsStatus.DEVELOPMENT;
      case TESTING -> ODPSProductDetails.OdpsStatus.TESTING;
      case PRODUCTION -> ODPSProductDetails.OdpsStatus.PRODUCTION;
      case DEPRECATED -> ODPSProductDetails.OdpsStatus.SUNSET;
      case RETIRED -> ODPSProductDetails.OdpsStatus.RETIRED;
    };
  }
}
