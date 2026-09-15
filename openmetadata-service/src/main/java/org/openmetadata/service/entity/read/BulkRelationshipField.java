package org.openmetadata.service.entity.read;

import static org.openmetadata.service.Entity.DATA_CONTRACT;
import static org.openmetadata.service.Entity.DATA_PRODUCT;
import static org.openmetadata.service.Entity.DOMAIN;
import static org.openmetadata.service.Entity.FIELD_CHILDREN;
import static org.openmetadata.service.Entity.FIELD_DATA_CONTRACT;
import static org.openmetadata.service.Entity.FIELD_DATA_PRODUCTS;
import static org.openmetadata.service.Entity.FIELD_DOMAINS;
import static org.openmetadata.service.Entity.FIELD_EXPERTS;
import static org.openmetadata.service.Entity.FIELD_FOLLOWERS;
import static org.openmetadata.service.Entity.FIELD_OWNERS;
import static org.openmetadata.service.Entity.FIELD_REVIEWERS;
import static org.openmetadata.service.Entity.FIELD_VOTES;
import static org.openmetadata.service.Entity.USER;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.function.BiConsumer;
import java.util.stream.Collectors;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.VoteRequest.VoteType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.Votes;
import org.openmetadata.schema.utils.JsonUtils;

/** A relationship projection and its assignment policy for list reads. */
public record BulkRelationshipField(
    String name, EdgeSelection selection, BiConsumer<EntityInterface, List<Value>> assign) {

  public record EdgeSelection(boolean incoming, Relationship relationship, String relatedType) {}

  public record Value(EntityReference reference, String json) {}

  public static List<BulkRelationshipField> defaults(String entityType, Set<String> allowedFields) {
    return List.of(
            field(FIELD_OWNERS, true, Relationship.OWNS, null, EntityInterface::setOwners),
            field(FIELD_FOLLOWERS, true, Relationship.FOLLOWS, USER, EntityInterface::setFollowers),
            field(FIELD_DOMAINS, true, Relationship.HAS, DOMAIN, EntityInterface::setDomains),
            field(FIELD_REVIEWERS, true, Relationship.REVIEWS, null, EntityInterface::setReviewers),
            field(
                FIELD_DATA_PRODUCTS,
                true,
                Relationship.HAS,
                DATA_PRODUCT,
                EntityInterface::setDataProducts),
            new BulkRelationshipField(
                FIELD_VOTES,
                new EdgeSelection(true, Relationship.VOTED, USER),
                BulkRelationshipField::assignVotes),
            field(
                FIELD_CHILDREN,
                false,
                Relationship.CONTAINS,
                entityType,
                (entity, refs) -> entity.setChildren(refs.isEmpty() ? null : refs)),
            field(
                FIELD_DATA_CONTRACT,
                false,
                Relationship.CONTAINS,
                DATA_CONTRACT,
                (entity, refs) -> entity.setDataContract(refs.isEmpty() ? null : refs.getFirst())),
            field(FIELD_EXPERTS, false, Relationship.EXPERT, USER, EntityInterface::setExperts))
        .stream()
        .filter(field -> allowedFields.contains(field.name()))
        .toList();
  }

  private static BulkRelationshipField field(
      String name,
      boolean incoming,
      Relationship relationship,
      String relatedType,
      BiConsumer<EntityInterface, List<EntityReference>> setter) {
    return new BulkRelationshipField(
        name,
        new EdgeSelection(incoming, relationship, relatedType),
        (entity, values) ->
            setter.accept(
                entity,
                values.isEmpty()
                    ? List.of()
                    : values.stream()
                        .map(Value::reference)
                        .collect(Collectors.toCollection(ArrayList::new))));
  }

  private static void assignVotes(EntityInterface entity, List<Value> values) {
    final List<EntityReference> up = new ArrayList<>();
    final List<EntityReference> down = new ArrayList<>();
    for (final Value value : values) {
      final VoteType vote = JsonUtils.readValue(value.json(), VoteType.class);
      if (vote == VoteType.VOTED_UP) {
        up.add(value.reference());
      } else if (vote == VoteType.VOTED_DOWN) {
        down.add(value.reference());
      }
    }
    entity.setVotes(
        new Votes()
            .withUpVotes(up.size())
            .withDownVotes(down.size())
            .withUpVoters(up)
            .withDownVoters(down));
  }
}
