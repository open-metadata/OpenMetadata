package org.openmetadata.service.security.listaccess;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * A condition on the rows of one listed entity type. Each leaf reads a row's effective value, with
 * inheritance applied, as {@code authorize} reads it. {@link RowFilterCompiler} builds it from the
 * caller's policies and {@link SqlRowFilterRenderer} turns it into a WHERE fragment
 * (ADR:2026-11-09-a-listing-filters-its-rows-in-sql-through-a-required-access-scope).
 */
public sealed interface RowPredicate {
  RowPredicate TRUE = new Const(true);
  RowPredicate FALSE = new Const(false);

  record And(List<RowPredicate> all) implements RowPredicate {
    public And {
      all = List.copyOf(all);
    }
  }

  record Or(List<RowPredicate> any) implements RowPredicate {
    public Or {
      any = List.copyOf(any);
    }
  }

  record Not(RowPredicate negated) implements RowPredicate {}

  /** Exists while compiling. {@link RowFilter#of} turns a constant plan into all rows or none. */
  record Const(boolean value) implements RowPredicate {}

  /**
   * A condition SQL cannot decide exactly: {@code lower} implies it, and it implies {@code upper}.
   * The renderer picks the bound that keeps the SQL a superset of the readable rows, and the per-row
   * check decides the rest.
   */
  record Approx(RowPredicate lower, RowPredicate upper, ApproxReason reason)
      implements RowPredicate {}

  enum ApproxReason {
    UNTRANSLATED_CONDITION,
    TYPE_NOT_COVERED,
    TAGS,
    TEAM_SET_TOO_LARGE
  }

  /** A condition on one effective value of the row. */
  sealed interface Cond extends RowPredicate
      permits OwnerMatch, NoOwner, InDomains, NoDomain, TaggedAny, TaggedAll, ReviewedBy {}

  /** The row has an owner that the condition accepts. */
  sealed interface OwnerMatch extends Cond permits OwnedBy, OwnerTeamWithin, OwnerUnderTeams {}

  /** An owner of the row, user or team, is one of {@code owners}. */
  record OwnedBy(Set<UUID> owners) implements OwnerMatch {
    public OwnedBy {
      owners = nonEmpty(owners, "owners");
    }
  }

  record NoOwner() implements Cond {}

  /**
   * A team owner of the row is one of {@code teams}. It selects the rows whose owning team brings
   * its deny rules to the caller, and a user owner never brings any.
   */
  record OwnerTeamWithin(Set<UUID> teams) implements OwnerMatch {
    public OwnerTeamWithin {
      teams = nonEmpty(teams, "teams");
    }
  }

  /**
   * A team owner of the row is one of {@code teams}, or a user owner is a member of one. That is the
   * row half of {@code matchTeam()}, which counts both.
   */
  record OwnerUnderTeams(Set<UUID> teams) implements OwnerMatch {
    public OwnerUnderTeams {
      teams = nonEmpty(teams, "teams");
    }
  }

  /** A domain of the row is one of {@code domainFqns} or a sub-domain of one. */
  record InDomains(Set<String> domainFqns) implements Cond {
    public InDomains {
      domainFqns = nonEmpty(domainFqns, "domains");
    }
  }

  record NoDomain() implements Cond {}

  record TaggedAny(Set<String> tagFqns) implements Cond {
    public TaggedAny {
      tagFqns = Set.copyOf(tagFqns);
    }
  }

  record TaggedAll(Set<String> tagFqns) implements Cond {
    public TaggedAll {
      tagFqns = Set.copyOf(tagFqns);
    }
  }

  /** A reviewer of the row, user or team, is one of {@code reviewers}. */
  record ReviewedBy(Set<UUID> reviewers) implements Cond {
    public ReviewedBy {
      reviewers = nonEmpty(reviewers, "reviewers");
    }
  }

  static RowPredicate and(RowPredicate... parts) {
    return and(Arrays.asList(parts));
  }

  static RowPredicate and(Collection<RowPredicate> parts) {
    return combine(parts, true);
  }

  static RowPredicate or(RowPredicate... parts) {
    return or(Arrays.asList(parts));
  }

  static RowPredicate or(Collection<RowPredicate> parts) {
    return combine(parts, false);
  }

  /**
   * Flattens nested nodes of the same kind, drops the constant that changes nothing, and collapses
   * to the constant that decides the whole: FALSE for a conjunction, TRUE for a disjunction.
   */
  private static RowPredicate combine(Collection<RowPredicate> parts, boolean conjunction) {
    RowPredicate deciding = conjunction ? FALSE : TRUE;
    Set<RowPredicate> kept = new LinkedHashSet<>();
    for (RowPredicate part : parts) {
      kept.addAll(sameKindChildren(part, conjunction));
    }
    kept.remove(conjunction ? TRUE : FALSE);
    RowPredicate combined;
    if (kept.contains(deciding)) {
      combined = deciding;
    } else if (kept.size() <= 1) {
      combined = kept.isEmpty() ? not(deciding) : kept.iterator().next();
    } else {
      List<RowPredicate> children = new ArrayList<>(kept);
      combined = conjunction ? new And(children) : new Or(children);
    }
    return combined;
  }

  private static List<RowPredicate> sameKindChildren(RowPredicate part, boolean conjunction) {
    List<RowPredicate> children = List.of(part);
    if (conjunction && part instanceof And and) {
      children = and.all();
    } else if (!conjunction && part instanceof Or or) {
      children = or.any();
    }
    return children;
  }

  static RowPredicate not(RowPredicate predicate) {
    return switch (predicate) {
      case Const constant -> new Const(!constant.value());
      case Not not -> not.negated();
      default -> new Not(predicate);
    };
  }

  /** A condition nothing is known about: every row may or may not satisfy it. */
  static RowPredicate unknown(ApproxReason reason) {
    return new Approx(FALSE, TRUE, reason);
  }

  /** A leaf over no values would render {@code IN ()}; the factories fold it to FALSE instead. */
  private static <T> Set<T> nonEmpty(Set<T> values, String what) {
    if (values.isEmpty()) {
      throw new IllegalArgumentException("A row condition needs at least one of its " + what);
    }
    return Set.copyOf(values);
  }

  static RowPredicate ownedBy(Set<UUID> owners) {
    return owners.isEmpty() ? FALSE : new OwnedBy(owners);
  }

  static RowPredicate ownerTeamWithin(Set<UUID> teams) {
    return teams.isEmpty() ? FALSE : new OwnerTeamWithin(teams);
  }

  static RowPredicate ownerUnderTeams(Set<UUID> teams) {
    return teams.isEmpty() ? FALSE : new OwnerUnderTeams(teams);
  }

  static RowPredicate inDomains(Set<String> domainFqns) {
    return domainFqns.isEmpty() ? FALSE : new InDomains(domainFqns);
  }

  static RowPredicate reviewedBy(Set<UUID> reviewers) {
    return reviewers.isEmpty() ? FALSE : new ReviewedBy(reviewers);
  }

  /** No approximation remains, so SQL decides every row the way {@code authorize} does. */
  static boolean exact(RowPredicate predicate) {
    return switch (predicate) {
      case And and -> and.all().stream().allMatch(RowPredicate::exact);
      case Or or -> or.any().stream().allMatch(RowPredicate::exact);
      case Not not -> exact(not.negated());
      case Approx ignored -> false;
      case Const ignored -> true;
      case Cond ignored -> true;
    };
  }
}
