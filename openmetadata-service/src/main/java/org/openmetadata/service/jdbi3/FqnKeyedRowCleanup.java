package org.openmetadata.service.jdbi3;

import static java.util.stream.Collectors.joining;
import static java.util.stream.Collectors.toSet;

import java.util.ArrayList;
import java.util.Collection;
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
 * a table's FQN, dashboard data models nest under {@code service.model}, the FQN of a chart named
 * "model", and a metric's bare name can equal a table column's FQN. Rows that an entity the delete
 * leaves in place also holds stay
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
  private final boolean freeFormFqn;

  FqnKeyedRowCleanup(CollectionDAO daoCollection, EntityRepository<?> deleting) {
    this.daoCollection = daoCollection;
    this.entityType = deleting.getEntityType();
    this.ownTable = deleting.getDao() == null ? null : deleting.getDao().getTableName();
    this.taggable = deleting.isSupportsTags();
    this.freeFormFqn = deleting.nestsUnderUnrelatedFqns();
  }

  /**
   * Whether a recursive hard delete rooted at {@code fqn} keeps rows under it that its descendants
   * hold, so that each descendant must remove its own. Asked before the cascade, while the root's
   * descendants still exist, so the search leaves out the types whose entities nest under the
   * root's type as its descendants.
   */
  boolean rootKeepsDescendantRows(String fqn) {
    List<String> hashes = List.of(FullyQualifiedName.buildHash(fqn));
    return taggable
        && (!keptHashes(hashes).isEmpty()
            || hasNestedHolders(hashes, tables(this::nestsUnrelatedToThisType)));
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
      List<String> hashList = List.copyOf(hashes.values());
      Set<String> kept = keptHashes(hashList);
      boolean anyNested =
          hasNestedHolders(hashList, tables(EntityRepository::nestsUnderUnrelatedFqns));
      hashes.forEach(
          (fqn, hash) -> owned.put(fqn, ownedRows(hash, kept.contains(hash), anyNested)));
    } else {
      fqns.forEach(fqn -> owned.put(fqn, OwnedRows.ALL));
    }
    return owned;
  }

  private OwnedRows ownedRows(String hash, boolean heldElsewhere, boolean mayHaveNestedHolders) {
    OwnedRows owned = OwnedRows.NONE;
    if (!heldElsewhere) {
      owned = mayHaveNestedHolders ? OwnedRows.keeping(nestedHolderHashes(hash)) : OwnedRows.ALL;
    }
    return owned;
  }

  /** The hashes whose rows another entity holds too: as its own, or as one of its fields'. */
  private Set<String> keptHashes(List<String> hashes) {
    Set<String> kept = new HashSet<>(namesakeHashes(hashes));
    if (freeFormFqn) {
      kept.addAll(fieldHashes(hashes));
    }
    return kept;
  }

  /** The hashes among {@code hashes} that an entity of another taggable type also has. */
  private List<String> namesakeHashes(List<String> hashes) {
    Map<String, String> bindings = bindAll("hash", hashes, "");
    List<EntityTable> tables = tables(this::isAnotherTypesTable);
    return listHashes(tables, inProbes(tables, bindings.keySet()), bindings);
  }

  /**
   * The hashes that sit under an entity with tagged inline fields (a table's columns, a topic's
   * schema fields, a file's columns): a free-form FQN can equal one of its fields' FQNs and then
   * shares that field's rows.
   */
  private Set<String> fieldHashes(List<String> hashes) {
    List<String> prefixes =
        hashes.stream().flatMap(hash -> properPrefixes(hash).stream()).distinct().toList();
    Map<String, String> bindings = bindAll("prefix", prefixes, "");
    List<EntityTable> tables = tables(EntityRepository::hasTaggedFields);
    Set<String> fieldHolders =
        prefixes.isEmpty()
            ? Set.of()
            : new HashSet<>(listHashes(tables, inProbes(tables, bindings.keySet()), bindings));
    return hashes.stream()
        .filter(hash -> properPrefixes(hash).stream().anyMatch(fieldHolders::contains))
        .collect(toSet());
  }

  private boolean hasNestedHolders(List<String> hashes, List<EntityTable> nestingTables) {
    Map<String, String> bindings = bindAll("under", hashes, UNDER);
    return !listHashes(nestingTables, anyUnderProbes(nestingTables, bindings.keySet()), bindings)
        .isEmpty();
  }

  private boolean nestsUnrelatedToThisType(EntityRepository<?> repository) {
    return repository.nestsUnderUnrelatedFqns() && !entityType.equals(repository.fqnParentType());
  }

  /** Entities under the hash, listed one past the cap so that hitting it shows. */
  private List<String> nestedHolderHashes(String hash) {
    List<EntityTable> tables = tables(EntityRepository::nestsUnderUnrelatedFqns);
    return listHashes(
        tables,
        allUnderProbes(tables, "under", MAX_KEPT_SUBTREES + 1),
        Map.of("under", hash + UNDER));
  }

  private List<String> listHashes(
      List<EntityTable> tables, String probes, Map<String, String> bindings) {
    return tables.isEmpty()
        ? List.of()
        : daoCollection.tagUsageDAO().listEntityFqnHashes(probes, bindings);
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

  /** One probe per table for the rows whose hash is one of the bound values. */
  static String inProbes(List<EntityTable> tables, Collection<String> bindNames) {
    String inList = bindNames.stream().map(name -> ":" + name).collect(joining(", "));
    return union(
        tables, table -> table.select() + " WHERE " + table.hashColumn() + " IN (" + inList + ")");
  }

  /** One probe per table for a row under any of the bound prefixes. */
  static String anyUnderProbes(List<EntityTable> tables, Collection<String> bindNames) {
    return union(
        tables,
        table ->
            table.select()
                + " WHERE "
                + bindNames.stream()
                    .map(name -> table.hashColumn() + " LIKE :" + name)
                    .collect(joining(" OR ", "(", ")"))
                + " LIMIT 1");
  }

  /** One probe per table for up to {@code limit} rows under the bound prefix. */
  static String allUnderProbes(List<EntityTable> tables, String bindName, int limit) {
    return union(
        tables,
        table ->
            table.select()
                + " WHERE "
                + table.hashColumn()
                + " LIKE :"
                + bindName
                + " LIMIT "
                + limit);
  }

  private static String union(List<EntityTable> tables, Function<EntityTable, String> probe) {
    return tables.stream().map(probe).map(part -> "(" + part + ")").collect(joining(" UNION ALL "));
  }

  /** The FQN hashes of the entities a hash could nest under: every shorter run of its segments. */
  static List<String> properPrefixes(String hash) {
    List<String> prefixes = new ArrayList<>();
    for (int dot = hash.indexOf(Entity.SEPARATOR);
        dot >= 0;
        dot = hash.indexOf(Entity.SEPARATOR, dot + 1)) {
      prefixes.add(hash.substring(0, dot));
    }
    return List.copyOf(prefixes);
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

  record EntityTable(String name, String hashColumn) {
    String select() {
      return "SELECT " + hashColumn + " AS hash FROM " + name;
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
