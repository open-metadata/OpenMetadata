package org.openmetadata.service.glossary;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Consumer;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.openmetadata.schema.api.data.GlossaryTermPropertyImpact;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.GlossaryTermProperty;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.EntityDataDAOs.GlossaryTermDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Loads the terms a rule needs and runs {@link GlossaryTermPropertyRules} on them. The repository
 * calls it where the design says the rules run, and the pure classes hold the rules themselves.
 */
public final class GlossaryTermPropertyGuard {
  static final int SUBTREE_PAGE_SIZE = 1000;
  private final GlossaryTermDAO dao;

  public GlossaryTermPropertyGuard(final GlossaryTermDAO dao) {
    this.dao = dao;
  }

  /** The ancestors of {@code termFqn}, nearest first. The glossary is not a term and is left out. */
  public List<GlossaryTerm> ancestorsOf(final String termFqn) {
    return loadTerms(FullyQualifiedName.getAncestors(termFqn));
  }

  /** Sets {@code effectiveProperties} on every term, reading all their ancestors in one query. */
  public void setEffectiveProperties(final List<GlossaryTerm> terms) {
    final Set<String> ancestorFqns = new LinkedHashSet<>();
    terms.forEach(
        term -> ancestorFqns.addAll(FullyQualifiedName.getAncestors(term.getFullyQualifiedName())));
    final Map<String, GlossaryTerm> byFqn = termsByFqn(new ArrayList<>(ancestorFqns));
    for (final GlossaryTerm term : terms) {
      final List<GlossaryTerm> ancestors =
          FullyQualifiedName.getAncestors(term.getFullyQualifiedName()).stream()
              .map(byFqn::get)
              .filter(Objects::nonNull)
              .toList();
      term.setEffectiveProperties(GlossaryTermPropertyResolver.resolve(term, ancestors));
    }
  }

  /** Rules 1 and 2 against ancestors for every write, and rule 3 for every key of a new term. */
  public void checkOnPrepare(final GlossaryTerm entity, final boolean update) {
    entity.setEffectiveProperties(null);
    GlossaryTermPropertyRules.validateDefinitions(entity.getPropertyDefinitions());
    GlossaryTermPropertyRules.validateStoredSize(
        entity.getPropertyDefinitions(), entity.getPropertyValues());
    if (!hasPropertyData(entity)) {
      return;
    }
    final List<GlossaryTerm> chain = chainOf(entity.getParent());
    GlossaryTermPropertyRules.validateNoAncestorClash(entity, chain);
    if (!update) {
      GlossaryTermPropertyRules.validateKeys(entity, chain, keysOf(entity));
    }
  }

  /**
   * Rules 1 to 4 and 7 for an edit of {@code original} into {@code updated}. Drops stored entries
   * that name no effective property, because the edit either removed their definition or an ancestor
   * did earlier, and keeps the move rule 7 from dropping anything.
   */
  public void checkEdit(final GlossaryTerm original, final GlossaryTerm updated) {
    final boolean placementChanged = placementChanged(original, updated);
    if (!placementChanged && !hasPropertyData(original) && !hasPropertyData(updated)) {
      return;
    }
    GlossaryTermPropertyRules.validateDefinitions(updated.getPropertyDefinitions());
    GlossaryTermPropertyRules.validateDatatypesUnchanged(
        original.getPropertyDefinitions(), updated.getPropertyDefinitions());
    GlossaryTermPropertyRules.validateStoredSize(
        updated.getPropertyDefinitions(), updated.getPropertyValues());
    final GlossaryTermPropertyChange change =
        GlossaryTermPropertyChange.between(
            original.getPropertyDefinitions(), updated.getPropertyDefinitions());
    checkAgainstAncestors(original, updated, change, placementChanged);
    checkBelow(original, updated, change);
    if (placementChanged) {
      checkMove(updated, original.getFullyQualifiedName(), updated.getParent());
    }
  }

  /** Rules 5 and 6: removes the entries below the term that the edit leaves without a property. */
  public void purgeEntriesBelow(final GlossaryTerm original, final GlossaryTerm updated) {
    final GlossaryTermPropertyChange change =
        GlossaryTermPropertyChange.between(
            original.getPropertyDefinitions(), updated.getPropertyDefinitions());
    final List<String> names =
        Stream.concat(
                change.stoppingToReachBelow().stream(), change.startingToReachBelow().stream())
            .map(GlossaryTermProperty::getName)
            .distinct()
            .toList();
    if (!names.isEmpty()) {
      removeEntriesBelow(original.getFullyQualifiedName(), names);
    }
  }

  /** Rule 7: the moved term and everything below it must still fit the ancestors it gets. */
  public void checkMove(
      final GlossaryTerm movedRoot, final String rootFqn, final EntityReference newParent) {
    final List<GlossaryTerm> newChain = chainOf(newParent);
    final TermPropertyViolations violations = new TermPropertyViolations();
    if (!GlossaryTermPropertyRules.fitsAncestors(movedRoot, newChain)) {
      violations.add(rootFqn);
    }
    final Map<String, GlossaryTerm> declarers = declarersBelow(movedRoot, rootFqn);
    scanSubtree(
        rootFqn,
        page ->
            page.stream()
                .filter(term -> !fitsMoved(term, rootFqn, declarers, newChain))
                .forEach(term -> violations.add(term.getFullyQualifiedName())));
    violations.throwConflictIfAny(
        "Moving '%s' would leave these terms with a property name clash or values no property covers"
            .formatted(rootFqn));
  }

  /** How many terms below {@code term} store an entry for its property {@code name}. */
  public GlossaryTermPropertyImpact impact(final GlossaryTerm term, final String name) {
    final GlossaryTermProperty definition =
        listOrEmpty(term.getPropertyDefinitions()).stream()
            .filter(candidate -> candidate.getName().equals(name))
            .findFirst()
            .orElseThrow(
                () ->
                    new EntityNotFoundException(
                        "Glossary term '%s' does not declare a property named '%s'"
                            .formatted(term.getFullyQualifiedName(), name)));
    if (!GlossaryTermPropertyResolver.isInheritable(definition)) {
      return new GlossaryTermPropertyImpact().withTermsWithEntries(0).withSample(List.of());
    }
    return impactBelow(term.getFullyQualifiedName(), name);
  }

  private GlossaryTermPropertyImpact impactBelow(final String fqn, final String name) {
    final String path = GlossaryTermDAO.propertyEntryPath(name);
    final List<EntityReference> sample =
        dao.listPropertyEntries(fqn, path, name, TermPropertyViolations.SAMPLE_LIMIT).stream()
            .map(json -> JsonUtils.readValue(json, GlossaryTerm.class).getEntityReference())
            .toList();
    return new GlossaryTermPropertyImpact()
        .withTermsWithEntries(dao.countPropertyEntries(fqn, path, name))
        .withSample(sample);
  }

  private void checkAgainstAncestors(
      final GlossaryTerm original,
      final GlossaryTerm updated,
      final GlossaryTermPropertyChange change,
      final boolean placementChanged) {
    final List<GlossaryTerm> chain =
        placementChanged
            ? chainOf(updated.getParent())
            : ancestorsOf(original.getFullyQualifiedName());
    if (!placementChanged) {
      dropStaleEntries(original, updated, change, chain);
    }
    if (!change.isEmpty() || placementChanged) {
      GlossaryTermPropertyRules.validateNoAncestorClash(updated, chain);
    }
    GlossaryTermPropertyRules.validateKeys(
        updated,
        chain,
        GlossaryTermPropertyRules.changedKeys(
            original.getPropertyValues(), updated.getPropertyValues()));
  }

  // An entry that names no effective property is dropped when it is the stored one; a changed
  // entry naming none is rejected by the key check that follows.
  private void dropStaleEntries(
      final GlossaryTerm original,
      final GlossaryTerm updated,
      final GlossaryTermPropertyChange change,
      final List<GlossaryTerm> chain) {
    final Map<String, List<String>> values = updated.getPropertyValues();
    if (nullOrEmpty(values)) {
      return;
    }
    change.removed().forEach(removed -> values.remove(removed.getName()));
    final Set<String> effective =
        GlossaryTermPropertyResolver.declaredProperties(updated, chain).stream()
            .map(declared -> declared.property().getName())
            .collect(Collectors.toSet());
    final Set<String> unchanged = unchangedKeys(original.getPropertyValues(), values);
    unchanged.stream().filter(key -> !effective.contains(key)).forEach(values::remove);
  }

  private static Set<String> unchangedKeys(
      final Map<String, List<String>> original, final Map<String, List<String>> updated) {
    final Set<String> unchanged = new LinkedHashSet<>(updated.keySet());
    unchanged.removeAll(GlossaryTermPropertyRules.changedKeys(original, updated));
    return unchanged;
  }

  private void checkBelow(
      final GlossaryTerm original,
      final GlossaryTerm updated,
      final GlossaryTermPropertyChange change) {
    final List<GlossaryTermProperty> reaching = change.startingToReachBelow();
    final List<GlossaryTermProperty> reshaped = change.shapeChanged();
    final TermPropertyViolations broken = new TermPropertyViolations();
    reshaped.forEach(
        definition ->
            GlossaryTermPropertyRules.collectBrokenValues(definition, List.of(updated), broken));
    final TermPropertyViolations clashes = new TermPropertyViolations();
    scanBelowIfNeeded(original, reaching, reshaped, clashes, broken);
    clashes.throwConflictIfAny(
        "A term below '%s' already declares a property with the same name"
            .formatted(original.getFullyQualifiedName()));
    broken.throwConflictIfAny(
        "The change to the property would break values stored by these terms");
  }

  private void scanBelowIfNeeded(
      final GlossaryTerm original,
      final List<GlossaryTermProperty> reaching,
      final List<GlossaryTermProperty> reshaped,
      final TermPropertyViolations clashes,
      final TermPropertyViolations broken) {
    final List<GlossaryTermProperty> reshapedInherited =
        reshaped.stream().filter(GlossaryTermPropertyResolver::isInheritable).toList();
    if (reaching.isEmpty() && reshapedInherited.isEmpty()) {
      return;
    }
    scanSubtree(
        original.getFullyQualifiedName(),
        page -> {
          GlossaryTermPropertyRules.collectNameClashes(reaching, page, clashes);
          reshapedInherited.forEach(
              definition ->
                  GlossaryTermPropertyRules.collectBrokenValues(definition, page, broken));
        });
  }

  private void removeEntriesBelow(final String fqn, final List<String> names) {
    final List<EntityDAO.EntityIdFqnPair> affected =
        EntityRepository.invalidateCacheForRenameCascade(Entity.GLOSSARY_TERM, fqn);
    names.forEach(
        name -> dao.removePropertyEntries(fqn, GlossaryTermDAO.propertyEntryPath(name), name));
    EntityRepository.finishInvalidateCacheForRenameCascade(Entity.GLOSSARY_TERM, affected);
  }

  private Map<String, GlossaryTerm> declarersBelow(final GlossaryTerm root, final String rootFqn) {
    final Map<String, GlossaryTerm> declarers = new HashMap<>();
    if (hasInheritableDefinition(root)) {
      declarers.put(rootFqn, root);
    }
    scanSubtree(
        rootFqn,
        page ->
            page.stream()
                .filter(GlossaryTermPropertyGuard::hasInheritableDefinition)
                .forEach(term -> declarers.put(term.getFullyQualifiedName(), term)));
    return declarers;
  }

  private static boolean fitsMoved(
      final GlossaryTerm term,
      final String rootFqn,
      final Map<String, GlossaryTerm> declarers,
      final List<GlossaryTerm> newChain) {
    if (!hasPropertyData(term)) {
      return true;
    }
    final List<GlossaryTerm> chain = new ArrayList<>(subtreeAncestors(term, rootFqn, declarers));
    chain.addAll(newChain);
    return GlossaryTermPropertyRules.fitsAncestors(term, chain);
  }

  // The terms between a moved term and the moved root, root included, that declare an inheritable
  // property, nearest first.
  private static List<GlossaryTerm> subtreeAncestors(
      final GlossaryTerm term, final String rootFqn, final Map<String, GlossaryTerm> declarers) {
    final List<GlossaryTerm> found = new ArrayList<>();
    for (final String ancestorFqn : FullyQualifiedName.getAncestors(term.getFullyQualifiedName())) {
      if (declarers.containsKey(ancestorFqn)) {
        found.add(declarers.get(ancestorFqn));
      }
      if (ancestorFqn.equals(rootFqn)) {
        break;
      }
    }
    return found;
  }

  private List<GlossaryTerm> chainOf(final EntityReference parent) {
    if (parent == null || !Entity.GLOSSARY_TERM.equals(parent.getType())) {
      return List.of();
    }
    final String parentFqn = resolveFqn(parent);
    final List<String> fqns = new ArrayList<>();
    fqns.add(parentFqn);
    fqns.addAll(FullyQualifiedName.getAncestors(parentFqn));
    return loadTerms(fqns);
  }

  private String resolveFqn(final EntityReference parent) {
    return nullOrEmpty(parent.getFullyQualifiedName())
        ? dao.findEntityById(parent.getId(), Include.ALL).getFullyQualifiedName()
        : parent.getFullyQualifiedName();
  }

  private List<GlossaryTerm> loadTerms(final List<String> fqnsNearestFirst) {
    final Map<String, GlossaryTerm> byFqn = termsByFqn(fqnsNearestFirst);
    return fqnsNearestFirst.stream().map(byFqn::get).filter(Objects::nonNull).toList();
  }

  private Map<String, GlossaryTerm> termsByFqn(final List<String> fqns) {
    return dao.findEntityByNames(fqns, Include.ALL).stream()
        .collect(
            Collectors.toMap(
                GlossaryTerm::getFullyQualifiedName,
                term -> term,
                (first, second) -> first,
                LinkedHashMap::new));
  }

  private void scanSubtree(final String fqn, final Consumer<List<GlossaryTerm>> pageConsumer) {
    String afterId = "";
    boolean more = true;
    while (more) {
      final List<GlossaryTerm> page =
          dao.listSubtreeAfter(fqn, afterId, SUBTREE_PAGE_SIZE).stream()
              .map(json -> JsonUtils.readValue(json, GlossaryTerm.class))
              .toList();
      if (!page.isEmpty()) {
        pageConsumer.accept(page);
        afterId = page.getLast().getId().toString();
      }
      more = page.size() == SUBTREE_PAGE_SIZE;
    }
  }

  private static boolean placementChanged(final GlossaryTerm original, final GlossaryTerm updated) {
    return !Objects.equals(idOf(original.getParent()), idOf(updated.getParent()))
        || !Objects.equals(idOf(original.getGlossary()), idOf(updated.getGlossary()));
  }

  private static Object idOf(final EntityReference reference) {
    return reference == null ? null : reference.getId();
  }

  private static boolean hasPropertyData(final GlossaryTerm term) {
    return !nullOrEmpty(term.getPropertyDefinitions()) || !nullOrEmpty(term.getPropertyValues());
  }

  private static boolean hasInheritableDefinition(final GlossaryTerm term) {
    return listOrEmpty(term.getPropertyDefinitions()).stream()
        .anyMatch(GlossaryTermPropertyResolver::isInheritable);
  }

  private static Set<String> keysOf(final GlossaryTerm term) {
    return nullOrEmpty(term.getPropertyValues()) ? Set.of() : term.getPropertyValues().keySet();
  }
}
