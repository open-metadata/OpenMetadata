package org.openmetadata.service.datacontract.odcs;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.exception.DataContractImportException;
import jakarta.validation.ConstraintViolationException;

/**
 * Utility class for importing ODCS (Open Data Contract Standard) contracts
 */
@Slf4j
public class ODCSImportUtil {
  
  private ODCSImportUtil() {
    // Private constructor for utility class
  }
  
  /**
   * Import an ODCS contract and convert it to OpenMetadata DataContract
   * 
   * @param odcsContent The ODCS content as string (YAML or JSON)
   * @param format The format of the content ("json" or "yaml")
   * @param entityId The ID of the target entity (table or topic)
   * @return Import response containing the created contract and import report
   */
  public static ODCSImportResponse importContract(String odcsContent, String format, UUID entityId) {
    ODCSImportReport report = new ODCSImportReport();
    
    try {
      // Parse ODCS content
      ODCSContract odcsContract = parseODCSContent(odcsContent, format);
      report.setOdcsVersion(odcsContract.getApiVersion());
      
      // Get the target entity
      EntityReference targetEntity = getTargetEntity(entityId);
      
      // Map ODCS to OpenMetadata DataContract
      ODCSMapper mapper = new ODCSMapper();
      DataContract dataContract = mapper.mapToDataContract(odcsContract, targetEntity);
      
      // Add any mapping errors to the report
      for (String error : mapper.getMappingErrors()) {
        report.addError(error);
      }
      
      // Build import report
      buildImportReport(odcsContract, report);
      
      // Set contract info in report (will be updated after creation)
      report.setContractName(dataContract.getName());
      
      ODCSImportResponse response = new ODCSImportResponse();
      response.setContract(dataContract);
      response.setImportReport(report);
      
      return response;
      
    } catch (DataContractImportException e) {
      // Re-throw import errors directly without wrapping
      throw e;
    } catch (Exception e) {
      report.addError("Import failed: " + e.getMessage());
      throw new DataContractImportException("Failed to import ODCS contract: " + e.getMessage(), e);
    }
  }
  
  /**
   * Parse ODCS content from string
   */
  private static ODCSContract parseODCSContent(String content, String format) {
    try {
      ObjectMapper mapper = format.equalsIgnoreCase("json") 
          ? new ObjectMapper() 
          : new ObjectMapper(new YAMLFactory());
      ODCSContract contract = mapper.readValue(content, ODCSContract.class);
      
      // Manually validate the version since Jackson doesn't trigger bean validation
      if (!contract.getApiVersion().matches("v3\\.0\\.[0-2]")) {
        throw new DataContractImportException(
            "Only ODCS versions v3.0.0, v3.0.1, v3.0.2 are supported. Found: " + contract.getApiVersion());
      }
      
      return contract;
    } catch (DataContractImportException e) {
      // Re-throw import errors as-is
      throw e;
    } catch (Exception e) {
      throw new DataContractImportException("Invalid " + format.toUpperCase() + " content: " + e.getMessage(), e);
    }
  }
  
  /**
   * Get target entity reference for the contract
   */
  private static EntityReference getTargetEntity(UUID entityId) {
    // Try to find as table first
    try {
      Table table = Entity.getEntity(Entity.TABLE, entityId, "", Include.NON_DELETED);
      return table.getEntityReference();
    } catch (EntityNotFoundException e) {
      // Try as topic
      try {
        Topic topic = Entity.getEntity(Entity.TOPIC, entityId, "", Include.NON_DELETED);
        return topic.getEntityReference();
      } catch (EntityNotFoundException ex) {
        throw new DataContractImportException(
            "Entity with id " + entityId + " not found. Must be a table or topic.");
      }
    }
  }
  
  /**
   * Build import report tracking mapped and skipped fields
   */
  private static void buildImportReport(ODCSContract odcsContract, ODCSImportReport report) {
    // Track mapped fields (excluding id which is auto-generated)
    report.addMappedField("name");
    report.addMappedField("version");
    report.addMappedField("status");
    
    if (odcsContract.getDescription() != null) {
      report.addMappedField("description");
    }
    
    if (odcsContract.getSchema() != null && !odcsContract.getSchema().isEmpty()) {
      report.addMappedField("schema");
    }
    
    if (odcsContract.getQuality() != null && !odcsContract.getQuality().isEmpty()) {
      report.addMappedField("quality");
    }
    
    if (odcsContract.getSlaProperties() != null && !odcsContract.getSlaProperties().isEmpty()) {
      report.addMappedField("slaProperties");
    }
    
    if (odcsContract.getTeam() != null && !odcsContract.getTeam().isEmpty()) {
      report.addMappedField("team");
    }
    
    // Track skipped fields with warnings
    if (odcsContract.getServers() != null && !odcsContract.getServers().isEmpty()) {
      report.addSkippedField("servers");
      report.addWarning("Servers field ignored - using provided entityId instead");
    }
    
    if (odcsContract.getPrice() != null) {
      report.addSkippedField("price");
      report.addWarning("Price information stored as custom property");
    }
    
    if (odcsContract.getSupport() != null && !odcsContract.getSupport().isEmpty()) {
      report.addSkippedField("support");
      report.addWarning("Support channels stored as custom property");
    }
    
    if (odcsContract.getRoles() != null && !odcsContract.getRoles().isEmpty()) {
      report.addSkippedField("roles");
      report.addWarning("Access roles stored as custom property - OpenMetadata manages permissions separately");
    }
    
    if (odcsContract.getTenant() != null) {
      report.addSkippedField("tenant");
      report.addWarning("Tenant information stored as custom property");
    }
    
    if (odcsContract.getDomain() != null || odcsContract.getDataProduct() != null) {
      if (odcsContract.getDomain() != null) report.addSkippedField("domain");
      if (odcsContract.getDataProduct() != null) report.addSkippedField("dataProduct");
      report.addWarning("Domain and data product information stored as custom properties");
    }
  }
}