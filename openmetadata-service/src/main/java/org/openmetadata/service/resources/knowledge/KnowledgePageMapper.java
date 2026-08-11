package org.openmetadata.service.resources.knowledge;

import static org.openmetadata.service.Entity.ORGANIZATION_NAME;
import static org.openmetadata.service.Entity.TEAM;

import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.api.data.CreatePage;
import org.openmetadata.schema.entity.data.Page;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Votes;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityMapper;

public class KnowledgePageMapper implements EntityMapper<Page, CreatePage> {
  @Override
  public Page createToEntity(CreatePage create, String user) {
    // Resolve the effective related-entities list locally without mutating the inbound
    // CreatePage. Mutating the request object (previously via create.withRelatedEntities)
    // leaked the Organization fallback into the caller's request copy, which is surprising
    // if the request is re-used or logged.
    List<EntityReference> relatedEntities = create.getRelatedEntities();
    if (relatedEntities == null || relatedEntities.isEmpty()) {
      relatedEntities = new ArrayList<>();
      relatedEntities.add(Entity.getEntityReferenceByName(TEAM, ORGANIZATION_NAME, Include.ALL));
    }
    return copy(new Page(), create, user)
        .withTags(create.getTags())
        .withVotes(new Votes().withUpVotes(0).withDownVotes(0))
        .withPageType(create.getPageType())
        .withPage(create.getPage())
        .withParent(create.getParent())
        .withRelatedEntities(relatedEntities);
  }
}
