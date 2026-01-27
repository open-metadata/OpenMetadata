package org.openmetadata.sdk.fluent;

import java.util.*;
import java.util.UUID;
import org.openmetadata.schema.api.data.ContractSLA;
import org.openmetadata.schema.api.data.CreateDataContract;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.datacontract.DataContractResult;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ContractExecutionStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.SemanticsRule;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Fluent API for DataContract operations.
 *
 * <p>Usage:
 *
 * <pre>
 * import static org.openmetadata.sdk.fluent.DataContracts.*;
 *
 * // Create a data contract
 * DataContract contract = create()
 *     .name("my-contract")
 *     .forEntity(tableReference)
 *     .withDescription("Data contract for sales data")
 *     .withStatus(EntityStatus.APPROVED)
 *     .execute();
 *
 * // Find and load
 * DataContract contract = find(contractId)
 *     .includeReviewers()
 *     .fetch();
 *
 * // Add a result
 * DataContractResult result = forContract(contractId)
 *     .addResult()
 *     .status(ContractExecutionStatus.Success)
 *     .withMessage("All validations passed")
 *     .execute();
 *
 * // Validate
 * DataContractResult result = forContract(contractId)
 *     .validate();
 * </pre>
 */
public final class DataContracts {
  private static OpenMetadataClient defaultClient;

  private DataContracts() {} // Prevent instantiation

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException(
          "Client not initialized. Call DataContracts.setDefaultClient() first.");
    }
    return defaultClient;
  }

  // ==================== Creation ====================

  public static DataContractCreator create() {
    return new DataContractCreator(getClient());
  }

  public static DataContract create(CreateDataContract request) {
    return getClient().dataContracts().create(request);
  }

  // ==================== Finding/Retrieval ====================

  public static DataContractFinder find(String id) {
    return new DataContractFinder(getClient(), id);
  }

  public static DataContractFinder find(UUID id) {
    return find(id.toString());
  }

  public static DataContractFinder findByName(String fqn) {
    return new DataContractFinder(getClient(), fqn, true);
  }

  public static DataContractFinder findByEntity(UUID entityId, String entityType) {
    return new DataContractFinder(getClient(), entityId, entityType);
  }

  // ==================== Contract Operations ====================

  public static ContractOperations forContract(String id) {
    return new ContractOperations(getClient(), id);
  }

  public static ContractOperations forContract(UUID id) {
    return forContract(id.toString());
  }

  // ==================== Listing ====================

  public static DataContractLister list() {
    return new DataContractLister(getClient());
  }

  // ==================== Creator ====================

  public static class DataContractCreator {
    private final OpenMetadataClient client;
    private final CreateDataContract request = new CreateDataContract();

    DataContractCreator(OpenMetadataClient client) {
      this.client = client;
    }

    public DataContractCreator name(String name) {
      request.setName(name);
      return this;
    }

    public DataContractCreator forEntity(EntityReference entity) {
      request.setEntity(entity);
      return this;
    }

    public DataContractCreator withDescription(String description) {
      request.setDescription(description);
      return this;
    }

    public DataContractCreator withDisplayName(String displayName) {
      request.setDisplayName(displayName);
      return this;
    }

    public DataContractCreator withStatus(EntityStatus status) {
      request.setEntityStatus(status);
      return this;
    }

    public DataContractCreator withSemantics(List<SemanticsRule> rules) {
      request.setSemantics(rules);
      return this;
    }

    public DataContractCreator withSemanticRule(SemanticsRule rule) {
      if (request.getSemantics() == null) {
        request.setSemantics(new ArrayList<>());
      }
      request.getSemantics().add(rule);
      return this;
    }

    public DataContractCreator withSchema(List<Column> columns) {
      request.setSchema(columns);
      return this;
    }

    public DataContractCreator withSla(ContractSLA sla) {
      request.setSla(sla);
      return this;
    }

    public DataContractCreator withReviewers(List<EntityReference> reviewers) {
      request.setReviewers(reviewers);
      return this;
    }

    public DataContractCreator withOwners(List<EntityReference> owners) {
      request.setOwners(owners);
      return this;
    }

    public DataContract execute() {
      return client.dataContracts().create(request);
    }

    public DataContract now() {
      return execute();
    }

    public DataContract createOrUpdate() {
      return client.dataContracts().createOrUpdate(request);
    }
  }

  // ==================== Finder ====================

  public static class DataContractFinder {
    private final OpenMetadataClient client;
    private final String identifier;
    private final boolean isFqn;
    private final boolean isByEntity;
    private final String entityType;
    private final Set<String> includes = new HashSet<>();

    DataContractFinder(OpenMetadataClient client, String identifier) {
      this(client, identifier, false);
    }

    DataContractFinder(OpenMetadataClient client, String identifier, boolean isFqn) {
      this.client = client;
      this.identifier = identifier;
      this.isFqn = isFqn;
      this.isByEntity = false;
      this.entityType = null;
    }

    DataContractFinder(OpenMetadataClient client, UUID entityId, String entityType) {
      this.client = client;
      this.identifier = entityId.toString();
      this.isFqn = false;
      this.isByEntity = true;
      this.entityType = entityType;
    }

    public DataContractFinder includeReviewers() {
      includes.add("reviewers");
      return this;
    }

    public DataContractFinder includeOwners() {
      includes.add("owners");
      return this;
    }

    public DataContractFinder includeAll() {
      includes.addAll(Arrays.asList("reviewers", "owners", "latestResult"));
      return this;
    }

    public FluentDataContract fetch() {
      DataContract contract;
      String fields = includes.isEmpty() ? null : String.join(",", includes);

      if (isByEntity) {
        contract =
            fields != null
                ? client
                    .dataContracts()
                    .getByEntityId(UUID.fromString(identifier), entityType, fields)
                : client.dataContracts().getByEntityId(UUID.fromString(identifier), entityType);
      } else if (isFqn) {
        contract =
            fields != null
                ? client.dataContracts().getByName(identifier, fields)
                : client.dataContracts().getByName(identifier);
      } else {
        contract =
            fields != null
                ? client.dataContracts().get(identifier, fields)
                : client.dataContracts().get(identifier);
      }
      return new FluentDataContract(contract, client);
    }

    public DataContractDeleter delete() {
      return new DataContractDeleter(client, identifier);
    }
  }

  // ==================== Contract Operations ====================

  public static class ContractOperations {
    private final OpenMetadataClient client;
    private final String contractId;
    private String contractFqn; // Cached FQN

    ContractOperations(OpenMetadataClient client, String contractId) {
      this.client = client;
      this.contractId = contractId;
    }

    private String getContractFqn() {
      if (contractFqn == null) {
        DataContract contract = client.dataContracts().get(contractId);
        contractFqn = contract.getFullyQualifiedName();
      }
      return contractFqn;
    }

    public DataContractResult validate() {
      return client.dataContracts().validate(UUID.fromString(contractId));
    }

    public DataContractResult getLatestResult() {
      return client.dataContracts().getLatestResult(UUID.fromString(contractId));
    }

    public ResultBuilder addResult() {
      return new ResultBuilder(client, contractId, getContractFqn());
    }

    public void deleteResult(Long timestamp) {
      client.dataContracts().deleteResult(UUID.fromString(contractId), timestamp);
    }

    public void deleteResultsBefore(Long timestamp) {
      client.dataContracts().deleteResultsBefore(UUID.fromString(contractId), timestamp);
    }
  }

  // ==================== Result Builder ====================

  public static class ResultBuilder {
    private final OpenMetadataClient client;
    private final String contractId;
    private final DataContractResult result = new DataContractResult();

    ResultBuilder(OpenMetadataClient client, String contractId) {
      this(client, contractId, null);
    }

    ResultBuilder(OpenMetadataClient client, String contractId, String contractFqn) {
      this.client = client;
      this.contractId = contractId;
      result.setTimestamp(System.currentTimeMillis());
      if (contractFqn != null) {
        result.setDataContractFQN(contractFqn);
      }
    }

    public ResultBuilder status(ContractExecutionStatus status) {
      result.setContractExecutionStatus(status);
      return this;
    }

    public ResultBuilder success() {
      result.setContractExecutionStatus(ContractExecutionStatus.Success);
      return this;
    }

    public ResultBuilder failed() {
      result.setContractExecutionStatus(ContractExecutionStatus.Failed);
      return this;
    }

    public ResultBuilder running() {
      result.setContractExecutionStatus(ContractExecutionStatus.Running);
      return this;
    }

    public ResultBuilder aborted() {
      result.setContractExecutionStatus(ContractExecutionStatus.Aborted);
      return this;
    }

    public ResultBuilder withMessage(String message) {
      result.setResult(message);
      return this;
    }

    public ResultBuilder withTimestamp(Long timestamp) {
      result.setTimestamp(timestamp);
      return this;
    }

    public ResultBuilder withExecutionTime(Long millis) {
      result.setExecutionTime(millis);
      return this;
    }

    public ResultBuilder withContractFqn(String fqn) {
      result.setDataContractFQN(fqn);
      return this;
    }

    public DataContractResult execute() {
      return client.dataContracts().addResult(UUID.fromString(contractId), result);
    }
  }

  // ==================== Deleter ====================

  public static class DataContractDeleter {
    private final OpenMetadataClient client;
    private final String id;
    private boolean hardDelete = false;

    DataContractDeleter(OpenMetadataClient client, String id) {
      this.client = client;
      this.id = id;
    }

    public DataContractDeleter permanently() {
      this.hardDelete = true;
      return this;
    }

    public void confirm() {
      if (!hardDelete) {
        client.dataContracts().delete(id);
      } else {
        Map<String, String> params = new HashMap<>();
        params.put("hardDelete", "true");
        client.dataContracts().delete(id, params);
      }
    }
  }

  // ==================== Lister ====================

  public static class DataContractLister {
    private final OpenMetadataClient client;
    private final Map<String, String> filters = new HashMap<>();
    private Integer limit;
    private String after;

    DataContractLister(OpenMetadataClient client) {
      this.client = client;
    }

    public DataContractLister limit(int limit) {
      this.limit = limit;
      return this;
    }

    public DataContractLister after(String cursor) {
      this.after = cursor;
      return this;
    }

    public List<FluentDataContract> fetch() {
      var params = new org.openmetadata.sdk.models.ListParams();
      if (limit != null) params.setLimit(limit);
      if (after != null) params.setAfter(after);
      filters.forEach(params::addFilter);

      var response = client.dataContracts().list(params);
      List<FluentDataContract> items = new ArrayList<>();
      for (DataContract item : response.getData()) {
        items.add(new FluentDataContract(item, client));
      }
      return items;
    }

    public void forEach(java.util.function.Consumer<FluentDataContract> action) {
      fetch().forEach(action);
    }
  }

  // ==================== Fluent Entity ====================

  public static class FluentDataContract {
    private final DataContract contract;
    private final OpenMetadataClient client;
    private boolean modified = false;

    public FluentDataContract(DataContract contract, OpenMetadataClient client) {
      this.contract = contract;
      this.client = client;
    }

    public DataContract get() {
      return contract;
    }

    public UUID getId() {
      return contract.getId();
    }

    public String getFqn() {
      return contract.getFullyQualifiedName();
    }

    public FluentDataContract withDescription(String description) {
      contract.setDescription(description);
      modified = true;
      return this;
    }

    public FluentDataContract withDisplayName(String displayName) {
      contract.setDisplayName(displayName);
      modified = true;
      return this;
    }

    public FluentDataContract withStatus(EntityStatus status) {
      contract.setEntityStatus(status);
      modified = true;
      return this;
    }

    public FluentDataContract withSemantics(List<SemanticsRule> rules) {
      contract.setSemantics(rules);
      modified = true;
      return this;
    }

    public FluentDataContract withSchema(List<Column> columns) {
      contract.setSchema(columns);
      modified = true;
      return this;
    }

    public FluentDataContract withSla(ContractSLA sla) {
      contract.setSla(sla);
      modified = true;
      return this;
    }

    public FluentDataContract save() {
      if (modified) {
        DataContract updated = client.dataContracts().update(contract.getId().toString(), contract);
        contract.setVersion(updated.getVersion());
        modified = false;
      }
      return this;
    }

    public DataContractResult validate() {
      return client.dataContracts().validate(contract.getId());
    }

    public ResultBuilder addResult() {
      return new ResultBuilder(client, contract.getId().toString())
          .withContractFqn(contract.getFullyQualifiedName());
    }

    public DataContractResult getLatestResult() {
      return client.dataContracts().getLatestResult(contract.getId());
    }

    public DataContractDeleter delete() {
      return new DataContractDeleter(client, contract.getId().toString());
    }
  }
}
