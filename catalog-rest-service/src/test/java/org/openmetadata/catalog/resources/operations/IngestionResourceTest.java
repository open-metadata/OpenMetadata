/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.catalog.resources.operations;

import org.apache.http.client.HttpResponseException;
import org.joda.time.DateTime;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.operations.workflows.CreateIngestion;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.jdbi3.IngestionRepository;
import org.openmetadata.catalog.operations.workflows.ConnectorConfig;
import org.openmetadata.catalog.operations.workflows.Ingestion;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityHistory;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.FieldChange;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.TestUtils;

import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.Response.Status;
import java.io.IOException;
import java.net.URISyntaxException;
import java.util.Date;
import java.util.Map;
import java.util.UUID;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.CONFLICT;
import static javax.ws.rs.core.Response.Status.FORBIDDEN;
import static javax.ws.rs.core.Response.Status.NOT_FOUND;
import static javax.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;
import static org.openmetadata.catalog.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.catalog.util.TestUtils.adminAuthHeaders;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;
import static org.openmetadata.catalog.util.TestUtils.authHeaders;

public class IngestionResourceTest extends EntityResourceTest<Ingestion> {
    public static ConnectorConfig INGESTION_CONFIG;

    public IngestionResourceTest() {
        super(Ingestion.class, IngestionResource.IngestionList.class, "ingestion",
                IngestionResource.FIELDS, false, true, true);
    }


    @BeforeAll
    public static void setup(TestInfo test) throws HttpResponseException, URISyntaxException {
        EntityResourceTest.setup(test);
        INGESTION_CONFIG = new ConnectorConfig().withEnableDataProfiler(true).withUsername("test")
                .withPassword("test").withHost("localhost:9092");
    }

    @Override
    public Object createRequest(TestInfo test, int index, String description,
                                String displayName, EntityReference owner) {
        return create(test, index).withDescription(description).withDisplayName(displayName).withOwner(owner);
    }

    @Override
    public void validateCreatedEntity(Ingestion ingestion, Object request, Map<String, String> authHeaders)
            throws HttpResponseException {
        CreateIngestion createRequest = (CreateIngestion) request;
        validateCommonEntityFields(getEntityInterface(ingestion), createRequest.getDescription(),
                TestUtils.getPrincipal(authHeaders), createRequest.getOwner());
        assertEquals(createRequest.getDisplayName(), ingestion.getDisplayName());
        assertEquals(createRequest.getConcurrency(), ingestion.getConcurrency());
        assertEquals(createRequest.getConnectorConfig(), ingestion.getConnectorConfig());
        TestUtils.validateTags(createRequest.getTags(), ingestion.getTags());
    }

    @Override
    public void validateUpdatedEntity(Ingestion ingestion, Object request, Map<String, String> authHeaders)
            throws HttpResponseException {
        validateCreatedEntity(ingestion, request, authHeaders);
    }

    @Override
    public void validatePatchedEntity(Ingestion expected, Ingestion updated, Map<String, String> authHeaders)
            throws HttpResponseException {
        validateCommonEntityFields(getEntityInterface(updated), expected.getDescription(),
                TestUtils.getPrincipal(authHeaders), expected.getOwner());
        assertEquals(expected.getDisplayName(), updated.getDisplayName());
        assertService(expected.getService(), updated.getService());
        assertEquals(expected.getConnectorConfig(), updated.getConnectorConfig());
        TestUtils.validateTags(expected.getTags(), updated.getTags());
    }

    @Override
    public EntityInterface<Ingestion> getEntityInterface(Ingestion entity) {
        return new IngestionRepository.IngestionEntityInterface(entity);
    }

    @Override
    public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
        if (expected == null && actual == null) {
            return;
        }
        assertCommonFieldChange(fieldName, expected, actual);

    }


    @Test
    public void post_ingestionWithoutName_400_badRequest(TestInfo test) {
        // Create ingestion with mandatory name field empty
        CreateIngestion create = create(test).withName("");
        HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
                createIngestion(create, adminAuthHeaders()));
        assertResponse(exception, BAD_REQUEST, "[name size must be between 1 and 256]");
    }

    @Test
    public void post_IngestionAlreadyExists_409_conflict(TestInfo test) throws HttpResponseException {
        CreateIngestion create = create(test);
        createIngestion(create, adminAuthHeaders());
        HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
                createIngestion(create, adminAuthHeaders()));
        assertResponse(exception, CONFLICT, CatalogExceptionMessage.ENTITY_ALREADY_EXISTS);
    }

    @Test
    public void post_validIngestion_as_admin_200_OK(TestInfo test) throws HttpResponseException {
        // Create team with different optional fields
        CreateIngestion create = create(test);
        createAndCheckEntity(create, adminAuthHeaders());

        create.withName(getIngestionName(test, 1)).withDescription("description");
        createAndCheckEntity(create, adminAuthHeaders());
    }

    @Test
    public void post_IngestionWithUserOwner_200_ok(TestInfo test) throws HttpResponseException {
        createAndCheckEntity(create(test).withOwner(USER_OWNER1), adminAuthHeaders());
    }

    @Test
    public void post_IngestionWithTeamOwner_200_ok(TestInfo test) throws HttpResponseException {
        createAndCheckEntity(create(test).withOwner(TEAM_OWNER1).withDisplayName("Ingestion1"), adminAuthHeaders());
    }

    @Test
    public void post_IngestionWithConfig_200_ok(TestInfo test) throws HttpResponseException {
        createAndCheckEntity(create(test).withConnectorConfig(INGESTION_CONFIG), adminAuthHeaders());
    }

    @Test
    public void post_Ingestion_as_non_admin_401(TestInfo test) {
        CreateIngestion create = create(test);
        HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
                createIngestion(create, authHeaders("test@open-metadata.org")));
        assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} is not admin");
    }

    @Test
    public void post_IngestionWithoutRequiredService_4xx(TestInfo test) {
        CreateIngestion create = create(test).withService(null);
        HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
                createIngestion(create, adminAuthHeaders()));
        TestUtils.assertResponseContains(exception, BAD_REQUEST, "service must not be null");
    }

    @Test
    public void post_IngestionWithInvalidOwnerType_4xx(TestInfo test) {
        EntityReference owner = new EntityReference().withId(TEAM1.getId()); /* No owner type is set */

        CreateIngestion create = create(test).withOwner(owner);
        HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
                createIngestion(create, adminAuthHeaders()));
        TestUtils.assertResponseContains(exception, BAD_REQUEST, "type must not be null");
    }

    @Test
    public void post_IngestionWithDeploy_4xx(TestInfo test) {
        CreateIngestion create = create(test).withService(BIGQUERY_REFERENCE).withForceDeploy(true);
        HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
                createIngestion(create, adminAuthHeaders()));
    }

    @Test
    public void post_IngestionWithNonExistentOwner_4xx(TestInfo test) {
        EntityReference owner = new EntityReference().withId(TestUtils.NON_EXISTENT_ENTITY).withType("user");
        CreateIngestion create = create(test).withOwner(owner);
        HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
                createIngestion(create, adminAuthHeaders()));
        assertResponse(exception, NOT_FOUND, entityNotFound("User", TestUtils.NON_EXISTENT_ENTITY));
    }

    @Test
    public void post_IngestionWithDifferentService_200_ok(TestInfo test) throws HttpResponseException {
        EntityReference[] differentServices = {REDSHIFT_REFERENCE, BIGQUERY_REFERENCE};

        // Create Ingestion for each service and test APIs
        for (EntityReference service : differentServices) {
            Ingestion ingestion = createAndCheckEntity(create(test).withService(service), adminAuthHeaders());
            assertEquals(service.getName(), ingestion.getService().getName());
        }
    }

    @Test
    public void put_IngestionUrlUpdate_200(TestInfo test) throws HttpResponseException, URISyntaxException {
        CreateIngestion request = create(test).withService(new EntityReference().withId(BIGQUERY_REFERENCE.getId())
                .withType("databaseService")).withDescription("description");
        createAndCheckEntity(request, adminAuthHeaders());
        Integer pipelineConcurrency = 110;
        Date startDate = new DateTime("2021-11-13T20:20:39+00:00").toDate();

        // Updating description is ignored when backend already has description
        Ingestion ingestion = updateIngestion(request.withConnectorConfig(INGESTION_CONFIG)
                .withConcurrency(pipelineConcurrency)
                .withStartDate(startDate.toString()), OK, adminAuthHeaders());
        String expectedFQN = BIGQUERY_REFERENCE.getName()+"."+ingestion.getName();
        assertEquals(startDate.toString(), ingestion.getStartDate());
        assertEquals(pipelineConcurrency, ingestion.getConcurrency());
        assertEquals(expectedFQN, ingestion.getFullyQualifiedName());
    }

    @Test
    public void put_IngestionUpdate_200(TestInfo test) throws IOException {
        CreateIngestion request = create(test).withService(BIGQUERY_REFERENCE).withDescription(null).withOwner(null);
        Ingestion ingestion = createAndCheckEntity(request, adminAuthHeaders());

        // Add description and tasks
        ChangeDescription change = getChangeDescription(ingestion.getVersion());
        change.getFieldsAdded().add(new FieldChange().withName("description").withNewValue("newDescription"));
        change.getFieldsAdded().add(new FieldChange().withName("owner").withNewValue(USER_OWNER1));
        updateAndCheckEntity(request.withDescription("newDescription").withOwner(USER_OWNER1),
                OK, adminAuthHeaders(), MINOR_UPDATE, change);
    }

    @Test
    public void get_nonExistentPipeline_404_notFound() {
        HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
                getIngestion(TestUtils.NON_EXISTENT_ENTITY, adminAuthHeaders()));
        assertResponse(exception, NOT_FOUND,
                entityNotFound(Entity.INGESTION, TestUtils.NON_EXISTENT_ENTITY));
    }

    @Test
    public void get_IngestionWithDifferentFields_200_OK(TestInfo test) throws HttpResponseException {
        CreateIngestion create = create(test).withDescription("description").withOwner(USER_OWNER1)
                .withService(REDSHIFT_REFERENCE).withConcurrency(10);
        Ingestion ingestion = createAndCheckEntity(create, adminAuthHeaders());
        validateGetWithDifferentFields(ingestion, false);
    }

    @Test
    public void get_IngestionByNameWithDifferentFields_200_OK(TestInfo test) throws HttpResponseException {
        CreateIngestion create = create(test).withDescription("description").withOwner(USER_OWNER1)
                .withService(BIGQUERY_REFERENCE);
        Ingestion ingestion = createAndCheckEntity(create, adminAuthHeaders());
        validateGetWithDifferentFields(ingestion, true);
    }

    @Test
    public void delete_ingestion_200_ok(TestInfo test) throws HttpResponseException {
        Ingestion ingestion = createIngestion(create(test), adminAuthHeaders());
        deleteIngestion(ingestion.getId(), adminAuthHeaders());
    }

    @Test
    public void delete_nonEmptyPipeline_4xx() {
        // TODO
    }

    @Test
    public void delete_nonExistentPipeline_404() {
        HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
                deleteIngestion(TestUtils.NON_EXISTENT_ENTITY, adminAuthHeaders()));
        assertResponse(exception, NOT_FOUND, entityNotFound(Entity.INGESTION, TestUtils.NON_EXISTENT_ENTITY));
    }

    public static Ingestion updateIngestion(CreateIngestion create,
                                          Status status,
                                          Map<String, String> authHeaders) throws HttpResponseException {
        return TestUtils.put(getOperationsResource("ingestion"),
                create, Ingestion.class, status, authHeaders);
    }

    public static Ingestion createIngestion(CreateIngestion create,
                                          Map<String, String> authHeaders) throws HttpResponseException {
        return TestUtils.post(getOperationsResource("ingestion"), create, Ingestion.class, authHeaders);
    }

    /** Validate returned fields GET .../operations/ingestion/{id}?fields="..." or
     * GET .../operations/ingestion/name/{fqn}?fields="..." */
    private void validateGetWithDifferentFields(Ingestion ingestion, boolean byName) throws HttpResponseException {
        // .../Pipelines?fields=owner
        String fields = "owner";
        ingestion = byName ? getIngestionByName(ingestion.getFullyQualifiedName(), fields, adminAuthHeaders()) :
                getIngestion(ingestion.getId(), fields, adminAuthHeaders());
        assertNotNull(ingestion.getOwner());
        assertNotNull(ingestion.getService()); // We always return the service

        // .../ingestion?fields=owner,service
        fields = "owner,service";
        ingestion = byName ? getIngestionByName(ingestion.getFullyQualifiedName(), fields, adminAuthHeaders()) :
                getIngestion(ingestion.getId(), fields, adminAuthHeaders());
        assertNotNull(ingestion.getOwner());
        assertNotNull(ingestion.getService());

    }

    public static void getIngestion(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
        getIngestion(id, null, authHeaders);
    }

    public static Ingestion getIngestion(UUID id, String fields, Map<String, String> authHeaders)
            throws HttpResponseException {
        WebTarget target = getOperationsResource("ingestion/" + id);
        target = fields != null ? target.queryParam("fields", fields): target;
        return TestUtils.get(target, Ingestion.class, authHeaders);
    }

    public static Ingestion getIngestionByName(String fqn, String fields, Map<String, String> authHeaders)
            throws HttpResponseException {
        WebTarget target = getOperationsResource("ingestion/name/" + fqn);
        target = fields != null ? target.queryParam("fields", fields): target;
        return TestUtils.get(target, Ingestion.class, authHeaders);
    }

    private void deleteIngestion(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
        TestUtils.delete(getOperationsResource("ingestion/" + id), authHeaders);

        // Ensure deleted ingestion does not exist
        HttpResponseException exception = assertThrows(HttpResponseException.class,
                () -> getIngestion(id, authHeaders));
        assertResponse(exception, NOT_FOUND, entityNotFound(Entity.INGESTION, id));
    }

    public static String getIngestionName(TestInfo test) {
        return String.format("inge_%s", test.getDisplayName());
    }

    public static String getIngestionName(TestInfo test, int index) {
        return String.format("inge%d_%s", index, test.getDisplayName());
    }

    public static CreateIngestion create(TestInfo test) {
        return new CreateIngestion().withName(getIngestionName(test)).withService(BIGQUERY_REFERENCE)
                .withConnectorConfig(INGESTION_CONFIG).withStartDate("2021-11-21").withOwner(TEAM_OWNER1);
    }

    public static CreateIngestion create(TestInfo test, int index) {
        return new CreateIngestion().withName(getIngestionName(test, index)).withService(REDSHIFT_REFERENCE)
                .withConnectorConfig(INGESTION_CONFIG).withStartDate("2021-11-21").withOwner(USER_OWNER1);
    }

    @Override
    protected final WebTarget getCollection() {
        return getOperationsResource("ingestion");
    }

    @Override
    protected final WebTarget getResource(UUID id) {
        return getOperationsResource("ingestion" + "/" + id);
    }

    @Override
    protected EntityHistory getVersionList(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
        WebTarget target = getOperationsResource("ingestion/" + id + "/versions");
        return TestUtils.get(target, EntityHistory.class, authHeaders);
    }

    @Override
    protected Ingestion getVersion(UUID id, Double version, Map<String, String> authHeaders)
            throws HttpResponseException {
        WebTarget target = getOperationsResource("ingestion/" + id + "/versions/" + version.toString());
        return TestUtils.get(target, Ingestion.class, authHeaders);
    }
}

