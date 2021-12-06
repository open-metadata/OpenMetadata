/*
 *  Copyright 2021 Collate 
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

package org.openmetadata.catalog.resources.locations;

import com.fasterxml.jackson.core.JsonProcessingException;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.catalog.CatalogApplicationTest;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.data.CreateLocation;
import org.openmetadata.catalog.api.services.CreateStorageService;
import org.openmetadata.catalog.entity.data.Location;
import org.openmetadata.catalog.entity.services.StorageService;
import org.openmetadata.catalog.entity.teams.Team;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.resources.locations.LocationResource.LocationList;
import org.openmetadata.catalog.resources.services.StorageServiceResourceTest;
import org.openmetadata.catalog.resources.tags.TagResourceTest;
import org.openmetadata.catalog.resources.teams.TeamResourceTest;
import org.openmetadata.catalog.resources.teams.UserResourceTest;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.StorageServiceType;
import org.openmetadata.catalog.type.Tag;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.TestUtils;
import org.openmetadata.common.utils.JsonSchemaUtil;

import javax.json.JsonPatch;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.Response.Status;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;

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
import static org.openmetadata.catalog.util.TestUtils.NON_EXISTENT_ENTITY;
import static org.openmetadata.catalog.util.TestUtils.adminAuthHeaders;
import static org.openmetadata.catalog.util.TestUtils.assertEntityPagination;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;
import static org.openmetadata.catalog.util.TestUtils.authHeaders;
import static org.openmetadata.catalog.util.TestUtils.existsInEntityReferenceList;
import static org.openmetadata.catalog.util.TestUtils.userAuthHeaders;

public class LocationResourceTest extends CatalogApplicationTest {
  public static User USER1;
  public static EntityReference USER_OWNER1;
  public static Team TEAM1;
  public static EntityReference TEAM_OWNER1;
  public static EntityReference AWS_REFERENCE;
  public static EntityReference GCP_REFERENCE;
  public static TagLabel TIER1_TAG_LABEL;
  public static TagLabel TIER2_TAG_LABEL;


  @BeforeAll
  public static void setup(TestInfo test) throws HttpResponseException {
    USER1 = UserResourceTest.createUser(new UserResourceTest().create(test),
            authHeaders("test@open-metadata.org"));
    USER_OWNER1 = new EntityReference().withId(USER1.getId()).withType("user");

    TeamResourceTest teamResourceTest = new TeamResourceTest();
    TEAM1 = TeamResourceTest.createTeam(teamResourceTest.create(test), adminAuthHeaders());
    TEAM_OWNER1 = new EntityReference().withId(TEAM1.getId()).withType("team");

    CreateStorageService createService = new CreateStorageService().withName("s3")
            .withServiceType(StorageServiceType.S3);
    StorageService service = new StorageServiceResourceTest().createEntity(createService, adminAuthHeaders());
    AWS_REFERENCE = new EntityReference().withName(service.getName()).withId(service.getId())
            .withType(Entity.STORAGE_SERVICE);

    createService.withName("gs").withServiceType(StorageServiceType.GCS);
    service = new StorageServiceResourceTest().createEntity(createService, adminAuthHeaders());
    GCP_REFERENCE = new EntityReference().withName(service.getName()).withId(service.getId())
            .withType(Entity.STORAGE_SERVICE);

    Tag tag = TagResourceTest.getTag("Tier.Tier1", adminAuthHeaders());
    TIER1_TAG_LABEL = new TagLabel().withTagFQN(tag.getFullyQualifiedName()).withDescription(tag.getDescription());
    tag = TagResourceTest.getTag("Tier.Tier2", adminAuthHeaders());
    TIER2_TAG_LABEL = new TagLabel().withTagFQN(tag.getFullyQualifiedName()).withDescription(tag.getDescription());
  }

  @Test
  public void get_locationListWithPrefix_2xx(TestInfo test) throws HttpResponseException {
    // Create some nested locations.
    List<String> paths = Arrays.asList("/" + test.getDisplayName(), "/dwh", "/catalog", "/schema", "/table");
    String locationName = paths.stream()
            .reduce("", (subtotal, element) -> {
              try {
                CreateLocation create = new CreateLocation().withName(subtotal + element).withService(AWS_REFERENCE);
                createLocation(create, adminAuthHeaders());
              } catch (HttpResponseException e) {
                throw new RuntimeException(e);
              }
              return subtotal + element;
            });

    // List all locations
    LocationList allLocations = listPrefixes(null, AWS_REFERENCE.getName() + "." + locationName, 1000000, null,
            null, adminAuthHeaders());
    assertEquals(5, allLocations.getData().size(), "Wrong number of prefix locations");
  }

  @Test
  public void post_locationAlreadyExists_409_conflict(TestInfo test) throws HttpResponseException {
    CreateLocation create = create(test);
    createLocation(create, adminAuthHeaders());
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createLocation(create, adminAuthHeaders()));
    assertResponse(exception, CONFLICT, CatalogExceptionMessage.ENTITY_ALREADY_EXISTS);
  }

  @Test
  public void post_validLocations_as_admin_200_OK(TestInfo test) throws HttpResponseException {
    // Create team with different optional fields
    CreateLocation create = create(test);
    createAndCheckLocation(create, adminAuthHeaders());

    create.withName(getLocationName(test, 1)).withDescription("description");
    createAndCheckLocation(create, adminAuthHeaders());
  }

  @Test
  public void post_locationWithUserOwner_200_ok(TestInfo test) throws HttpResponseException {
    createAndCheckLocation(create(test).withOwner(USER_OWNER1), adminAuthHeaders());
  }

  @Test
  public void post_locationWithTeamOwner_200_ok(TestInfo test) throws HttpResponseException {
    createAndCheckLocation(create(test).withOwner(TEAM_OWNER1), adminAuthHeaders());
  }

  @Test
  public void post_location_as_non_admin_401(TestInfo test) {
    CreateLocation create = create(test);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createLocation(create, authHeaders("test@open-metadata.org")));
    assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  @Test
  public void delete_location_200_ok(TestInfo test) throws HttpResponseException {
    Location location = createLocation(create(test), adminAuthHeaders());
    deleteLocation(location.getId(), adminAuthHeaders());
  }

  @Test
  public void delete_location_as_non_admin_401(TestInfo test) throws HttpResponseException {
    Location location = createLocation(create(test), adminAuthHeaders());
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            deleteLocation(location.getId(), authHeaders("test@open-metadata.org")));
    assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  @Test
  public void post_locationWithoutRequiredFields_4xx(TestInfo test) {
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createLocation(create(test).withName(null), adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[name must not be null]");

    // Service is required field
    exception = assertThrows(HttpResponseException.class, () ->
            createLocation(create(test).withService(null), adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[service must not be null]");
  }

  @Test
  public void post_locationWithInvalidOwnerType_4xx(TestInfo test) {
    EntityReference owner = new EntityReference().withId(TEAM1.getId()); /* No owner type is set */

    CreateLocation create = create(test).withOwner(owner);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createLocation(create, adminAuthHeaders()));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "type must not be null");
  }

  @Test
  public void post_locationWithNonExistentOwner_4xx(TestInfo test) {
    EntityReference owner = new EntityReference().withId(NON_EXISTENT_ENTITY).withType("user");
    CreateLocation create = create(test).withOwner(owner);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createLocation(create, adminAuthHeaders()));
    assertResponse(exception, NOT_FOUND, entityNotFound("User", NON_EXISTENT_ENTITY));
  }

  @Test
  public void post_locationWithDifferentService_200_ok(TestInfo test) throws HttpResponseException {
    EntityReference[] differentServices = {GCP_REFERENCE, AWS_REFERENCE};

    // Create location for each service and test APIs
    for (EntityReference service : differentServices) {
      createAndCheckLocation(create(test).withService(service), adminAuthHeaders());

      // List locations by filtering on service name and ensure right locations are returned in the response
//      LocationList list = listLocations("service", service.getName(), adminAuthHeaders());
//      for (Location location : list.getData()) {
//        assertEquals(service.getName(), location.getService().getName());
//      }
    }
  }

  @Test
  public void get_locationListWithInvalidLimitOffset_4xx() {
    // Limit must be >= 1 and <= 1000,000
    HttpResponseException exception = assertThrows(HttpResponseException.class, ()
            -> listLocations(null, null, -1, null, null, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[query param limit must be greater than or equal to 1]");

    exception = assertThrows(HttpResponseException.class, ()
            -> listLocations(null, null, 0, null, null, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[query param limit must be greater than or equal to 1]");

    exception = assertThrows(HttpResponseException.class, ()
            -> listLocations(null, null, 1000001, null, null, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[query param limit must be less than or equal to 1000000]");
  }

  @Test
  public void get_locationListWithInvalidPaginationCursors_4xx() {
    // Passing both before and after cursors is invalid
    HttpResponseException exception = assertThrows(HttpResponseException.class, ()
            -> listLocations(null, null, 1, "", "", adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "Only one of before or after query parameter allowed");
  }

  @Test
  public void get_locationPrefixesListWithValidLimitOffset_4xx(TestInfo test) throws HttpResponseException {
        /*
            /a
            /b
            /b/a
            /b/b
            /b/b/a
            /b/b/b
            /b/b/b/a
            /b/b/b/b
            ...
        */
    int maxLocations = 40;
    String location = "";
    for (int i = 0; i < maxLocations; i++) {
      CreateLocation create = new CreateLocation().withName(location + "/a").withService(AWS_REFERENCE);
      createLocation(create, adminAuthHeaders());
      location = location + "/b";
      create = new CreateLocation().withName(location).withService(AWS_REFERENCE);
      createLocation(create, adminAuthHeaders());
    }
    String fqn = AWS_REFERENCE.getName() + "." + location;

    // List all locations
    LocationList allLocations = listPrefixes(null, fqn, 1000000, null,
            null, adminAuthHeaders());
    int totalRecords = allLocations.getData().size();
    printLocations(allLocations);

    // List limit number locations at a time at various offsets and ensure right results are returned
    for (int limit = 1; limit < maxLocations; limit++) {
      String after = null;
      String before;
      int pageCount = 0;
      int indexInAllLocations = 0;
      LocationList forwardPage;
      LocationList backwardPage;
      do { // For each limit (or page size) - forward scroll till the end
        LOG.info("Limit {} forward scrollCount {} afterCursor {}", limit, pageCount, after);
        forwardPage = listPrefixes(null, fqn, limit, null, after, adminAuthHeaders());
        printLocations(forwardPage);
        after = forwardPage.getPaging().getAfter();
        before = forwardPage.getPaging().getBefore();
        assertEntityPagination(allLocations.getData(), forwardPage, limit, indexInAllLocations);

        if (pageCount == 0) {  // CASE 0 - First page is being returned. There is no before cursor
          assertNull(before);
        } else {
          // Make sure scrolling back based on before cursor returns the correct result
          backwardPage = listPrefixes(null, fqn, limit, before, null, adminAuthHeaders());
          assertEntityPagination(allLocations.getData(), backwardPage, limit, (indexInAllLocations - limit));
        }

        indexInAllLocations += forwardPage.getData().size();
        pageCount++;
      } while (after != null);

      // We have now reached the last page - test backward scroll till the beginning
      pageCount = 0;
      indexInAllLocations = totalRecords - limit - forwardPage.getData().size();
      do {
        LOG.info("Limit {} backward scrollCount {} beforeCursor {}", limit, pageCount, before);
        forwardPage = listPrefixes(null, fqn, limit, before, null, adminAuthHeaders());
        printLocations(forwardPage);
        before = forwardPage.getPaging().getBefore();
        assertEntityPagination(allLocations.getData(), forwardPage, limit, indexInAllLocations);
        pageCount++;
        indexInAllLocations -= forwardPage.getData().size();
      } while (before != null);
    }
  }

  @Test
  public void get_locationListWithValidLimitOffset_4xx(TestInfo test) throws HttpResponseException {
    // Create a large number of locations
    int maxLocations = 40;
    for (int i = 0; i < maxLocations; i++) {
      createLocation(create(test, i), adminAuthHeaders());
    }

    // List all locations
    LocationList allLocations = listLocations(null, null, 1000000, null,
            null, adminAuthHeaders());
    int totalRecords = allLocations.getData().size();
    printLocations(allLocations);

    // List limit number locations at a time at various offsets and ensure right results are returned
    for (int limit = 1; limit < maxLocations; limit++) {
      String after = null;
      String before;
      int pageCount = 0;
      int indexInAllLocations = 0;
      LocationList forwardPage;
      LocationList backwardPage;
      do { // For each limit (or page size) - forward scroll till the end
        LOG.info("Limit {} forward scrollCount {} afterCursor {}", limit, pageCount, after);
        forwardPage = listLocations(null, null, limit, null, after, adminAuthHeaders());
        printLocations(forwardPage);
        after = forwardPage.getPaging().getAfter();
        before = forwardPage.getPaging().getBefore();
        assertEntityPagination(allLocations.getData(), forwardPage, limit, indexInAllLocations);

        if (pageCount == 0) {  // CASE 0 - First page is being returned. There is no before cursor
          assertNull(before);
        } else {
          // Make sure scrolling back based on before cursor returns the correct result
          backwardPage = listLocations(null, null, limit, before, null, adminAuthHeaders());
          assertEntityPagination(allLocations.getData(), backwardPage, limit, (indexInAllLocations - limit));
        }

        indexInAllLocations += forwardPage.getData().size();
        pageCount++;
      } while (after != null);

      // We have now reached the last page - test backward scroll till the beginning
      pageCount = 0;
      indexInAllLocations = totalRecords - limit - forwardPage.getData().size();
      do {
        LOG.info("Limit {} backward scrollCount {} beforeCursor {}", limit, pageCount, before);
        forwardPage = listLocations(null, null, limit, before, null, adminAuthHeaders());
        printLocations(forwardPage);
        before = forwardPage.getPaging().getBefore();
        assertEntityPagination(allLocations.getData(), forwardPage, limit, indexInAllLocations);
        pageCount++;
        indexInAllLocations -= forwardPage.getData().size();
      } while (before != null);
    }
  }

  private void printLocations(LocationList list) {
    list.getData().forEach(location -> LOG.info("Location {}", location.getFullyQualifiedName()));
    LOG.info("before {} after {} ", list.getPaging().getBefore(), list.getPaging().getAfter());
  }

  @Test
  public void put_locationUpdateWithNoChange_200(TestInfo test) throws HttpResponseException {
    // Create a location with POST
    CreateLocation request = create(test).withService(AWS_REFERENCE).withOwner(USER_OWNER1);
    createAndCheckLocation(request, adminAuthHeaders());

    // Update location two times successfully with PUT requests
    updateAndCheckLocation(request, OK, adminAuthHeaders());
    updateAndCheckLocation(request, OK, adminAuthHeaders());
  }

  @Test
  public void put_locationCreate_200(TestInfo test) throws HttpResponseException {
    // Create a new location with put
    CreateLocation request = create(test).withService(AWS_REFERENCE).withOwner(USER_OWNER1);
    updateAndCheckLocation(request.withName(test.getDisplayName()).withDescription(null), CREATED,
            adminAuthHeaders());
  }

  @Test
  public void put_locationCreate_as_owner_200(TestInfo test) throws HttpResponseException {
    // Create a new location with put
    CreateLocation request = create(test).withService(AWS_REFERENCE).withOwner(USER_OWNER1);
    // Add Owner as admin
    createAndCheckLocation(request, adminAuthHeaders());
    //Update the location Owner
    updateAndCheckLocation(request.withName(test.getDisplayName()).withDescription(null),
            CREATED, authHeaders(USER1.getEmail()));

  }

  @Test
  public void put_locationNullDescriptionUpdate_200(TestInfo test) throws HttpResponseException {
    CreateLocation request = create(test).withService(AWS_REFERENCE).withDescription(null);
    createAndCheckLocation(request, adminAuthHeaders());

    // Update null description with a new description
    Location location = updateAndCheckLocation(request.withDescription("newDescription"), OK, adminAuthHeaders());
    assertEquals("newDescription", location.getDescription());
  }

  @Test
  public void put_locationEmptyDescriptionUpdate_200(TestInfo test) throws HttpResponseException {
    // Create location with empty description
    CreateLocation request = create(test).withService(AWS_REFERENCE).withDescription("");
    createAndCheckLocation(request, adminAuthHeaders());

    // Update empty description with a new description
    Location location = updateAndCheckLocation(request.withDescription("newDescription"), OK, adminAuthHeaders());
    assertEquals("newDescription", location.getDescription());
  }

  @Test
  public void put_locationNonEmptyDescriptionUpdate_200(TestInfo test) throws HttpResponseException {
    CreateLocation request = create(test).withService(AWS_REFERENCE).withDescription("description");
    createAndCheckLocation(request, adminAuthHeaders());

    // Updating description is ignored when backend already has description
    Location location = updateLocation(request.withDescription("newDescription"), OK, adminAuthHeaders());
    assertEquals("description", location.getDescription());
  }

  @Test
  public void put_locationUpdateOwner_200(TestInfo test) throws HttpResponseException {
    CreateLocation request = create(test).withService(AWS_REFERENCE).withDescription("");
    createAndCheckLocation(request, adminAuthHeaders());

    // Change ownership from USER_OWNER1 to TEAM_OWNER1
    updateAndCheckLocation(request.withOwner(TEAM_OWNER1), OK, adminAuthHeaders());

    // Remove ownership
    Location location = updateAndCheckLocation(request.withOwner(null), OK, adminAuthHeaders());
    assertNull(location.getOwner());
  }

  @Test
  public void get_nonExistentLocation_404_notFound() {
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            getLocation(NON_EXISTENT_ENTITY, adminAuthHeaders()));
    assertResponse(exception, NOT_FOUND,
            entityNotFound(Entity.LOCATION, NON_EXISTENT_ENTITY));
  }

  @Test
  public void get_locationWithDifferentFields_200_OK(TestInfo test) throws HttpResponseException {
    CreateLocation create = create(test).withDescription("description").withOwner(USER_OWNER1)
            .withService(AWS_REFERENCE);
    Location location = createAndCheckLocation(create, adminAuthHeaders());
    validateGetWithDifferentFields(location, false);
  }

  @Test
  public void get_locationByNameWithDifferentFields_200_OK(TestInfo test) throws HttpResponseException {
    CreateLocation create = create(test).withDescription("description").withOwner(USER_OWNER1)
            .withService(AWS_REFERENCE);
    Location location = createAndCheckLocation(create, adminAuthHeaders());
    validateGetWithDifferentFields(location, true);
  }

  @Test
  public void patch_locationAttributes_200_ok(TestInfo test) throws HttpResponseException, JsonProcessingException {
    // Create location without description, owner
    Location location = createLocation(create(test), adminAuthHeaders());
    assertNull(location.getDescription());
    assertNull(location.getOwner());
    assertNotNull(location.getService());
    List<TagLabel> locationTags = List.of(TIER1_TAG_LABEL);

    location = getLocation(location.getId(), "owner,tags", adminAuthHeaders());
    location.getService().setHref(null); // href is readonly and not patchable

    // Add description, owner when previously they were null
    location = patchLocationAttributesAndCheck(location, "description", TEAM_OWNER1, locationTags,
            adminAuthHeaders());
    location.setOwner(TEAM_OWNER1); // Get rid of href and name returned in the response for owner
    location.setService(AWS_REFERENCE); // Get rid of href and name returned in the response for service
    location.setTags(locationTags);
    locationTags = List.of(TIER2_TAG_LABEL);
    // Replace description, tier, owner
    location = patchLocationAttributesAndCheck(location, "description1", USER_OWNER1, locationTags,
            adminAuthHeaders());
    location.setOwner(USER_OWNER1); // Get rid of href and name returned in the response for owner
    location.setService(GCP_REFERENCE); // Get rid of href and name returned in the response for service

    // Remove description, tier, owner
    patchLocationAttributesAndCheck(location, null, null, locationTags, adminAuthHeaders());
  }

  @Disabled
  @Test
  public void patch_locationIDChange_400(TestInfo test) throws HttpResponseException, JsonProcessingException {
    // Ensure location ID can't be changed using patch
    Location location = createLocation(create(test), adminAuthHeaders());
    UUID locationId = location.getId();
    String locationJson = JsonUtils.pojoToJson(location);
    location.setId(UUID.randomUUID());
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            patchLocation(locationId, locationJson, location, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, readOnlyAttribute(Entity.LOCATION, "id"));

    // ID can't be deleted
    location.setId(null);
    exception = assertThrows(HttpResponseException.class, () ->

            patchLocation(locationId, locationJson, location, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, readOnlyAttribute(Entity.LOCATION, "id"));
  }

  @Disabled
  @Test
  public void patch_locationNameChange_400(TestInfo test) throws HttpResponseException, JsonProcessingException {
    // Ensure location name can't be changed using patch
    Location location = createLocation(create(test), adminAuthHeaders());
    String locationJson = JsonUtils.pojoToJson(location);
    location.setName("newName");
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            patchLocation(locationJson, location, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, readOnlyAttribute(Entity.LOCATION, "name"));

    // Name can't be removed
    location.setName(null);
    exception = assertThrows(HttpResponseException.class, () ->
            patchLocation(locationJson, location, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, readOnlyAttribute(Entity.LOCATION, "name"));
  }

  @Disabled
  @Test
  public void patch_locationRemoveService_400(TestInfo test) throws HttpResponseException, JsonProcessingException {
    // Ensure service corresponding to location can't be changed by patch operation
    Location location = createLocation(create(test), adminAuthHeaders());
    location.getService().setHref(null); // Remove href from returned response as it is read-only field

    String locationJson = JsonUtils.pojoToJson(location);
    location.setService(GCP_REFERENCE);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            patchLocation(locationJson, location, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, readOnlyAttribute(Entity.LOCATION, "service"));

    // Service relationship can't be removed
    location.setService(null);
    exception = assertThrows(HttpResponseException.class, () ->
            patchLocation(locationJson, location, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, readOnlyAttribute(Entity.LOCATION, "service"));
  }

  @Test
  public void put_addDeleteFollower_200(TestInfo test) throws HttpResponseException {
    Location location = createAndCheckLocation(create(test), adminAuthHeaders());

    // Add follower to the location
    UserResourceTest userResourceTest = new UserResourceTest();
    User user1 = UserResourceTest.createUser(userResourceTest.create(test, 1), userAuthHeaders());
    addAndCheckFollower(location, user1.getId(), CREATED, 1, userAuthHeaders());

    // Add the same user as follower and make sure no errors are thrown and return response is OK (and not CREATED)
    addAndCheckFollower(location, user1.getId(), OK, 1, userAuthHeaders());

    // Add a new follower to the location
    User user2 = UserResourceTest.createUser(userResourceTest.create(test, 2), userAuthHeaders());
    addAndCheckFollower(location, user2.getId(), CREATED, 2, userAuthHeaders());

    // Delete followers and make sure they are deleted
    deleteAndCheckFollower(location, user1.getId(), 1, userAuthHeaders());
    deleteAndCheckFollower(location, user2.getId(), 0, userAuthHeaders());
  }

  @Test
  public void put_addDeleteInvalidFollower_200(TestInfo test) throws HttpResponseException {
    Location location = createAndCheckLocation(create(test), adminAuthHeaders());

    // Add non existent user as follower to the location
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            addAndCheckFollower(location, NON_EXISTENT_ENTITY, CREATED, 1, adminAuthHeaders()));
    assertResponse(exception, NOT_FOUND, CatalogExceptionMessage.entityNotFound("User", NON_EXISTENT_ENTITY));

    // Delete non existent user as follower to the location
    exception = assertThrows(HttpResponseException.class, () ->
            deleteAndCheckFollower(location, NON_EXISTENT_ENTITY, 1, adminAuthHeaders()));
    assertResponse(exception, NOT_FOUND, CatalogExceptionMessage.entityNotFound("User", NON_EXISTENT_ENTITY));
  }


  @Test
  public void delete_nonExistentLocation_404() {
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            deleteLocation(NON_EXISTENT_ENTITY, adminAuthHeaders()));
    assertResponse(exception, NOT_FOUND, entityNotFound(Entity.LOCATION, NON_EXISTENT_ENTITY));
  }

  public static Location createAndCheckLocation(CreateLocation create,
                                                Map<String, String> authHeaders) throws HttpResponseException {
    Location location = createLocation(create, authHeaders);
    validateLocation(location, create.getDescription(), create.getOwner(), create.getService(), create.getTags());
    return getAndValidate(location.getId(), create, authHeaders);
  }

  public static Location updateAndCheckLocation(CreateLocation create,
                                                Status status,
                                                Map<String, String> authHeaders) throws HttpResponseException {
    Location updatedLocation = updateLocation(create, status, authHeaders);
    validateLocation(updatedLocation, create.getDescription(), create.getOwner(), create.getService(),
            create.getTags());

    // GET the newly updated location and validate
    return getAndValidate(updatedLocation.getId(), create, authHeaders);
  }

  // Make sure in GET operations the returned location has all the required information passed during creation
  public static Location getAndValidate(UUID locationId,
                                        CreateLocation create,
                                        Map<String, String> authHeaders) throws HttpResponseException {
    // GET the newly created location by ID and validate
    Location location = getLocation(locationId, "owner", authHeaders);
    validateLocation(location, create.getDescription(), create.getOwner(), create.getService(), create.getTags());

    // GET the newly created location by name and validate
    String fqn = location.getFullyQualifiedName();
    location = getLocationByName(fqn, "owner", authHeaders);
    return validateLocation(location, create.getDescription(), create.getOwner(), create.getService(),
            create.getTags());
  }

  public static Location updateLocation(CreateLocation create,
                                        Status status,
                                        Map<String, String> authHeaders) throws HttpResponseException {
    return TestUtils.put(getResource("locations"), create, Location.class, status, authHeaders);
  }

  public static Location createLocation(CreateLocation create,
                                        Map<String, String> authHeaders) throws HttpResponseException {
    return TestUtils.post(getResource("locations"), create, Location.class, authHeaders);
  }

  /**
   * Validate returned fields GET .../locations/{id}?fields="..." or GET .../locations/name/{fqn}?fields="..."
   */
  private void validateGetWithDifferentFields(Location location, boolean byName) throws HttpResponseException {
    // .../locations?fields=owner
    String fields = "owner";
    location = byName ? getLocationByName(location.getFullyQualifiedName(), fields, adminAuthHeaders()) :
            getLocation(location.getId(), fields, adminAuthHeaders());
    assertNotNull(location.getOwner());
    assertNotNull(location.getService()); // We always return the service
    assertNotNull(location.getServiceType()); // We always return the service

    // TODO add other fields
  }

  private static Location validateLocation(Location location, String expectedDescription,
                                           EntityReference expectedOwner, EntityReference expectedService,
                                           List<TagLabel> expectedTags)
          throws HttpResponseException {
    assertNotNull(location.getId());
    assertNotNull(location.getHref());
    assertEquals(expectedDescription, location.getDescription());

    // Validate owner
    if (expectedOwner != null) {
      TestUtils.validateEntityReference(location.getOwner());
      assertEquals(expectedOwner.getId(), location.getOwner().getId());
      assertEquals(expectedOwner.getType(), location.getOwner().getType());
      assertNotNull(location.getOwner().getHref());
    }

    // Validate service
    if (expectedService != null) {
      TestUtils.validateEntityReference(location.getService());
      assertEquals(expectedService.getId(), location.getService().getId());
      assertEquals(expectedService.getType(), location.getService().getType());
    }
    TestUtils.validateTags(expectedTags, location.getTags());
    return location;
  }

  private Location patchLocationAttributesAndCheck(Location location, String newDescription,
                                                   EntityReference newOwner,
                                                   List<TagLabel> tags,
                                                   Map<String, String> authHeaders)
          throws JsonProcessingException, HttpResponseException {
    String locationJson = JsonUtils.pojoToJson(location);

    // Update the location attributes
    location.setDescription(newDescription);
    location.setOwner(newOwner);
    location.setTags(tags);

    // Validate information returned in patch response has the updates
    Location updateLocation = patchLocation(locationJson, location, authHeaders);
    validateLocation(updateLocation, location.getDescription(), newOwner, null, tags);

    // GET the location and Validate information returned
    Location getLocation = getLocation(location.getId(), "owner,tags", authHeaders);
    validateLocation(getLocation, location.getDescription(), newOwner, null, tags);
    return updateLocation;
  }

  private Location patchLocation(UUID locationId, String originalJson, Location updatedLocation,
                                 Map<String, String> authHeaders)
          throws JsonProcessingException, HttpResponseException {
    String updateLocationJson = JsonUtils.pojoToJson(updatedLocation);
    JsonPatch patch = JsonSchemaUtil.getJsonPatch(originalJson, updateLocationJson);
    return TestUtils.patch(getResource("locations/" + locationId), patch, Location.class, authHeaders);
  }

  private Location patchLocation(String originalJson,
                                 Location updatedLocation,
                                 Map<String, String> authHeaders)
          throws JsonProcessingException, HttpResponseException {
    return patchLocation(updatedLocation.getId(), originalJson, updatedLocation, authHeaders);
  }

  public static void getLocation(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
    getLocation(id, null, authHeaders);
  }

  public static Location getLocation(UUID id, String fields, Map<String, String> authHeaders)
          throws HttpResponseException {
    WebTarget target = getResource("locations/" + id);
    target = fields != null ? target.queryParam("fields", fields) : target;
    return TestUtils.get(target, Location.class, authHeaders);
  }

  public static Location getLocationByName(String fqn, String fields, Map<String, String> authHeaders)
          throws HttpResponseException {
    String encodedFqn = URLEncoder.encode(fqn, StandardCharsets.UTF_8);
    WebTarget target = getResource("locations/name/" + encodedFqn);
    target = fields != null ? target.queryParam("fields", fields) : target;
    return TestUtils.get(target, Location.class, authHeaders);
  }

  public static LocationList listLocations(String fields, String fqnPrefixParam, Map<String, String> authHeaders)
          throws HttpResponseException {
    return listLocations(fields, fqnPrefixParam, null, null, null, authHeaders);
  }

  public static LocationList listLocations(String fields, String fqnPrefixParam, Integer limitParam,
                                           String before, String after, Map<String, String> authHeaders)
          throws HttpResponseException {
    WebTarget target = getResource("locations");
    target = fields != null ? target.queryParam("fields", fields) : target;
    target = fqnPrefixParam != null ? target.queryParam("fqnPrefix", fqnPrefixParam) : target;
    target = limitParam != null ? target.queryParam("limit", limitParam) : target;
    target = before != null ? target.queryParam("before", before) : target;
    target = after != null ? target.queryParam("after", after) : target;
    return TestUtils.get(target, LocationList.class, authHeaders);
  }

  public static LocationList listPrefixes(String fields, String fqn, Integer limitParam,
                                          String before, String after, Map<String, String> authHeaders)
          throws HttpResponseException {
    String encodedFqn = URLEncoder.encode(fqn, StandardCharsets.UTF_8);
    WebTarget target = getResource("locations/prefixes/" + encodedFqn);
    target = fields != null ? target.queryParam("fields", fields) : target;
    target = limitParam != null ? target.queryParam("limit", limitParam) : target;
    target = before != null ? target.queryParam("before", before) : target;
    target = after != null ? target.queryParam("after", after) : target;
    return TestUtils.get(target, LocationList.class, authHeaders);
  }

  private static void deleteLocation(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
    TestUtils.delete(getResource("locations/" + id), authHeaders);

    // Ensure deleted location does not exist
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> getLocation(id, authHeaders));
    assertResponse(exception, NOT_FOUND, entityNotFound(Entity.LOCATION, id));
  }

  public static String getLocationName(TestInfo test) {
    return String.format("location_%s", test.getDisplayName());
  }

  public static String getLocationName(TestInfo test, int index) {
    return String.format("location%d_%s", index, test.getDisplayName());
  }

  public static CreateLocation create(TestInfo test) {
    return new CreateLocation().withName(getLocationName(test)).withService(AWS_REFERENCE);
  }

  public static CreateLocation create(TestInfo test, int index) {
    return new CreateLocation().withName(getLocationName(test, index)).withService(AWS_REFERENCE);
  }

  public static void addAndCheckFollower(Location location, UUID userId, Status status, int totalFollowerCount,
                                         Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource(String.format("locations/%s/followers",
            location.getId()));
    TestUtils.put(target, userId.toString(), status, authHeaders);

    // GET .../locations/{locationId} returns newly added follower
    Location getLocation = getLocation(location.getId(), "followers", authHeaders);
    assertEquals(totalFollowerCount, getLocation.getFollowers().size());
    TestUtils.validateEntityReference(getLocation.getFollowers());
    boolean followerFound = false;
    for (EntityReference followers : getLocation.getFollowers()) {
      if (followers.getId().equals(userId)) {
        followerFound = true;
        break;
      }
    }
    assertTrue(followerFound, "Follower added was not found in location get response");

    // GET .../users/{userId} shows user as following location
    checkUserFollowing(userId, location.getId(), true, authHeaders);
  }

  private static void checkUserFollowing(UUID userId, UUID locationId, boolean expectedFollowing,
                                         Map<String, String> authHeaders) throws HttpResponseException {
    // GET .../users/{userId} shows user as following location
    User user = UserResourceTest.getUser(userId, "follows", authHeaders);
    existsInEntityReferenceList(user.getFollows(), locationId, expectedFollowing);
  }

  private void deleteAndCheckFollower(Location location, UUID userId, int totalFollowerCount,
                                      Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource(String.format("locations/%s/followers/%s",
            location.getId(), userId));
    TestUtils.delete(target, authHeaders);

    Location getLocation = checkFollowerDeleted(location.getId(), userId, authHeaders);
    assertEquals(totalFollowerCount, getLocation.getFollowers().size());
  }

  public static Location checkFollowerDeleted(UUID locationId, UUID userId, Map<String, String> authHeaders)
          throws HttpResponseException {
    Location getLocation = getLocation(locationId, "followers", authHeaders);
    TestUtils.validateEntityReference(getLocation.getFollowers());
    existsInEntityReferenceList(getLocation.getFollowers(), locationId, false);

    // GET .../users/{userId} shows user as following location
    checkUserFollowing(userId, locationId, false, authHeaders);
    return getLocation;
  }
}
