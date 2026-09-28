/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.resources.rdf;

import java.util.List;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;

/**
 * Policy resource for the RDF query surface. RDF has no entity repository, so the entity-backed
 * {@code ResourceContext} cannot be used; the dataset has no owners, tags, or domains to evaluate.
 */
enum RdfQueryResourceContext implements ResourceContextInterface {
  INSTANCE;

  @Override
  public String getResource() {
    return Entity.RDF;
  }

  @Override
  public List<EntityReference> getOwners() {
    return List.of();
  }

  @Override
  public List<TagLabel> getTags() {
    return List.of();
  }

  @Override
  public EntityInterface getEntity() {
    return null;
  }

  @Override
  public List<EntityReference> getDomains() {
    return List.of();
  }
}
