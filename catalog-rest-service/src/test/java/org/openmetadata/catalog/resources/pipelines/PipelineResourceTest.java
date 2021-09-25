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

package org.openmetadata.catalog.resources.pipelines;

import com.fasterxml.jackson.core.JsonProcessingException;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.catalog.CatalogApplicationTest;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.data.CreateTask;
import org.openmetadata.catalog.api.data.CreatePipeline;
import org.openmetadata.catalog.api.services.CreatePipelineService;
import org.openmetadata.catalog.entity.data.Pipeline;
import org.openmetadata.catalog.entity.data.Task;
import org.openmetadata.catalog.entity.services.PipelineService;
import org.openmetadata.catalog.entity.teams.Team;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.resources.tasks.TaskResourceTest;
import org.openmetadata.catalog.resources.pipelines.PipelineResource.PipelineList;
import org.openmetadata.catalog.resources.services.PipelineServiceResourceTest;
import org.openmetadata.catalog.resources.tags.TagResourceTest;
import org.openmetadata.catalog.resources.teams.TeamResourceTest;
import org.openmetadata.catalog.resources.teams.UserResourceTest;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.TestUtils;
import org.openmetadata.common.utils.JsonSchemaUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.json.JsonPatch;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.Response.Status;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import static java.util.Collections.singletonList;
import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.CONFLICT;
import static javax.ws.rs.core.Response.Status.CREATED;
import static javax.ws.rs.core.Response.Status.FORBIDDEN;
import static javax.ws.rs.core.Response.Status.NOT_FOUND;
import static javax.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.readOnlyAttribute;
import static org.openmetadata.catalog.util.TestUtils.adminAuthHeaders;
import static org.openmetadata.catalog.util.TestUtils.assertEntityPagination;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;
import static org.openmetadata.catalog.util.TestUtils.authHeaders;

public class PipelineResourceTest extends CatalogApplicationTest {
  private static final Logger LOG = LoggerFactory.getLogger(PipelineResourceTest.class);
  public static User USER1;
  public static EntityReference USER_OWNER1;
  public static Team TEAM1;
  public static EntityReference TEAM_OWNER1;
  public static EntityReference AIRFLOW_REFERENCE;
  public static EntityReference PREFECT_REFERENCE;
  public static List<EntityReference> TASK_REFERENCES;
  public static final TagLabel TIER_1 = new TagLabel().withTagFQN("Tier.Tier1");
  public static final TagLabel USER_ADDRESS_TAG_LABEL = new TagLabel().withTagFQN("User.Address");


  @BeforeAll
  public static void setup(TestInfo test) throws HttpResponseException, URISyntaxException {
    USER1 = UserResourceTest.createUser(UserResourceTest.create(test), authHeaders("test@open-metadata.org"));
    USER_OWNER1 = new EntityReference().withId(USER1.getId()).withType("user");

    TEAM1 = TeamResourceTest.createTeam(TeamResourceTest.create(test), adminAuthHeaders());
    TEAM_OWNER1 = new EntityReference().withId(TEAM1.getId()).withType("team");

    CreatePipelineService createService = new CreatePipelineService().withName("airflow")
            .withServiceType(CreatePipelineService.PipelineServiceType.Airflow)
            .withPipelineUrl(TestUtils.PIPELINE_URL);

    PipelineService service = PipelineServiceResourceTest.createService(createService, adminAuthHeaders());
    AIRFLOW_REFERENCE = EntityUtil.getEntityReference(service);

    createService.withName("prefect").withServiceType(CreatePipelineService.PipelineServiceType.Prefect);
    service = PipelineServiceResourceTest.createService(createService, adminAuthHeaders());
    PREFECT_REFERENCE = EntityUtil.getEntityReference(service);
    TASK_REFERENCES = new ArrayList<>();
    for (int i=0; i < 3; i++) {
      CreateTask createTask = TaskResourceTest.create(test, i).withService(AIRFLOW_REFERENCE);
      Task task = TaskResourceTest.createTask(createTask, adminAuthHeaders());
      TASK_REFERENCES.add(EntityUtil.getEntityReference(task));
    }

  }

  @Test
  public void post_pipelineWithLongName_400_badRequest(TestInfo test) {
    // Create pipeline with mandatory name field empty
    CreatePipeline create = create(test).withName(TestUtils.LONG_ENTITY_NAME);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createPipeline(create, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[name size must be between 1 and 64]");
  }

  @Test
  public void post_pipelineWithoutName_400_badRequest(TestInfo test) {
    // Create Pipeline with mandatory name field empty
    CreatePipeline create = create(test).withName("");
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createPipeline(create, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[name size must be between 1 and 64]");
  }

  @Test
  public void post_PipelineAlreadyExists_409_conflict(TestInfo test) throws HttpResponseException {
    CreatePipeline create = create(test);
    createPipeline(create, adminAuthHeaders());
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createPipeline(create, adminAuthHeaders()));
    assertResponse(exception, CONFLICT, CatalogExceptionMessage.ENTITY_ALREADY_EXISTS);
  }

  @Test
  public void post_validPipelines_as_admin_200_OK(TestInfo test) throws HttpResponseException {
    // Create team with different optional fields
    CreatePipeline create = create(test);
    createAndCheckPipeline(create, adminAuthHeaders());

    create.withName(getPipelineName(test, 1)).withDescription("description");
    createAndCheckPipeline(create, adminAuthHeaders());
  }

  @Test
  public void post_PipelineWithUserOwner_200_ok(TestInfo test) throws HttpResponseException {
    createAndCheckPipeline(create(test).withOwner(USER_OWNER1), adminAuthHeaders());
  }

  @Test
  public void post_PipelineWithTeamOwner_200_ok(TestInfo test) throws HttpResponseException {
    createAndCheckPipeline(create(test).withOwner(TEAM_OWNER1).withDisplayName("Pipeline1"), adminAuthHeaders());
  }

  @Test
  public void post_PipelineWithTASKs_200_ok(TestInfo test) throws HttpResponseException {
    createAndCheckPipeline(create(test), TASK_REFERENCES, adminAuthHeaders());
  }

  @Test
  public void post_Pipeline_as_non_admin_401(TestInfo test) {
    CreatePipeline create = create(test);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createPipeline(create, authHeaders("test@open-metadata.org")));
    assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  @Test
  public void post_PipelineWithoutRequiredService_4xx(TestInfo test) {
    CreatePipeline create = create(test).withService(null);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createPipeline(create, adminAuthHeaders()));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "service must not be null");
  }

  @Test
  public void post_PipelineWithInvalidOwnerType_4xx(TestInfo test) {
    EntityReference owner = new EntityReference().withId(TEAM1.getId()); /* No owner type is set */

    CreatePipeline create = create(test).withOwner(owner);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createPipeline(create, adminAuthHeaders()));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "type must not be null");
  }

  @Test
  public void post_PipelineWithNonExistentOwner_4xx(TestInfo test) {
    EntityReference owner = new EntityReference().withId(TestUtils.NON_EXISTENT_ENTITY).withType("user");
    CreatePipeline create = create(test).withOwner(owner);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createPipeline(create, adminAuthHeaders()));
    assertResponse(exception, NOT_FOUND, entityNotFound("User", TestUtils.NON_EXISTENT_ENTITY));
  }

  @Test
  public void post_PipelineWithDifferentService_200_ok(TestInfo test) throws HttpResponseException {
    EntityReference[] differentServices = {AIRFLOW_REFERENCE, PREFECT_REFERENCE};

    // Create Pipeline for each service and test APIs
    for (EntityReference service : differentServices) {
      createAndCheckPipeline(create(test).withService(service), adminAuthHeaders());

      // List Pipelines by filtering on service name and ensure right Pipelines are returned in the response
      PipelineList list = listPipelines("service", service.getName(), adminAuthHeaders());
      for (Pipeline db : list.getData()) {
        assertEquals(service.getName(), db.getService().getName());
      }
    }
  }

  @Test
  public void get_PipelineListWithInvalidLimitOffset_4xx() {
    // Limit must be >= 1 and <= 1000,000
    HttpResponseException exception = assertThrows(HttpResponseException.class, ()
            -> listPipelines(null, null, -1, null, null, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[query param limit must be greater than or equal to 1]");

    exception = assertThrows(HttpResponseException.class, ()
            -> listPipelines(null, null, 0, null, null, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[query param limit must be greater than or equal to 1]");

    exception = assertThrows(HttpResponseException.class, ()
            -> listPipelines(null, null, 1000001, null, null, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[query param limit must be less than or equal to 1000000]");
  }

  @Test
  public void get_PipelineListWithInvalidPaginationCursors_4xx() {
    // Passing both before and after cursors is invalid
    HttpResponseException exception = assertThrows(HttpResponseException.class, ()
            -> listPipelines(null, null, 1, "", "", adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "Only one of before or after query parameter allowed");
  }

  @Test
  public void get_PipelineListWithValidLimitOffset_4xx(TestInfo test) throws HttpResponseException {
    // Create a large number of Pipelines
    int maxPipelines = 40;
    for (int i = 0; i < maxPipelines; i++) {
      createPipeline(create(test, i), adminAuthHeaders());
    }

    // List all Pipelines
    PipelineList allPipelines = listPipelines(null, null, 1000000, null,
            null, adminAuthHeaders());
    int totalRecords = allPipelines.getData().size();
    printPipelines(allPipelines);

    // List limit number Pipelines at a time at various offsets and ensure right results are returned
    for (int limit = 1; limit < maxPipelines; limit++) {
      String after = null;
      String before;
      int pageCount = 0;
      int indexInAllPipelines = 0;
      PipelineList forwardPage;
      PipelineList backwardPage;
      do { // For each limit (or page size) - forward scroll till the end
        LOG.info("Limit {} forward scrollCount {} afterCursor {}", limit, pageCount, after);
        forwardPage = listPipelines(null, null, limit, null, after, adminAuthHeaders());
        printPipelines(forwardPage);
        after = forwardPage.getPaging().getAfter();
        before = forwardPage.getPaging().getBefore();
        assertEntityPagination(allPipelines.getData(), forwardPage, limit, indexInAllPipelines);

        if (pageCount == 0) {  // CASE 0 - First page is being returned. There is no before cursor
          assertNull(before);
        } else {
          // Make sure scrolling back based on before cursor returns the correct result
          backwardPage = listPipelines(null, null, limit, before, null, adminAuthHeaders());
          assertEntityPagination(allPipelines.getData(), backwardPage, limit, (indexInAllPipelines - limit));
        }

        indexInAllPipelines += forwardPage.getData().size();
        pageCount++;
      } while (after != null);

      // We have now reached the last page - test backward scroll till the beginning
      pageCount = 0;
      indexInAllPipelines = totalRecords - limit - forwardPage.getData().size();
      do {
        LOG.info("Limit {} backward scrollCount {} beforeCursor {}", limit, pageCount, before);
        forwardPage = listPipelines(null, null, limit, before, null, adminAuthHeaders());
        printPipelines(forwardPage);
        before = forwardPage.getPaging().getBefore();
        assertEntityPagination(allPipelines.getData(), forwardPage, limit, indexInAllPipelines);
        pageCount++;
        indexInAllPipelines -= forwardPage.getData().size();
      } while (before != null);
    }
  }

  private void printPipelines(PipelineList list) {
    list.getData().forEach(Pipeline -> LOG.info("DB {}", Pipeline.getFullyQualifiedName()));
    LOG.info("before {} after {} ", list.getPaging().getBefore(), list.getPaging().getAfter());
  }

  @Test
  public void put_PipelineUpdateWithNoChange_200(TestInfo test) throws HttpResponseException {
    // Create a Pipeline with POST
    CreatePipeline request = create(test).withService(AIRFLOW_REFERENCE).withOwner(USER_OWNER1);
    createAndCheckPipeline(request, adminAuthHeaders());

    // Update Pipeline two times successfully with PUT requests
    updateAndCheckPipeline(request, OK, adminAuthHeaders());
    updateAndCheckPipeline(request, OK, adminAuthHeaders());
  }

  @Test
  public void put_PipelineCreate_200(TestInfo test) throws HttpResponseException {
    // Create a new Pipeline with put
    CreatePipeline request = create(test).withService(AIRFLOW_REFERENCE).withOwner(USER_OWNER1);
    updateAndCheckPipeline(request.withName(test.getDisplayName()).withDescription(null), CREATED, adminAuthHeaders());
  }

  @Test
  public void put_PipelineCreate_as_owner_200(TestInfo test) throws HttpResponseException {
    // Create a new Pipeline with put
    CreatePipeline request = create(test).withService(AIRFLOW_REFERENCE).withOwner(USER_OWNER1);
    // Add Owner as admin
    createAndCheckPipeline(request, adminAuthHeaders());
    //Update the table as Owner
    updateAndCheckPipeline(request.withName(test.getDisplayName()).withDescription(null),
            CREATED, authHeaders(USER1.getEmail()));

  }

  @Test
  public void put_PipelineNullDescriptionUpdate_200(TestInfo test) throws HttpResponseException {
    CreatePipeline request = create(test).withService(AIRFLOW_REFERENCE).withDescription(null);
    createAndCheckPipeline(request, adminAuthHeaders());

    // Update null description with a new description
    Pipeline db = updateAndCheckPipeline(request.withDisplayName("Pipeline1").
            withDescription("newDescription"), OK, adminAuthHeaders());
    assertEquals("newDescription", db.getDescription());
    assertEquals("Pipeline1", db.getDisplayName());
  }

  @Test
  public void put_PipelineEmptyDescriptionUpdate_200(TestInfo test) throws HttpResponseException {
    // Create table with empty description
    CreatePipeline request = create(test).withService(AIRFLOW_REFERENCE).withDescription("");
    createAndCheckPipeline(request, adminAuthHeaders());

    // Update empty description with a new description
    Pipeline db = updateAndCheckPipeline(request.withDescription("newDescription"), OK, adminAuthHeaders());
    assertEquals("newDescription", db.getDescription());
  }

  @Test
  public void put_PipelineNonEmptyDescriptionUpdate_200(TestInfo test) throws HttpResponseException {
    CreatePipeline request = create(test).withService(AIRFLOW_REFERENCE).withDescription("description");
    createAndCheckPipeline(request, adminAuthHeaders());

    // Updating description is ignored when backend already has description
    Pipeline db = updatePipeline(request.withDescription("newDescription"), OK, adminAuthHeaders());
    assertEquals("description", db.getDescription());
  }

  @Test
  public void put_PipelineUpdateOwner_200(TestInfo test) throws HttpResponseException {
    CreatePipeline request = create(test).withService(AIRFLOW_REFERENCE).withDescription("");
    createAndCheckPipeline(request, adminAuthHeaders());

    // Change ownership from USER_OWNER1 to TEAM_OWNER1
    updateAndCheckPipeline(request.withOwner(TEAM_OWNER1), OK, adminAuthHeaders());

    // Remove ownership
    Pipeline db = updateAndCheckPipeline(request.withOwner(null), OK, adminAuthHeaders());
    assertNull(db.getOwner());
  }


  @Test
  public void put_PipelineTASKsUpdate_200(TestInfo test) throws HttpResponseException {
    CreatePipeline request = create(test).withService(AIRFLOW_REFERENCE).withDescription(null);
    createAndCheckPipeline(request, adminAuthHeaders());

    Pipeline pipeline = updateAndCheckPipeline(request
                    .withDescription("newDescription").withTasks(TASK_REFERENCES),
            OK, adminAuthHeaders());
    validatePipelineTASKs(pipeline, TASK_REFERENCES);
    assertEquals("newDescription", pipeline.getDescription());
  }

  @Test
  public void put_AddRemovePipelineTASKsUpdate_200(TestInfo test) throws HttpResponseException {
    CreatePipeline request = create(test).withService(AIRFLOW_REFERENCE).withDescription(null);
    createAndCheckPipeline(request, adminAuthHeaders());

    Pipeline pipeline = updateAndCheckPipeline(request
                    .withDescription("newDescription").withTasks(TASK_REFERENCES),
            OK, adminAuthHeaders());
    validatePipelineTASKs(pipeline, TASK_REFERENCES);
    // remove a TASK
    TASK_REFERENCES.remove(0);
    pipeline = updateAndCheckPipeline(request
                    .withDescription("newDescription").withTasks(TASK_REFERENCES),
            OK, adminAuthHeaders());
    validatePipelineTASKs(pipeline, TASK_REFERENCES);
  }

  @Test
  public void get_nonExistentPipeline_404_notFound() {
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            getPipeline(TestUtils.NON_EXISTENT_ENTITY, adminAuthHeaders()));
    assertResponse(exception, NOT_FOUND,
            entityNotFound(Entity.PIPELINE, TestUtils.NON_EXISTENT_ENTITY));
  }

  @Test
  public void get_PipelineWithDifferentFields_200_OK(TestInfo test) throws HttpResponseException {
    CreatePipeline create = create(test).withDescription("description").withOwner(USER_OWNER1)
            .withService(AIRFLOW_REFERENCE);
    Pipeline pipeline = createAndCheckPipeline(create, adminAuthHeaders());
    validateGetWithDifferentFields(pipeline, false);
  }

  @Test
  public void get_PipelineByNameWithDifferentFields_200_OK(TestInfo test) throws HttpResponseException {
    CreatePipeline create = create(test).withDescription("description").withOwner(USER_OWNER1)
            .withService(AIRFLOW_REFERENCE);
    Pipeline pipeline = createAndCheckPipeline(create, adminAuthHeaders());
    validateGetWithDifferentFields(pipeline, true);
  }

  @Test
  public void patch_PipelineAttributes_200_ok(TestInfo test) throws HttpResponseException, JsonProcessingException {
    // Create Pipeline without description, owner
    Pipeline pipeline = createPipeline(create(test), adminAuthHeaders());
    assertNull(pipeline.getDescription());
    assertNull(pipeline.getOwner());
    assertNotNull(pipeline.getService());

    pipeline = getPipeline(pipeline.getId(), "service,owner", adminAuthHeaders());
    pipeline.getService().setHref(null); // href is readonly and not patchable
    List<TagLabel> pipelineTags = singletonList(TIER_1);

    // Add description, owner when previously they were null
    pipeline = patchPipelineAttributesAndCheck(pipeline, "description",
            TEAM_OWNER1, pipelineTags, adminAuthHeaders());
    pipeline.setOwner(TEAM_OWNER1); // Get rid of href and name returned in the response for owner
    pipeline.setService(AIRFLOW_REFERENCE); // Get rid of href and name returned in the response for service
    pipelineTags = singletonList(USER_ADDRESS_TAG_LABEL);
    // Replace description, tier, owner
    pipeline = patchPipelineAttributesAndCheck(pipeline, "description1",
            USER_OWNER1, pipelineTags, adminAuthHeaders());
    pipeline.setOwner(USER_OWNER1); // Get rid of href and name returned in the response for owner
    pipeline.setService(AIRFLOW_REFERENCE); // Get rid of href and name returned in the response for service

    // Remove description, tier, owner
    patchPipelineAttributesAndCheck(pipeline, null, null, pipelineTags, adminAuthHeaders());
  }

  @Test
  public void patch_PipelineIDChange_400(TestInfo test) throws HttpResponseException, JsonProcessingException {
    // Ensure Pipeline ID can't be changed using patch
    Pipeline pipeline = createPipeline(create(test), adminAuthHeaders());
    UUID pipelineId = pipeline.getId();
    String PipelineJson = JsonUtils.pojoToJson(pipeline);
    pipeline.setId(UUID.randomUUID());
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            patchPipeline(pipelineId, PipelineJson, pipeline, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, readOnlyAttribute(Entity.PIPELINE, "id"));

    // ID can't be deleted
    pipeline.setId(null);
    exception = assertThrows(HttpResponseException.class, () ->
            patchPipeline(pipelineId, PipelineJson, pipeline, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, readOnlyAttribute(Entity.PIPELINE, "id"));
  }

  @Test
  public void patch_PipelineNameChange_400(TestInfo test) throws HttpResponseException, JsonProcessingException {
    // Ensure Pipeline name can't be changed using patch
    Pipeline pipeline = createPipeline(create(test), adminAuthHeaders());
    String pipelineJson = JsonUtils.pojoToJson(pipeline);
    pipeline.setName("newName");
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            patchPipeline(pipelineJson, pipeline, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, readOnlyAttribute(Entity.PIPELINE, "name"));

    // Name can't be removed
    pipeline.setName(null);
    exception = assertThrows(HttpResponseException.class, () ->
            patchPipeline(pipelineJson, pipeline, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, readOnlyAttribute(Entity.PIPELINE, "name"));
  }

  @Test
  public void patch_PipelineRemoveService_400(TestInfo test) throws HttpResponseException, JsonProcessingException {
    // Ensure service corresponding to Pipeline can't be changed by patch operation
    Pipeline pipeline = createPipeline(create(test), adminAuthHeaders());
    pipeline.getService().setHref(null); // Remove href from returned response as it is read-only field

    String pipelineJson = JsonUtils.pojoToJson(pipeline);
    pipeline.setService(PREFECT_REFERENCE);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            patchPipeline(pipelineJson, pipeline, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, readOnlyAttribute(Entity.PIPELINE, "service"));

    // Service relationship can't be removed
    pipeline.setService(null);
    exception = assertThrows(HttpResponseException.class, () ->
            patchPipeline(pipelineJson, pipeline, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, readOnlyAttribute(Entity.PIPELINE, "service"));
  }

  // TODO listing tables test:1
  // TODO Change service?

  @Test
  public void delete_emptyPipeline_200_ok(TestInfo test) throws HttpResponseException {
    Pipeline pipeline = createPipeline(create(test), adminAuthHeaders());
    deletePipeline(pipeline.getId(), adminAuthHeaders());
  }

  @Test
  public void delete_nonEmptyPipeline_4xx() {
    // TODO
  }

  @Test
  public void delete_nonExistentPipeline_404() {
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            deletePipeline(TestUtils.NON_EXISTENT_ENTITY, adminAuthHeaders()));
    assertResponse(exception, NOT_FOUND, entityNotFound(Entity.PIPELINE, TestUtils.NON_EXISTENT_ENTITY));
  }

  public static Pipeline createAndCheckPipeline(CreatePipeline create,
                                                Map<String, String> authHeaders) throws HttpResponseException {
    Pipeline pipeline = createPipeline(create, authHeaders);
    validatePipeline(pipeline, create.getDisplayName(),
            create.getDescription(), create.getOwner(), create.getService());
    return getAndValidate(pipeline.getId(), create, authHeaders);
  }

  public static Pipeline createAndCheckPipeline(CreatePipeline create, List<EntityReference> tasks,
                                                  Map<String, String> authHeaders) throws HttpResponseException {
    create.withTasks(tasks);
    Pipeline pipeline = createPipeline(create, authHeaders);
    validatePipeline(pipeline, create.getDescription(), create.getOwner(), create.getService(), create.getTags(),
            tasks);
    return getAndValidate(pipeline.getId(), create, authHeaders);
  }

  public static Pipeline updateAndCheckPipeline(CreatePipeline create,
                                                Status status,
                                                Map<String, String> authHeaders) throws HttpResponseException {
    Pipeline updatedPipeline = updatePipeline(create, status, authHeaders);
    validatePipeline(updatedPipeline, create.getDescription(), create.getOwner(), create.getService());

    // GET the newly updated Pipeline and validate
    return getAndValidate(updatedPipeline.getId(), create, authHeaders);
  }

  // Make sure in GET operations the returned Pipeline has all the required information passed during creation
  public static Pipeline getAndValidate(UUID PipelineId,
                                        CreatePipeline create,
                                        Map<String, String> authHeaders) throws HttpResponseException {
    // GET the newly created Pipeline by ID and validate
    Pipeline pipeline = getPipeline(PipelineId, "service,owner,tasks", authHeaders);
    validatePipeline(pipeline, create.getDescription(), create.getOwner(), create.getService());

    // GET the newly created Pipeline by name and validate
    String fqn = pipeline.getFullyQualifiedName();
    pipeline = getPipelineByName(fqn, "service,owner,tasks", authHeaders);
    return validatePipeline(pipeline, create.getDescription(), create.getOwner(), create.getService());
  }

  public static Pipeline updatePipeline(CreatePipeline create,
                                        Status status,
                                        Map<String, String> authHeaders) throws HttpResponseException {
    return TestUtils.put(getResource("pipelines"),
                          create, Pipeline.class, status, authHeaders);
  }

  public static Pipeline createPipeline(CreatePipeline create,
                                        Map<String, String> authHeaders) throws HttpResponseException {
    return TestUtils.post(getResource("pipelines"), create, Pipeline.class, authHeaders);
  }

  /** Validate returned fields GET .../pipelines/{id}?fields="..." or GET .../pipelines/name/{fqn}?fields="..." */
  private void validateGetWithDifferentFields(Pipeline pipeline, boolean byName) throws HttpResponseException {
    // .../Pipelines?fields=owner
    String fields = "owner";
    pipeline = byName ? getPipelineByName(pipeline.getFullyQualifiedName(), fields, adminAuthHeaders()) :
            getPipeline(pipeline.getId(), fields, adminAuthHeaders());
    assertNotNull(pipeline.getOwner());
    assertNull(pipeline.getService());
    assertNull(pipeline.getTasks());

    // .../Pipelines?fields=owner,service
    fields = "owner,service";
    pipeline = byName ? getPipelineByName(pipeline.getFullyQualifiedName(), fields, adminAuthHeaders()) :
            getPipeline(pipeline.getId(), fields, adminAuthHeaders());
    assertNotNull(pipeline.getOwner());
    assertNotNull(pipeline.getService());
    assertNull(pipeline.getTasks());

    // .../Pipelines?fields=owner,service,tables
    fields = "owner,service,tasks";
    pipeline = byName ? getPipelineByName(pipeline.getFullyQualifiedName(), fields, adminAuthHeaders()) :
            getPipeline(pipeline.getId(), fields, adminAuthHeaders());
    assertNotNull(pipeline.getOwner());
    assertNotNull(pipeline.getService());
    assertNotNull(pipeline.getTasks());
    TestUtils.validateEntityReference(pipeline.getTasks());

  }

  private static Pipeline validatePipeline(Pipeline pipeline, String expectedDisplayName,
                                             String expectedDescription,
                                             EntityReference expectedOwner, EntityReference expectedService) {
    Pipeline newPipeline = validatePipeline(pipeline, expectedDescription, expectedOwner, expectedService);
    assertEquals(expectedDisplayName, newPipeline.getDisplayName());
    return newPipeline;
  }
  private static Pipeline validatePipeline(Pipeline pipeline, String expectedDescription,
                                            EntityReference expectedOwner, EntityReference expectedService) {
    assertNotNull(pipeline.getId());
    assertNotNull(pipeline.getHref());
    assertEquals(expectedDescription, pipeline.getDescription());

    // Validate owner
    if (expectedOwner != null) {
      TestUtils.validateEntityReference(pipeline.getOwner());
      assertEquals(expectedOwner.getId(), pipeline.getOwner().getId());
      assertEquals(expectedOwner.getType(), pipeline.getOwner().getType());
      assertNotNull(pipeline.getOwner().getHref());
    }

    // Validate service
    if (expectedService != null) {
      TestUtils.validateEntityReference(pipeline.getService());
      assertEquals(expectedService.getId(), pipeline.getService().getId());
      assertEquals(expectedService.getType(), pipeline.getService().getType());
    }
    return pipeline;
  }

  private static Pipeline validatePipeline(Pipeline pipeline, String expectedDescription,
                                             EntityReference expectedOwner, EntityReference expectedService,
                                              List<TagLabel> expectedTags,
                                              List<EntityReference> TASKs) throws HttpResponseException {
    assertNotNull(pipeline.getId());
    assertNotNull(pipeline.getHref());
    assertEquals(expectedDescription, pipeline.getDescription());

    // Validate owner
    if (expectedOwner != null) {
      TestUtils.validateEntityReference(pipeline.getOwner());
      assertEquals(expectedOwner.getId(), pipeline.getOwner().getId());
      assertEquals(expectedOwner.getType(), pipeline.getOwner().getType());
      assertNotNull(pipeline.getOwner().getHref());
    }

    // Validate service
    if (expectedService != null) {
      TestUtils.validateEntityReference(pipeline.getService());
      assertEquals(expectedService.getId(), pipeline.getService().getId());
      assertEquals(expectedService.getType(), pipeline.getService().getType());
    }
    validatePipelineTASKs(pipeline, TASKs);
    validateTags(expectedTags, pipeline.getTags());
    return pipeline;
  }

  private static void validatePipelineTASKs(Pipeline pipeline, List<EntityReference> Tasks) {
    if (Tasks != null) {
      List<UUID> expectedTASKReferences = new ArrayList<>();
      for (EntityReference Task: Tasks) {
        expectedTASKReferences.add(Task.getId());
      }
      List<UUID> actualTaskReferences = new ArrayList<>();
      for (EntityReference task: pipeline.getTasks()) {
        TestUtils.validateEntityReference(task);
        actualTaskReferences.add(task.getId());
      }
      assertTrue(actualTaskReferences.containsAll(expectedTASKReferences));
    }
  }

  private static void validateTags(List<TagLabel> expectedList, List<TagLabel> actualList)
          throws HttpResponseException {
    if (expectedList == null) {
      return;
    }
    // When tags from the expected list is added to an entity, the derived tags for those tags are automatically added
    // So add to the expectedList, the derived tags before validating the tags
    List<TagLabel> updatedExpectedList = new ArrayList<>(expectedList);
    for (TagLabel expected : expectedList) {
      List<TagLabel> derived = EntityUtil.getDerivedTags(expected, TagResourceTest.getTag(expected.getTagFQN(),
              adminAuthHeaders()));
      updatedExpectedList.addAll(derived);
    }
    updatedExpectedList = updatedExpectedList.stream().distinct().collect(Collectors.toList());

    assertTrue(actualList.containsAll(updatedExpectedList));
    assertTrue(updatedExpectedList.containsAll(actualList));
  }

  private Pipeline patchPipelineAttributesAndCheck(Pipeline pipeline, String newDescription,
                                                     EntityReference newOwner, List<TagLabel> tags,
                                                     Map<String, String> authHeaders)
          throws JsonProcessingException, HttpResponseException {
    String PipelineJson = JsonUtils.pojoToJson(pipeline);

    // Update the table attributes
    pipeline.setDescription(newDescription);
    pipeline.setOwner(newOwner);
    pipeline.setTags(tags);

    // Validate information returned in patch response has the updates
    Pipeline updatedPipeline = patchPipeline(PipelineJson, pipeline, authHeaders);
    validatePipeline(updatedPipeline, pipeline.getDescription(), newOwner, null, tags,
            pipeline.getTasks());

    // GET the table and Validate information returned
    Pipeline getPipeline = getPipeline(pipeline.getId(), "service,owner", authHeaders);
    validatePipeline(updatedPipeline, pipeline.getDescription(), newOwner, null, tags,
            pipeline.getTasks());
    return updatedPipeline;
  }

  private Pipeline patchPipeline(UUID pipelineId, String originalJson, Pipeline updatedPipeline,
                                 Map<String, String> authHeaders)
          throws JsonProcessingException, HttpResponseException {
    String updatePipelineJson = JsonUtils.pojoToJson(updatedPipeline);
    JsonPatch patch = JsonSchemaUtil.getJsonPatch(originalJson, updatePipelineJson);
    return TestUtils.patch(getResource("pipelines/" + pipelineId), patch, Pipeline.class, authHeaders);
  }

  private Pipeline patchPipeline(String originalJson,
                                 Pipeline updatedPipeline,
                                 Map<String, String> authHeaders)
          throws JsonProcessingException, HttpResponseException {
    return patchPipeline(updatedPipeline.getId(), originalJson, updatedPipeline, authHeaders);
  }

  public static void getPipeline(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
    getPipeline(id, null, authHeaders);
  }

  public static Pipeline getPipeline(UUID id, String fields, Map<String, String> authHeaders)
          throws HttpResponseException {
    WebTarget target = getResource("pipelines/" + id);
    target = fields != null ? target.queryParam("fields", fields): target;
    return TestUtils.get(target, Pipeline.class, authHeaders);
  }

  public static Pipeline getPipelineByName(String fqn, String fields, Map<String, String> authHeaders)
          throws HttpResponseException {
    WebTarget target = getResource("pipelines/name/" + fqn);
    target = fields != null ? target.queryParam("fields", fields): target;
    return TestUtils.get(target, Pipeline.class, authHeaders);
  }

  public static PipelineList listPipelines(String fields, String serviceParam, Map<String, String> authHeaders)
          throws HttpResponseException {
    return listPipelines(fields, serviceParam, null, null, null, authHeaders);
  }

  public static PipelineList listPipelines(String fields, String serviceParam, Integer limitParam,
                                           String before, String after, Map<String, String> authHeaders)
          throws HttpResponseException {
    WebTarget target = getResource("pipelines");
    target = fields != null ? target.queryParam("fields", fields): target;
    target = serviceParam != null ? target.queryParam("service", serviceParam): target;
    target = limitParam != null ? target.queryParam("limit", limitParam): target;
    target = before != null ? target.queryParam("before", before) : target;
    target = after != null ? target.queryParam("after", after) : target;
    return TestUtils.get(target, PipelineList.class, authHeaders);
  }

  private void deletePipeline(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
    TestUtils.delete(getResource("pipelines/" + id), authHeaders);

    // Ensure deleted Pipeline does not exist
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> getPipeline(id, authHeaders));
    assertResponse(exception, NOT_FOUND, entityNotFound(Entity.PIPELINE, id));
  }

  public static String getPipelineName(TestInfo test) {
    return String.format("pipe_%s", test.getDisplayName());
  }

  public static String getPipelineName(TestInfo test, int index) {
    return String.format("pipe%d_%s", index, test.getDisplayName());
  }

  public static CreatePipeline create(TestInfo test) {
    return new CreatePipeline().withName(getPipelineName(test)).withService(AIRFLOW_REFERENCE);
  }

  public static CreatePipeline create(TestInfo test, int index) {
    return new CreatePipeline().withName(getPipelineName(test, index)).withService(AIRFLOW_REFERENCE);
  }
}
