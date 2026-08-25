package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.entity.data.APIEndpoint;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.models.FlattenSchemaField;

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
  public Set<String> getRequiredReindexFields() {
    Set<String> fields = new java.util.HashSet<>(DataAssetIndex.super.getRequiredReindexFields());
    // APIEndpointRepository.fetchAndSetSchemaFieldTagsInBatch is gated on
    // fields.contains("requestSchema") || fields.contains("responseSchema").
    fields.add("requestSchema");
    fields.add("responseSchema");
    return java.util.Collections.unmodifiableSet(fields);
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
      SchemaFieldFlattener.parseSchemaFields(
          apiEndpoint.getResponseSchema().getSchemaFields(), flattenFields, null);

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
      SchemaFieldFlattener.parseSchemaFields(
          apiEndpoint.getRequestSchema().getSchemaFields(), flattenFields, null);

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

  public static Map<String, Float> getFields() {
    Map<String, Float> fields = SearchIndex.getDefaultFields();
    fields.put("requestSchema.schemaFields.name.keyword", 5.0f);
    fields.put("requestSchema.schemaFields.description", 1.0f);
    fields.put("request_field_namesFuzzy", 7.0f);
    fields.put("responseSchema.schemaFields.name.keyword", 5.0f);
    fields.put("responseSchema.schemaFields.description", 1.0f);
    fields.put("response_field_namesFuzzy", 7.0f);
    return fields;
  }
}
