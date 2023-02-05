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

package org.openmetadata.service.resources.locations;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponse;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.Response.Status;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.data.CreateLocation;
import org.openmetadata.schema.entity.data.Location;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.locations.LocationResource.LocationList;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.util.TestUtils;

@Slf4j
public class LocationResourceTest extends EntityResourceTest<Location, CreateLocation> {
  public LocationResourceTest() {
    super(Entity.LOCATION, Location.class, LocationList.class, "locations", LocationResource.FIELDS);
    // TODO quoted location is not allowed by the Location listPrefix APIs
    // TODO "." is not allowed
    supportedNameCharacters = "_'-";
  }

  @Override
  public CreateLocation createRequest(String name) {
    return new CreateLocation().withName(name).withPath(name).withService(getContainer());
  }

  @Override
  public EntityReference getContainer() {
    return AWS_STORAGE_SERVICE_REFERENCE;
  }

  @Override
  public EntityReference getContainer(Location entity) {
    return entity.getService();
  }

  @Override
  public void validateCreatedEntity(Location location, CreateLocation createRequest, Map<String, String> authHeaders)
      throws HttpResponseException {
    assertEquals(createRequest.getPath(), location.getPath());
    // Validate service
    assertReference(createRequest.getService(), location.getService());
    TestUtils.validateTags(createRequest.getTags(), location.getTags());
  }

  @Override
  public void compareEntities(Location expected, Location patched, Map<String, String> authHeaders)
      throws HttpResponseException {
    assertEquals(expected.getDisplayName(), patched.getDisplayName());
    assertEquals(expected.getFullyQualifiedName(), patched.getFullyQualifiedName());
    assertEquals(expected.getLocationType(), patched.getLocationType());
    assertEquals(expected.getService(), patched.getService());
    assertEquals(expected.getServiceType(), patched.getServiceType());
    TestUtils.validateTags(expected.getTags(), patched.getTags());
    TestUtils.validateEntityReferences(patched.getFollowers());
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    assertCommonFieldChange(fieldName, expected, actual);
  }

  private List<EntityReference> getAssociatedEntity(Location location) throws HttpResponseException {
    WebTarget target = getResource(String.format("locations/association/%s", location.getId()));
    return (List<EntityReference>) TestUtils.get(target, List.class, ADMIN_AUTH_HEADERS);
  }

  @Test
  void get_entity_from_location(TestInfo test) throws IOException {
    Location location = createAndCheckEntity(createRequest(test), ADMIN_AUTH_HEADERS);
    String actualValue = getAssociatedEntity(location).toString();
    LinkedHashMap<Object, Object> expected = new LinkedHashMap<>();
    expected.put("id", location.getService().getId());
    expected.put("type", location.getService().getType());
    expected.put("name", location.getService().getName());
    expected.put("fullyQualifiedName", location.getService().getFullyQualifiedName());
    expected.put("deleted", location.getService().getDeleted());
    List<Map<Object, Object>> expectedValue = new ArrayList<>();
    expectedValue.add(expected);
    assertEquals(expectedValue.toString(), actualValue);
  }

  @Test
  void get_locationListWithPrefix_2xx(TestInfo test) throws HttpResponseException {
    // Create some nested locations.
    String[] paths = {getEntityName(test), "dwh", "catalog", "schema", "table"};

    CreateLocation create = new CreateLocation().withService(AWS_STORAGE_SERVICE_REFERENCE);
    String locationName = "";
    for (String path : paths) {
      locationName += "/" + path;
      System.out.println("Creating entity " + locationName);
      createEntity(create.withName(locationName), ADMIN_AUTH_HEADERS);
    }

    // List all locations
    LocationList allLocations =
        listPrefixes(
            null,
            FullyQualifiedName.add(AWS_STORAGE_SERVICE_REFERENCE.getFullyQualifiedName(), locationName),
            1000000,
            null,
            null,
            ADMIN_AUTH_HEADERS);
    assertEquals(paths.length, allLocations.getData().size(), "Wrong number of prefix locations");
  }

  @Test
  void post_locationWithoutRequiredFields_4xx(TestInfo test) {
    assertResponse(
        () -> createEntity(createRequest(test).withName(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[name must not be null]");

    // Service is required field
    assertResponse(
        () -> createEntity(createRequest(test).withService(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[service must not be null]");
  }

  @Test
  void post_locationWithDifferentService_200_ok(TestInfo test) throws IOException {
    EntityReference[] differentServices = {GCP_STORAGE_SERVICE_REFERENCE, AWS_STORAGE_SERVICE_REFERENCE};

    // Create location for each service and test APIs
    for (EntityReference service : differentServices) {
      createAndCheckEntity(createRequest(test).withService(service), ADMIN_AUTH_HEADERS);
      // List locations by filtering on service name and ensure right locations are returned
      Map<String, String> queryParams = new HashMap<>();
      queryParams.put("service", service.getName());

      ResultList<Location> list = listEntities(queryParams, ADMIN_AUTH_HEADERS);
      for (Location location : list.getData()) {
        assertEquals(service.getName(), location.getService().getName());
      }
    }
  }

  public static Location updateLocation(CreateLocation create, Status status, Map<String, String> authHeaders)
      throws HttpResponseException {
    return TestUtils.put(getResource("locations"), create, Location.class, status, authHeaders);
  }

  @Override
  public Location validateGetWithDifferentFields(Location location, boolean byName) throws HttpResponseException {
    String fields = "";
    location =
        byName
            ? getEntityByName(location.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(location.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(location.getService(), location.getServiceType());
    assertListNull(location.getOwner(), location.getFollowers(), location.getTags());

    fields = "owner,followers,tags";
    location =
        byName
            ? getEntityByName(location.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(location.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(location.getService(), location.getServiceType());
    // Checks for other owner, tags, and followers is done in the base class
    return location;
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
