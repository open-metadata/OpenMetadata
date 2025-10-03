#!/usr/bin/env python3
"""Generate pure fluent API classes for all entities."""

import os

template = '''package org.openmetadata.sdk.fluent;

import java.util.*;
import org.openmetadata.schema.api.data.Create{entity};
import org.openmetadata.schema.entity.data.{entity};
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * Pure Fluent API for {entity} operations.
 *
 * Usage:
 * <pre>
 * import static org.openmetadata.sdk.fluent.{plural}.*;
 *
 * // Create
 * {entity} {lower} = create()
 *     .name("{lower}_name")
 *     .withDescription("Description")
 *     .execute();
 *
 * // Find and load
 * {entity} {lower} = find({lower}Id)
 *     .includeOwner()
 *     .includeTags()
 *     .fetch();
 *
 * // Update
 * {entity} updated = find({lower}Id)
 *     .fetch()
 *     .withDescription("Updated description")
 *     .save();
 *
 * // Delete
 * find({lower}Id)
 *     .delete()
 *     .confirm();
 *
 * // List
 * list()
 *     .limit(50)
 *     .forEach({lower} -> process({lower}));
 * </pre>
 */
public final class {plural} {{
  private static OpenMetadataClient defaultClient;

  private {plural}() {{}} // Prevent instantiation

  public static void setDefaultClient(OpenMetadataClient client) {{
    defaultClient = client;
  }}

  private static OpenMetadataClient getClient() {{
    if (defaultClient == null) {{
      throw new IllegalStateException("Client not initialized. Call {plural}.setDefaultClient() first.");
    }}
    return defaultClient;
  }}

  // ==================== Creation ====================

  public static {entity}Creator create() {{
    return new {entity}Creator(getClient());
  }}

  public static {entity} create(Create{entity} request) {{
    return getClient().{service}().create(request);
  }}

  // ==================== Finding/Retrieval ====================

  public static {entity}Finder find(String id) {{
    return new {entity}Finder(getClient(), id);
  }}

  public static {entity}Finder find(UUID id) {{
    return find(id.toString());
  }}

  public static {entity}Finder findByName(String fqn) {{
    return new {entity}Finder(getClient(), fqn, true);
  }}

  // ==================== Listing ====================

  public static {entity}Lister list() {{
    return new {entity}Lister(getClient());
  }}

  // ==================== Creator ====================

  public static class {entity}Creator {{
    private final OpenMetadataClient client;
    private final Create{entity} request = new Create{entity}();

    {entity}Creator(OpenMetadataClient client) {{
      this.client = client;
    }}

    public {entity}Creator name(String name) {{
      request.setName(name);
      return this;
    }}

    public {entity}Creator withDescription(String description) {{
      request.setDescription(description);
      return this;
    }}

    public {entity}Creator withDisplayName(String displayName) {{
      request.setDisplayName(displayName);
      return this;
    }}

    {additionalCreatorMethods}

    public {entity} execute() {{
      return client.{service}().create(request);
    }}

    public {entity} now() {{
      return execute();
    }}
  }}

  // ==================== Finder ====================

  public static class {entity}Finder {{
    private final OpenMetadataClient client;
    private final String identifier;
    private final boolean isFqn;
    private final Set<String> includes = new HashSet<>();

    {entity}Finder(OpenMetadataClient client, String identifier) {{
      this(client, identifier, false);
    }}

    {entity}Finder(OpenMetadataClient client, String identifier, boolean isFqn) {{
      this.client = client;
      this.identifier = identifier;
      this.isFqn = isFqn;
    }}

    public {entity}Finder includeOwner() {{
      includes.add("owner");
      return this;
    }}

    public {entity}Finder includeTags() {{
      includes.add("tags");
      return this;
    }}

    public {entity}Finder includeAll() {{
      includes.addAll(Arrays.asList("owner", "tags", "followers", "domain"));
      return this;
    }}

    public Fluent{entity} fetch() {{
      {entity} {lower};
      if (includes.isEmpty()) {{
        {lower} = isFqn ? client.{service}().getByName(identifier)
                        : client.{service}().get(identifier);
      }} else {{
        String fields = String.join(",", includes);
        {lower} = isFqn ? client.{service}().getByName(identifier, fields)
                        : client.{service}().get(identifier, fields);
      }}
      return new Fluent{entity}({lower}, client);
    }}

    public {entity}Deleter delete() {{
      return new {entity}Deleter(client, identifier);
    }}
  }}

  // ==================== Deleter ====================

  public static class {entity}Deleter {{
    private final OpenMetadataClient client;
    private final String id;
    private boolean recursive = false;
    private boolean hardDelete = false;

    {entity}Deleter(OpenMetadataClient client, String id) {{
      this.client = client;
      this.id = id;
    }}

    public {entity}Deleter recursively() {{
      this.recursive = true;
      return this;
    }}

    public {entity}Deleter permanently() {{
      this.hardDelete = true;
      return this;
    }}

    public void confirm() {{
      Map<String, String> params = new HashMap<>();
      if (recursive) params.put("recursive", "true");
      if (hardDelete) params.put("hardDelete", "true");
      client.{service}().delete(id, params);
    }}
  }}

  // ==================== Lister ====================

  public static class {entity}Lister {{
    private final OpenMetadataClient client;
    private final Map<String, String> filters = new HashMap<>();
    private Integer limit;
    private String after;

    {entity}Lister(OpenMetadataClient client) {{
      this.client = client;
    }}

    public {entity}Lister limit(int limit) {{
      this.limit = limit;
      return this;
    }}

    public {entity}Lister after(String cursor) {{
      this.after = cursor;
      return this;
    }}

    public List<Fluent{entity}> fetch() {{
      var params = new org.openmetadata.sdk.models.ListParams();
      if (limit != null) params.setLimit(limit);
      if (after != null) params.setAfter(after);
      filters.forEach(params::addFilter);

      var response = client.{service}().list(params);
      List<Fluent{entity}> items = new ArrayList<>();
      for ({entity} item : response.getData()) {{
        items.add(new Fluent{entity}(item, client));
      }}
      return items;
    }}

    public void forEach(java.util.function.Consumer<Fluent{entity}> action) {{
      fetch().forEach(action);
    }}
  }}

  // ==================== Fluent Entity ====================

  public static class Fluent{entity} {{
    private final {entity} {lower};
    private final OpenMetadataClient client;
    private boolean modified = false;

    public Fluent{entity}({entity} {lower}, OpenMetadataClient client) {{
      this.{lower} = {lower};
      this.client = client;
    }}

    public {entity} get() {{
      return {lower};
    }}

    public Fluent{entity} withDescription(String description) {{
      {lower}.setDescription(description);
      modified = true;
      return this;
    }}

    public Fluent{entity} withDisplayName(String displayName) {{
      {lower}.setDisplayName(displayName);
      modified = true;
      return this;
    }}

    public Fluent{entity} save() {{
      if (modified) {{
        {entity} updated = client.{service}().update({lower}.getId().toString(), {lower});
        {lower}.setVersion(updated.getVersion());
        modified = false;
      }}
      return this;
    }}

    public {entity}Deleter delete() {{
      return new {entity}Deleter(client, {lower}.getId().toString());
    }}

    {additionalFluentMethods}
  }}
}}
'''

# Entity configurations
entities = {
    "Database": {
        "service": "databases",
        "package": "org.openmetadata.schema.entity.data",
        "additionalCreatorMethods": '''
    public DatabaseCreator in(String service) {
      request.setService(service);
      return this;
    }''',
        "additionalFluentMethods": ""
    },
    "DatabaseSchema": {
        "service": "databaseSchemas",
        "package": "org.openmetadata.schema.entity.data",
        "additionalCreatorMethods": '''
    public DatabaseSchemaCreator in(String database) {
      request.setDatabase(database);
      return this;
    }''',
        "additionalFluentMethods": ""
    },
    "Table": {
        "service": "tables",
        "package": "org.openmetadata.schema.entity.data",
        "additionalCreatorMethods": "",
        "additionalFluentMethods": ""
    },
    "Dashboard": {
        "service": "dashboards",
        "package": "org.openmetadata.schema.entity.data",
        "additionalCreatorMethods": '''
    public DashboardCreator in(String service) {
      request.setService(service);
      return this;
    }

    public DashboardCreator withCharts(String... chartIds) {
      request.setCharts(Arrays.asList(chartIds));
      return this;
    }''',
        "additionalFluentMethods": '''
    public FluentDashboard addChart(String chartId) {
      // Add chart logic
      modified = true;
      return this;
    }'''
    },
    "Chart": {
        "service": "charts",
        "package": "org.openmetadata.schema.entity.data",
        "additionalCreatorMethods": '''
    public ChartCreator in(String service) {
      request.setService(service);
      return this;
    }''',
        "additionalFluentMethods": ""
    },
    "Pipeline": {
        "service": "pipelines",
        "package": "org.openmetadata.schema.entity.data",
        "additionalCreatorMethods": '''
    public PipelineCreator in(String service) {
      request.setService(service);
      return this;
    }''',
        "additionalFluentMethods": ""
    },
    "Topic": {
        "service": "topics",
        "package": "org.openmetadata.schema.entity.data",
        "additionalCreatorMethods": '''
    public TopicCreator in(String service) {
      request.setService(service);
      return this;
    }

    public TopicCreator withPartitions(int partitions) {
      request.setPartitions(partitions);
      return this;
    }

    public TopicCreator withReplicationFactor(int factor) {
      request.setReplicationFactor(factor);
      return this;
    }''',
        "additionalFluentMethods": ""
    },
    "Container": {
        "service": "containers",
        "package": "org.openmetadata.schema.entity.data",
        "additionalCreatorMethods": '''
    public ContainerCreator in(String service) {
      request.setService(service);
      return this;
    }''',
        "additionalFluentMethods": ""
    },
    "MlModel": {
        "service": "mlModels",
        "package": "org.openmetadata.schema.entity.data",
        "additionalCreatorMethods": '''
    public MlModelCreator in(String service) {
      request.setService(service);
      return this;
    }''',
        "additionalFluentMethods": ""
    },
    "SearchIndex": {
        "service": "searchIndexes",
        "package": "org.openmetadata.schema.entity.data",
        "additionalCreatorMethods": '''
    public SearchIndexCreator in(String service) {
      request.setService(service);
      return this;
    }''',
        "additionalFluentMethods": ""
    },
    "StoredProcedure": {
        "service": "storedProcedures",
        "package": "org.openmetadata.schema.entity.data",
        "additionalCreatorMethods": '''
    public StoredProcedureCreator in(String databaseSchema) {
      request.setDatabaseSchema(databaseSchema);
      return this;
    }''',
        "additionalFluentMethods": ""
    },
    "Query": {
        "service": "queries",
        "package": "org.openmetadata.schema.entity.data",
        "additionalCreatorMethods": '''
    public QueryCreator withQuery(String sql) {
      request.setQuery(sql);
      return this;
    }''',
        "additionalFluentMethods": ""
    },
    "User": {
        "service": "users",
        "package": "org.openmetadata.schema.entity.teams",
        "additionalCreatorMethods": '''
    public UserCreator withEmail(String email) {
      request.setEmail(email);
      return this;
    }

    public UserCreator inTeams(UUID... teamIds) {
      request.setTeams(Arrays.asList(teamIds));
      return this;
    }''',
        "additionalFluentMethods": '''
    public FluentUser joinTeam(String teamId) {
      // Add team logic
      modified = true;
      return this;
    }'''
    },
    "Team": {
        "service": "teams",
        "package": "org.openmetadata.schema.entity.teams",
        "additionalCreatorMethods": '''
    public TeamCreator withUsers(UUID... userIds) {
      request.setUsers(Arrays.asList(userIds));
      return this;
    }''',
        "additionalFluentMethods": '''
    public FluentTeam addUser(String userId) {
      // Add user logic
      modified = true;
      return this;
    }'''
    },
    "Role": {
        "service": "roles",
        "package": "org.openmetadata.schema.entity.teams",
        "additionalCreatorMethods": "",
        "additionalFluentMethods": ""
    },
    "Policy": {
        "service": "policies",
        "package": "org.openmetadata.schema.entity.policies",
        "additionalCreatorMethods": "",
        "additionalFluentMethods": ""
    },
    "Glossary": {
        "service": "glossaries",
        "package": "org.openmetadata.schema.entity.data",
        "additionalCreatorMethods": "",
        "additionalFluentMethods": ""
    },
    "GlossaryTerm": {
        "service": "glossaryTerms",
        "package": "org.openmetadata.schema.entity.data",
        "additionalCreatorMethods": '''
    public GlossaryTermCreator in(String glossary) {
      request.setGlossary(glossary);
      return this;
    }''',
        "additionalFluentMethods": ""
    },
    "Classification": {
        "service": "classifications",
        "package": "org.openmetadata.schema.entity.classification",
        "additionalCreatorMethods": "",
        "additionalFluentMethods": ""
    },
    "Tag": {
        "service": "tags",
        "package": "org.openmetadata.schema.entity.classification",
        "additionalCreatorMethods": '''
    public TagCreator in(String classification) {
      request.setClassification(classification);
      return this;
    }''',
        "additionalFluentMethods": ""
    },
    "DataProduct": {
        "service": "dataProducts",
        "package": "org.openmetadata.schema.entity.domains",
        "additionalCreatorMethods": '''
    public DataProductCreator in(String domain) {
      request.setDomain(domain);
      return this;
    }''',
        "additionalFluentMethods": ""
    },
    "Domain": {
        "service": "domains",
        "package": "org.openmetadata.schema.entity.domains",
        "additionalCreatorMethods": "",
        "additionalFluentMethods": ""
    },
    "TestSuite": {
        "service": "testSuites",
        "package": "org.openmetadata.schema.tests",
        "additionalCreatorMethods": "",
        "additionalFluentMethods": ""
    },
    "TestCase": {
        "service": "testCases",
        "package": "org.openmetadata.schema.tests",
        "additionalCreatorMethods": '''
    public TestCaseCreator in(String testSuite) {
      request.setTestSuite(testSuite);
      return this;
    }''',
        "additionalFluentMethods": ""
    },
    "TestDefinition": {
        "service": "testDefinitions",
        "package": "org.openmetadata.schema.tests",
        "additionalCreatorMethods": "",
        "additionalFluentMethods": ""
    },
    "Metric": {
        "service": "metrics",
        "package": "org.openmetadata.schema.entity.data",
        "additionalCreatorMethods": "",
        "additionalFluentMethods": ""
    },
    "DashboardDataModel": {
        "service": "dashboardDataModels",
        "package": "org.openmetadata.schema.entity.data",
        "additionalCreatorMethods": '''
    public DashboardDataModelCreator in(String service) {
      request.setService(service);
      return this;
    }''',
        "additionalFluentMethods": ""
    }
}

# Generate files
output_dir = "openmetadata-sdk/src/main/java/org/openmetadata/sdk/fluent"

for entity, config in entities.items():
    plural = entity + "s" if not entity.endswith("y") else entity[:-1] + "ies"
    lower = entity[0].lower() + entity[1:]

    content = template.format(
        entity=entity,
        plural=plural,
        lower=lower,
        service=config["service"],
        additionalCreatorMethods=config.get("additionalCreatorMethods", ""),
        additionalFluentMethods=config.get("additionalFluentMethods", "")
    )

    # Fix package imports based on entity package
    content = content.replace(
        "org.openmetadata.schema.entity.data." + entity,
        config["package"] + "." + entity
    )
    content = content.replace(
        "org.openmetadata.schema.api.data.Create" + entity,
        config["package"].replace(".entity.", ".api.") + ".Create" + entity
    )

    filename = f"{output_dir}/{plural}.java.new"
    with open(filename, 'w') as f:
        f.write(content)

    print(f"Generated {filename}")

print("\nPure fluent API files generated!")