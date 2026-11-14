package org.openmetadata.service.security.listaccess;

import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.listaccess.RowPredicate.And;
import org.openmetadata.service.security.listaccess.RowPredicate.Approx;
import org.openmetadata.service.security.listaccess.RowPredicate.Cond;
import org.openmetadata.service.security.listaccess.RowPredicate.Const;
import org.openmetadata.service.security.listaccess.RowPredicate.InDomains;
import org.openmetadata.service.security.listaccess.RowPredicate.NoDomain;
import org.openmetadata.service.security.listaccess.RowPredicate.NoOwner;
import org.openmetadata.service.security.listaccess.RowPredicate.Not;
import org.openmetadata.service.security.listaccess.RowPredicate.Or;
import org.openmetadata.service.security.listaccess.RowPredicate.OwnedBy;
import org.openmetadata.service.security.listaccess.RowPredicate.OwnerMatch;
import org.openmetadata.service.security.listaccess.RowPredicate.OwnerTeamWithin;
import org.openmetadata.service.security.listaccess.RowPredicate.OwnerUnderTeams;
import org.openmetadata.service.security.listaccess.RowPredicate.ReviewedBy;
import org.openmetadata.service.security.listaccess.RowPredicate.TaggedAll;
import org.openmetadata.service.security.listaccess.RowPredicate.TaggedAny;
import org.openmetadata.service.security.listaccess.ValueSource.Inherited;
import org.openmetadata.service.security.listaccess.ValueSource.Own;
import org.openmetadata.service.security.listaccess.ValueSource.Self;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Renders a plan fitted by {@link RowCoverage} as a WHERE fragment over one listed table. Ids are
 * inlined as canonical UUIDs and hashes as checked hex digests, so nothing needs binding. Under an
 * even number of NOTs an approximation renders its upper bound and under an odd number its lower
 * bound, so the fragment selects every readable row. {@code NOT IN} is never emitted, because it
 * selects nothing once its subquery yields a NULL. A renderer numbers the aliases it creates, so it
 * renders one plan.
 */
final class SqlRowFilterRenderer {
  // An fqnHash joins one 32-digit MD5 hex per FQN segment with a separator.
  private static final int HASH_SEGMENT_LENGTH = 33;
  private static final Pattern FQN_HASH = Pattern.compile("[0-9a-f]{32}(\\.[0-9a-f]{32})*");
  private static final String RELATIONSHIPS = "entity_relationship";
  private static final String DOMAIN_TABLE = "domain_entity";
  private static final String USER_TABLE = "user_entity";
  private static final String TEAM_TABLE = "team_entity";
  private static final String TRUE_SQL = "TRUE";
  private static final String FALSE_SQL = "FALSE";

  private int aliases;

  String render(RowPredicate predicate, RowStorage storage, String rowQualifier) {
    return node(predicate, false, Level.of(storage, rowQualifier));
  }

  /** A row whose values a condition reads: the listed row, or a parent it inherits from. */
  private record Level(RowStorage storage, String id, String hash) {
    static Level of(RowStorage storage, String qualifier) {
      return new Level(storage, qualifier + ".id", qualifier + "." + storage.hashColumn());
    }
  }

  private String node(RowPredicate predicate, boolean negated, Level row) {
    return switch (predicate) {
      case And and -> join(" AND ", and.all(), negated, row);
      case Or or -> join(" OR ", or.any(), negated, row);
      case Not not -> "NOT (" + node(not.negated(), !negated, row) + ")";
      case Approx approx -> node(negated ? approx.lower() : approx.upper(), negated, row);
      case Const constant -> constant.value() ? TRUE_SQL : FALSE_SQL;
      case Cond leaf -> leaf(leaf, row);
    };
  }

  private String join(String operator, List<RowPredicate> parts, boolean negated, Level row) {
    return parts.stream()
        .map(part -> node(part, negated, row))
        .collect(Collectors.joining(operator, "(", ")"));
  }

  private String leaf(Cond leaf, Level row) {
    return switch (leaf) {
      case OwnerMatch match -> owners(match, row);
      case NoOwner ignored -> noOwner(row);
      case InDomains inDomains -> domains(hashesOf(inDomains.domainFqns()), row);
      case NoDomain ignored -> noDomain(row);
      case ReviewedBy reviewed -> reviewedBy(reviewed.reviewers(), row);
      case TaggedAny ignored -> throw notComputed("tags", row);
      case TaggedAll ignored -> throw notComputed("tags", row);
    };
  }

  private String owners(OwnerMatch match, Level row) {
    return switch (row.storage().owners()) {
      case Own ignored -> ownOwner(match, row);
      case Self ignored -> userRowMatches(match, row);
      case Inherited parent -> nearest(
          ownOwner(match, row), anyOwnOwner(row), parent, row, l -> owners(match, l));
      default -> throw notComputed("owners", row);
    };
  }

  private String noOwner(Level row) {
    return switch (row.storage().owners()) {
      case Own ignored -> "NOT " + anyOwnOwner(row);
      case Self ignored -> FALSE_SQL;
      case Inherited parent -> noneAnywhere(anyOwnOwner(row), parent, row, this::noOwner);
      default -> throw notComputed("owners", row);
    };
  }

  private String domains(List<String> domainHashes, Level row) {
    return switch (row.storage().domains()) {
      case Own ignored -> ownDomainWithin(domainHashes, row);
      case Self ignored -> hashWithin(row.hash(), domainHashes);
      case Inherited parent -> nearest(
          ownDomainWithin(domainHashes, row),
          anyOwnDomain(row),
          parent,
          row,
          level -> domains(domainHashes, level));
      default -> throw notComputed("domains", row);
    };
  }

  private String noDomain(Level row) {
    return switch (row.storage().domains()) {
      case Own ignored -> "NOT " + anyOwnDomain(row);
      case Self ignored -> FALSE_SQL;
      case Inherited parent -> noneAnywhere(anyOwnDomain(row), parent, row, this::noDomain);
      default -> throw notComputed("domains", row);
    };
  }

  private String reviewedBy(Set<UUID> reviewers, Level row) {
    if (!(row.storage().reviewers() instanceof Own)) {
      throw notComputed("reviewers", row);
    }
    String relation = alias();
    return relationExists(
        relation,
        Relationship.REVIEWS,
        row,
        "%s.fromId IN (%s)".formatted(relation, uuids(reviewers)));
  }

  /** The row's own value decides when it has one, and its parent's effective value otherwise. */
  private String nearest(
      String ownMatches,
      String ownAny,
      Inherited parent,
      Level row,
      Function<Level, String> parentMatches) {
    return "(%s OR (NOT %s AND %s))"
        .formatted(ownMatches, ownAny, parentRow(parent, row, parentMatches));
  }

  private String noneAnywhere(
      String ownAny, Inherited parent, Level row, Function<Level, String> parentHasNone) {
    return "(NOT %s AND %s)".formatted(ownAny, parentRow(parent, row, parentHasNone));
  }

  private String parentRow(Inherited parent, Level row, Function<Level, String> condition) {
    String alias = alias();
    Level level = Level.of(parent.parent(), alias);
    return "EXISTS (SELECT 1 FROM %s %s WHERE %s = LEFT(%s, %d) AND %s)"
        .formatted(
            parent.parent().table(),
            alias,
            level.hash(),
            row.hash(),
            HASH_SEGMENT_LENGTH * parent.parentSegments() - 1,
            condition.apply(level));
  }

  private String ownOwner(OwnerMatch match, Level row) {
    String relation = alias();
    return relationExists(
        relation,
        Relationship.OWNS,
        row,
        liveOwner(relation) + " AND " + ownerAccepted(match, relation));
  }

  private String anyOwnOwner(Level row) {
    String relation = alias();
    return relationExists(relation, Relationship.OWNS, row, liveOwner(relation));
  }

  /** A deleted user or team keeps its owner rows, and reads leave it out (NON_DELETED). */
  private String liveOwner(String relation) {
    return "(%s OR %s)"
        .formatted(
            liveFrom(relation, Entity.USER, USER_TABLE),
            liveFrom(relation, Entity.TEAM, TEAM_TABLE));
  }

  private String liveFrom(String relation, String entityType, String table) {
    String entity = alias();
    return ("(%1$s.fromEntity = '%2$s' AND EXISTS (SELECT 1 FROM %3$s %4$s"
            + " WHERE %4$s.id = %1$s.fromId AND %4$s.deleted = FALSE))")
        .formatted(relation, entityType, table, entity);
  }

  private String ownerAccepted(OwnerMatch match, String relation) {
    return switch (match) {
      case OwnedBy owned -> "%s.fromId IN (%s)".formatted(relation, uuids(owned.owners()));
      case OwnerTeamWithin owned -> teamOwnerIn(relation, owned.teams());
      case OwnerUnderTeams owned -> "(%s OR (%s.fromEntity = '%s' AND %s.fromId IN (%s)))"
          .formatted(
              teamOwnerIn(relation, owned.teams()),
              relation,
              Entity.USER,
              relation,
              membersOf(owned.teams()));
    };
  }

  private static String teamOwnerIn(String relation, Set<UUID> teams) {
    return "(%1$s.fromEntity = '%2$s' AND %1$s.fromId IN (%3$s))"
        .formatted(relation, Entity.TEAM, uuids(teams));
  }

  /** A user is its own owner, so a user row matches by its own id. */
  private String userRowMatches(OwnerMatch match, Level row) {
    return switch (match) {
      case OwnedBy owned -> "%s IN (%s)".formatted(row.id(), uuids(owned.owners()));
      case OwnerTeamWithin ignored -> FALSE_SQL;
      case OwnerUnderTeams owned -> "%s IN (%s)".formatted(row.id(), membersOf(owned.teams()));
    };
  }

  /**
   * The live users who belong directly to one of {@code teams}. A deleted user keeps its membership
   * rows, and the read path does not resolve it, so it is under no team there.
   */
  private String membersOf(Set<UUID> teams) {
    String member = alias();
    String user = alias();
    return ("SELECT %1$s.toId FROM %2$s %1$s WHERE %1$s.fromId IN (%3$s)"
            + " AND %1$s.fromEntity = '%4$s' AND %1$s.toEntity = '%5$s'"
            + " AND %1$s.relation = %6$d AND %1$s.deleted = FALSE"
            + " AND EXISTS (SELECT 1 FROM %7$s %8$s"
            + " WHERE %8$s.id = %1$s.toId AND %8$s.deleted = FALSE)")
        .formatted(
            member,
            RELATIONSHIPS,
            uuids(teams),
            Entity.TEAM,
            Entity.USER,
            Relationship.HAS.ordinal(),
            USER_TABLE,
            user);
  }

  private String ownDomainWithin(List<String> domainHashes, Level row) {
    String relation = alias();
    String domain = alias();
    return ("EXISTS (SELECT 1 FROM %1$s %2$s JOIN %3$s %4$s ON %4$s.id = %2$s.fromId"
            + " WHERE %5$s AND %2$s.fromEntity = '%6$s' AND %7$s)")
        .formatted(
            RELATIONSHIPS,
            relation,
            DOMAIN_TABLE,
            domain,
            relationToRow(relation, Relationship.HAS, row),
            Entity.DOMAIN,
            hashWithin(domain + ".fqnHash", domainHashes));
  }

  private String anyOwnDomain(Level row) {
    String relation = alias();
    return relationExists(
        relation, Relationship.HAS, row, "%s.fromEntity = '%s'".formatted(relation, Entity.DOMAIN));
  }

  private static String relationExists(
      String relation, Relationship kind, Level row, String condition) {
    return "EXISTS (SELECT 1 FROM %s %s WHERE %s AND %s)"
        .formatted(RELATIONSHIPS, relation, relationToRow(relation, kind, row), condition);
  }

  /** The live relationships of one kind that point at the row, read as findFrom reads them. */
  private static String relationToRow(String relation, Relationship kind, Level row) {
    return ("%1$s.toId = %2$s AND %1$s.toEntity = '%3$s' AND %1$s.relation = %4$d"
            + " AND %1$s.deleted = FALSE")
        .formatted(relation, row.id(), row.storage().entityType(), kind.ordinal());
  }

  /** The hash is one of {@code hashes} or lies under one, as a sub-domain lies under its domain. */
  private static String hashWithin(String hashColumn, List<String> hashes) {
    return hashes.stream()
        .map(hash -> "%1$s = '%2$s' OR %1$s LIKE '%2$s.%%'".formatted(hashColumn, hash))
        .collect(Collectors.joining(" OR ", "(", ")"));
  }

  private static List<String> hashesOf(Collection<String> fqns) {
    return fqns.stream().map(SqlRowFilterRenderer::checkedHash).sorted().toList();
  }

  private static String checkedHash(String fqn) {
    String hash = FullyQualifiedName.buildHash(fqn);
    if (hash == null || !FQN_HASH.matcher(hash).matches()) {
      throw new IllegalArgumentException("Not a fully qualified name with hex hashes: " + fqn);
    }
    return hash;
  }

  private static String uuids(Set<UUID> ids) {
    return ids.stream()
        .map(UUID::toString)
        .sorted()
        .map(id -> "'" + id + "'")
        .collect(Collectors.joining(", "));
  }

  private String alias() {
    aliases++;
    return "la" + aliases;
  }

  private static IllegalStateException notComputed(String field, Level row) {
    return new IllegalStateException(
        "SQL does not compute the %s of %s rows; RowCoverage should have approximated them"
            .formatted(field, row.storage().entityType()));
  }
}
