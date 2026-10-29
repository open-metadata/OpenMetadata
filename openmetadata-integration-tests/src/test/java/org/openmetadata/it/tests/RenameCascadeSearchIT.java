package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.util.SearchDocs.awaitDoc;
import static org.openmetadata.it.util.SearchDocs.findTag;
import static org.openmetadata.it.util.SearchDocs.tagFqns;
import static org.openmetadata.it.util.SearchDocs.tagFqnsOf;
import static org.openmetadata.it.util.SearchDocs.tagOf;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.factories.StorageServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.api.data.CreateContainer;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.CreatePage;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.MoveGlossaryTermRequest;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.Article;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Page;
import org.openmetadata.schema.entity.data.PageType;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.StorageService;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.type.Style;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.test.util.RestClient;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * A rename or move rewrites FQNs in the database for the entity, its descendants and every tag
 * label pointing at them. The search documents of all of those have to follow (#35879).
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class RenameCascadeSearchIT {

  private static final String GLOSSARY_TERM_INDEX = "glossary_term_search_index";
  private static final String TAG_INDEX = "tag_search_index";
  private static final String TABLE_INDEX = "table_search_index";
  private static final String CONTAINER_INDEX = "container_search_index";
  private static final String PAGE_INDEX = "knowledge_page_search_index";
  private static final String PAGES_PATH = "v1/contextCenter/pages";
  private static final String COLUMN = "id";

  @Test
  void glossaryTermRename_reindexesDescendantTerms(TestNamespace ns) {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm root = term(glossary, "Root", null);
    GlossaryTerm child = term(glossary, "Child", root);
    GlossaryTerm grandchild = term(glossary, "Grandchild", child);

    GlossaryTerm renamed = client().glossaryTerms().get(root.getId().toString());
    renamed.setName("RootRenamed");
    client().glossaryTerms().update(root.getId().toString(), renamed);

    String newRoot = FullyQualifiedName.add(glossary.getFullyQualifiedName(), "RootRenamed");
    awaitFqn(GLOSSARY_TERM_INDEX, child.getId(), newRoot + ".Child");
    awaitFqn(GLOSSARY_TERM_INDEX, grandchild.getId(), newRoot + ".Child.Grandchild");
  }

  @Test
  void glossaryTermMove_reindexesDescendantTerms(TestNamespace ns) {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm root = term(glossary, "Root", null);
    GlossaryTerm child = term(glossary, "Child", root);
    GlossaryTerm grandchild = term(glossary, "Grandchild", child);
    GlossaryTerm target = term(glossary, "Target", null);

    client()
        .getHttpClient()
        .executeForString(
            HttpMethod.PUT,
            "/v1/glossaryTerms/" + child.getId() + "/moveAsync",
            new MoveGlossaryTermRequest()
                .withParent(new EntityReference().withId(target.getId()).withType("glossaryTerm")));

    awaitFqn(
        GLOSSARY_TERM_INDEX,
        grandchild.getId(),
        FullyQualifiedName.add(target.getFullyQualifiedName(), "Child") + ".Grandchild");
  }

  @Test
  void glossaryRename_reindexesSoftDeletedTerms(TestNamespace ns) {
    Glossary glossary = GlossaryTestFactory.createSimple(ns);
    GlossaryTerm deletedTerm = term(glossary, "Deleted", null);
    client()
        .getHttpClient()
        .executeForString(
            HttpMethod.DELETE,
            "/v1/glossaryTerms/" + deletedTerm.getId() + "?hardDelete=false",
            null);
    awaitDoc(GLOSSARY_TERM_INDEX, deletedTerm.getId(), doc -> doc.path("deleted").asBoolean());

    Glossary renamed = client().glossaries().get(glossary.getId().toString());
    renamed.setName(glossary.getName() + "Renamed");
    client().glossaries().update(glossary.getId().toString(), renamed);

    JsonNode doc =
        awaitDoc(
            GLOSSARY_TERM_INDEX,
            deletedTerm.getId(),
            written ->
                FullyQualifiedName.add(renamed.getName(), "Deleted")
                    .equals(written.path("fullyQualifiedName").asText()));
    assertTrue(doc.path("deleted").asBoolean());
  }

  @Test
  void tagRename_reindexesChildTags(TestNamespace ns) {
    Classification classification = classification(ns.prefix("parents"));
    Tag parent = tag(classification, "Parent", null);
    Tag child = tag(classification, "Child", parent);

    rename(parent, "Parent2");

    awaitFqn(
        TAG_INDEX,
        child.getId(),
        FullyQualifiedName.add(classification.getFullyQualifiedName(), "Parent2") + ".Child");
  }

  @Test
  void tagMove_rewritesTaggedAssets(TestNamespace ns) {
    Classification classification = classification(ns.prefix("moves"));
    Tag mover = tag(classification, "Mover", null);
    Tag target = tag(classification, "Target", null);
    Table table = table(ns, "moved_tag", List.of(label(mover)), List.of());
    awaitDoc(
        TABLE_INDEX, table.getId(), doc -> tagFqns(doc).contains(mover.getFullyQualifiedName()));

    Tag moved = client().tags().get(mover.getId().toString());
    moved.setParent(new EntityReference().withId(target.getId()).withType("tag"));
    client().tags().update(mover.getId().toString(), moved);

    String movedFqn = FullyQualifiedName.add(target.getFullyQualifiedName(), "Mover");
    awaitDoc(TABLE_INDEX, table.getId(), doc -> tagFqns(doc).contains(movedFqn));
  }

  @Test
  void classificationRename_leavesSiblingsSharingThePrefixAlone(TestNamespace ns) {
    Classification renamed = classification(ns.prefix("pfx"));
    Classification sibling = classification(renamed.getName() + "Data");
    Tag own = tag(renamed, "Own", null);
    Tag siblingTag = tag(sibling, "Sibling", null);

    Classification update = client().classifications().get(renamed.getId().toString());
    update.setName(renamed.getName() + "Renamed");
    client().classifications().update(renamed.getId().toString(), update);

    awaitFqn(TAG_INDEX, own.getId(), FullyQualifiedName.add(update.getName(), "Own"));
    assertEquals(
        siblingTag.getFullyQualifiedName(),
        awaitDoc(TAG_INDEX, siblingTag.getId(), doc -> true).path("fullyQualifiedName").asText());
  }

  @Test
  void classificationRename_reindexesSoftDeletedTags(TestNamespace ns) {
    Classification classification = classification(ns.prefix("deleted"));
    Tag deletedTag = tag(classification, "Deleted", null);
    client()
        .getHttpClient()
        .executeForString(
            HttpMethod.DELETE, "/v1/tags/" + deletedTag.getId() + "?hardDelete=false", null);
    awaitDoc(TAG_INDEX, deletedTag.getId(), doc -> doc.path("deleted").asBoolean());

    Classification renamed = client().classifications().get(classification.getId().toString());
    renamed.setName(classification.getName() + "Renamed");
    client().classifications().update(classification.getId().toString(), renamed);

    JsonNode doc =
        awaitDoc(
            TAG_INDEX,
            deletedTag.getId(),
            written ->
                FullyQualifiedName.add(renamed.getName(), "Deleted")
                    .equals(written.path("fullyQualifiedName").asText()));
    assertTrue(doc.path("deleted").asBoolean());
  }

  @Test
  void tagRename_keepsTheTaggedAssetsOwnFqn(TestNamespace ns) {
    // The tag's FQN is a prefix of the table's own FQN: "<service>.<database>".
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    Classification classification = classification(service.getName());
    Tag tag = tag(classification, schema.getDatabase().getName(), null);
    Table table = tableIn(schema, "own_fqn", List.of(label(tag)), List.of());
    awaitDoc(TABLE_INDEX, table.getId(), doc -> tagFqns(doc).contains(tag.getFullyQualifiedName()));

    rename(tag, tag.getName() + "x");

    String renamedFqn =
        FullyQualifiedName.add(classification.getFullyQualifiedName(), tag.getName() + "x");
    JsonNode doc = awaitDoc(TABLE_INDEX, table.getId(), d -> tagFqns(d).contains(renamedFqn));
    assertEquals(table.getFullyQualifiedName(), doc.path("fullyQualifiedName").asText());
  }

  @Test
  void tagRename_rewritesNestedColumnTags(TestNamespace ns) {
    Classification classification = classification(ns.prefix("nested"));
    Tag tag = tag(classification, "ColumnTag", null);
    Table table = table(ns, "nested_rename", List.of(), List.of(label(tag)));
    awaitDoc(TABLE_INDEX, table.getId(), doc -> tagFqns(doc).contains(tag.getFullyQualifiedName()));

    rename(tag, "ColumnTag2");

    String renamedFqn =
        FullyQualifiedName.add(classification.getFullyQualifiedName(), "ColumnTag2");
    JsonNode doc = awaitDoc(TABLE_INDEX, table.getId(), d -> tagFqns(d).contains(renamedFqn));
    assertEquals(Set.of(renamedFqn), tagFqnsOf(doc.path("columns"), COLUMN));
  }

  @Test
  void tagDelete_removesNestedColumnTags(TestNamespace ns) {
    Classification classification = classification(ns.prefix("deleted"));
    Tag tag = tag(classification, "Doomed", null);
    Table table = table(ns, "nested_delete", List.of(), List.of(label(tag)));
    awaitDoc(TABLE_INDEX, table.getId(), doc -> tagFqns(doc).contains(tag.getFullyQualifiedName()));

    client().tags().delete(tag.getId().toString(), Map.of("hardDelete", "true"));

    JsonNode doc =
        awaitDoc(
            TABLE_INDEX, table.getId(), d -> !tagFqns(d).contains(tag.getFullyQualifiedName()));
    assertTrue(tagFqnsOf(doc.path("columns"), COLUMN).isEmpty(), doc.path("columns").toString());
  }

  @Test
  void tagDisplayNameAndStyle_reachTheLabelsOnAssets(TestNamespace ns) {
    Classification classification = classification(ns.prefix("labels"));
    Tag tag = tag(classification, "Label", null);
    String tagFqn = tag.getFullyQualifiedName();
    Table table = table(ns, "labels", List.of(label(tag)), List.of(label(tag)));
    awaitDoc(TABLE_INDEX, table.getId(), doc -> tagFqns(doc).contains(tagFqn));

    Tag edited = client().tags().get(tag.getId().toString());
    edited.setDisplayName("Shown Label");
    edited.setStyle(new Style().withColor("#ff5733"));
    client().tags().update(tag.getId().toString(), edited);

    JsonNode doc =
        awaitDoc(
            TABLE_INDEX,
            table.getId(),
            d ->
                "Shown Label".equals(findTag(d.path("tags"), tagFqn).path("displayName").asText()));
    assertAll(
        () ->
            assertEquals(
                "#ff5733", findTag(doc.path("tags"), tagFqn).path("style").path("color").asText()),
        () ->
            assertEquals(
                "Shown Label",
                tagOf(doc.path("columns"), COLUMN, tagFqn).path("displayName").asText()));
  }

  @Test
  void containerMove_leavesSiblingsSharingThePrefixAlone(TestNamespace ns) {
    StorageService service = StorageServiceTestFactory.createS3(ns);
    Container raw = container(service, "raw", null);
    Container part = container(service, "part", raw);
    Container rawData = container(service, "rawdata", null);
    Container archive = container(service, "archive", null);
    awaitFqn(CONTAINER_INDEX, part.getId(), part.getFullyQualifiedName());
    awaitFqn(CONTAINER_INDEX, rawData.getId(), rawData.getFullyQualifiedName());

    Container moved = client().containers().get(raw.getId().toString(), "parent");
    moved.setParent(new EntityReference().withId(archive.getId()).withType("container"));
    client().containers().update(raw.getId().toString(), moved);

    String movedFqn = FullyQualifiedName.add(archive.getFullyQualifiedName(), "raw");
    awaitFqn(CONTAINER_INDEX, part.getId(), FullyQualifiedName.add(movedFqn, "part"));
    assertEquals(
        rawData.getFullyQualifiedName(),
        awaitDoc(CONTAINER_INDEX, rawData.getId(), doc -> true)
            .path("fullyQualifiedName")
            .asText());
  }

  @Test
  void pageMove_leavesSiblingsSharingThePrefixAlone(TestNamespace ns) throws Exception {
    RestClient rest = RestClient.admin();
    String guideName = ns.shortPrefix("guide");
    Page guide = page(rest, guideName, null);
    Page step = page(rest, "step", guide);
    Page guidelines = page(rest, guideName + "lines", null);
    Page docs = page(rest, ns.shortPrefix("docs"), null);
    awaitFqn(PAGE_INDEX, step.getId(), step.getFullyQualifiedName());
    awaitFqn(PAGE_INDEX, guidelines.getId(), guidelines.getFullyQualifiedName());

    String original = JsonUtils.pojoToJson(guide);
    guide.setParent(new EntityReference().withId(docs.getId()).withType("page"));
    rest.patch(PAGES_PATH, guide.getId(), original, guide, Page.class);

    String movedFqn = FullyQualifiedName.add(docs.getFullyQualifiedName(), guideName);
    awaitFqn(PAGE_INDEX, step.getId(), FullyQualifiedName.add(movedFqn, "step"));
    assertEquals(
        guidelines.getFullyQualifiedName(),
        awaitDoc(PAGE_INDEX, guidelines.getId(), doc -> true).path("fullyQualifiedName").asText());
  }

  private static void awaitFqn(String index, UUID id, String fqn) {
    awaitDoc(index, id, doc -> fqn.equals(doc.path("fullyQualifiedName").asText()));
  }

  private static void rename(Tag tag, String newName) {
    Tag renamed = client().tags().get(tag.getId().toString());
    renamed.setName(newName);
    client().tags().update(tag.getId().toString(), renamed);
  }

  private static GlossaryTerm term(Glossary glossary, String name, GlossaryTerm parent) {
    CreateGlossaryTerm create =
        new CreateGlossaryTerm()
            .withGlossary(glossary.getFullyQualifiedName())
            .withName(name)
            .withDescription(name);
    if (parent != null) {
      create.withParent(parent.getFullyQualifiedName());
    }
    return client().glossaryTerms().create(create);
  }

  private static Classification classification(String name) {
    return client()
        .classifications()
        .create(new CreateClassification().withName(name).withDescription(name));
  }

  private static Tag tag(Classification classification, String name, Tag parent) {
    CreateTag create =
        new CreateTag()
            .withClassification(classification.getName())
            .withName(name)
            .withDescription(name);
    if (parent != null) {
      create.withParent(parent.getFullyQualifiedName());
    }
    return client().tags().create(create);
  }

  private static TagLabel label(Tag tag) {
    return new TagLabel()
        .withTagFQN(tag.getFullyQualifiedName())
        .withSource(TagLabel.TagSource.CLASSIFICATION)
        .withLabelType(TagLabel.LabelType.MANUAL);
  }

  private static Table table(
      TestNamespace ns, String name, List<TagLabel> tableTags, List<TagLabel> columnTags) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    return tableIn(
        DatabaseSchemaTestFactory.createSimple(ns, service),
        ns.prefix(name),
        tableTags,
        columnTags);
  }

  private static Table tableIn(
      DatabaseSchema schema, String name, List<TagLabel> tableTags, List<TagLabel> columnTags) {
    return client()
        .tables()
        .create(
            new CreateTable()
                .withName(name)
                .withDatabaseSchema(schema.getFullyQualifiedName())
                .withTags(tableTags)
                .withColumns(
                    List.of(
                        new Column()
                            .withName(COLUMN)
                            .withDataType(ColumnDataType.BIGINT)
                            .withTags(columnTags))));
  }

  private static Container container(StorageService service, String name, Container parent) {
    CreateContainer create =
        new CreateContainer().withName(name).withService(service.getFullyQualifiedName());
    if (parent != null) {
      create.withParent(new EntityReference().withId(parent.getId()).withType("container"));
    }
    return client().containers().create(create);
  }

  private static Page page(RestClient rest, String name, Page parent) throws Exception {
    Team organization = client().teams().getByName("Organization");
    CreatePage create =
        new CreatePage()
            .withName(name)
            .withPageType(PageType.ARTICLE)
            .withDescription(name)
            .withPage(new Article())
            .withRelatedEntities(List.of(organization.getEntityReference()));
    if (parent != null) {
      create.withParent(new EntityReference().withId(parent.getId()).withType("page"));
    }
    return rest.create(PAGES_PATH, create, Page.class);
  }

  private static OpenMetadataClient client() {
    return SdkClients.adminClient();
  }
}
