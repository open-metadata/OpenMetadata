package org.openmetadata.service.entity.metadata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.teams.CreateTeam.TeamType;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

class EntityReferenceValidatorTest {
  private static final UUID ID = new UUID(0, 1);

  @Test
  void groupOwnerUsesTheValidatedTeamForItsCompleteReference() {
    final Fixture fixture = new Fixture();
    final EntityReference request = ref(Entity.TEAM).withName("incoming");
    final EntityReference owner = fixture.validator.owners(List.of(request)).getFirst();
    assertEquals(
        JsonUtils.pojoToJson(fixture.team.getEntityReference()), JsonUtils.pojoToJson(owner));
    assertEquals(1, fixture.teamReads);
    assertTrue(fixture.lookups.isEmpty());
    assertEquals("incoming", request.getName());
  }

  @Test
  void duplicateTeamOwnersHaveIndependentReferences() {
    final Fixture fixture = new Fixture();
    final List<EntityReference> owners =
        fixture.validator.owners(List.of(ref(Entity.TEAM), ref(Entity.TEAM)));
    owners.getFirst().setName("changed");
    assertEquals("team", owners.getLast().getName());
    assertEquals(2, fixture.teamReads);
  }

  @Test
  void userOwnersUseOnlyNonDeletedReferencesAndKeepInputOrder() {
    final Fixture fixture = new Fixture();
    final EntityReference second = ref(Entity.USER).withId(new UUID(0, 2));
    final List<EntityReference> owners =
        fixture.validator.owners(List.of(second, ref(Entity.USER)));
    assertEquals(List.of(second.getId(), ID), owners.stream().map(EntityReference::getId).toList());
    assertEquals(List.of(Include.NON_DELETED, Include.NON_DELETED), fixture.includes());
    assertEquals(0, fixture.teamReads);
  }

  @Test
  void invalidOwnerTypesAndNonGroupTeamsKeepTheirValidationErrors() {
    final Fixture fixture = new Fixture();
    assertEquals(
        "Owner type must be specified for owner with id [" + ID + "]",
        assertThrows(
                IllegalArgumentException.class, () -> fixture.validator.owners(List.of(ref(null))))
            .getMessage());
    assertThrows(
        IllegalArgumentException.class, () -> fixture.validator.owners(List.of(ref(Entity.TABLE))));
    assertTrue(fixture.lookups.isEmpty());
    fixture.team.setTeamType(TeamType.DEPARTMENT);
    assertThrows(
        IllegalArgumentException.class, () -> fixture.validator.owners(List.of(ref(Entity.TEAM))));
    assertTrue(fixture.lookups.isEmpty());
  }

  @Test
  void usersResolveIdsBeforeNamesAndCopyOnlyTheExistingFields() {
    final Fixture fixture = new Fixture();
    final EntityReference named =
        new EntityReference()
            .withFullyQualifiedName("alpha")
            .withDescription("keep")
            .withInherited(true);
    final EntityReference identified = ref(Entity.TEAM).withName("stale");
    final List<EntityReference> users = new ArrayList<>(List.of(identified, named));
    fixture.validator.users(users);
    assertSame(named, users.getFirst());
    assertEquals("alpha", named.getName());
    assertEquals(Entity.USER, named.getType());
    assertEquals("keep", named.getDescription());
    assertEquals(Boolean.TRUE, named.getInherited());
    assertEquals(Entity.USER, identified.getType());
    assertEquals(List.of(Include.ALL, Include.ALL), fixture.includes());
  }

  @Test
  void reviewerRulesAllowOneTeamOrMultipleUsersAndRejectMixedTypesBeforeLookups() {
    final Fixture fixture = new Fixture();
    fixture.validator.reviewers(new ArrayList<>(List.of(ref(Entity.TEAM))));
    assertEquals(Include.ALL, fixture.lookups.getFirst().include());
    fixture.lookups.clear();
    assertEquals(
        "Only one team can be assigned as reviewer.",
        assertThrows(
                IllegalArgumentException.class,
                () -> fixture.validator.reviewers(List.of(ref(Entity.TEAM), ref(Entity.TEAM))))
            .getMessage());
    assertThrows(
        IllegalArgumentException.class,
        () -> fixture.validator.reviewers(List.of(ref(Entity.TEAM), ref(Entity.USER))));
    assertThrows(NullPointerException.class, () -> fixture.validator.reviewers(List.of(ref(null))));
    assertTrue(fixture.lookups.isEmpty());
    fixture.validator.reviewers(new ArrayList<>(List.of(ref(Entity.USER), ref(Entity.USER))));
    assertEquals(2, fixture.lookups.size());
  }

  @Test
  void aReviewerTeamCanResolveByFqn() {
    final Fixture fixture = new Fixture();
    final EntityReference reviewer =
        new EntityReference().withType(Entity.TEAM).withFullyQualifiedName("alpha");
    fixture.validator.reviewers(new ArrayList<>(List.of(reviewer)));
    assertEquals(ID, reviewer.getId());
    assertEquals("alpha", reviewer.getName());
    assertEquals(new Lookup(Entity.TEAM, "alpha", Include.ALL), fixture.lookups.getFirst());
  }

  @Test
  void rolesAndPoliciesResolveByIdAndSortTheirHydratedValues() {
    final Fixture fixture = new Fixture();
    final List<EntityReference> references =
        new ArrayList<>(List.of(ref(Entity.USER).withId(new UUID(0, 2)), ref(Entity.USER)));
    fixture.validator.roles(references);
    assertEquals(
        List.of(Entity.ROLE, Entity.ROLE),
        references.stream().map(EntityReference::getType).toList());
    assertEquals(ID, references.getFirst().getId());
    fixture.validator.policies(references);
    assertEquals(
        List.of(Entity.POLICY, Entity.POLICY),
        references.stream().map(EntityReference::getType).toList());
    assertTrue(fixture.includes().stream().allMatch(include -> include == Include.ALL));
  }

  @Test
  void emptyListsKeepTheExistingMutableAndImmutableInputBehavior() {
    final Fixture fixture = new Fixture();
    fixture.validator.users(null);
    fixture.validator.roles(null);
    fixture.validator.policies(null);
    fixture.validator.reviewers(null);
    fixture.validator.reviewers(List.of());
    assertThrows(UnsupportedOperationException.class, () -> fixture.validator.users(List.of()));
    assertThrows(UnsupportedOperationException.class, () -> fixture.validator.roles(List.of()));
    assertThrows(UnsupportedOperationException.class, () -> fixture.validator.policies(List.of()));
    assertNull(fixture.validator.owners(List.of()));
    assertNull(fixture.validator.owners(null));
    assertTrue(fixture.lookups.isEmpty());
  }

  @Test
  void domainCapabilityChecksKeepTheirDifferentNullInputRules() {
    final Fixture fixture = new Fixture();
    assertNull(fixture.validator.domains(List.of("domain"), false));
    assertNull(fixture.validator.domains(null, true));
    assertNull(fixture.validator.domainsByRef(null, true));
    assertThrows(IllegalArgumentException.class, () -> fixture.validator.domainsByRef(null, false));
    assertThrows(IllegalArgumentException.class, () -> fixture.validator.dataProducts(null, false));
    assertTrue(fixture.lookups.isEmpty());
  }

  @Test
  void domainsResolveNonDeletedReferencesAndRetainNullResultFiltering() {
    final Fixture fixture = new Fixture();
    assertEquals("alpha", fixture.validator.domains(List.of("alpha"), true).getFirst().getName());
    final EntityReference request = ref(Entity.USER).withName("incoming");
    assertEquals(
        Entity.DOMAIN, fixture.validator.domainsByRef(List.of(request), true).getFirst().getType());
    assertEquals("incoming", request.getName());
    fixture.missing = true;
    assertTrue(fixture.validator.domains(List.of("missing"), true).isEmpty());
    assertTrue(fixture.validator.domainsByRef(List.of(request), true).isEmpty());
    assertTrue(fixture.includes().stream().allMatch(include -> include == Include.NON_DELETED));
  }

  @Test
  void dataProductValidationHydratesInPlaceWithoutSortingOrReplacingMetadata() {
    final Fixture fixture = new Fixture();
    final EntityReference first = ref(Entity.USER).withId(new UUID(0, 2)).withDescription("keep");
    final List<EntityReference> values = new ArrayList<>(List.of(first, ref(Entity.USER)));
    fixture.validator.dataProducts(values, true);
    assertSame(first, values.getFirst());
    assertEquals(Entity.DATA_PRODUCT, first.getType());
    assertEquals("keep", first.getDescription());
    assertEquals(List.of(Include.NON_DELETED, Include.NON_DELETED), fixture.includes());
    fixture.validator.dataProducts(null, true);
    fixture.validator.dataProducts(List.of(), true);
  }

  @Test
  void inheritedReferenceListsRetainIdentityWithoutValidation() {
    final Fixture fixture = new Fixture();
    final List<EntityReference> inherited = List.of(ref(null).withInherited(true));
    assertSame(inherited, fixture.validator.validatedOwners(inherited));
    assertSame(inherited, fixture.validator.validatedDomains(inherited, false));
    assertNull(fixture.validator.validatedOwners(null));
    assertNull(fixture.validator.validatedDomains(null, false));
    final List<EntityReference> empty = List.of();
    assertSame(empty, fixture.validator.validatedOwners(empty));
    assertSame(empty, fixture.validator.validatedDomains(empty, false));
    assertTrue(fixture.lookups.isEmpty());
  }

  @Test
  void mixedInheritanceValidatesEveryReferenceAndSortsTheResolvedValues() {
    final Fixture fixture = new Fixture();
    final List<EntityReference> values =
        List.of(ref(Entity.USER).withId(new UUID(0, 2)).withInherited(true), ref(Entity.USER));
    final List<EntityReference> owners = fixture.validator.validatedOwners(values);
    final List<EntityReference> domains = fixture.validator.validatedDomains(values, true);
    assertEquals(ID, owners.getFirst().getId());
    assertEquals(ID, domains.getFirst().getId());
    assertEquals(new UUID(0, 2), values.getFirst().getId());
    assertEquals(4, fixture.lookups.size());
  }

  @Test
  void unresolvedDomainsRetainTheOriginalProjection() {
    final Fixture fixture = new Fixture();
    fixture.missing = true;
    final List<EntityReference> domains = List.of(ref(Entity.DOMAIN));
    assertSame(domains, fixture.validator.validatedDomains(domains, true));
  }

  private static EntityReference ref(final String type) {
    return new EntityReference().withId(ID).withType(type);
  }

  private record Lookup(String type, Object key, Include include) {}

  private static final class Fixture {
    private final Team team =
        new Team()
            .withId(ID)
            .withName("team")
            .withFullyQualifiedName("team")
            .withTeamType(TeamType.GROUP)
            .withDescription("description")
            .withDisplayName("display")
            .withDeleted(false)
            .withHref(URI.create("http://localhost/team"));
    private final List<Lookup> lookups = new ArrayList<>();
    private int teamReads;
    private boolean missing;
    private final EntityReferenceValidator validator =
        new EntityReferenceValidator(
            new EntityReferenceValidator.References(
                this::byId,
                this::byName,
                id -> {
                  teamReads++;
                  return team;
                }));

    private EntityReference byId(final String type, final UUID id, final Include include) {
      lookups.add(new Lookup(type, id, include));
      return missing
          ? null
          : new EntityReference()
              .withId(id)
              .withType(type)
              .withName("reference" + id.getLeastSignificantBits())
              .withFullyQualifiedName("reference" + id.getLeastSignificantBits())
              .withDescription("stored")
              .withDeleted(false);
    }

    private EntityReference byName(final String type, final String name, final Include include) {
      lookups.add(new Lookup(type, name, include));
      return missing
          ? null
          : new EntityReference()
              .withId(ID)
              .withType(type)
              .withName(name)
              .withFullyQualifiedName(name);
    }

    private List<Include> includes() {
      return lookups.stream().map(Lookup::include).toList();
    }
  }
}
