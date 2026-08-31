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
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.util.EntityUtil.Fields;

final class RepositoryOntologyBulkTermCatalog implements OntologyBulkTermCatalog {
  private static final String BULK_FIELDS =
      "parent,relatedTerms,attributes,conceptMappings,ontologySource";
  private static final String PARENT_FILTER = "parent";
  private final GlossaryTermRepository repository;
  private final Fields fields;

  RepositoryOntologyBulkTermCatalog(final GlossaryTermRepository repository) {
    this.repository = repository;
    fields = repository.getFields(BULK_FIELDS);
  }

  @Override
  public List<GlossaryTerm> list(final Glossary glossary) {
    final ListFilter filter =
        new ListFilter(Include.NON_DELETED)
            .addQueryParam(PARENT_FILTER, glossary.getFullyQualifiedName());
    return repository.listAll(fields, filter);
  }
}
