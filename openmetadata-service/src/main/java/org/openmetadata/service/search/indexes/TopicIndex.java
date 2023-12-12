package org.openmetadata.service.search.indexes;

import static org.openmetadata.service.search.EntityBuilderConstant.ES_MESSAGE_SCHEMA_FIELD;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.ParseTags;
import org.openmetadata.service.search.SearchIndexUtils;
import org.openmetadata.service.search.models.FlattenSchemaField;
import org.openmetadata.service.search.models.SearchSuggest;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;

public class TopicIndex implements SearchIndex {

  final List<String> excludeTopicFields = List.of("sampleData", "changeDescription", "messageSchema");
  final Topic topic;

  public TopicIndex(Topic topic) {
    this.topic = topic;
  }

  public Map<String, Object> buildESDoc() {
    Map<String, Object> doc = JsonUtils.getMap(topic);
    List<SearchSuggest> suggest = new ArrayList<>();
    List<SearchSuggest> fieldSuggest = new ArrayList<>();
    List<SearchSuggest> serviceSuggest = new ArrayList<>();
    Set<List<TagLabel>> tagsWithChildren = new HashSet<>();
    List<String> fieldsWithChildrenName = new ArrayList<>();
    suggest.add(SearchSuggest.builder().input(topic.getFullyQualifiedName()).weight(5).build());
    suggest.add(SearchSuggest.builder().input(topic.getName()).weight(10).build());
    serviceSuggest.add(SearchSuggest.builder().input(topic.getService().getName()).weight(5).build());
    SearchIndexUtils.removeNonIndexableFields(doc, excludeTopicFields);

    if (
      topic.getMessageSchema() != null &&
      topic.getMessageSchema().getSchemaFields() != null &&
      !topic.getMessageSchema().getSchemaFields().isEmpty()
    ) {
      List<FlattenSchemaField> flattenFields = new ArrayList<>();
      parseSchemaFields(topic.getMessageSchema().getSchemaFields(), flattenFields, null);

      for (FlattenSchemaField field : flattenFields) {
        fieldSuggest.add(SearchSuggest.builder().input(field.getName()).weight(5).build());
        fieldsWithChildrenName.add(field.getName());
        if (field.getTags() != null) {
          tagsWithChildren.add(field.getTags());
        }
      }
      doc.put("fieldNames", fieldsWithChildrenName);
    }

    ParseTags parseTags = new ParseTags(Entity.getEntityTags(Entity.TOPIC, topic));
    tagsWithChildren.add(parseTags.getTags());
    List<TagLabel> flattenedTagList = tagsWithChildren
      .stream()
      .flatMap(List::stream)
      .collect(ArrayList::new, ArrayList::add, ArrayList::addAll);
    doc.put("displayName", topic.getDisplayName() != null ? topic.getDisplayName() : topic.getName());
    doc.put("tags", flattenedTagList);
    doc.put("tier", parseTags.getTierTag());
    doc.put("followers", SearchIndexUtils.parseFollowers(topic.getFollowers()));
    doc.put("suggest", suggest);
    doc.put("field_suggest", fieldSuggest);
    doc.put("service_suggest", serviceSuggest);
    doc.put("entityType", Entity.TOPIC);
    doc.put("serviceType", topic.getServiceType());
    doc.put("messageSchema", topic.getMessageSchema() != null ? topic.getMessageSchema() : null);
    doc.put(
      "fqnParts",
      getFQNParts(
        topic.getFullyQualifiedName(),
        suggest.stream().map(SearchSuggest::getInput).collect(Collectors.toList())
      )
    );
    doc.put("owner", getEntityWithDisplayName(topic.getOwner()));
    doc.put("service", getEntityWithDisplayName(topic.getService()));
    doc.put("domain", getEntityWithDisplayName(topic.getDomain()));
    return doc;
  }

  private void parseSchemaFields(
    List<Field> fields,
    List<FlattenSchemaField> flattenSchemaFields,
    String parentSchemaField
  ) {
    Optional<String> optParentField = Optional.ofNullable(parentSchemaField).filter(Predicate.not(String::isEmpty));
    List<TagLabel> tags = new ArrayList<>();
    for (Field field : fields) {
      String fieldName = field.getName();
      if (optParentField.isPresent()) {
        fieldName = FullyQualifiedName.add(optParentField.get(), fieldName);
      }
      if (field.getTags() != null) {
        tags = field.getTags();
      }

      FlattenSchemaField flattenSchemaField = FlattenSchemaField
        .builder()
        .name(fieldName)
        .description(field.getDescription())
        .build();

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
    fields.put(ES_MESSAGE_SCHEMA_FIELD, 2.0f);
    fields.put("messageSchema.schemaFields.name.keyword", 2.0f);
    fields.put("messageSchema.schemaFields.name.ngram", 1.0f);
    fields.put("messageSchema.schemaFields.description", 1.0f);
    fields.put("messageSchema.schemaFields.children.name", 2.0f);
    fields.put("messageSchema.schemaFields.children.keyword", 2.0f);
    return fields;
  }
}
