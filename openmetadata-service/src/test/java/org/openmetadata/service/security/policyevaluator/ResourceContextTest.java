/*
 *  Copyright 2024 Collate.
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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.util.EntityUtil.Fields;

class ResourceContextTest {

  /**
   * Bulk authorization: every {@link ResourceContext} in one request shares a single {@link
   * BulkFieldHydrator}, so the first policy that reads tags hydrates the whole batch in one query
   * and later reads are no-ops. Without this the on-demand path fetched tags once per entity (N+1).
   */
  @Test
  void bulkContexts_shareHydrator_tagsHydratedOncePerRequest() {
    @SuppressWarnings("unchecked")
    EntityRepository<Table> repository = mock(EntityRepository.class);
    when(repository.isSupportsTags()).thenReturn(true);

    int[] batchLoads = {0};
    BulkFieldHydrator hydrator =
        new BulkFieldHydrator(Map.of(Entity.FIELD_TAGS, () -> batchLoads[0]++));

    ResourceContext<Table> c1 = new ResourceContext<>("table", new Table(), repository, hydrator);
    ResourceContext<Table> c2 = new ResourceContext<>("table", new Table(), repository, hydrator);
    ResourceContext<Table> c3 = new ResourceContext<>("table", new Table(), repository, hydrator);

    c1.ensureTagsLoaded();
    c2.ensureTagsLoaded();
    c3.ensureTagsLoaded();

    assertEquals(
        1, batchLoads[0], "tags must be hydrated once for the whole bulk request, not per entity");
    verify(repository, never()).setFieldsInternal(any(), any(Fields.class));
  }

  /** Single-entity requests carry no loader and keep the per-entity on-demand tag fetch. */
  @Test
  void singleEntityContext_noLoader_fetchesTagsPerEntity() {
    @SuppressWarnings("unchecked")
    EntityRepository<Table> repository = mock(EntityRepository.class);
    when(repository.isSupportsTags()).thenReturn(true);
    Fields tagFields = mock(Fields.class);
    when(repository.getFields(anyString())).thenReturn(tagFields);

    Table table = new Table();
    ResourceContext<Table> context = new ResourceContext<>("table", table, repository);

    context.ensureTagsLoaded();

    verify(repository).setFieldsInternal(table, tagFields);
  }
}
