/*
 *  Copyright 2024 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import jakarta.json.JsonPatch;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.APIEndpoint;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.SearchIndex;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.type.APISchema;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ContainerDataModel;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.MessageSchema;
import org.openmetadata.schema.type.MlFeature;
import org.openmetadata.schema.type.SearchIndexField;
import org.openmetadata.schema.type.Task;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.util.FieldPathUtils.FieldPathComponents;

/**
 * Unit tests for FieldPathUtils.
 *
 * <p>Tests the field path parsing logic for various formats:
 * - Simple: "description"
 * - Column/Field: "columns::column_name::description"
 * - Dot notation: "columns.column_name.description"
 * - Nested with quotes: "messageSchema::\"parent.child\"::description"
 * - Array index: "columns[0].description"
 */
class FieldPathUtilsTest {

  @Test
  void testParseFieldPath_colonSeparator_simple() throws Exception {
    FieldPathComponents result = invokeParseFieldPath("columns::customer_id::description");

    assertNotNull(result);
    assertEquals("columns", result.containerName());
    assertEquals("customer_id", result.fieldName());
    assertEquals("description", result.property());
  }

  @Test
  void testParseFieldPath_colonSeparator_noProperty() throws Exception {
    FieldPathComponents result = invokeParseFieldPath("columns::customer_id");

    assertNotNull(result);
    assertEquals("columns", result.containerName());
    assertEquals("customer_id", result.fieldName());
    assertEquals("description", result.property());
  }

  @Test
  void testParseFieldPath_colonSeparator_quotedFieldName() throws Exception {
    FieldPathComponents result =
        invokeParseFieldPath("messageSchema::\"level.somefield\"::description");

    assertNotNull(result);
    assertEquals("messageSchema", result.containerName());
    assertEquals("level.somefield", result.fieldName());
    assertEquals("description", result.property());
  }

  @Test
  void testParseFieldPath_dotSeparator_simple() throws Exception {
    FieldPathComponents result = invokeParseFieldPath("columns.email.description");

    assertNotNull(result);
    assertEquals("columns", result.containerName());
    assertEquals("email", result.fieldName());
    assertEquals("description", result.property());
  }

  @Test
  void testParseFieldPath_dotSeparator_noProperty() throws Exception {
    FieldPathComponents result = invokeParseFieldPath("columns.email");

    assertNotNull(result);
    assertEquals("columns", result.containerName());
    assertEquals("email", result.fieldName());
    assertEquals("description", result.property());
  }

  @Test
  void testParseFieldPath_arrayIndex() throws Exception {
    FieldPathComponents result = invokeParseFieldPath("columns[0].description");

    assertNotNull(result);
    assertEquals("columns", result.containerName());
    assertEquals("0", result.fieldName());
    assertEquals("description", result.property());
  }

  @Test
  void testParseFieldPath_arrayIndex_nestedProperty() throws Exception {
    FieldPathComponents result = invokeParseFieldPath("schemaFields[2].tags");

    assertNotNull(result);
    assertEquals("schemaFields", result.containerName());
    assertEquals("2", result.fieldName());
    assertEquals("tags", result.property());
  }

  @Test
  void testParseFieldPath_messageSchema() throws Exception {
    FieldPathComponents result = invokeParseFieldPath("messageSchema::event_id::description");

    assertNotNull(result);
    assertEquals("messageSchema", result.containerName());
    assertEquals("event_id", result.fieldName());
    assertEquals("description", result.property());
  }

  @Test
  void testParseFieldPath_dataModel() throws Exception {
    FieldPathComponents result = invokeParseFieldPath("dataModel::product_id::description");

    assertNotNull(result);
    assertEquals("dataModel", result.containerName());
    assertEquals("product_id", result.fieldName());
    assertEquals("description", result.property());
  }

  @Test
  void testParseFieldPath_schemaFields() throws Exception {
    FieldPathComponents result = invokeParseFieldPath("schemaFields::user_id::description");

    assertNotNull(result);
    assertEquals("schemaFields", result.containerName());
    assertEquals("user_id", result.fieldName());
    assertEquals("description", result.property());
  }

  @Test
  void testParseFieldPath_responseSchema() throws Exception {
    FieldPathComponents result = invokeParseFieldPath("responseSchema::status_code::description");

    assertNotNull(result);
    assertEquals("responseSchema", result.containerName());
    assertEquals("status_code", result.fieldName());
    assertEquals("description", result.property());
  }

  @Test
  void testParseFieldPath_tasks() throws Exception {
    FieldPathComponents result = invokeParseFieldPath("tasks::etl_task::description");

    assertNotNull(result);
    assertEquals("tasks", result.containerName());
    assertEquals("etl_task", result.fieldName());
    assertEquals("description", result.property());
  }

  @Test
  void testParseFieldPath_charts() throws Exception {
    FieldPathComponents result = invokeParseFieldPath("charts::revenue_chart::description");

    assertNotNull(result);
    assertEquals("charts", result.containerName());
    assertEquals("revenue_chart", result.fieldName());
    assertEquals("description", result.property());
  }

  @Test
  void testParseFieldPath_fields() throws Exception {
    FieldPathComponents result = invokeParseFieldPath("fields::title::description");

    assertNotNull(result);
    assertEquals("fields", result.containerName());
    assertEquals("title", result.fieldName());
    assertEquals("description", result.property());
  }

  @Test
  void testParseFieldPath_null() throws Exception {
    FieldPathComponents result = invokeParseFieldPath(null);
    assertNull(result);
  }

  @Test
  void testParseFieldPath_empty() throws Exception {
    FieldPathComponents result = invokeParseFieldPath("");
    assertNull(result);
  }

  @Test
  void testParseFieldPath_simpleString() throws Exception {
    FieldPathComponents result = invokeParseFieldPath("description");
    assertNull(result);
  }

  @Test
  void testParseFieldPath_nestedChildrenPath() throws Exception {
    FieldPathComponents result =
        invokeParseFieldPath("columns::address::children::street::description");

    assertNotNull(result);
    assertEquals("columns", result.containerName());
    assertEquals("address", result.fieldName());
    assertEquals("children", result.property());
  }

  @Test
  void testParseFieldPath_dotSeparator_nestedDepth2() throws Exception {
    FieldPathComponents result = invokeParseFieldPath("columns.profile.personal.description");

    assertNotNull(result);
    assertEquals("columns", result.containerName());
    assertEquals("profile.personal", result.fieldName());
    assertEquals("description", result.property());
  }

  @Test
  void testParseFieldPath_dotSeparator_nestedDepth3() throws Exception {
    FieldPathComponents result =
        invokeParseFieldPath("columns.profile.personal.full_name.description");

    assertNotNull(result);
    assertEquals("columns", result.containerName());
    assertEquals("profile.personal.full_name", result.fieldName());
    assertEquals("description", result.property());
  }

  @Test
  void testParseFieldPath_dotSeparator_nestedDepth3_quoted() throws Exception {
    FieldPathComponents result =
        invokeParseFieldPath("columns.\"profile.personal.full_name\".description");

    assertNotNull(result);
    assertEquals("columns", result.containerName());
    assertEquals("profile.personal.full_name", result.fieldName());
    assertEquals("description", result.property());
  }

  @Test
  void testParseFieldPath_dotSeparator_nestedTags() throws Exception {
    FieldPathComponents result = invokeParseFieldPath("columns.profile.contact.phone.tags");

    assertNotNull(result);
    assertEquals("columns", result.containerName());
    assertEquals("profile.contact.phone", result.fieldName());
    assertEquals("tags", result.property());
  }

  @Test
  void testParseFieldPath_dotSeparator_threeSegments_propertyLast() throws Exception {
    // "columns.profile.personal" is ambiguous (nested column with implied description vs.
    // flat column + property). Property-last wins — this pins the pre-existing behavior for
    // three-segment paths; every real producer appends an explicit ".description"/".tags".
    FieldPathComponents result = invokeParseFieldPath("columns.profile.personal");

    assertNotNull(result);
    assertEquals("columns", result.containerName());
    assertEquals("profile", result.fieldName());
    assertEquals("personal", result.property());
  }

  @Test
  void testParseFieldPath_dotSeparator_literalDottedName() throws Exception {
    FieldPathComponents result = invokeParseFieldPath("columns.\"a.b\".description");

    assertNotNull(result);
    assertEquals("columns", result.containerName());
    assertEquals("a.b", result.fieldName());
    assertEquals("description", result.property());
  }

  @Test
  void testParseFieldPath_dotSeparator_malformedEmptySegment() throws Exception {
    // The FQN parser rejects empty segments; parseFieldPath must return null (fail-loud
    // upstream at updateFieldDescription) instead of producing garbage components.
    FieldPathComponents result = invokeParseFieldPath("columns..description");

    assertNull(result);
  }

  @Test
  void testUpdateFieldDescription_nestedLeaf_updatesLeafOnly() {
    Table table = nestedTable();
    EntityRepository<?> repository = mock(EntityRepository.class);

    boolean updated =
        FieldPathUtils.updateFieldDescription(
            table,
            repository,
            "admin",
            "columns.profile.personal.full_name.description",
            "Full name of the customer");

    assertTrue(updated);
    Column profile = table.getColumns().getFirst();
    Column personal = profile.getChildren().getFirst();
    Column fullName = personal.getChildren().getFirst();
    assertEquals("Full name of the customer", fullName.getDescription());
    assertEquals("Customer profile block", profile.getDescription());
    assertNull(personal.getDescription());
  }

  @Test
  void testUpdateFieldDescription_unresolvableNestedPath_failsLoudly() {
    Table table = nestedTable();
    EntityRepository<?> repository = mock(EntityRepository.class);

    boolean updated =
        FieldPathUtils.updateFieldDescription(
            table, repository, "admin", "columns.profile.nonexistent.child.description", "text");

    assertFalse(updated);
    assertEquals("Customer profile block", table.getColumns().getFirst().getDescription());
    verifyNoInteractions(repository);
  }

  @Test
  void testGetFieldDescription_nestedLeaf() {
    Table table = nestedTable();

    Optional<String> description =
        FieldPathUtils.getFieldDescription(table, "columns.profile.personal.full_name.description");

    assertEquals(Optional.of("name"), description);
  }

  private Table nestedTable() {
    Column fullName = new Column().withName("full_name").withDescription("name");
    Column personal = new Column().withName("personal").withChildren(List.of(fullName));
    Column phone = new Column().withName("phone").withDescription("Phone");
    Column contact = new Column().withName("contact").withChildren(List.of(phone));
    Column profile =
        new Column()
            .withName("profile")
            .withDescription("Customer profile block")
            .withChildren(List.of(personal, contact));
    return new Table()
        .withId(UUID.randomUUID())
        .withName("customer_events")
        .withColumns(List.of(profile));
  }

  @Test
  void updateFieldDescription_tableColumn_updatesInMemoryAndPatches() {
    Table table =
        new Table()
            .withId(UUID.randomUUID())
            .withName("orders")
            .withColumns(new ArrayList<>(List.of(new Column().withName("id"))));
    EntityRepository<?> repository = mock(EntityRepository.class);

    boolean updated =
        FieldPathUtils.updateFieldDescription(
            table, repository, "admin", "columns::id::description", "Order id");

    assertTrue(updated);
    assertEquals("Order id", table.getColumns().get(0).getDescription());
    verify(repository)
        .patch(isNull(), eq(table.getId()), eq("admin"), any(JsonPatch.class), isNull(), isNull());
  }

  @Test
  void updateFieldDescription_topicNestedSchemaField_quotedDottedName() {
    Topic topic =
        new Topic()
            .withId(UUID.randomUUID())
            .withName("orders")
            .withMessageSchema(
                new MessageSchema()
                    .withSchemaFields(
                        List.of(
                            new Field()
                                .withName("customer")
                                .withChildren(List.of(new Field().withName("id"))))));
    EntityRepository<?> repository = mock(EntityRepository.class);

    boolean updated =
        FieldPathUtils.updateFieldDescription(
            topic, repository, "admin", "messageSchema::\"customer.id\"::description", "Cust id");

    assertTrue(updated);
    assertEquals(
        "Cust id",
        topic.getMessageSchema().getSchemaFields().get(0).getChildren().get(0).getDescription());
  }

  @Test
  void updateFieldDescription_containerDataModelColumn() {
    Container container =
        new Container()
            .withId(UUID.randomUUID())
            .withName("bucket")
            .withDataModel(
                new ContainerDataModel().withColumns(List.of(new Column().withName("payload"))));
    EntityRepository<?> repository = mock(EntityRepository.class);

    boolean updated =
        FieldPathUtils.updateFieldDescription(
            container, repository, "admin", "dataModel::payload::description", "Payload col");

    assertTrue(updated);
    assertEquals("Payload col", container.getDataModel().getColumns().get(0).getDescription());
  }

  @Test
  void updateFieldDescription_apiEndpointResponseSchemaField() {
    APIEndpoint endpoint =
        new APIEndpoint()
            .withId(UUID.randomUUID())
            .withName("getUser")
            .withResponseSchema(
                new APISchema().withSchemaFields(List.of(new Field().withName("userId"))));
    EntityRepository<?> repository = mock(EntityRepository.class);

    boolean updated =
        FieldPathUtils.updateFieldDescription(
            endpoint, repository, "admin", "responseSchema::userId::description", "User id");

    assertTrue(updated);
    assertEquals("User id", endpoint.getResponseSchema().getSchemaFields().get(0).getDescription());
  }

  @Test
  void updateFieldDescription_missingField_returnsFalseAndNeverPatches() {
    Table table =
        new Table()
            .withId(UUID.randomUUID())
            .withName("orders")
            .withColumns(List.of(new Column().withName("id")));
    EntityRepository<?> repository = mock(EntityRepository.class);

    boolean updated =
        FieldPathUtils.updateFieldDescription(
            table, repository, "admin", "columns::nope::description", "x");

    assertFalse(updated);
    verifyNoInteractions(repository);
  }

  @Test
  void updateFieldDescription_unknownContainer_returnsFalse() {
    Pipeline pipeline = new Pipeline().withId(UUID.randomUUID()).withName("etl");
    EntityRepository<?> repository = mock(EntityRepository.class);

    // Pins today's gap: the if-chain does not know pipeline tasks. Task 10 deliberately
    // changes this expectation (see that task's step 4).
    boolean updated =
        FieldPathUtils.updateFieldDescription(
            pipeline, repository, "admin", "unknownContainer::t1::description", "x");

    assertFalse(updated);
    verifyNoInteractions(repository);
  }

  @Test
  void updateFieldDescription_emptyChildArray_returnsFalse() {
    Topic topic =
        new Topic()
            .withId(UUID.randomUUID())
            .withName("orders")
            .withMessageSchema(new MessageSchema().withSchemaFields(List.of()));
    EntityRepository<?> repository = mock(EntityRepository.class);

    assertFalse(
        FieldPathUtils.updateFieldDescription(
            topic, repository, "admin", "messageSchema::id::description", "x"));
    verifyNoInteractions(repository);
  }

  @Test
  void findField_tableStructChild_dottedPath() {
    Table table =
        new Table()
            .withName("orders")
            .withColumns(
                List.of(
                    new Column()
                        .withName("profile")
                        .withChildren(List.of(new Column().withName("full_name")))));

    Optional<Object> found =
        FieldPathUtils.findField(table, "columns::profile.full_name::description");

    assertTrue(found.isPresent());
    assertEquals("full_name", ((Column) found.get()).getName());
  }

  @Test
  void nestedContainerResolution_returnsTheLiveListInstance() {
    // The registry must hand back the entity's own list, not a copy: FieldPathUtils mutates the
    // element POJOs in place, so a copied list would write to something the entity cannot see.
    // This is what makes the resolver a safe substitute for the deleted nested-container chain.
    Topic topic =
        new Topic()
            .withMessageSchema(
                new MessageSchema()
                    .withSchemaFields(new ArrayList<>(List.of(new Field().withName("customer")))));
    EntityRepository<?> repository = mock(EntityRepository.class);

    assertTrue(
        FieldPathUtils.updateFieldDescription(
            topic, repository, "admin", "messageSchema::customer::description", "via resolver"));
    assertSame(
        topic.getMessageSchema().getSchemaFields(),
        ChildFieldResolver.containerListFor(topic, "messageSchema"));
  }

  @Test
  void updateFieldDescription_columnsContainerOnTable_worksToday() {
    // FROZEN, must never change. Task 10 makes "columns" a registry-resolved alias for the
    // entity's child container; for table the registry's container path IS literally "columns"
    // (ChildFieldResolver's TABLE spec), so this resolution must stay byte-identical.
    Table table =
        new Table()
            .withId(UUID.randomUUID())
            .withName("orders")
            .withColumns(new ArrayList<>(List.of(new Column().withName("id"))));
    EntityRepository<?> repository = mock(EntityRepository.class);

    assertTrue(
        FieldPathUtils.updateFieldDescription(
            table, repository, "admin", "columns::id::description", "Primary key"));
    assertEquals("Primary key", table.getColumns().get(0).getDescription());
  }

  @Test
  void updateFieldDescription_columnsAliasOnTopic_writesTheSchemaField() {
    // Was updateFieldDescription_columnsContainerOnTopic_silentlyDoesNothingToday, the
    // characterization of the bug. "columns" is now the registry-resolved alias for the entity's
    // child container, so the fieldPath the suggestion tool emits for every type finally lands.
    Topic topic =
        new Topic()
            .withId(UUID.randomUUID())
            .withName("orders")
            .withMessageSchema(
                new MessageSchema()
                    .withSchemaFields(
                        new ArrayList<>(List.of(new Field().withName("customer_id")))));
    EntityRepository<?> repository = mock(EntityRepository.class);

    assertTrue(
        FieldPathUtils.updateFieldDescription(
            topic,
            repository,
            "admin",
            "columns::customer_id::description",
            "Customer identifier"));
    assertEquals(
        "Customer identifier", topic.getMessageSchema().getSchemaFields().get(0).getDescription());
  }

  @Test
  void updateFieldDescription_columnsAliasOnPipelineTask() {
    Pipeline pipeline =
        new Pipeline()
            .withId(UUID.randomUUID())
            .withName("etl")
            .withTasks(new ArrayList<>(List.of(new Task().withName("extract"))));
    EntityRepository<?> repository = mock(EntityRepository.class);

    assertTrue(
        FieldPathUtils.updateFieldDescription(
            pipeline, repository, "admin", "columns::extract::description", "Extract step"));
    assertEquals("Extract step", pipeline.getTasks().get(0).getDescription());
  }

  @Test
  void updateFieldDescription_columnsAliasOnMlFeature() {
    MlModel model =
        new MlModel()
            .withId(UUID.randomUUID())
            .withName("churn")
            .withMlFeatures(new ArrayList<>(List.of(new MlFeature().withName("age"))));
    EntityRepository<?> repository = mock(EntityRepository.class);

    assertTrue(
        FieldPathUtils.updateFieldDescription(
            model, repository, "admin", "columns::age::description", "Customer age"));
    assertEquals("Customer age", model.getMlFeatures().get(0).getDescription());
  }

  @Test
  void updateFieldDescription_columnsAliasOnSearchIndexField() {
    SearchIndex index =
        new SearchIndex()
            .withId(UUID.randomUUID())
            .withName("catalog")
            .withFields(new ArrayList<>(List.of(new SearchIndexField().withName("title"))));
    EntityRepository<?> repository = mock(EntityRepository.class);

    assertTrue(
        FieldPathUtils.updateFieldDescription(
            index, repository, "admin", "columns::title::description", "Document title"));
    assertEquals("Document title", index.getFields().get(0).getDescription());
  }

  @Test
  void updateFieldDescription_columnsAliasOnContainerDataModelColumn() {
    Container container =
        new Container()
            .withId(UUID.randomUUID())
            .withName("bucket")
            .withDataModel(
                new ContainerDataModel()
                    .withColumns(new ArrayList<>(List.of(new Column().withName("payload")))));
    EntityRepository<?> repository = mock(EntityRepository.class);

    assertTrue(
        FieldPathUtils.updateFieldDescription(
            container, repository, "admin", "columns::payload::description", "Raw payload"));
    assertEquals("Raw payload", container.getDataModel().getColumns().get(0).getDescription());
  }

  @Test
  void findField_columnsAliasOnApiEndpoint_refusesAnAmbiguousName() {
    // findField is what the TAG path resolves through (TaskWorkflowHandler.patchFieldTags),
    // and it walks a different method from the description path. Guarding only the
    // description walkers left an approved `columns.<name>.tags` suggestion writing onto
    // whichever of the two schemas' same-named fields came first, reporting success — the
    // same silent mis-write, reached through the other door.
    APIEndpoint endpoint =
        new APIEndpoint()
            .withId(UUID.randomUUID())
            .withName("registerCustomer")
            .withRequestSchema(
                new APISchema()
                    .withSchemaFields(new ArrayList<>(List.of(new Field().withName("email")))))
            .withResponseSchema(
                new APISchema()
                    .withSchemaFields(new ArrayList<>(List.of(new Field().withName("email")))));

    assertTrue(FieldPathUtils.findField(endpoint, "columns::email::tags").isEmpty());
  }

  @Test
  void findField_apiEndpointOwnContainer_resolvesASharedName() {
    // The counterweight: naming the container makes it unambiguous, and findField resolves.
    Field responseEmail = new Field().withName("email");
    APIEndpoint endpoint =
        new APIEndpoint()
            .withId(UUID.randomUUID())
            .withName("registerCustomer")
            .withRequestSchema(
                new APISchema()
                    .withSchemaFields(new ArrayList<>(List.of(new Field().withName("email")))))
            .withResponseSchema(
                new APISchema().withSchemaFields(new ArrayList<>(List.of(responseEmail))));

    assertSame(
        responseEmail,
        FieldPathUtils.findField(endpoint, "responseSchema::email::tags").orElse(null));
  }

  @Test
  void updateFieldDescription_columnsAliasOnApiEndpoint_refusesAnAmbiguousName() {
    // A REST endpoint normally echoes its request shape in its response, so the two schemas share
    // field names. The "columns" alias concatenates both, and resolving by position wrote the
    // caller's text onto whichever came first while reporting success — an accepted suggestion for
    // the response field silently overwrote the request field.
    APIEndpoint endpoint =
        new APIEndpoint()
            .withId(UUID.randomUUID())
            .withName("registerCustomer")
            .withRequestSchema(
                new APISchema()
                    .withSchemaFields(new ArrayList<>(List.of(new Field().withName("category")))))
            .withResponseSchema(
                new APISchema()
                    .withSchemaFields(new ArrayList<>(List.of(new Field().withName("category")))));
    EntityRepository<?> repository = mock(EntityRepository.class);

    assertFalse(
        FieldPathUtils.updateFieldDescription(
            endpoint, repository, "admin", "columns::category::description", "Pet category"));

    // Neither is written, and nothing is persisted: guessing is worse than declining.
    assertNull(endpoint.getRequestSchema().getSchemaFields().get(0).getDescription());
    assertNull(endpoint.getResponseSchema().getSchemaFields().get(0).getDescription());
    verifyNoInteractions(repository);
  }

  @Test
  void updateFieldDescription_apiEndpointOwnContainer_disambiguatesASharedName() {
    // The counterweight: the caller that means one of them says which, and that path resolves to
    // a single schema's list, so the shared name is no longer ambiguous.
    APIEndpoint endpoint =
        new APIEndpoint()
            .withId(UUID.randomUUID())
            .withName("registerCustomer")
            .withRequestSchema(
                new APISchema()
                    .withSchemaFields(new ArrayList<>(List.of(new Field().withName("category")))))
            .withResponseSchema(
                new APISchema()
                    .withSchemaFields(new ArrayList<>(List.of(new Field().withName("category")))));
    EntityRepository<?> repository = mock(EntityRepository.class);

    assertTrue(
        FieldPathUtils.updateFieldDescription(
            endpoint,
            repository,
            "admin",
            "responseSchema::category::description",
            "Category returned on the created account"));

    assertEquals(
        "Category returned on the created account",
        endpoint.getResponseSchema().getSchemaFields().get(0).getDescription());
    assertNull(endpoint.getRequestSchema().getSchemaFields().get(0).getDescription());
  }

  @Test
  void updateFieldDescription_columnsAliasOnApiEndpoint_writesEitherSchemaField() {
    // The two-container-path type. A response-schema field must be reachable through the same
    // "columns" alias as a request-schema one.
    APIEndpoint endpoint =
        new APIEndpoint()
            .withId(UUID.randomUUID())
            .withName("getUser")
            .withRequestSchema(
                new APISchema()
                    .withSchemaFields(new ArrayList<>(List.of(new Field().withName("query")))))
            .withResponseSchema(
                new APISchema()
                    .withSchemaFields(new ArrayList<>(List.of(new Field().withName("userId")))));
    EntityRepository<?> repository = mock(EntityRepository.class);

    assertTrue(
        FieldPathUtils.updateFieldDescription(
            endpoint, repository, "admin", "columns::userId::description", "The user id"));
    assertEquals(
        "The user id", endpoint.getResponseSchema().getSchemaFields().get(0).getDescription());
  }

  @Test
  void updateFieldDescription_columnsAliasReachesNestedStructChild() {
    // The alias must not lose the recursion into children: a struct child of a container
    // dataModel column is addressed as "columns::parent.child::description".
    Container container =
        new Container()
            .withId(UUID.randomUUID())
            .withName("bucket")
            .withDataModel(
                new ContainerDataModel()
                    .withColumns(
                        new ArrayList<>(
                            List.of(
                                new Column()
                                    .withName("profile")
                                    .withChildren(
                                        new ArrayList<>(
                                            List.of(new Column().withName("full_name"))))))));
    EntityRepository<?> repository = mock(EntityRepository.class);

    assertTrue(
        FieldPathUtils.updateFieldDescription(
            container,
            repository,
            "admin",
            "columns::profile.full_name::description",
            "Full name"));
    assertEquals(
        "Full name",
        container.getDataModel().getColumns().get(0).getChildren().get(0).getDescription());
  }

  @Test
  void updateFieldDescription_columnsAliasOnNonRegistryType_stillFails() {
    // The alias is not a wildcard: a type with no registered child container still resolves
    // nothing, so it cannot start writing to an unrelated list that happens to exist.
    Glossary glossary = new Glossary().withId(UUID.randomUUID()).withName("business");
    EntityRepository<?> repository = mock(EntityRepository.class);

    assertFalse(
        FieldPathUtils.updateFieldDescription(
            glossary, repository, "admin", "columns::anything::description", "x"));
    verifyNoInteractions(repository);
  }

  /** Table with two sibling columns [profile, address], each with an immediate child "street". */
  private Table twinStreetTable() {
    Column profileStreet = new Column().withName("street");
    Column profile =
        new Column().withName("profile").withChildren(new ArrayList<>(List.of(profileStreet)));
    Column addressStreet = new Column().withName("street");
    Column address =
        new Column().withName("address").withChildren(new ArrayList<>(List.of(addressStreet)));
    return new Table()
        .withId(UUID.randomUUID())
        .withName("people")
        .withColumns(new ArrayList<>(List.of(profile, address)));
  }

  @Test
  void updateFieldDescription_bareLeafInTwoSubtrees_refusesInsteadOfGuessing() {
    // A bare leaf "street" that lives under two sibling columns must not resolve to the first
    // sibling's child and report success — guessing the target is worse than declining.
    Table table = twinStreetTable();
    EntityRepository<?> repository = mock(EntityRepository.class);

    boolean updated =
        FieldPathUtils.updateFieldDescription(
            table, repository, "admin", "columns::street::description", "Road name");

    assertFalse(updated, "an ambiguous bare leaf must not be resolved by sibling iteration order");
    assertNull(
        table.getColumns().get(0).getChildren().get(0).getDescription(),
        "profile.street must not be written when the name is ambiguous");
    assertNull(
        table.getColumns().get(1).getChildren().get(0).getDescription(),
        "address.street must not be written when the name is ambiguous");
    verifyNoInteractions(repository);
  }

  @Test
  void getFieldDescription_bareLeafInTwoSubtrees_refusesInsteadOfGuessing() {
    Table table = twinStreetTable();
    table.getColumns().get(0).getChildren().get(0).setDescription("first");
    table.getColumns().get(1).getChildren().get(0).setDescription("second");

    Optional<String> description =
        FieldPathUtils.getFieldDescription(table, "columns::street::description");

    assertTrue(description.isEmpty(), "an ambiguous bare leaf must not return a value");
  }

  @Test
  void findField_bareLeafInTwoSubtrees_refusesInsteadOfGuessing() {
    // findField is what the tag path resolves through (TaskWorkflowHandler.patchFieldTags), so
    // an ambiguous bare leaf here would silently tag the first sibling's child.
    Table table = twinStreetTable();

    Optional<Object> found = FieldPathUtils.findField(table, "columns::street::tags");

    assertTrue(found.isEmpty(), "an ambiguous bare leaf must not resolve to a field POJO");
  }

  @Test
  void updateFieldDescription_bareLeafTwoDeepInTwoSubtrees_isDeclinedNotGuessed() {
    // The same ambiguity one level deeper: "street" is a grandchild of both siblings. The
    // recursive fallback must not write to the first sibling's grandchild either; declining is
    // the safe outcome for any bare leaf whose resolution would be a guess.
    Column profileStreet = new Column().withName("street");
    Column profileInner =
        new Column().withName("personal").withChildren(new ArrayList<>(List.of(profileStreet)));
    Column profile =
        new Column().withName("profile").withChildren(new ArrayList<>(List.of(profileInner)));
    Column addressStreet = new Column().withName("street");
    Column addressInner =
        new Column().withName("contact").withChildren(new ArrayList<>(List.of(addressStreet)));
    Column address =
        new Column().withName("address").withChildren(new ArrayList<>(List.of(addressInner)));
    Table table =
        new Table()
            .withId(UUID.randomUUID())
            .withName("people")
            .withColumns(new ArrayList<>(List.of(profile, address)));
    EntityRepository<?> repository = mock(EntityRepository.class);

    boolean updated =
        FieldPathUtils.updateFieldDescription(
            table, repository, "admin", "columns::street::description", "Road name");

    assertFalse(updated, "an ambiguous grandchild bare leaf must not be guessed");
    assertNull(profileStreet.getDescription(), "profile's deep street must not be written");
    assertNull(addressStreet.getDescription(), "address's deep street must not be written");
    verifyNoInteractions(repository);
  }

  @Test
  void updateFieldDescription_bareLeafInSingleSubtree_resolvesWithoutFalseRefusal() {
    // Counterweight: a bare leaf that lives in exactly one sibling's subtree must still
    // resolve, so the cross-subtree guard does not over-refuse unambiguous names.
    Column street = new Column().withName("street");
    Column profile =
        new Column().withName("profile").withChildren(new ArrayList<>(List.of(street)));
    Column other =
        new Column()
            .withName("address")
            .withChildren(new ArrayList<>(List.of(new Column().withName("city"))));
    Table table =
        new Table()
            .withId(UUID.randomUUID())
            .withName("people")
            .withColumns(new ArrayList<>(List.of(profile, other)));
    EntityRepository<?> repository = mock(EntityRepository.class);

    boolean updated =
        FieldPathUtils.updateFieldDescription(
            table, repository, "admin", "columns::street::description", "Road name");

    assertTrue(updated, "a unique bare leaf must still resolve");
    assertEquals("Road name", street.getDescription());
  }

  @Test
  void findField_dottedPathThroughNamedParentResolvesWithSiblingDuplicatePresent() {
    // Regression: a dotted path that names the parent resolves to that parent's child even when
    // a sibling subtree contains a same-named leaf; the cross-subtree guard is for bare leaves
    // that the caller did not anchor to a parent.
    Column profileStreet = new Column().withName("street");
    Column profile =
        new Column().withName("profile").withChildren(new ArrayList<>(List.of(profileStreet)));
    Column addressStreet = new Column().withName("street");
    Column address =
        new Column().withName("address").withChildren(new ArrayList<>(List.of(addressStreet)));
    Table table =
        new Table().withName("people").withColumns(new ArrayList<>(List.of(profile, address)));

    Optional<Object> found =
        FieldPathUtils.findField(table, "columns::address.street::description");

    assertTrue(found.isPresent());
    assertSame(addressStreet, found.get());
  }

  @Test
  void getFieldDescription_bareLeafMissingEverywhere_isEmpty() {
    // A bare leaf that matches no sibling's children is simply absent (not guessed).
    Table table = twinStreetTable();

    Optional<String> description =
        FieldPathUtils.getFieldDescription(table, "columns::nope::description");

    assertTrue(description.isEmpty());
  }

  private FieldPathComponents invokeParseFieldPath(String fieldPath) throws Exception {
    Method method = FieldPathUtils.class.getDeclaredMethod("parseFieldPath", String.class);
    method.setAccessible(true);
    return (FieldPathComponents) method.invoke(null, fieldPath);
  }
}
