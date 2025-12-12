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

    // Add default prefixes
    context.addPrefix("om", "https://open-metadata.org/ontology/");
    context.addPrefix("dcat", "http://www.w3.org/ns/dcat#");
    context.addPrefix("dct", "http://purl.org/dc/terms/");
    context.addPrefix("rdfs", "http://www.w3.org/2000/01/rdf-schema#");
    context.addPrefix("xsd", "http://www.w3.org/2001/XMLSchema#");

    // Add OpenMetadata entity mappings
    context.addTableMapping(
        "tables",
        TableMapping.builder()
            .rdfClass("om:Table")
            .subjectPattern("om:table/{id}")
            .build()
            .addColumnMapping("id", "om:id", "xsd:string")
            .addColumnMapping("name", "om:name", "xsd:string")
            .addColumnMapping("displayName", "om:displayName", "xsd:string")
            .addColumnMapping("description", "om:description", "xsd:string")
            .addColumnMapping("database", "om:database", "@id")
            .addColumnMapping("fullyQualifiedName", "om:fullyQualifiedName", "xsd:string"));

    context.addTableMapping(
        "columns",
        TableMapping.builder()
            .rdfClass("om:Column")
            .subjectPattern("om:column/{id}")
            .build()
            .addColumnMapping("id", "om:id", "xsd:string")
            .addColumnMapping("name", "om:name", "xsd:string")
            .addColumnMapping("dataType", "om:dataType", "xsd:string")
            .addColumnMapping("tableId", "om:table", "@id"));

    context.addTableMapping(
        "databases",
        TableMapping.builder()
            .rdfClass("om:Database")
            .subjectPattern("om:database/{id}")
            .build()
            .addColumnMapping("id", "om:id", "xsd:string")
            .addColumnMapping("name", "om:name", "xsd:string")
            .addColumnMapping("service", "om:service", "@id"));

    context.addTableMapping(
        "users",
        TableMapping.builder()
            .rdfClass("om:User")
            .subjectPattern("om:user/{id}")
            .build()
            .addColumnMapping("id", "om:id", "xsd:string")
            .addColumnMapping("name", "om:name", "xsd:string")
            .addColumnMapping("email", "om:email", "xsd:string"));

    context.addTableMapping(
        "teams",
        TableMapping.builder()
            .rdfClass("om:Team")
            .subjectPattern("om:team/{id}")
            .build()
            .addColumnMapping("id", "om:id", "xsd:string")
            .addColumnMapping("name", "om:name", "xsd:string")
            .addColumnMapping("displayName", "om:displayName", "xsd:string"));

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

    public TableMapping addColumnMapping(String columnName, String rdfProperty, String dataType) {
      columnMappings.put(
          columnName.toLowerCase(), new ColumnMapping(columnName, rdfProperty, dataType));
      return this;
    }

    public Optional<ColumnMapping> getColumnMapping(String columnName) {
      return Optional.ofNullable(columnMappings.get(columnName.toLowerCase()));
    }
  }

  @Getter
  public static class ColumnMapping {
    private final String columnName;
    private final String rdfProperty;
    private final String dataType;

    public ColumnMapping(String columnName, String rdfProperty, String dataType) {
      this.columnName = columnName;
      this.rdfProperty = rdfProperty;
      this.dataType = dataType;
    }

    public boolean isObjectProperty() {
      return "@id".equals(dataType);
    }
  }
}
