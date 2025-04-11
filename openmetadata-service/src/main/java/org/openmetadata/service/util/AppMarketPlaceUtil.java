package org.openmetadata.service.util;

import static org.openmetadata.service.Entity.ADMIN_USER_NAME;
import static org.openmetadata.service.Entity.APPLICATION;
import static org.openmetadata.service.jdbi3.AppRepository.APP_BOT_ROLE;
import static org.openmetadata.service.jdbi3.EntityRepository.getEntitiesFromSeedData;

import java.io.IOException;
import java.util.List;
import org.openmetadata.schema.entity.app.AppMarketPlaceDefinition;
import org.openmetadata.schema.entity.app.CreateAppMarketPlaceDefinitionReq;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.AppMarketPlaceRepository;
import org.openmetadata.service.jdbi3.PolicyRepository;
import org.openmetadata.service.jdbi3.RoleRepository;
import org.openmetadata.service.jdbi3.TeamRepository;
import org.openmetadata.service.resources.apps.AppMarketPlaceMapper;

public class AppMarketPlaceUtil {
  public static void createAppMarketPlaceDefinitions(
      AppMarketPlaceRepository appMarketRepository, AppMarketPlaceMapper mapper)
      throws IOException {
    PolicyRepository policyRepository = Entity.getPolicyRepository();
    RoleRepository roleRepository = Entity.getRoleRepository();

    try {
      roleRepository.findByName(APP_BOT_ROLE, Include.NON_DELETED);
    } catch (EntityNotFoundException e) {
      policyRepository.initSeedDataFromResources();
      List<Role> roles = roleRepository.getEntitiesFromSeedData();
      for (Role role : roles) {
        role.setFullyQualifiedName(role.getName());
        List<EntityReference> policies = role.getPolicies();
        for (EntityReference policy : policies) {
          EntityReference ref =
              Entity.getEntityReferenceByName(Entity.POLICY, policy.getName(), Include.NON_DELETED);
          policy.setId(ref.getId());
        }
        roleRepository.initializeEntity(role);
      }
      TeamRepository teamRepository = (TeamRepository) Entity.getEntityRepository(Entity.TEAM);
      teamRepository.initOrganization();
    }

    List<CreateAppMarketPlaceDefinitionReq> createAppMarketPlaceDefinitionReqs =
        getEntitiesFromSeedData(
            APPLICATION,
            String.format(".*json/data/%s/.*\\.json$", Entity.APP_MARKET_PLACE_DEF),
            CreateAppMarketPlaceDefinitionReq.class);
    for (CreateAppMarketPlaceDefinitionReq definitionReq : createAppMarketPlaceDefinitionReqs) {
      AppMarketPlaceDefinition definition = mapper.createToEntity(definitionReq, ADMIN_USER_NAME);
      appMarketRepository.setFullyQualifiedName(definition);
      appMarketRepository.createOrUpdate(null, definition, ADMIN_USER_NAME);
    }
  }
}
