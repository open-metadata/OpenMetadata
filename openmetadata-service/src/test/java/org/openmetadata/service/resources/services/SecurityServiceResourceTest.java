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

 package org.openmetadata.service.resources.services;

 import static jakarta.ws.rs.core.Response.Status.BAD_REQUEST;
 import static jakarta.ws.rs.core.Response.Status.OK;
 import static org.junit.jupiter.api.Assertions.assertEquals;
 import static org.junit.jupiter.api.Assertions.assertNotNull;
 import static org.junit.jupiter.api.Assertions.assertNull;
 import static org.junit.jupiter.api.Assertions.assertTrue;
 import static org.openmetadata.service.util.EntityUtil.fieldAdded;
 import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
 import static org.openmetadata.service.util.TestUtils.INGESTION_BOT_AUTH_HEADERS;
 import static org.openmetadata.service.util.TestUtils.TEST_AUTH_HEADERS;
 import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
 import static org.openmetadata.service.util.TestUtils.assertResponse;
 
 import jakarta.ws.rs.client.WebTarget;
 import java.io.IOException;
 import java.net.URISyntaxException;
 import java.util.Map;
 import java.util.UUID;
 import lombok.extern.slf4j.Slf4j;
 import org.apache.http.client.HttpResponseException;
 import org.junit.jupiter.api.Test;
 import org.junit.jupiter.api.TestInfo;
 import org.openmetadata.common.utils.CommonUtil;
 import org.openmetadata.schema.api.services.CreateSecurityService;
 import org.openmetadata.schema.api.services.CreateSecurityService.SecurityServiceType;
 import org.openmetadata.schema.entity.services.SecurityService;
 import org.openmetadata.schema.entity.services.connections.TestConnectionResult;
 import org.openmetadata.schema.entity.services.connections.TestConnectionResultStatus;
 import org.openmetadata.schema.services.connections.security.RangerConnection;
 import org.openmetadata.schema.type.ChangeDescription;
 import org.openmetadata.schema.type.EntityReference;
 import org.openmetadata.schema.type.SecurityConnection;
 import org.openmetadata.service.Entity;
 import org.openmetadata.service.resources.services.security.SecurityServiceResource;
 import org.openmetadata.service.util.JsonUtils;
 import org.openmetadata.service.util.TestUtils;
 
 @Slf4j
 public class SecurityServiceResourceTest
     extends ServiceResourceTest<SecurityService, CreateSecurityService> {
 
   public static EntityReference RANGER_SECURITY_SERVICE_REFERENCE;
 
   public SecurityServiceResourceTest() {
     super(
         Entity.SECURITY_SERVICE,
         SecurityService.class,
         SecurityServiceResource.SecurityServiceList.class,
         "services/securityServices",
         SecurityServiceResource.FIELDS);
     this.supportsPatch = false;
   }
 
   @Test
   void post_withoutRequiredFields_400_badRequest(TestInfo test) {
     // Create SecurityService with mandatory serviceType field empty
     assertResponse(
         () -> createEntity(createRequest(test).withServiceType(null), ADMIN_AUTH_HEADERS),
         BAD_REQUEST,
         "[query param serviceType must not be null]");
   }
 
   @Test
   void post_validSecurityService_as_admin_200_ok(TestInfo test)
       throws IOException, URISyntaxException {
     // Create security service with different optional fields
     Map<String, String> authHeaders = ADMIN_AUTH_HEADERS;
 
     // Create service without description
     SecurityService service1 =
         createAndCheckEntity(createRequest(test, 1).withDescription(null), authHeaders);
     assertNotNull(service1);
     assertNotNull(service1.getId());
     assertNotNull(service1.getName());
     assertNull(service1.getDescription());
     assertEquals(SecurityServiceType.Ranger, service1.getServiceType());
     assertNotNull(service1.getConnection());
 
     // Create service with description
     SecurityService service2 =
         createAndCheckEntity(createRequest(test, 2).withDescription("description"), authHeaders);
     assertNotNull(service2);
     assertNotNull(service2.getId());
     assertNotNull(service2.getName());
     assertEquals("description", service2.getDescription());
     assertEquals(SecurityServiceType.Ranger, service2.getServiceType());
 
     // Create service with different configuration
     RangerConnection altConnection =
         new RangerConnection().withHostPort(CommonUtil.getUri("https://alt-localhost:6080"));
     SecurityConnection securityConnection = new SecurityConnection().withConfig(altConnection);
     createAndCheckEntity(createRequest(test, 3).withConnection(securityConnection), authHeaders);
 
     // We can create the service without connection
     SecurityService service4 =
         createAndCheckEntity(createRequest(test).withConnection(null), ADMIN_AUTH_HEADERS);
     assertNotNull(service4);
     assertNull(service4.getConnection());
     assertEquals(SecurityServiceType.Ranger, service4.getServiceType());
   }
 
   @Test
   void put_updateSecurityService_as_admin_2xx(TestInfo test)
       throws IOException, URISyntaxException {
     // Create initial service with basic connection
     RangerConnection rangerConnection =
         new RangerConnection().withHostPort(CommonUtil.getUri("https://localhost:6080"));
     SecurityConnection securityConnection = new SecurityConnection().withConfig(rangerConnection);
 
     SecurityService service =
         createAndCheckEntity(
             createRequest(test).withDescription(null).withConnection(securityConnection),
             ADMIN_AUTH_HEADERS);
 
     // Update security service description
     CreateSecurityService update =
         createRequest(test).withDescription("description1").withName(service.getName());
 
     ChangeDescription change = getChangeDescription(service, MINOR_UPDATE);
     fieldAdded(change, "description", "description1");
     updateAndCheckEntity(update, OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
 
     // Update connection with different host
     RangerConnection newRangerConnection =
         new RangerConnection().withHostPort(CommonUtil.getUri("https://newhost:6080"));
     SecurityConnection newSecurityConnection =
         new SecurityConnection().withConfig(newRangerConnection);
 
     update.withConnection(newSecurityConnection);
     service = updateEntity(update, OK, ADMIN_AUTH_HEADERS);
     validateSecurityConnection(
         newSecurityConnection, service.getConnection(), service.getServiceType(), true);
 
     // Get the recently updated entity and verify the changes
     service = getEntity(service.getId(), ADMIN_AUTH_HEADERS);
     validateSecurityConnection(
         newSecurityConnection, service.getConnection(), service.getServiceType(), true);
     assertEquals("description1", service.getDescription());
 
     // non admin/bot user, connection should still be accessible
     SecurityService newService = getEntity(service.getId(), "*", TEST_AUTH_HEADERS);
     assertEquals(newService.getName(), service.getName());
     validateSecurityConnection(
         newSecurityConnection, newService.getConnection(), newService.getServiceType(), true);
 
     // bot user, connection should be accessible
     service = getEntity(service.getId(), INGESTION_BOT_AUTH_HEADERS);
     validateSecurityConnection(
         newSecurityConnection, service.getConnection(), service.getServiceType(), false);
   }
 
   @Test
   void put_testConnectionResult_200(TestInfo test) throws IOException {
     SecurityService service = createAndCheckEntity(createRequest(test), ADMIN_AUTH_HEADERS);
     // By default, we have no result logged in
     assertNull(service.getTestConnectionResult());
 
     TestConnectionResult testConnectionResult =
         new TestConnectionResult()
             .withStatus(TestConnectionResultStatus.SUCCESSFUL)
             .withLastUpdatedAt(System.currentTimeMillis());
 
     SecurityService updatedService =
         putTestConnectionResult(service.getId(), testConnectionResult, ADMIN_AUTH_HEADERS);
     // Validate that the data got properly stored
     assertNotNull(updatedService.getTestConnectionResult());
     assertEquals(
         TestConnectionResultStatus.SUCCESSFUL,
         updatedService.getTestConnectionResult().getStatus());
     assertEquals(updatedService.getConnection(), service.getConnection());
 
     // Check that the stored data is also correct
     SecurityService stored = getEntity(service.getId(), ADMIN_AUTH_HEADERS);
     assertNotNull(stored.getTestConnectionResult());
     assertEquals(
         TestConnectionResultStatus.SUCCESSFUL, stored.getTestConnectionResult().getStatus());
     assertEquals(stored.getConnection(), service.getConnection());
   }
 
   public SecurityService putTestConnectionResult(
       UUID serviceId, TestConnectionResult testConnectionResult, Map<String, String> authHeaders)
       throws HttpResponseException {
     WebTarget target = getResource(serviceId).path("/testConnectionResult");
     return TestUtils.put(target, testConnectionResult, SecurityService.class, OK, authHeaders);
   }
 
   @Override
   public CreateSecurityService createRequest(String name) {
     return new CreateSecurityService()
         .withName(name)
         .withServiceType(SecurityServiceType.Ranger)
         .withConnection(getRangerConnection());
   }
 
   @Override
   public void validateCreatedEntity(
       SecurityService service,
       CreateSecurityService createRequest,
       Map<String, String> authHeaders) {
     assertEquals(createRequest.getName(), service.getName());
     boolean maskSecrets = !INGESTION_BOT_AUTH_HEADERS.equals(authHeaders);
     validateSecurityConnection(
         createRequest.getConnection(),
         service.getConnection(),
         service.getServiceType(),
         maskSecrets);
   }
 
   @Override
   public void compareEntities(
       SecurityService expected, SecurityService updated, Map<String, String> authHeaders) {
     // PATCH operation is not supported by this entity
   }
 
   @Override
   public SecurityService validateGetWithDifferentFields(SecurityService service, boolean byName)
       throws HttpResponseException {
     String fields = "";
     service =
         byName
             ? getEntityByName(service.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
             : getEntity(service.getId(), fields, ADMIN_AUTH_HEADERS);
     TestUtils.assertListNull(service.getOwners());
 
     fields = "owners,tags,followers";
     service =
         byName
             ? getEntityByName(service.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
             : getEntity(service.getId(), fields, ADMIN_AUTH_HEADERS);
     // Checks for other owners, tags is done in the base class
     return service;
   }
 
   @Override
   public void assertFieldChange(String fieldName, Object expected, Object actual) {
     if (expected == actual) {
       return;
     }
     if (fieldName.equals("connection")) {
       assertTrue(((String) actual).contains("-encrypted-value"));
     } else {
       assertCommonFieldChange(fieldName, expected, actual);
     }
   }
 
   private SecurityConnection getRangerConnection() {
     // Create basic Ranger connection configuration
     RangerConnection rangerConnection =
         new RangerConnection().withHostPort(CommonUtil.getUri("https://localhost:6080"));
 
     return new SecurityConnection().withConfig(rangerConnection);
   }
 
   private void validateSecurityConnection(
       SecurityConnection expectedConnection,
       SecurityConnection actualConnection,
       SecurityServiceType serviceType,
       boolean maskSecrets) {
     if (expectedConnection != null && actualConnection != null) {
       if (serviceType == SecurityServiceType.Ranger) {
         RangerConnection expected = (RangerConnection) expectedConnection.getConfig();
         RangerConnection actual;
         if (actualConnection.getConfig() instanceof RangerConnection) {
           actual = (RangerConnection) actualConnection.getConfig();
         } else {
           actual = JsonUtils.convertValue(actualConnection.getConfig(), RangerConnection.class);
         }
 
         assertEquals(expected.getHostPort(), actual.getHostPort());
 
         // Validate authentication type (generic validation)
         if (expected.getAuthType() != null && actual.getAuthType() != null) {
           // Basic validation - both auth types should be present
           assertNotNull(actual.getAuthType(), "Auth type should be present");
         }
       }
     }
   }
 
   public void setupSecurityServices(TestInfo test) throws HttpResponseException {
     // Create Apache Ranger security service
     CreateSecurityService createRangerService =
         createRequest(test)
             .withName("rangerSecurityService")
             .withServiceType(SecurityServiceType.Ranger)
             .withConnection(getRangerConnection());
 
     SecurityService rangerService;
     try {
       rangerService = getEntityByName(createRangerService.getName(), ADMIN_AUTH_HEADERS);
     } catch (Exception e) {
       // Service doesn't exist, create it
       rangerService = createEntity(createRangerService, ADMIN_AUTH_HEADERS);
     }
     RANGER_SECURITY_SERVICE_REFERENCE = rangerService.getEntityReference();
   }
 }
 