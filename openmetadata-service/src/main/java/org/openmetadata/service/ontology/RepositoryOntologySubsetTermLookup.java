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

package org.openmetadata.service.ontology;

import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.entity.read.EntityPageReader;
import org.openmetadata.service.entity.read.EntityReadService;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.ontology.OntologySubsetTermSelector.TermLookup;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

final class RepositoryOntologySubsetTermLookup implements TermLookup {
  private static final String SUBSET_FIELDS = "parent,relatedTerms,attributes,conceptMappings";
  private final GlossaryTermRepository repository;
  private final Fields fields;

  RepositoryOntologySubsetTermLookup(final GlossaryTermRepository repository) {
    this.repository = repository;
    fields = repository.fieldPolicy().parse(SUBSET_FIELDS);
  }

  @Override
  public GlossaryTerm read(final UUID termId) {
    return repository
        .reads()
        .byId(
            termId,
            new EntityReadService.Query(
                null, fields, RelationIncludes.fromInclude(Include.NON_DELETED), false));
  }

  @Override
  public List<GlossaryTerm> descendants(final GlossaryTerm root, final int limit) {
    final ListFilter filter =
        new ListFilter(Include.NON_DELETED).addQueryParam("parent", root.getFullyQualifiedName());
    return repository
        .pages()
        .after(new EntityPageReader.Projection(null, fields, filter), limit, null)
        .getData();
  }
}
