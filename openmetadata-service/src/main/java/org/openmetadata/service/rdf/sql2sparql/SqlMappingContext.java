package org.openmetadata.service.rdf.sql2sparql;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class SqlMappingContext {

  private static final String DEFAULT_PREFIX = "https://open-metadata.org/ontology/";

  @Builder.Default private final Map<String, TableMapping> tableMappings = new HashMap<>();

  @Builder.Default private final Map<String, String> prefixes = new HashMap<>();

  @Builder.Default private final String defaultPrefix = DEFAULT_PREFIX;

  public static SqlMappingContext createDefault() {
    SqlMappingContext context = SqlMappingContext.builder().build();

    context.addPrefix("om", "https://open-metadata.org/ontology/");
    context.addPrefix("prov", "http://www.w3.org/ns/prov#");
    context.addPrefix("dcat", "http://www.w3.org/ns/dcat#");
    context.addPrefix("dct", "http://purl.org/dc/terms/");
    context.addPrefix("rdfs", "http://www.w3.org/2000/01/rdf-schema#");
    context.addPrefix("xsd", "http://www.w3.org/2001/XMLSchema#");
    context.addPrefix("skos", "http://www.w3.org/2004/02/skos/core#");

    context.addTableMapping(
        "tables",
        TableMapping.builder()
            .rdfClass("om:Table")
            .subjectPattern("om:table/{id}")
            .build()
            .addColumnMapping("id", "om:id", "xsd:string")
            .addColumnMapping("name", "rdfs:label", "xsd:string")
            .addColumnMapping("displayName", "skos:prefLabel", "xsd:string")
            .addColumnMapping("description", "dct:description", "xsd:string")
            .addColumnMapping("database", "om:database", "@id")
            .addColumnMapping("fullyQualifiedName", "om:fullyQualifiedName", "xsd:string")
            .addColumnMapping("owners", "om:hasOwner", "@id")
            .addColumnMapping("tags", "om:hasTag", "@id")
            .addColumnMapping("domain", "om:belongsToDomain", "@id")
            .addNestedMapping(
                "votes",
                NestedMapping.builder()
                    .parentProperty("om:hasVotes")
                    .nestedClass("om:Votes")
                    .build()
                    .addField("upVotes", "om:upVotes", "xsd:integer")
                    .addField("downVotes", "om:downVotes", "xsd:integer")
                    .addField("upVoters", "om:upVoters", "@id"))
            .addNestedMapping(
                "changeDescription",
                NestedMapping.builder()
                    .parentProperty("om:hasChangeDescription")
                    .nestedClass("om:ChangeDescription")
                    .build()
                    .addField("previousVersion", "om:previousVersion", "xsd:decimal")
                    .addField("fieldsAdded", "om:fieldsAdded", "@id")
                    .addField("fieldsUpdated", "om:fieldsUpdated", "@id")
                    .addField("fieldsDeleted", "om:fieldsDeleted", "@id"))
            .addNestedMapping(
                "lifeCycle",
                NestedMapping.builder()
                    .parentProperty("om:hasLifeCycle")
                    .nestedClass("om:LifeCycle")
                    .build()
                    .addField("created", "om:lifecycleCreated", "@id")
                    .addField("updated", "om:lifecycleUpdated", "@id")
                    .addField("accessed", "om:lifecycleAccessed", "@id")));

    context.addTableMapping(
        "columns",
        TableMapping.builder()
            .rdfClass("om:Column")
            .subjectPattern("om:column/{id}")
            .build()
            .addColumnMapping("id", "om:id", "xsd:string")
            .addColumnMapping("name", "rdfs:label", "xsd:string")
            .addColumnMapping("dataType", "om:dataType", "xsd:string")
            .addColumnMapping("tableId", "om:table", "@id"));

    context.addTableMapping(
        "databases",
        TableMapping.builder()
            .rdfClass("om:Database")
            .subjectPattern("om:database/{id}")
            .build()
            .addColumnMapping("id", "om:id", "xsd:string")
            .addColumnMapping("name", "rdfs:label", "xsd:string")
            .addColumnMapping("service", "om:service", "@id"));

    context.addTableMapping(
        "users",
        TableMapping.builder()
            .rdfClass("om:User")
            .subjectPattern("om:user/{id}")
            .build()
            .addColumnMapping("id", "om:id", "xsd:string")
            .addColumnMapping("name", "rdfs:label", "xsd:string")
            .addColumnMapping("email", "om:email", "xsd:string"));

    context.addTableMapping(
        "teams",
        TableMapping.builder()
            .rdfClass("om:Team")
            .subjectPattern("om:team/{id}")
            .build()
            .addColumnMapping("id", "om:id", "xsd:string")
            .addColumnMapping("name", "rdfs:label", "xsd:string")
            .addColumnMapping("displayName", "skos:prefLabel", "xsd:string"));

    context.addTableMapping(
        "lineage",
        TableMapping.builder()
            .rdfClass("om:LineageDetails")
            .subjectPattern("om:lineage/{id}")
            .build()
            .addColumnMapping("sqlQuery", "om:sqlQuery", "xsd:string")
            .addColumnMapping("source", "om:lineageSource", "xsd:string")
            .addColumnMapping("pipeline", "prov:wasGeneratedBy", "@id")
            .addColumnMapping("description", "dct:description", "xsd:string")
            .addColumnMapping("upstream", "prov:wasDerivedFrom", "@id")
            .addColumnMapping("downstream", "prov:wasInfluencedBy", "@id")
            .addNestedMapping(
                "columnsLineage",
                NestedMapping.builder()
                    .parentProperty("om:hasColumnLineage")
                    .nestedClass("om:ColumnLineage")
                    .build()
                    .addField("fromColumns", "om:fromColumn", "xsd:string")
                    .addField("toColumn", "om:toColumn", "xsd:string")
                    .addField("function", "om:transformFunction", "xsd:string")));

    context.addTableMapping(
        "pipelines",
        TableMapping.builder()
            .rdfClass("om:Pipeline")
            .subjectPattern("om:pipeline/{id}")
            .build()
            .addColumnMapping("id", "om:id", "xsd:string")
            .addColumnMapping("name", "rdfs:label", "xsd:string")
            .addColumnMapping("displayName", "skos:prefLabel", "xsd:string")
            .addColumnMapping("description", "dct:description", "xsd:string"));

    return context;
  }

  public void addPrefix(String prefix, String uri) {
    prefixes.put(prefix, uri);
  }

  public void addTableMapping(String tableName, TableMapping mapping) {
    tableMappings.put(tableName.toLowerCase(), mapping);
  }

  public Optional<TableMapping> getTableMapping(String tableName) {
    return Optional.ofNullable(tableMappings.get(tableName.toLowerCase()));
  }

  public String getPrefixDeclarations() {
    StringBuilder sb = new StringBuilder();
    prefixes.forEach(
        (prefix, uri) ->
            sb.append("PREFIX ").append(prefix).append(": <").append(uri).append(">\n"));
    return sb.toString();
  }

  @Getter
  @Builder
  public static class TableMapping {
    private final String rdfClass;
    private final String subjectPattern;

    @Builder.Default private final Map<String, ColumnMapping> columnMappings = new HashMap<>();
    @Builder.Default private final Map<String, NestedMapping> nestedMappings = new HashMap<>();

    public TableMapping addColumnMapping(String columnName, String rdfProperty, String dataType) {
      columnMappings.put(
          columnName.toLowerCase(), new ColumnMapping(columnName, rdfProperty, dataType));
      return this;
    }

    public TableMapping addNestedMapping(String fieldName, NestedMapping mapping) {
      nestedMappings.put(fieldName.toLowerCase(), mapping);
      return this;
    }

    public Optional<ColumnMapping> getColumnMapping(String columnName) {
      return Optional.ofNullable(columnMappings.get(columnName.toLowerCase()));
    }

    public Optional<NestedMapping> getNestedMapping(String fieldName) {
      return Optional.ofNullable(nestedMappings.get(fieldName.toLowerCase()));
    }

    public boolean hasNestedField(String path) {
      if (!path.contains(".")) {
        return nestedMappings.containsKey(path.toLowerCase());
      }
      String[] parts = path.split("\\.", 2);
      return nestedMappings.containsKey(parts[0].toLowerCase());
    }
  }

  @Getter
  @Builder
  public static class NestedMapping {
    private final String parentProperty;
    private final String nestedClass;
    @Builder.Default private final Map<String, ColumnMapping> fields = new HashMap<>();

    public NestedMapping addField(String fieldName, String rdfProperty, String dataType) {
      fields.put(fieldName.toLowerCase(), new ColumnMapping(fieldName, rdfProperty, dataType));
      return this;
    }

    public Optional<ColumnMapping> getField(String fieldName) {
      return Optional.ofNullable(fields.get(fieldName.toLowerCase()));
    }
  }

  @Getter
  public static class ColumnMapping {
    private final String columnName;
    private final String rdfProperty;
    private final String dataType;
    private final boolean transitive;

    public ColumnMapping(String columnName, String rdfProperty, String dataType) {
      this(columnName, rdfProperty, dataType, false);
    }

    public ColumnMapping(
        String columnName, String rdfProperty, String dataType, boolean transitive) {
      this.columnName = columnName;
      this.rdfProperty = rdfProperty;
      this.dataType = dataType;
      this.transitive = transitive;
    }

    public boolean isObjectProperty() {
      return "@id".equals(dataType);
    }
  }
}
