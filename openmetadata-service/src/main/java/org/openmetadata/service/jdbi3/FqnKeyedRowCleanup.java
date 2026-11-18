package org.openmetadata.service.jdbi3;

import static java.util.stream.Collectors.joining;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.StringJoiner;
import java.util.function.Function;
import java.util.function.Predicate;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Removes the FQN-keyed rows a hard delete leaves behind: tag labels and field relationships at and
 * under the deleted entity's FQN. Those tables key rows by FQN hash alone, and an FQN is unique
 * only within an entity type: services of two kinds can share a name, a stored procedure can share
 * a table's FQN, and dashboard data models nest under {@code service.model}, the FQN of a chart
 * named "model". Rows that an entity the delete leaves in place also holds stay
 * (ADR:2026-11-18-a-hard-delete-keeps-the-rows-of-entities-that-share-its-fqn).
 */
final class FqnKeyedRowCleanup {
  /** Past this many surviving subtrees under a deleted FQN, only the rows at the FQN are removed. */
  static final int MAX_KEPT_SUBTREES = 100;

  private static final int PROBE_BATCH_SIZE = 50;
  private static final String UNDER = ".%";

  private final CollectionDAO daoCollection;
  private final String entityType;
  private final String ownTable;
  private final boolean taggable;

  FqnKeyedRowCleanup(
      CollectionDAO daoCollection, String entityType, String ownTable, boolean taggable) {
    this.daoCollection = daoCollection;
    this.entityType = entityType;
    this.ownTable = ownTable;
    this.taggable = taggable;
  }

  /** Whether an entity of another type has {@code fqn}, and with it the same rows. */
  boolean isSharedByAnotherType(String fqn) {
    return taggable && !namesakeHashes(List.of(FullyQualifiedName.buildHash(fqn))).isEmpty();
  }

  /** Deletes the rows each FQN's entity owns, probing in batches: few FQNs share anything. */
  void delete(List<String> fqns) {
    for (int start = 0; start < fqns.size(); start += PROBE_BATCH_SIZE) {
      List<String> batch = fqns.subList(start, Math.min(fqns.size(), start + PROBE_BATCH_SIZE));
      ownedRows(batch).forEach(this::delete);
    }
  }

  private void delete(String fqn, OwnedRows owned) {
    if (owned.underFqn()) {
      deleteAtAndUnder(fqn, owned.keptSubtreeHashes());
    } else if (owned.atFqn()) {
      daoCollection.tagUsageDAO().deleteTagsByTarget(fqn);
    }
  }

  private void deleteAtAndUnder(String fqn, List<String> keptSubtreeHashes) {
    if (keptSubtreeHashes.isEmpty()) {
      daoCollection.fieldRelationshipDAO().deleteAllByPrefix(fqn, entityType);
      if (taggable) {
        daoCollection.tagUsageDAO().deleteTagLabelsByTargetPrefix(fqn);
      }
    } else {
      daoCollection
          .fieldRelationshipDAO()
          .deleteAllByPrefixOutside(fqn, entityType, keptSubtreeHashes);
      daoCollection.tagUsageDAO().deleteTagLabelsByTargetPrefixOutside(fqn, keptSubtreeHashes);
    }
  }

  private Map<String, OwnedRows> ownedRows(List<String> fqns) {
    Map<String, String> hashes = new LinkedHashMap<>();
    fqns.forEach(fqn -> hashes.put(fqn, FullyQualifiedName.buildHash(fqn)));
    Map<String, OwnedRows> owned = new LinkedHashMap<>();
    if (taggable) {
      Set<String> namesakes = new HashSet<>(namesakeHashes(List.copyOf(hashes.values())));
      boolean anyNested = hasNestedHolders(List.copyOf(hashes.values()));
      hashes.forEach(
          (fqn, hash) -> owned.put(fqn, ownedRows(hash, namesakes.contains(hash), anyNested)));
    } else {
      fqns.forEach(fqn -> owned.put(fqn, OwnedRows.ALL));
    }
    return owned;
  }

  private OwnedRows ownedRows(String hash, boolean hasNamesake, boolean mayHaveNestedHolders) {
    OwnedRows owned = OwnedRows.NONE;
    if (!hasNamesake) {
      owned = mayHaveNestedHolders ? OwnedRows.keeping(nestedHolderHashes(hash)) : OwnedRows.ALL;
    }
    return owned;
  }

  /** The hashes among {@code hashes} that an entity of another taggable type also has. */
  private List<String> namesakeHashes(List<String> hashes) {
    Map<String, String> bindings = bindAll("hash", hashes, "");
    String inList = bindings.keySet().stream().map(name -> ":" + name).collect(joining(", "));
    return listHashes(
        tables(this::isAnotherTypesTable),
        table -> table.select() + " WHERE " + table.hashColumn() + " IN (" + inList + ")",
        bindings);
  }

  private boolean hasNestedHolders(List<String> hashes) {
    Map<String, String> bindings = bindAll("under", hashes, UNDER);
    return !listHashes(
            tables(EntityRepository::nestsUnderUnrelatedFqns),
            table ->
                table.select() + " WHERE " + likeAny(table.hashColumn(), bindings) + " LIMIT 1",
            bindings)
        .isEmpty();
  }

  /** Entities under the hash, listed one past the cap so that hitting it shows. */
  private List<String> nestedHolderHashes(String hash) {
    return listHashes(
        tables(EntityRepository::nestsUnderUnrelatedFqns),
        table ->
            table.select()
                + " WHERE "
                + table.hashColumn()
                + " LIKE :under LIMIT "
                + (MAX_KEPT_SUBTREES + 1),
        Map.of("under", hash + UNDER));
  }

  private List<String> listHashes(
      List<EntityTable> tables, Function<EntityTable, String> select, Map<String, String> binds) {
    List<String> hashes = List.of();
    if (!tables.isEmpty()) {
      String query =
          tables.stream().map(select).map(part -> "(" + part + ")").collect(joining(" UNION ALL "));
      hashes = daoCollection.tagUsageDAO().listEntityFqnHashes(query, binds);
    }
    return hashes;
  }

  private boolean isAnotherTypesTable(EntityRepository<?> repository) {
    return !Objects.equals(repository.getDao().getTableName(), ownTable);
  }

  /** The tables of taggable types: only those can hold rows in {@code tag_usage}. */
  private static List<EntityTable> tables(Predicate<EntityRepository<?>> include) {
    return Entity.getEntityRepositories().stream()
        .filter(EntityRepository::isSupportsTags)
        .filter(FqnKeyedRowCleanup::hasTable)
        .filter(include)
        .map(repository -> repository.getDao())
        .map(dao -> new EntityTable(dao.getTableName(), dao.getNameHashColumn()))
        .distinct()
        .toList();
  }

  private static boolean hasTable(EntityRepository<?> repository) {
    return repository.getDao() != null && repository.getDao().getTableName() != null;
  }

  private static Map<String, String> bindAll(String name, List<String> values, String suffix) {
    Map<String, String> bindings = new LinkedHashMap<>();
    for (int index = 0; index < values.size(); index++) {
      bindings.put(name + index, values.get(index) + suffix);
    }
    return bindings;
  }

  private static String likeAny(String column, Map<String, String> bindings) {
    return bindings.keySet().stream()
        .map(name -> column + " LIKE :" + name)
        .collect(joining(" OR ", "(", ")"));
  }

  /**
   * {@code " AND NOT (c = :kept0 OR c LIKE :keptUnder0 ...)"}: leaves the rows at and under each
   * kept subtree, binding the values. Empty when nothing is kept.
   */
  static String outsideKeptSubtrees(
      String column, List<String> keptSubtreeHashes, Map<String, String> bindings) {
    StringJoiner kept = new StringJoiner(" OR ", " AND NOT (", ")").setEmptyValue("");
    for (int index = 0; index < keptSubtreeHashes.size(); index++) {
      bindings.put("kept" + index, keptSubtreeHashes.get(index));
      bindings.put("keptUnder" + index, keptSubtreeHashes.get(index) + UNDER);
      kept.add(column + " = :kept" + index + " OR " + column + " LIKE :keptUnder" + index);
    }
    return kept.toString();
  }

  /** Drops each hash nested under another: keeping an ancestor's subtree keeps it too. */
  static List<String> outermost(List<String> hashes) {
    List<String> outermost = new ArrayList<>();
    for (String hash : hashes.stream().distinct().sorted().toList()) {
      if (outermost.isEmpty() || !hash.startsWith(outermost.getLast() + Entity.SEPARATOR)) {
        outermost.add(hash);
      }
    }
    return List.copyOf(outermost);
  }

  private record EntityTable(String name, String hashColumn) {
    String select() {
      return "SELECT " + hashColumn + " FROM " + name;
    }
  }

  /**
   * The rows at an FQN and under it that its entity owns. Rows under {@code keptSubtreeHashes}
   * belong to entities the delete leaves in place.
   */
  record OwnedRows(boolean atFqn, boolean underFqn, List<String> keptSubtreeHashes) {
    static final OwnedRows ALL = new OwnedRows(true, true, List.of());
    static final OwnedRows NONE = new OwnedRows(false, false, List.of());
    static final OwnedRows AT_FQN_ONLY = new OwnedRows(true, false, List.of());

    /** All rows except the subtrees of the entities that nest under the FQN. */
    static OwnedRows keeping(List<String> nestedHolderHashes) {
      OwnedRows owned = AT_FQN_ONLY;
      if (nestedHolderHashes.size() <= MAX_KEPT_SUBTREES) {
        List<String> kept = outermost(nestedHolderHashes);
        owned = kept.isEmpty() ? ALL : new OwnedRows(true, true, kept);
      }
      return owned;
    }
  }
}
