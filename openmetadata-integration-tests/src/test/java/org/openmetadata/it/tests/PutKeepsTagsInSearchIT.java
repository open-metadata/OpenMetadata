package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.util.SearchDocs.awaitDoc;
import static org.openmetadata.it.util.SearchDocs.fieldValues;
import static org.openmetadata.it.util.SearchDocs.tagFqns;
import static org.openmetadata.it.util.SearchDocs.tagFqnsOf;
import static org.openmetadata.it.util.SearchDocs.textValues;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.factories.APIServiceTestFactory;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.factories.MessagingServiceTestFactory;
import org.openmetadata.it.factories.MlModelServiceTestFactory;
import org.openmetadata.it.factories.SearchServiceTestFactory;
import org.openmetadata.it.util.BulkApi;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateAPICollection;
import org.openmetadata.schema.api.data.CreateAPIEndpoint;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.CreateMlModel;
import org.openmetadata.schema.api.data.CreateSearchIndex;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.CreateTopic;
import org.openmetadata.schema.entity.data.APICollection;
import org.openmetadata.schema.entity.data.APIEndpoint;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.schema.entity.data.SearchIndex;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.schema.entity.services.MlModelService;
import org.openmetadata.schema.entity.services.SearchService;
import org.openmetadata.schema.type.APIRequestMethod;
import org.openmetadata.schema.type.APISchema;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.FieldDataType;
import org.openmetadata.schema.type.MessageSchema;
import org.openmetadata.schema.type.MlFeature;
import org.openmetadata.schema.type.MlFeatureDataType;
import org.openmetadata.schema.type.SchemaType;
import org.openmetadata.schema.type.SearchIndexDataType;
import org.openmetadata.schema.type.SearchIndexField;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * A connector re-run sends an entity without the tags users applied in OpenMetadata, on the entity
 * and on its columns, schema fields or features. The PUT keeps those tags in the database, so the
 * search document it rewrites has to keep them as well: otherwise the entity falls out of tag and
 * Tier filters until the next reindex (#35879).
 *
 * <p>Each re-run also adds a field at the source. The document only shows that field once the
 * re-run's own write has been indexed, so the tag checks run against that write.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class PutKeepsTagsInSearchIT {

  private static final String TIER = "Tier.Tier1";
  private static final String SOURCE_FIELD = "added_at_source";
  private static final URI ENDPOINT_URL = URI.create("https://localhost:8585/api/v1/users");

  @Test
  void tablePutWithoutTags_keepsTagsInSearchDoc(TestNamespace ns) {
    Table table = createTaggedTable(ns, "single_put");

    SdkClients.ingestionBotClient().tables().createOrUpdate(tableRerun(table));

    assertTableTagsSurvived(awaitTableRerun(table));
  }

  @Test
  void tableBulkPutWithoutTags_keepsTagsInSearchDoc(TestNamespace ns) throws Exception {
    Table table = createTaggedTable(ns, "bulk_put");

    bulkRerun("tables", tableRerun(table), false);

    assertTableTagsSurvived(awaitTableRerun(table));
  }

  @Test
  void tableBulkPutWithoutTags_withOverrideMetadata_keepsTagsInSearchDoc(TestNamespace ns)
      throws Exception {
    Table table = createTaggedTable(ns, "bulk_put_override");

    bulkRerun("tables", tableRerun(table), true);

    assertTableTagsSurvived(awaitTableRerun(table));
  }

  @Test
  void topicBulkPutWithoutFieldTags_keepsThemInSearchDoc(TestNamespace ns) throws Exception {
    MessagingService service = MessagingServiceTestFactory.createKafka(ns);
    Topic topic =
        SdkClients.adminClient()
            .topics()
            .create(topic(ns, service, field("id").withTags(List.of(piiSensitive()))));

    bulkRerun("topics", topic(ns, service, field("id"), field(SOURCE_FIELD)), false);

    JsonNode doc =
        awaitDoc(
            "topic_search_index",
            topic.getId(),
            written -> textValues(written.path("fieldNames")).contains(SOURCE_FIELD));
    assertHasTag(doc, piiSensitive(), "schema field tag merged into the topic's tags");
  }

  @Test
  void apiEndpointBulkPutWithoutFieldTags_keepsThemInSearchDoc(TestNamespace ns) throws Exception {
    APICollection collection =
        SdkClients.adminClient()
            .apiCollections()
            .create(
                new CreateAPICollection()
                    .withName(ns.prefix("collection"))
                    .withService(APIServiceTestFactory.createRest(ns).getFullyQualifiedName())
                    .withEndpointURL(ENDPOINT_URL));
    APIEndpoint endpoint =
        SdkClients.adminClient()
            .apiEndpoints()
            .create(apiEndpoint(ns, collection, field("id").withTags(List.of(piiSensitive()))));

    bulkRerun("apiEndpoints", apiEndpoint(ns, collection, field("id"), field(SOURCE_FIELD)), false);

    JsonNode doc =
        awaitDoc(
            "api_endpoint_search_index",
            endpoint.getId(),
            written -> textValues(written.path("responseFieldNames")).contains(SOURCE_FIELD));
    assertHasTag(doc, piiSensitive(), "response field tag merged into the endpoint's tags");
  }

  @Test
  void mlModelBulkPutWithoutFeatureTags_keepsThemInSearchDoc(TestNamespace ns) throws Exception {
    MlModelService service = MlModelServiceTestFactory.createMlflow(ns);
    MlModel model =
        SdkClients.adminClient()
            .mlModels()
            .create(mlModel(ns, service, feature("score").withTags(List.of(piiSensitive()))));

    bulkRerun("mlmodels", mlModel(ns, service, feature("score"), feature(SOURCE_FIELD)), false);

    JsonNode doc =
        awaitDoc(
            "mlmodel_search_index",
            model.getId(),
            written -> fieldValues(written.path("mlFeatures"), "name").contains(SOURCE_FIELD));
    Set<String> featureTags = tagFqnsOf(doc.path("mlFeatures"), "score");
    assertTrue(
        featureTags.contains(piiSensitive().getTagFQN()),
        "feature tag in the search doc: " + featureTags);
  }

  @Test
  void searchIndexBulkPutWithoutFieldTags_keepsThemInSearchDoc(TestNamespace ns) throws Exception {
    SearchService service = SearchServiceTestFactory.createElasticSearch(ns);
    SearchIndex index =
        SdkClients.adminClient()
            .searchIndexes()
            .create(searchIndex(ns, service, indexField("id").withTags(List.of(piiSensitive()))));

    bulkRerun(
        "searchIndexes",
        searchIndex(ns, service, indexField("id"), indexField(SOURCE_FIELD)),
        false);

    JsonNode doc =
        awaitDoc(
            "search_entity_search_index",
            index.getId(),
            written -> fieldValues(written.path("fields"), "name").contains(SOURCE_FIELD));
    Set<String> fieldTags = tagFqnsOf(doc.path("fields"), "id");
    assertTrue(
        fieldTags.contains(piiSensitive().getTagFQN()),
        "field tag in the search doc: " + fieldTags);
  }

  @Test
  void glossaryTermPutWithoutTags_keepsThemInSearchDoc(TestNamespace ns) {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    TagLabel tag = SharedEntities.get().PERSONAL_DATA_TAG_LABEL;
    GlossaryTerm term =
        SdkClients.adminClient()
            .glossaryTerms()
            .create(glossaryTerm(ns, glossary, "curated").withTags(List.of(tag)));
    String changedDescription = "changed by a later PUT";

    SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            "/v1/glossaryTerms",
            glossaryTerm(ns, glossary, changedDescription),
            GlossaryTerm.class);

    JsonNode doc =
        awaitDoc(
            "glossary_term_search_index",
            term.getId(),
            written -> changedDescription.equals(written.path("description").asText()));
    assertHasTag(doc, tag, "glossary term tag");
  }

  private static Table createTaggedTable(TestNamespace ns, String name) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    return SdkClients.adminClient()
        .tables()
        .create(
            new CreateTable()
                .withName(ns.prefix(name))
                .withDatabaseSchema(schema.getFullyQualifiedName())
                .withTags(List.of(SharedEntities.get().PERSONAL_DATA_TAG_LABEL, tierLabel()))
                .withColumns(List.of(idColumn().withTags(List.of(piiSensitive())))));
  }

  /**
   * What a connector sends after the source table gained a column: the table's identity and its
   * columns, and none of the tags curated in OpenMetadata.
   */
  private static CreateTable tableRerun(Table table) {
    CreateTable rerun =
        new CreateTable()
            .withName(table.getName())
            .withDatabaseSchema(table.getDatabaseSchema().getFullyQualifiedName())
            .withColumns(
                List.of(
                    idColumn(),
                    new Column().withName(SOURCE_FIELD).withDataType(ColumnDataType.STRING)));
    rerun.setSourceHash("source-changed");
    return rerun;
  }

  private static JsonNode awaitTableRerun(Table table) {
    return awaitDoc(
        "table_search_index",
        table.getId(),
        written -> fieldValues(written.path("columns"), "name").contains(SOURCE_FIELD));
  }

  private static void assertTableTagsSurvived(JsonNode doc) {
    assertAll(
        () -> assertHasTag(doc, SharedEntities.get().PERSONAL_DATA_TAG_LABEL, "table tag"),
        () -> assertHasTag(doc, piiSensitive(), "column tag merged into the table's tags"),
        () -> assertEquals(TIER, doc.path("tier").path("tagFQN").asText(), "tier"));
  }

  /** The bulk endpoint answers 200 even when it rejects a row, so check the row went through. */
  private static void bulkRerun(String collection, Object request, boolean overrideMetadata)
      throws Exception {
    BulkOperationResult result =
        BulkApi.upsert(collection, List.of(request), overrideMetadata, BulkApi.botToken());
    assertEquals(ApiStatus.SUCCESS, result.getStatus(), () -> JsonUtils.pojoToJson(result));
  }

  private static void assertHasTag(JsonNode doc, TagLabel tag, String what) {
    Set<String> tagFqns = tagFqns(doc);
    assertTrue(tagFqns.contains(tag.getTagFQN()), what + " in the search doc: " + tagFqns);
  }

  private static CreateTopic topic(TestNamespace ns, MessagingService service, Field... fields) {
    return new CreateTopic()
        .withName(ns.prefix("topic"))
        .withService(service.getFullyQualifiedName())
        .withPartitions(1)
        .withMessageSchema(
            new MessageSchema()
                .withSchemaText("{}")
                .withSchemaType(SchemaType.Avro)
                .withSchemaFields(List.of(fields)));
  }

  private static CreateAPIEndpoint apiEndpoint(
      TestNamespace ns, APICollection collection, Field... responseFields) {
    return new CreateAPIEndpoint()
        .withName(ns.prefix("endpoint"))
        .withApiCollection(collection.getFullyQualifiedName())
        .withEndpointURL(ENDPOINT_URL)
        .withRequestMethod(APIRequestMethod.GET)
        .withResponseSchema(new APISchema().withSchemaFields(List.of(responseFields)));
  }

  private static CreateMlModel mlModel(
      TestNamespace ns, MlModelService service, MlFeature... features) {
    return new CreateMlModel()
        .withName(ns.prefix("model"))
        .withService(service.getFullyQualifiedName())
        .withAlgorithm("Random Forest")
        .withMlFeatures(List.of(features));
  }

  private static CreateGlossaryTerm glossaryTerm(
      TestNamespace ns, Glossary glossary, String description) {
    return new CreateGlossaryTerm()
        .withName(ns.prefix("term"))
        .withGlossary(glossary.getFullyQualifiedName())
        .withDescription(description);
  }

  private static CreateSearchIndex searchIndex(
      TestNamespace ns, SearchService service, SearchIndexField... fields) {
    return new CreateSearchIndex()
        .withName(ns.prefix("index"))
        .withService(service.getFullyQualifiedName())
        .withFields(List.of(fields));
  }

  private static Field field(String name) {
    return new Field().withName(name).withDataType(FieldDataType.STRING);
  }

  private static SearchIndexField indexField(String name) {
    return new SearchIndexField().withName(name).withDataType(SearchIndexDataType.TEXT);
  }

  private static MlFeature feature(String name) {
    return new MlFeature().withName(name).withDataType(MlFeatureDataType.Numerical);
  }

  private static Column idColumn() {
    return new Column().withName("id").withDataType(ColumnDataType.BIGINT);
  }

  private static TagLabel piiSensitive() {
    return SharedEntities.get().PII_SENSITIVE_TAG_LABEL;
  }

  private static TagLabel tierLabel() {
    return new TagLabel()
        .withTagFQN(TIER)
        .withSource(TagLabel.TagSource.CLASSIFICATION)
        .withLabelType(TagLabel.LabelType.MANUAL);
  }
}
