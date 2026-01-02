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

package org.openmetadata.service.services.glossary;

import static org.openmetadata.service.Entity.ADMIN_USER_NAME;
import static org.openmetadata.service.Entity.GLOSSARY;

import jakarta.ws.rs.core.UriInfo;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.VoteRequest;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.LoadGlossary;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.GlossaryRepository;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.resources.glossary.GlossaryTermMapper;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.services.AbstractEntityService;
import org.openmetadata.service.services.Service;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.RestUtil;

@Slf4j
@Singleton
@Service(entityType = Entity.GLOSSARY_TERM)
public class GlossaryTermService extends AbstractEntityService<GlossaryTerm> {

  @Getter private final GlossaryTermMapper mapper;
  private final GlossaryTermRepository glossaryTermRepository;
  private final GlossaryService glossaryService;

  @Inject
  public GlossaryTermService(
      GlossaryTermRepository repository,
      SearchRepository searchRepository,
      Authorizer authorizer,
      GlossaryTermMapper mapper,
      GlossaryService glossaryService) {
    super(repository, searchRepository, authorizer, Entity.GLOSSARY_TERM);
    this.glossaryTermRepository = repository;
    this.mapper = mapper;
    this.glossaryService = glossaryService;
  }

  public void initialize() {
    GlossaryRepository glossaryRepository =
        (GlossaryRepository) Entity.getEntityRepository(GLOSSARY);
    List<LoadGlossary> loadGlossaries =
        EntityRepository.getEntitiesFromSeedData(
            GLOSSARY, ".*json/data/glossary/.*Glossary\\.json$", LoadGlossary.class);
    for (LoadGlossary loadGlossary : loadGlossaries) {
      Glossary glossary =
          glossaryService
              .getMapper()
              .createToEntity(loadGlossary.getCreateGlossary(), ADMIN_USER_NAME);
      glossary.setFullyQualifiedName(glossary.getName());
      glossaryRepository.initializeEntity(glossary);

      List<GlossaryTerm> termsToCreate = new ArrayList<>();
      for (CreateGlossaryTerm createTerm : loadGlossary.getCreateTerms()) {
        createTerm.withGlossary(glossary.getName());
        createTerm.withProvider(glossary.getProvider());
        GlossaryTerm term = mapper.createToEntity(createTerm, ADMIN_USER_NAME);
        glossaryTermRepository.setFullyQualifiedName(term);
        termsToCreate.add(term);
      }

      EntityUtil.sortByFQN(termsToCreate);

      for (GlossaryTerm term : termsToCreate) {
        glossaryTermRepository.initializeEntity(term);
      }
    }
  }

  public GlossaryTerm addHref(UriInfo uriInfo, GlossaryTerm term) {
    Entity.withHref(uriInfo, term.getOwners());
    Entity.withHref(uriInfo, term.getFollowers());
    Entity.withHref(uriInfo, term.getExperts());
    Entity.withHref(uriInfo, term.getReviewers());
    Entity.withHref(uriInfo, term.getChildren());
    Entity.withHref(uriInfo, term.getDomains());
    Entity.withHref(uriInfo, term.getDataProducts());
    Entity.withHref(uriInfo, term.getGlossary());
    Entity.withHref(uriInfo, term.getParent());
    Entity.withHref(uriInfo, term.getRelatedTerms());
    return term;
  }

  public RestUtil.PutResponse<GlossaryTerm> updateVote(
      String updatedBy, UUID id, VoteRequest request) {
    return glossaryTermRepository.updateVote(updatedBy, id, request);
  }
}
