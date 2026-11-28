package org.openmetadata.service.util;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.APIEndpoint;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.SearchIndex;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.data.Worksheet;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.MlFeature;
import org.openmetadata.schema.type.MlFeatureSource;
import org.openmetadata.schema.type.SearchIndexField;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.Task;
import org.openmetadata.service.jdbi3.TableRepository;

/** Shared policy tag projection for entity indexes, authorization and vector chunks. */
public final class EntityPolicyTags {
  private EntityPolicyTags() {}

  public static List<TagLabel> collect(EntityInterface<?> entity) {
    return switch (entity) {
      case Table table -> TableRepository.allTags(table);
      case APIEndpoint value -> tags(value);
      case Container value -> tags(value);
      case DashboardDataModel value -> tags(value);
      case MlModel value -> tags(value);
      case Pipeline value -> tags(value);
      case SearchIndex value -> tags(value);
      case Topic value -> tags(value);
      case Worksheet value -> tags(value);
      default -> listOrEmpty(entity.getTags());
    };
  }

  private static List<TagLabel> tags(APIEndpoint entity) {
    List<TagLabel> allTags = new ArrayList<>();
    APIEndpoint apiEndpoint = entity;
    EntityUtil.mergeTags(allTags, apiEndpoint.getTags());
    List<Field> requestSchemaFields =
        apiEndpoint.getRequestSchema() != null
            ? apiEndpoint.getRequestSchema().getSchemaFields()
            : null;
    List<Field> responseSchemaFields =
        apiEndpoint.getResponseSchema() != null
            ? apiEndpoint.getResponseSchema().getSchemaFields()
            : null;
    EntityUtil.mergeFieldTags(allTags, responseSchemaFields);
    EntityUtil.mergeFieldTags(allTags, requestSchemaFields);
    return allTags;
  }

  private static List<TagLabel> tags(Container entity) {
    List<TagLabel> allTags = new ArrayList<>();
    Container container = entity;
    EntityUtil.mergeTags(allTags, container.getTags());
    if (container.getDataModel() != null) {
      EntityUtil.mergeColumnTags(allTags, container.getDataModel().getColumns());
    }
    return allTags;
  }

  private static List<TagLabel> tags(DashboardDataModel entity) {
    List<TagLabel> allTags = new ArrayList<>();
    DashboardDataModel dashboardDataModel = entity;
    EntityUtil.mergeTags(allTags, dashboardDataModel.getTags());
    EntityUtil.mergeColumnTags(allTags, dashboardDataModel.getColumns());
    return allTags;
  }

  private static List<TagLabel> tags(MlModel entity) {
    List<TagLabel> allTags = new ArrayList<>();
    MlModel mlModel = entity;
    EntityUtil.mergeTags(allTags, mlModel.getTags());
    for (MlFeature feature : listOrEmpty(mlModel.getMlFeatures())) {
      EntityUtil.mergeTags(allTags, feature.getTags());
      for (MlFeatureSource source : listOrEmpty(feature.getFeatureSources())) {
        EntityUtil.mergeTags(allTags, source.getTags());
      }
    }
    return allTags;
  }

  private static List<TagLabel> tags(Pipeline entity) {
    List<TagLabel> allTags = new ArrayList<>();
    Pipeline pipeline = entity;
    EntityUtil.mergeTags(allTags, pipeline.getTags());
    for (Task task : listOrEmpty(pipeline.getTasks())) {
      EntityUtil.mergeTags(allTags, task.getTags());
    }
    return allTags;
  }

  private static List<TagLabel> tags(SearchIndex entity) {
    List<TagLabel> allTags = new ArrayList<>();
    SearchIndex searchIndex = entity;
    EntityUtil.mergeTags(allTags, searchIndex.getTags());
    mergeSearchIndexFieldTags(allTags, searchIndex.getFields());
    return allTags;
  }

  private static List<TagLabel> tags(Topic entity) {
    List<TagLabel> allTags = new ArrayList<>();
    Topic topic = entity;
    EntityUtil.mergeTags(allTags, topic.getTags());
    List<Field> schemaFields =
        topic.getMessageSchema() != null ? topic.getMessageSchema().getSchemaFields() : null;
    EntityUtil.mergeFieldTags(allTags, schemaFields);
    return allTags;
  }

  private static List<TagLabel> tags(Worksheet entity) {
    List<TagLabel> allTags = new ArrayList<>();
    Worksheet worksheet = entity;
    EntityUtil.mergeTags(allTags, worksheet.getTags());
    EntityUtil.mergeColumnTags(allTags, worksheet.getColumns());
    return allTags;
  }

  private static void mergeSearchIndexFieldTags(
      List<TagLabel> tags, List<SearchIndexField> fields) {
    for (SearchIndexField field : listOrEmpty(fields)) {
      EntityUtil.mergeTags(tags, field.getTags());
      mergeSearchIndexFieldTags(tags, field.getChildren());
    }
  }
}
