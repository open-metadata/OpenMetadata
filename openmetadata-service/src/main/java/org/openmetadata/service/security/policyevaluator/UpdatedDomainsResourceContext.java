/*
 *  Copyright 2026 Collate.
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

package org.openmetadata.service.security.policyevaluator;

import java.util.List;
import java.util.Set;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;

/**
 * The resource as the current request will leave it, in the domain dimension only.
 *
 * <p>An update is authorized against the stored entity, so a request that moves an asset between
 * domains is judged against the domain it is leaving and never against the one it is entering.
 * Re-running the decision against this context closes that gap.
 *
 * <p>Every attribute other than {@link #getDomains()} delegates to the stored resource, so {@code
 * isOwner()}, {@code matchAnyTag()} and {@code matchTeam()} resolve identically in both passes and
 * the second pass can only differ on domains. That is what keeps the extra check invisible to
 * deployments whose policies carry no domain conditions.
 */
public record UpdatedDomainsResourceContext(
    ResourceContextInterface storedResource, List<EntityReference> updatedDomains)
    implements ResourceContextInterface {

  @Override
  public String getResource() {
    return storedResource.getResource();
  }

  @Override
  public List<EntityReference> getOwners() {
    return storedResource.getOwners();
  }

  @Override
  public List<TagLabel> getTags() {
    return storedResource.getTags();
  }

  @Override
  public EntityInterface getEntity() {
    return storedResource.getEntity();
  }

  @Override
  public EntityInterface getResolvedEntity() {
    return storedResource.getResolvedEntity();
  }

  @Override
  public Set<String> getLoadedFields() {
    return storedResource.getLoadedFields();
  }

  @Override
  public List<EntityReference> getDomains() {
    return updatedDomains;
  }
}
