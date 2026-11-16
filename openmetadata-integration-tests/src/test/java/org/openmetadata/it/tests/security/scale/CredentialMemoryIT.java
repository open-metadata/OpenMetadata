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

package org.openmetadata.it.tests.security.scale;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bench.BenchmarkMetrics;
import org.openmetadata.it.tests.security.scale.CredentialPopulation.Principal;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TokenRepository;
import org.openmetadata.service.security.credentials.CredentialSourceTestSupport;
import org.openmetadata.service.security.credentials.CredentialSourceTestSupport.TestVerifier;
import org.openmetadata.service.security.credentials.CredentialVerificationConfig;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Heap the verifier's cache holds per cached principal. A verifier of this JVM (its sweep not
 * started, so nothing allocates beside the warm-up) caches 1000 and 4000 principals holding 1, 5
 * and 20 personal access tokens each. Live-object class histograms taken before and after the
 * warm-up are subtracted and filtered to the credential classes and Caffeine's classes, which the
 * test server also uses; the server is idle meanwhile, so what it allocates is a small constant that
 * the repetitions expose as spread. The design's estimate is about 0.8 KB per principal at five
 * tokens.
 *
 * <p>The filter leaves out the JDK classes the entries also hold (strings, hash sets, arrays), so a
 * second figure, the live heap after a full collection before and after, is reported beside it as an
 * upper bound. Proof of work: the cached-subjects gauge equals the warmed count.
 */
@Tag("scale")
@Isolated
@ExtendWith(TestNamespaceExtension.class)
class CredentialMemoryIT {
  private static final Logger LOG = LoggerFactory.getLogger(CredentialMemoryIT.class);
  private static final int[] PRINCIPALS = {1000, 4000};
  private static final int[] PATS_PER_USER = {20, 5, 1};
  private static final int REPETITIONS = 5;
  private static final int WARM_WIDTH = 16;
  private static final String CREDENTIAL_PACKAGE = "org.openmetadata.service.security.credentials.";
  private static final String CAFFEINE_PACKAGE = "com.github.benmanes.caffeine.cache.";
  private static final CredentialVerificationConfig CONFIG =
      new CredentialVerificationConfig(null, null, null, null, null, null, 4000, null, null);

  @Test
  void retainedBytesPerCachedPrincipal(TestNamespace ns) throws Exception {
    List<Principal> population =
        CredentialPopulation.users(ns, "mem", PRINCIPALS[PRINCIPALS.length - 1], PATS_PER_USER[0]);
    TokenRepository tokens = new TokenRepository();
    List<Map<String, Object>> cells = new ArrayList<>();
    for (int pats : PATS_PER_USER) {
      population.forEach(p -> p.keepPats(pats, tokens));
      for (int cached : PRINCIPALS) {
        cells.add(measure(population.subList(0, cached), pats));
      }
    }
    BenchmarkMetrics.write(
        Map.of("repetitions", REPETITIONS, "cells", cells), "credential-memory.json");
    cells.forEach(cell -> LOG.info("{}", cell));
  }

  private Map<String, Object> measure(List<Principal> principals, int pats) {
    List<Double> credentialBytes = new ArrayList<>();
    List<Double> caffeineBytes = new ArrayList<>();
    List<Double> heapBytes = new ArrayList<>();
    for (int repetition = 0; repetition < REPETITIONS; repetition++) {
      Retained retained = retainedByOneWarmUp(principals);
      credentialBytes.add(retained.credentialClasses() / (double) principals.size());
      caffeineBytes.add(retained.caffeineClasses() / (double) principals.size());
      heapBytes.add(retained.heap() / (double) principals.size());
    }
    Map<String, Object> cell = new LinkedHashMap<>();
    cell.put("cachedPrincipals", principals.size());
    cell.put("patsPerUser", pats);
    cell.put("credentialClassBytesPerPrincipal", Percentiles.spread(credentialBytes, "%.0f"));
    cell.put("caffeineClassBytesPerPrincipal", Percentiles.spread(caffeineBytes, "%.0f"));
    cell.put("liveHeapBytesPerPrincipal", Percentiles.spread(heapBytes, "%.0f"));
    return cell;
  }

  private record Retained(long credentialClasses, long caffeineClasses, long heap) {}

  private Retained retainedByOneWarmUp(List<Principal> principals) {
    TestVerifier verifier = CredentialSourceTestSupport.newVerifier(Entity.getJdbi(), CONFIG);
    ClassHistogram before = ClassHistogram.take();
    long heapBefore = liveHeap();
    warm(verifier, principals);
    assertEquals(
        principals.size(),
        verifier.meters().get("om.credential.cached.subjects").gauge().value(),
        "the cache holds exactly the warmed principals");
    ClassHistogram after = ClassHistogram.take();
    Retained retained =
        new Retained(
            bytes(after, CREDENTIAL_PACKAGE) - bytes(before, CREDENTIAL_PACKAGE),
            bytes(after, CAFFEINE_PACKAGE) - bytes(before, CAFFEINE_PACKAGE),
            liveHeap() - heapBefore);
    verifier.stop();
    return retained;
  }

  private static long bytes(ClassHistogram histogram, String packagePrefix) {
    return histogram.bytes(name -> name.startsWith(packagePrefix));
  }

  private static void warm(TestVerifier verifier, List<Principal> principals) {
    CredentialPopulation.inParallel(
        principals.size(),
        WARM_WIDTH,
        i -> verifier.accepts(principals.get(i).name(), principals.get(i).rawToken()));
  }

  private static long liveHeap() {
    System.gc();
    Runtime runtime = Runtime.getRuntime();
    return runtime.totalMemory() - runtime.freeMemory();
  }
}
