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

package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.Entity.CREDENTIALS;
import static org.openmetadata.service.Entity.USER;

import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.api.data.CreateCredentials;
import org.openmetadata.schema.entity.Credentials;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.credentials.CredentialsResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.Fields;

@Slf4j
public class CredentialsRepository extends EntityRepository<Credentials> {

  public CredentialsRepository() {
    super(
        CredentialsResource.COLLECTION_PATH,
        CREDENTIALS,
        Credentials.class,
        Entity.getCollectionDAO().credentialsDAO(),
        "",
        "");
  }

  @Override
  public void setFields(Credentials credentials, Fields fields) {
    credentials.setOwners(fields.contains("owner") ? getOwners(credentials) : null);
    credentials.setTags(
        fields.contains("tags") ? getTags(credentials.getFullyQualifiedName()) : null);
    credentials.setDomains(fields.contains("domain") ? getDomains(credentials) : null);
  }

  @Override
  public void clearFields(Credentials credentials, Fields fields) {
    credentials.setOwners(fields.contains("owner") ? credentials.getOwners() : null);
    credentials.setTags(fields.contains("tags") ? credentials.getTags() : null);
    credentials.setDomains(fields.contains("domain") ? credentials.getDomains() : null);
  }

  @Override
  public void setInheritedFields(Credentials credentials, Fields fields) {
    // Credentials don't have inherited fields
  }

  @Override
  public void prepare(Credentials credentials, boolean update) {
    populateOwners(credentials.getOwner());
    credentials.setFullyQualifiedName(EntityUtil.getFQN(credentials.getName()));
  }

  @Override
  public void storeEntity(Credentials credentials, boolean update) {
    // Store owner, domain, tags etc.
    store(credentials, update);
  }

  @Override
  public void storeRelationships(Credentials credentials) {
    // Store owner relationship
    storeOwners(credentials, credentials.getOwners());
    // Store domain relationship
    storeDomains(credentials, credentials.getDomains());
    // Store tag relationships
    applyTags(credentials);
  }

  @Override
  public EntityUpdater getUpdater(Credentials original, Credentials updated, Operation operation) {
    return new CredentialsUpdater(original, updated, operation);
  }

  @Override
  public void postDelete(Credentials entity, boolean hardDelete) {
    // Clean up OAuth tokens when credentials are deleted
    deleteOAuthTokensForCredentials(entity.getId());
  }

  public List<Credentials> listByServiceType(ServiceType serviceType) {
    String condition = "JSON_CONTAINS(serviceTypes, ?)";
    String value = String.format("\"%s\"", serviceType.value());
    return listInternal(null, null, condition, value);
  }

  public List<Credentials> listByCredentialType(CreateCredentials.CredentialType credentialType) {
    String condition = "credentialType = ?";
    return listInternal(null, null, condition, credentialType.value());
  }

  public List<Credentials> listByOwner(UUID ownerId) {
    List<CollectionDAO.EntityRelationshipRecord> jsons =
        Entity.getCollectionDAO()
            .relationshipDAO()
            .findTo(ownerId, USER, Relationship.OWNS.ordinal());
    return jsons.stream().map(json -> EntityUtil.readEntity(json, entityClass)).toList();
  }

  @Transaction
  public void deleteOAuthTokensForCredentials(UUID credentialsId) {
    // This will be implemented after OAuthTokenRepository is created
    LOG.info("Deleting OAuth tokens for credentials: {}", credentialsId);
  }

  public class CredentialsUpdater extends EntityUpdater {
    public CredentialsUpdater(Credentials original, Credentials updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() {
      updateCredentialType();
      updateCredentialConfig();
      updateServiceTypes();
      updateOAuthFlags();
    }

    private void updateCredentialType() {
      recordChange("credentialType", original.getCredentialType(), updated.getCredentialType());
    }

    private void updateCredentialConfig() {
      recordChange(
          "credentialConfig", original.getCredentialConfig(), updated.getCredentialConfig(), true);
    }

    private void updateServiceTypes() {
      recordChange("serviceTypes", original.getServiceTypes(), updated.getServiceTypes());
    }

    private void updateOAuthFlags() {
      recordChange("isOAuth", original.getIsOAuth(), updated.getIsOAuth());
      recordChange(
          "requiresUserAuthentication",
          original.getRequiresUserAuthentication(),
          updated.getRequiresUserAuthentication());
    }
  }
}
