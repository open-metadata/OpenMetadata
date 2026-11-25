package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
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
import org.openmetadata.schema.type.APISchema;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ContainerDataModel;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.MessageSchema;
import org.openmetadata.schema.type.MlFeature;
import org.openmetadata.schema.type.MlFeatureSource;
import org.openmetadata.schema.type.SearchIndexField;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.Task;

class EntityPolicyTagsTest {
  static Stream<EntityInterface<?>> inlineChildren() {
    List<Column> columns =
        List.of(new Column().withChildren(List.of(new Column().withTags(tags()))));
    List<Field> fields = List.of(new Field().withChildren(List.of(new Field().withTags(tags()))));
    return Stream.of(
        new Table().withColumns(columns),
        new Container().withDataModel(new ContainerDataModel().withColumns(columns)),
        new DashboardDataModel().withColumns(columns),
        new Worksheet().withColumns(columns),
        new APIEndpoint().withRequestSchema(new APISchema().withSchemaFields(fields)),
        new APIEndpoint().withResponseSchema(new APISchema().withSchemaFields(fields)),
        new Topic().withMessageSchema(new MessageSchema().withSchemaFields(fields)),
        new SearchIndex()
            .withFields(
                List.of(
                    new SearchIndexField()
                        .withChildren(List.of(new SearchIndexField().withTags(tags()))))),
        new Pipeline().withTasks(List.of(new Task().withTags(tags()))),
        new MlModel().withMlFeatures(List.of(new MlFeature().withTags(tags()))),
        new MlModel()
            .withMlFeatures(
                List.of(
                    new MlFeature()
                        .withFeatureSources(List.of(new MlFeatureSource().withTags(tags()))))));
  }

  @ParameterizedTest
  @MethodSource("inlineChildren")
  void inlineTagsAreAvailableToBothAuthorizationAndChunkProjection(EntityInterface<?> entity) {
    assertEquals(
        List.of("PII.Sensitive"),
        EntityPolicyTags.collect(entity).stream().map(TagLabel::getTagFQN).toList());
    entity.setTags(tags());
    assertEquals(1, EntityPolicyTags.collect(entity).size(), "deduplicate parent and child tags");
  }

  private static List<TagLabel> tags() {
    return List.of(
        new TagLabel().withTagFQN("PII.Sensitive").withSource(TagLabel.TagSource.CLASSIFICATION));
  }
}
