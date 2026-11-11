package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.jdbi3.OntologyTestDatabase.migrate;
import static org.openmetadata.service.jdbi3.OntologyTestDatabase.withDatabase;

import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.IntStream;
import org.jdbi.v3.core.Handle;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.api.data.NativeOntologyLoadedPrefix;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.jdbi3.OntologyDAO.LineagePosition;
import org.openmetadata.service.jdbi3.OntologyDAO.PrefixFilter;
import org.openmetadata.service.jdbi3.OntologyDAO.PrefixLineageQuery;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

class OntologyPrefixLineageDaoTest {
  private static final String FROM_TYPE_RELATION_INDEX =
      "idx_entity_relationship_from_type_relation";
  private static final Pattern POSTGRES_FROM_ID_PROBE =
      Pattern.compile("index cond: .*\\(?fromid\\)?(::\\w+)? = \\(?(loaded|source)\\.assetid\\)?");
  private static final UUID ONTOLOGY = UUID.fromString("00000000-0000-0000-0000-0000000000f0");
  private static final UUID CUSTOMER = new UUID(0xc1, 0);
  private static final UUID ORDER = new UUID(0xc2, 0);
  private static final UUID INVOICE = new UUID(0xc3, 0);

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void edgesJoinOnlyAssetsInsideTheLoadedPrefixes(final ConnectionType dialect) {
    withDatabase(
        dialect,
        handle -> {
          seedBindings(handle, dialect);
          relate(handle, 1, 2, "");
          relate(handle, 1, 2, "variant");
          relate(handle, 2, 4, "");
          relate(handle, 4, 2, "");
          relate(handle, 1, 3, "");
          relate(handle, 2, 5, "");
          relate(handle, 1, 99, "");
          relate(handle, new Lineage(3, 2, "", Relationship.CONTAINS.ordinal(), false));
          relate(handle, new Lineage(2, 4, "removed", Relationship.UPSTREAM.ordinal(), true));

          final var dao = handle.attach(CollectionDAO.class).ontologyDAO();
          final var filter = PrefixFilter.of(loaded());
          final var first =
              dao.listLineageForPrefixes(
                  filter.predicate("source"),
                  filter.predicate("target"),
                  filter.bindings(),
                  new PrefixLineageQuery(ONTOLOGY.toString(), LineagePosition.FIRST, 500));
          assertEquals(
              List.of("0001>0002>", "0001>0002>variant", "0002>0004>", "0004>0002>"), keys(first));

          final var afterFirst = first.getFirst().position();
          final var rest =
              dao.listLineageForPrefixes(
                  filter.predicate("source"),
                  filter.predicate("target"),
                  filter.bindings(),
                  new PrefixLineageQuery(ONTOLOGY.toString(), afterFirst, 2));
          assertEquals(List.of("0001>0002>variant", "0002>0004>"), keys(rest));
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void theQueryProbesRelationshipsByFromIdInsteadOfScanningTheTable(final ConnectionType dialect) {
    withDatabase(
        dialect,
        handle -> {
          seedBindings(handle, dialect);
          relate(handle, 1, 2, "");
          seedUnrelatedLineage(handle, 20_000);
          analyze(handle, dialect);

          final String plan = prefixLineagePlan(handle, dialect);
          assertTrue(probesFromIdByLoadedAsset(dialect, plan), plan);
          assertFalse(plan.contains("seq scan on entity_relationship"), plan);
          assertFalse(plan.contains("scan on relation"), plan);
        });
  }

  private static String prefixLineagePlan(final Handle handle, final ConnectionType dialect) {
    final var filter = PrefixFilter.of(loaded());
    final var plan =
        handle
            .createQuery(explain(dialect) + OntologyDAO.PREFIX_LINEAGE_SQL)
            .define("sourcePredicate", filter.predicate("source"))
            .define("targetPredicate", filter.predicate("target"))
            .bindMap(filter.bindings())
            .bindMethods(
                "query", new PrefixLineageQuery(ONTOLOGY.toString(), LineagePosition.FIRST, 500))
            .map((rows, context) -> rows.getString(1))
            .list();
    return String.join("\n", plan).toLowerCase(Locale.ROOT);
  }

  /**
   * MySQL names the lookup. PostgreSQL shows it as an index condition on fromId that takes each
   * loaded asset, whichever of an index, bitmap or index-only scan it picks; once it drops the
   * trivial {@code loaded} subquery scan, the column prints under the binding alias {@code source}.
   */
  private static boolean probesFromIdByLoadedAsset(
      final ConnectionType dialect, final String plan) {
    return dialect == ConnectionType.MYSQL
        ? plan.contains("index lookup on relation using")
        : POSTGRES_FROM_ID_PROBE.matcher(plan).find();
  }

  private static String explain(final ConnectionType dialect) {
    return dialect == ConnectionType.MYSQL ? "EXPLAIN FORMAT=TREE " : "EXPLAIN ";
  }

  private static List<NativeOntologyLoadedPrefix> loaded() {
    return List.of(
        new NativeOntologyLoadedPrefix()
            .withConceptId(CUSTOMER)
            .withBindingRevision(1L)
            .withThroughAssetId(asset(2)),
        new NativeOntologyLoadedPrefix()
            .withConceptId(ORDER)
            .withBindingRevision(1L)
            .withThroughAssetId(asset(4)),
        new NativeOntologyLoadedPrefix().withConceptId(INVOICE).withBindingRevision(1L));
  }

  private static void seedBindings(final Handle handle, final ConnectionType dialect) {
    handle.execute("DROP TABLE IF EXISTS entity_relationship");
    handle.execute("DROP TABLE IF EXISTS ontology_concept_binding");
    migrate(handle, dialect);
    handle.execute(
        dialect == ConnectionType.MYSQL
            ? "ALTER TABLE entity_relationship ADD INDEX "
                + FROM_TYPE_RELATION_INDEX
                + " (fromId, fromEntity, relation)"
            : "CREATE INDEX IF NOT EXISTS "
                + FROM_TYPE_RELATION_INDEX
                + " ON entity_relationship(fromId, fromEntity, relation)");
    bind(handle, CUSTOMER, 1, 2, 3);
    bind(handle, ORDER, 2, 4);
    bind(handle, INVOICE, 5);
  }

  private static void bind(final Handle handle, final UUID concept, final int... assets) {
    for (final int asset : assets) {
      handle.execute(
          "INSERT INTO ontology_concept_binding (conceptId, assetId, assetType, assetFqnHash, columnBindings) VALUES (?, ?, 'table', ?, '[]')",
          concept.toString(),
          asset(asset).toString(),
          "hash" + asset);
    }
  }

  private static void relate(
      final Handle handle, final int from, final int to, final String relationType) {
    relate(handle, new Lineage(from, to, relationType, Relationship.UPSTREAM.ordinal(), false));
  }

  private static void relate(final Handle handle, final Lineage lineage) {
    handle
        .createUpdate(
            "INSERT INTO entity_relationship (fromId, toId, fromEntity, toEntity, relation, relationType, deleted) VALUES (:from, :to, 'table', 'table', :relation, :type, :deleted)")
        .bind("from", asset(lineage.from()).toString())
        .bind("to", asset(lineage.to()).toString())
        .bind("relation", lineage.relation())
        .bind("type", lineage.relationType())
        .bind("deleted", lineage.deleted())
        .execute();
  }

  private static void seedUnrelatedLineage(final Handle handle, final int rows) {
    final var batch =
        handle.prepareBatch(
            "INSERT INTO entity_relationship (fromId, toId, fromEntity, toEntity, relation, relationType, deleted) VALUES (:from, :to, 'table', 'table', :relation, '', FALSE)");
    IntStream.range(0, rows)
        .forEach(
            index ->
                batch
                    .bind("from", new UUID(1L, index).toString())
                    .bind("to", new UUID(2L, index).toString())
                    .bind("relation", Relationship.UPSTREAM.ordinal())
                    .add());
    batch.execute();
  }

  private static void analyze(final Handle handle, final ConnectionType dialect) {
    handle.execute(
        dialect == ConnectionType.MYSQL
            ? "ANALYZE TABLE entity_relationship, ontology_concept_binding"
            : "ANALYZE entity_relationship");
  }

  private static List<String> keys(final List<OntologyDAO.PrefixLineageRow> rows) {
    return rows.stream()
        .map(
            row ->
                row.fromId().substring(row.fromId().length() - 4)
                    + ">"
                    + row.toId().substring(row.toId().length() - 4)
                    + ">"
                    + row.relationType())
        .toList();
  }

  private static UUID asset(final int number) {
    return new UUID(0, number);
  }

  private record Lineage(int from, int to, String relationType, int relation, boolean deleted) {}
}
