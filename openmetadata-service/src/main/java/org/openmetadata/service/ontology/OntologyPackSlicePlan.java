/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.ontology;

import java.net.URI;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.PriorityQueue;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.apache.commons.codec.digest.DigestUtils;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyChangeOperationType;

/**
 * A library install cut into slices that apply one after another. Concepts come before properties
 * and properties before axioms across all slices, so a slice only references definitions that an
 * earlier slice or the same slice declares. Inside the concepts and inside the properties, a
 * definition follows the definitions it names (a replacement, an inverse, a property chain, a
 * disjoint property), because each slice is validated on its own and refuses a reference to a
 * definition that has not landed. Definitions that name each other, such as an inverse pair, form
 * one unit that is never split across slices. Ties break by IRI so the plan digest is stable.
 */
public record OntologyPackSlicePlan(List<Slice> slices, String planDigest, int memberCount) {
  public record Slice(int index, List<OntologyChangeOperation> operations, String digest) {}

  public static OntologyPackSlicePlan of(
      final List<OntologyChangeOperation> operations,
      final int sliceMembers,
      final String packDigest) {
    if (sliceMembers < 1) {
      throw new IllegalArgumentException("A slice holds at least one member");
    }
    operations.forEach(OntologyPackSlicePlan::rank);
    final List<List<OntologyChangeOperation>> units = new ArrayList<>();
    units.addAll(
        dependencyUnits(
            ofType(operations, OntologyChangeOperationType.UPSERT_CONCEPT),
            operation -> operation.getConcept().getIri(),
            operation -> references(operation.getConcept())));
    units.addAll(
        dependencyUnits(
            ofType(operations, OntologyChangeOperationType.UPSERT_PROPERTY),
            operation -> operation.getProperty().getIri(),
            operation -> references(operation.getProperty())));
    ofType(operations, OntologyChangeOperationType.UPSERT_AXIOM).stream()
        .sorted(AXIOM_ORDER)
        .forEach(axiom -> units.add(List.of(axiom)));
    final List<Slice> slices = cut(units, sliceMembers);
    final List<String> digests = slices.stream().map(Slice::digest).toList();
    return new OntologyPackSlicePlan(
        List.copyOf(slices), planDigest(packDigest, digests), operations.size());
  }

  /** Independent of operation order, generated operation ids and generated definition ids. */
  public static String sliceDigest(final List<OntologyChangeOperation> operations) {
    final String joined =
        operations.stream()
            .map(OntologyPackSlicePlan::canonical)
            .sorted()
            .collect(Collectors.joining("\n"));
    return DigestUtils.sha256Hex(joined);
  }

  public static String planDigest(final String packDigest, final List<String> sliceDigests) {
    return DigestUtils.sha256Hex(packDigest + "\n" + String.join("\n", sliceDigests));
  }

  public List<String> sliceDigests() {
    return slices.stream().map(Slice::digest).toList();
  }

  private static final Comparator<OntologyChangeOperation> AXIOM_ORDER =
      Comparator.comparing(
              (OntologyChangeOperation operation) ->
                  operation.getAxiom().getSubjectIri() == null
                      ? ""
                      : operation.getAxiom().getSubjectIri().toString())
          .thenComparing(OntologyPackSlicePlan::canonical);

  private static String canonical(final OntologyChangeOperation operation) {
    return OntologyJson.canonical(OntologyPackInstallations.normalizedOperation(operation))
        .toString();
  }

  private static List<OntologyChangeOperation> ofType(
      final List<OntologyChangeOperation> operations, final OntologyChangeOperationType type) {
    return operations.stream().filter(operation -> operation.getOperationType() == type).toList();
  }

  private static List<URI> references(final OntologyConcept concept) {
    return nonNull(Stream.of(concept.getReplacedBy()));
  }

  private static List<URI> references(final OntologyProperty property) {
    return nonNull(
        Stream.of(
                Stream.of(property.getInverse(), property.getReplacedBy()),
                property.getPropertyChain() == null
                    ? Stream.<URI>empty()
                    : property.getPropertyChain().stream(),
                property.getDisjointWith() == null
                    ? Stream.<URI>empty()
                    : property.getDisjointWith().stream())
            .flatMap(Function.identity()));
  }

  private static List<URI> nonNull(final Stream<URI> iris) {
    return iris.filter(Objects::nonNull).toList();
  }

  /**
   * Orders definitions so each follows those it names, collapsing references that loop back into
   * one unit. Among units whose references are all met, the one with the smallest IRI goes first.
   */
  private static List<List<OntologyChangeOperation>> dependencyUnits(
      final List<OntologyChangeOperation> operations,
      final Function<OntologyChangeOperation, URI> iriOf,
      final Function<OntologyChangeOperation, List<URI>> referencesOf) {
    final List<OntologyChangeOperation> nodes =
        operations.stream()
            .sorted(
                Comparator.comparing(
                        (OntologyChangeOperation operation) -> iriOf.apply(operation).toString())
                    .thenComparing(OntologyPackSlicePlan::canonical))
            .toList();
    final Map<String, Integer> indexByIri = new HashMap<>();
    for (int index = 0; index < nodes.size(); index++) {
      indexByIri.putIfAbsent(iriOf.apply(nodes.get(index)).toString(), index);
    }
    final List<Set<Integer>> edges = new ArrayList<>();
    for (int index = 0; index < nodes.size(); index++) {
      final Set<Integer> targets = new HashSet<>();
      for (final URI iri : referencesOf.apply(nodes.get(index))) {
        final Integer target = indexByIri.get(iri.toString());
        if (target != null && target != index) {
          targets.add(target);
        }
      }
      edges.add(targets);
    }
    final int[] component = components(edges);
    final int count = Arrays.stream(component).max().orElse(-1) + 1;
    final List<List<Integer>> members = new ArrayList<>();
    final List<Set<Integer>> unmet = new ArrayList<>();
    final List<Set<Integer>> dependents = new ArrayList<>();
    for (int unit = 0; unit < count; unit++) {
      members.add(new ArrayList<>());
      unmet.add(new HashSet<>());
      dependents.add(new HashSet<>());
    }
    for (int index = 0; index < nodes.size(); index++) {
      members.get(component[index]).add(index);
      for (final int target : edges.get(index)) {
        if (component[target] != component[index]) {
          unmet.get(component[index]).add(component[target]);
          dependents.get(component[target]).add(component[index]);
        }
      }
    }
    final PriorityQueue<Integer> ready =
        new PriorityQueue<>(Comparator.comparingInt(unit -> members.get(unit).getFirst()));
    for (int unit = 0; unit < count; unit++) {
      if (unmet.get(unit).isEmpty()) {
        ready.add(unit);
      }
    }
    final List<List<OntologyChangeOperation>> ordered = new ArrayList<>();
    while (!ready.isEmpty()) {
      final int unit = ready.poll();
      ordered.add(members.get(unit).stream().map(nodes::get).toList());
      for (final int dependent : dependents.get(unit)) {
        unmet.get(dependent).remove(unit);
        if (unmet.get(dependent).isEmpty()) {
          ready.add(dependent);
        }
      }
    }
    return ordered;
  }

  /** Tarjan's strongly connected components, iterative so a long chain cannot overflow the stack. */
  private static int[] components(final List<Set<Integer>> edges) {
    final int size = edges.size();
    final int[] order = new int[size];
    final int[] low = new int[size];
    final int[] component = new int[size];
    Arrays.fill(order, -1);
    Arrays.fill(component, -1);
    final List<List<Integer>> successors =
        edges.stream().map(set -> set.stream().sorted().toList()).collect(Collectors.toList());
    final Deque<Integer> open = new ArrayDeque<>();
    final Deque<int[]> frames = new ArrayDeque<>();
    int visited = 0;
    int found = 0;
    for (int root = 0; root < size; root++) {
      if (order[root] != -1) {
        continue;
      }
      frames.push(new int[] {root, 0});
      order[root] = low[root] = visited++;
      open.push(root);
      while (!frames.isEmpty()) {
        final int[] frame = frames.peek();
        final int node = frame[0];
        if (frame[1] < successors.get(node).size()) {
          final int next = successors.get(node).get(frame[1]++);
          if (order[next] == -1) {
            order[next] = low[next] = visited++;
            open.push(next);
            frames.push(new int[] {next, 0});
          } else if (component[next] == -1) {
            low[node] = Math.min(low[node], order[next]);
          }
        } else {
          frames.pop();
          if (!frames.isEmpty()) {
            final int parent = frames.peek()[0];
            low[parent] = Math.min(low[parent], low[node]);
          }
          if (low[node] == order[node]) {
            int member;
            do {
              member = open.pop();
              component[member] = found;
            } while (member != node);
            found++;
          }
        }
      }
    }
    return component;
  }

  private static List<Slice> cut(
      final List<List<OntologyChangeOperation>> units, final int sliceMembers) {
    final List<Slice> slices = new ArrayList<>();
    List<OntologyChangeOperation> current = new ArrayList<>();
    for (final List<OntologyChangeOperation> unit : units) {
      if (unit.size() > sliceMembers) {
        throw new IllegalStateException(
            "%d definitions refer to each other and cannot be split, which exceeds the %d members of a slice"
                .formatted(unit.size(), sliceMembers));
      }
      if (current.size() + unit.size() > sliceMembers) {
        slices.add(slice(slices.size(), current));
        current = new ArrayList<>();
      }
      current.addAll(unit);
    }
    if (!current.isEmpty()) {
      slices.add(slice(slices.size(), current));
    }
    return slices;
  }

  private static Slice slice(final int index, final List<OntologyChangeOperation> members) {
    return new Slice(index, List.copyOf(members), sliceDigest(members));
  }

  private static int rank(final OntologyChangeOperation operation) {
    final OntologyChangeOperationType type = operation.getOperationType();
    return switch (type) {
      case UPSERT_CONCEPT -> 0;
      case UPSERT_PROPERTY -> 1;
      case UPSERT_AXIOM -> 2;
      default -> throw new IllegalArgumentException(
          "A library install plan holds only upserts, not " + type);
    };
  }
}
