package org.openmetadata.service.security.listaccess;

import static java.util.Map.entry;

import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.security.listaccess.ValueSource.Absent;
import org.openmetadata.service.security.listaccess.ValueSource.Inherited;
import org.openmetadata.service.security.listaccess.ValueSource.Own;
import org.openmetadata.service.security.listaccess.ValueSource.Self;
import org.openmetadata.service.security.listaccess.ValueSource.Uncovered;

/**
 * The types whose owners and domains SQL computes as the read path does. Each entry restates the
 * parent its repository inherits from ({@code getParentEntity}, {@code applyInheritance}); a type
 * without an entry has its owner, domain and reviewer conditions approximated and checked per row.
 */
final class RowStorages {
  private RowStorages() {}

  /** Where a type's owners or domains come from: its own rows, or a parent by fqnHash prefix. */
  private sealed interface Link {}

  private record OwnRows() implements Link {}

  private record SelfRow() implements Link {}

  private record NotCovered() implements Link {}

  private record Parent(String parentType, int parentSegments) implements Link {}

  private record Declared(Link owners, Link domains) {}

  private static final Link OWN = new OwnRows();
  private static final Declared OWN_VALUES = new Declared(OWN, OWN);
  private static final Declared UNDECLARED = new Declared(new NotCovered(), new NotCovered());

  private static final Map<String, Declared> DECLARED =
      Map.ofEntries(
          entry(Entity.DATABASE_SERVICE, OWN_VALUES),
          entry(Entity.DASHBOARD_SERVICE, OWN_VALUES),
          entry(Entity.PIPELINE_SERVICE, OWN_VALUES),
          entry(Entity.MESSAGING_SERVICE, OWN_VALUES),
          entry(Entity.MLMODEL_SERVICE, OWN_VALUES),
          entry(Entity.STORAGE_SERVICE, OWN_VALUES),
          entry(Entity.SEARCH_SERVICE, OWN_VALUES),
          entry(Entity.API_SERVICE, OWN_VALUES),
          entry(Entity.GLOSSARY, OWN_VALUES),
          entry(Entity.CLASSIFICATION, OWN_VALUES),
          entry(Entity.DATABASE, domainsFrom(Entity.DATABASE_SERVICE, 1)),
          entry(Entity.DATABASE_SCHEMA, bothFrom(Entity.DATABASE, 2)),
          entry(Entity.TABLE, bothFrom(Entity.DATABASE_SCHEMA, 3)),
          entry(Entity.STORED_PROCEDURE, bothFrom(Entity.DATABASE_SCHEMA, 3)),
          entry(Entity.DASHBOARD, domainsFrom(Entity.DASHBOARD_SERVICE, 1)),
          entry(Entity.CHART, domainsFrom(Entity.DASHBOARD_SERVICE, 1)),
          entry(Entity.DASHBOARD_DATA_MODEL, domainsFrom(Entity.DASHBOARD_SERVICE, 1)),
          entry(Entity.PIPELINE, domainsFrom(Entity.PIPELINE_SERVICE, 1)),
          entry(Entity.TOPIC, domainsFrom(Entity.MESSAGING_SERVICE, 1)),
          entry(Entity.MLMODEL, domainsFrom(Entity.MLMODEL_SERVICE, 1)),
          entry(Entity.CONTAINER, domainsFrom(Entity.STORAGE_SERVICE, 1)),
          entry(Entity.SEARCH_INDEX, domainsFrom(Entity.SEARCH_SERVICE, 1)),
          entry(Entity.API_COLLECTION, domainsFrom(Entity.API_SERVICE, 1)),
          entry(Entity.API_ENDPOINT, bothFrom(Entity.API_COLLECTION, 2)),
          entry(Entity.USER, new Declared(new SelfRow(), new NotCovered())),
          entry(Entity.DOMAIN, new Declared(new NotCovered(), new SelfRow())));

  private static Declared domainsFrom(String parentType, int parentSegments) {
    return new Declared(OWN, new Parent(parentType, parentSegments));
  }

  private static Declared bothFrom(String parentType, int parentSegments) {
    Link parent = new Parent(parentType, parentSegments);
    return new Declared(parent, parent);
  }

  static RowStorage of(String entityType) {
    EntityRepository<?> repository = Entity.getEntityRepository(entityType);
    Declared declared = DECLARED.getOrDefault(entityType, UNDECLARED);
    EntityDAO<?> dao = repository.getDao();
    return new RowStorage(
        entityType,
        dao.getTableName(),
        dao.getNameHashColumn(),
        source(repository.isSupportsOwners(), declared.owners(), RowStorage::owners),
        source(repository.isSupportsDomains(), declared.domains(), RowStorage::domains),
        reviewers(repository.isSupportsReviewers(), declared),
        repository.isSupportsTags());
  }

  /** The types whose owners and domains SQL computes. */
  static Set<String> coveredTypes() {
    return DECLARED.keySet();
  }

  /** Whether SQL computes the owners and domains of {@code entityType}, naming its table. */
  static boolean covers(String entityType) {
    return DECLARED.containsKey(entityType);
  }

  /**
   * Reviewers are the union of every level, and of the declared types none inherits them; glossary
   * terms and the ontology types do, and they have no entry.
   */
  private static ValueSource reviewers(boolean supported, Declared declared) {
    ValueSource source = new Absent();
    if (supported) {
      source = declared == UNDECLARED ? new Uncovered() : new Own();
    }
    return source;
  }

  private static ValueSource source(
      boolean supported, Link link, Function<RowStorage, ValueSource> sameField) {
    return switch (link) {
      case OwnRows ignored -> supported ? new Own() : new Absent();
      case SelfRow ignored -> new Self();
      case NotCovered ignored -> supported ? new Uncovered() : new Absent();
      case Parent parent -> supported ? inherited(parent, sameField) : new Absent();
    };
  }

  /** A parent without the field gives nothing to inherit, so the row's own value is the value. */
  private static ValueSource inherited(Parent link, Function<RowStorage, ValueSource> sameField) {
    RowStorage parent = of(link.parentType());
    return switch (sameField.apply(parent)) {
      case Uncovered ignored -> new Uncovered();
      case Absent ignored -> new Own();
      default -> new Inherited(parent, link.parentSegments());
    };
  }
}
