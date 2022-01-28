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

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.FORBIDDEN;
import static javax.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.catalog.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.catalog.util.TestUtils.TEST_AUTH_HEADERS;
import static org.openmetadata.catalog.util.TestUtils.assertListNotNull;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;

import java.io.IOException;
import java.net.URISyntaxException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.Response.Status;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.data.CreateLocation;
import org.openmetadata.catalog.entity.data.Location;
import org.openmetadata.catalog.jdbi3.LocationRepository.LocationEntityInterface;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.resources.locations.LocationResource.LocationList;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.ResultList;
import org.openmetadata.catalog.util.TestUtils;

@Slf4j
public class LocationResourceTest extends EntityResourceTest<Location, CreateLocation> {
  public LocationResourceTest() {
    super(
        Entity.LOCATION,
        Location.class,
        LocationList.class,
        "locations",
        LocationResource.FIELDS,
        true,
        true,
        true,
        true);
  }

  @BeforeAll
  public void setup(TestInfo test) throws IOException, URISyntaxException {
    super.setup(test);
  }

  @Override
  public CreateLocation createRequest(String name, String description, String displayName, EntityReference owner) {
    return new CreateLocation()
        .withName(name)
        .withService(AWS_STORAGE_SERVICE_REFERENCE)
        .withDescription(description)
        .withOwner(owner);
  }

  @Override
  public EntityReference getContainer(CreateLocation createRequest) {
    return createRequest.getService();
  }

  @Override
  public void validateCreatedEntity(Location location, CreateLocation createRequest, Map<String, String> authHeaders)
      throws HttpResponseException {
    validateCommonEntityFields(
        getEntityInterface(location),
        createRequest.getDescription(),
        TestUtils.getPrincipal(authHeaders),
        createRequest.getOwner());

    // Validate service
    EntityReference expectedService = createRequest.getService();
    if (expectedService != null) {
      TestUtils.validateEntityReference(location.getService());
      assertEquals(expectedService.getId(), location.getService().getId());
      assertEquals(expectedService.getType(), location.getService().getType());
    }
    TestUtils.validateTags(createRequest.getTags(), location.getTags());
  }

  @Override
  public void validateUpdatedEntity(Location location, CreateLocation request, Map<String, String> authHeaders)
      throws HttpResponseException {
    validateCreatedEntity(location, request, authHeaders);
  }

  @Override
  public void compareEntities(Location expected, Location patched, Map<String, String> authHeaders)
      throws HttpResponseException {
    validateCommonEntityFields(
        getEntityInterface(patched),
        expected.getDescription(),
        TestUtils.getPrincipal(authHeaders),
        expected.getOwner());
    // Entity specific validation
    assertEquals(expected.getDisplayName(), patched.getDisplayName());
    assertEquals(expected.getFullyQualifiedName(), patched.getFullyQualifiedName());
    assertEquals(expected.getLocationType(), patched.getLocationType());
    assertEquals(expected.getService(), patched.getService());
    assertEquals(expected.getServiceType(), patched.getServiceType());
    TestUtils.validateTags(expected.getTags(), patched.getTags());
    TestUtils.validateEntityReference(patched.getFollowers());
  }

  @Override
  public EntityInterface<Location> getEntityInterface(Location entity) {
    return new LocationEntityInterface(entity);
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    assertCommonFieldChange(fieldName, expected, actual);
  }

  @Test
  void get_locationListWithPrefix_2xx(TestInfo test) throws HttpResponseException {
    // Create some nested locations.
    List<String> paths = Arrays.asList("/" + test.getDisplayName(), "/dwh", "/catalog", "/schema", "/table");
    String locationName =
        paths.stream()
            .reduce(
                "",
                (subtotal, element) -> {
                  try {
                    CreateLocation create =
                        new CreateLocation().withName(subtotal + element).withService(AWS_STORAGE_SERVICE_REFERENCE);
                    createEntity(create, ADMIN_AUTH_HEADERS);
                  } catch (HttpResponseException e) {
                    throw new RuntimeException(e);
                  }
                  return subtotal + element;
                });

    // List all locations
    LocationList allLocations =
        listPrefixes(
            null,
            AWS_STORAGE_SERVICE_REFERENCE.getName() + "." + locationName,
            1000000,
            null,
            null,
            ADMIN_AUTH_HEADERS);
    assertEquals(5, allLocations.getData().size(), "Wrong number of prefix locations");
  }

  @Test
  void post_validLocations_as_admin_200_OK(TestInfo test) throws IOException {
    // Create team with different optional fields
    CreateLocation create = createRequest(test);
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    create.withName(getEntityName(test, 1)).withDescription("description");
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
  }

  @Test
  void post_locationWithUserOwner_200_ok(TestInfo test) throws IOException {
    createAndCheckEntity(createRequest(test).withOwner(USER_OWNER1), ADMIN_AUTH_HEADERS);
  }

  @Test
  void post_locationWithTeamOwner_200_ok(TestInfo test) throws IOException {
    createAndCheckEntity(createRequest(test).withOwner(TEAM_OWNER1), ADMIN_AUTH_HEADERS);
  }

  @Test
  void post_location_as_non_admin_401(TestInfo test) {
    CreateLocation create = createRequest(test);
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> createEntity(create, TEST_AUTH_HEADERS));
    assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  @Test
  void post_locationWithoutRequiredFields_4xx(TestInfo test) {
    HttpResponseException exception =
        assertThrows(
            HttpResponseException.class, () -> createEntity(createRequest(test).withName(null), ADMIN_AUTH_HEADERS));
    assertResponse(exception, BAD_REQUEST, "[name must not be null]");

    // Service is required field
    exception =
        assertThrows(
            HttpResponseException.class, () -> createEntity(createRequest(test).withService(null), ADMIN_AUTH_HEADERS));
    assertResponse(exception, BAD_REQUEST, "[service must not be null]");
  }

  @Test
  void post_locationWithDifferentService_200_ok(TestInfo test) throws IOException {
    EntityReference[] differentServices = {GCP_STORAGE_SERVICE_REFERENCE, AWS_STORAGE_SERVICE_REFERENCE};

    // Create location for each service and test APIs
    for (EntityReference service : differentServices) {
      createAndCheckEntity(createRequest(test).withService(service), ADMIN_AUTH_HEADERS);

      // List locations by filtering on service name and ensure right locations are returned
      Map<String, String> queryParams =
          new HashMap<>() {
            {
              put("service", service.getName());
            }
          };
      ResultList<Location> list = listEntities(queryParams, ADMIN_AUTH_HEADERS);
      for (Location location : list.getData()) {
        assertEquals(service.getName(), location.getService().getName());
      }
    }
  }

  @Test
  void put_locationNonEmptyDescriptionUpdate_200(TestInfo test) throws IOException {
    CreateLocation request =
        createRequest(test).withService(AWS_STORAGE_SERVICE_REFERENCE).withDescription("description");
    createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    // Updating description is ignored when backend already has description
    Location location = updateLocation(request.withDescription("newDescription"), OK, ADMIN_AUTH_HEADERS);
    assertEquals("description", location.getDescription());
  }

  public static Location updateLocation(CreateLocation create, Status status, Map<String, String> authHeaders)
      throws HttpResponseException {
    return TestUtils.put(getResource("locations"), create, Location.class, status, authHeaders);
  }

  /** Validate returned fields GET .../locations/{id}?fields="..." or GET .../locations/name/{fqn}?fields="..." */
  @Override
  public void validateGetWithDifferentFields(Location location, boolean byName) throws HttpResponseException {
    // .../locations?fields=owner
    String fields = "owner";
    location =
        byName
            ? getEntityByName(location.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(location.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(location.getOwner(), location.getService(), location.getServiceType());
    // TODO add other fields
  }

  public static LocationList listPrefixes(
      String fields, String fqn, Integer limitParam, String before, String after, Map<String, String> authHeaders)
      throws HttpResponseException {
    String encodedFqn = URLEncoder.encode(fqn, StandardCharsets.UTF_8);
    WebTarget target = getResource("locations/prefixes/" + encodedFqn);
    target = fields != null ? target.queryParam("fields", fields) : target;
    target = limitParam != null ? target.queryParam("limit", limitParam) : target;
    target = before != null ? target.queryParam("before", before) : target;
    target = after != null ? target.queryParam("after", after) : target;
    return TestUtils.get(target, LocationList.class, authHeaders);
  }
}
