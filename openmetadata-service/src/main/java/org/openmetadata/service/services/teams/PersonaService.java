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

package org.openmetadata.service.services.teams;

import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.teams.Persona;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.PersonaRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.EntityBaseService;
import org.openmetadata.service.resources.ResourceEntityInfo;
import org.openmetadata.service.resources.teams.PersonaMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.services.Service;

@Slf4j
@Singleton
@Service(entityType = Entity.PERSONA)
public class PersonaService extends EntityBaseService<Persona, PersonaRepository> {

  public static final String FIELDS = "users";

  @Getter private final PersonaMapper mapper;

  @Inject
  public PersonaService(
      PersonaRepository repository, Authorizer authorizer, PersonaMapper mapper, Limits limits) {
    super(new ResourceEntityInfo<>(Entity.PERSONA, Persona.class), repository, authorizer, limits);
    this.mapper = mapper;
  }

  public static class PersonaList extends ResultList<Persona> {}
}
