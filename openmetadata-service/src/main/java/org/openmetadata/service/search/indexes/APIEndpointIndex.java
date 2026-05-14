package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Predicate;
import org.openmetadata.schema.entity.data.APIEndpoint;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.models.FlattenSchemaField;
import org.openmetadata.service.util.FullyQualifiedName;

public class APIEndpointIndex implements DataAssetIndex {
  final Set<String> excludeAPIEndpointFields = Set.of("sampleData");
  final APIEndpoint apiEndpoint;

  public APIEndpointIndex(APIEndpoint apiEndpoint) {
    this.apiEndpoint = apiEndpoint;
  }

  @Override
  public Object getEntity() {
    return apiEndpoint;
  }

  @Override
  public String getEntityTypeName() {
    return Entity.API_ENDPOINT;
  }

  @Override
  public Set<String> getExcludedFields() {
    return excludeAPIEndpointFields;
  }

  public Map<String, Object> buildSearchIndexDocInternal(Map<String, Object> doc) {
    Set<List<TagLabel>> childTags = new HashSet<>();

    if (apiEndpoint.getResponseSchema() != null
        && apiEndpoint.getResponseSchema().getSchemaFields() != null
        && !apiEndpoint.getResponseSchema().getSchemaFields().isEmpty()) {
      List<FlattenSchemaField> flattenFields = new ArrayList<>();
      parseSchemaFields(apiEndpoint.getResponseSchema().getSchemaFields(), flattenFields, null);

      List<String> fieldsWithChildrenName = new ArrayList<>();
      for (FlattenSchemaField field : flattenFields) {
        fieldsWithChildrenName.add(field.getName());
        if (field.getTags() != null) {
          childTags.add(field.getTags());
        }
      }
      doc.put("response_field_names", fieldsWithChildrenName);
      doc.put("response_field_namesFuzzy", String.join(" ", fieldsWithChildrenName));
    }

    if (apiEndpoint.getRequestSchema() != null
        && apiEndpoint.getRequestSchema().getSchemaFields() != null
        && !apiEndpoint.getRequestSchema().getSchemaFields().isEmpty()) {
      List<FlattenSchemaField> flattenFields = new ArrayList<>();
      parseSchemaFields(apiEndpoint.getRequestSchema().getSchemaFields(), flattenFields, null);

      List<String> fieldsWithChildrenName = new ArrayList<>();
      for (FlattenSchemaField field : flattenFields) {
        fieldsWithChildrenName.add(field.getName());
        if (field.getTags() != null) {
          childTags.add(field.getTags());
        }
      }
      doc.put("request_field_names", fieldsWithChildrenName);
      doc.put("request_field_namesFuzzy", String.join(" ", fieldsWithChildrenName));
    }

    mergeChildTags(doc, childTags);

    doc.put(
        "requestSchema",
        apiEndpoint.getRequestSchema() != null ? apiEndpoint.getRequestSchema() : null);
    doc.put(
        "responseSchema",
        apiEndpoint.getResponseSchema() != null ? apiEndpoint.getResponseSchema() : null);
    return doc;
  }

  private void parseSchemaFields(
      List<Field> fields, List<FlattenSchemaField> flattenSchemaFields, String parentSchemaField) {
    Optional<String> optParentField =
        Optional.ofNullable(parentSchemaField).filter(Predicate.not(String::isEmpty));
    List<TagLabel> tags = new ArrayList<>();
    for (Field field : fields) {
      String fieldName = field.getName();
      if (optParentField.isPresent()) {
        fieldName = FullyQualifiedName.add(optParentField.get(), fieldName);
      }
      if (field.getTags() != null) {
        tags = field.getTags();
      }

      FlattenSchemaField flattenSchemaField =
          FlattenSchemaField.builder().name(fieldName).description(field.getDescription()).build();

      if (!tags.isEmpty()) {
        flattenSchemaField.setTags(tags);
      }
      flattenSchemaFields.add(flattenSchemaField);
      if (field.getChildren() != null) {
        parseSchemaFields(field.getChildren(), flattenSchemaFields, field.getName());
      }
    }
  }

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = SearchIndex.getDefaultFields();
    fields.put("requestSchema.schemaFields.name.keyword", 5.0f);
    fields.put("requestSchema.schemaFields.description", 1.0f);
    fields.put("requestSchema.schemaFields.children.name", 7.0f);
    fields.put("requestSchema.schemaFields.children.keyword", 5.0f);
    fields.put("responseSchema.schemaFields.name.keyword", 5.0f);
    fields.put("responseSchema.schemaFields.description", 1.0f);
    fields.put("responseSchema.schemaFields.children.name", 7.0f);
    fields.put("responseSchema.schemaFields.children.keyword", 5.0f);
    return fields;
  }
}
