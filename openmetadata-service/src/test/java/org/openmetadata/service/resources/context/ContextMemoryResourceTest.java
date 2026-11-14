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

package org.openmetadata.service.resources.context;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.BadRequestException;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.context.ExtractionAvailability;
import org.openmetadata.schema.configuration.LLMBedrockConfig;
import org.openmetadata.schema.configuration.LLMConfiguration;
import org.openmetadata.schema.configuration.LLMProvider;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.MemoryOutcomes;
import org.openmetadata.schema.security.credentials.AWSBaseConfig;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.context.center.AiProvider;
import org.openmetadata.service.context.center.AiProviderHolder;
import org.openmetadata.service.context.center.LlmAiProvider;
import org.openmetadata.service.context.center.MemoryDerivations;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.llm.LLMClientHolder;
import org.openmetadata.service.search.SearchSortFilter;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;

class ContextMemoryResourceTest {

  private static final long NOW = 1_760_000_000_000L;
  private static final long SKEW = ContextMemoryResource.COUNTED_AT_CLOCK_SKEW.toMillis();

  @AfterEach
  void resetAiHolders() {
    AiProviderHolder.reset();
    LLMClientHolder.setForTesting(null);
  }

  @Test
  void aRecountMustSayWhenItCounted() {
    BadRequestException refused =
        assertThrows(
            BadRequestException.class,
            () -> ContextMemoryResource.requireRecountTime(new MemoryOutcomes(), NOW));

    assertEquals(ContextMemoryResource.COUNTED_AT_REQUIRED, refused.getMessage());
  }

  @Test
  void aRecountAheadOfTheServerClockIsRefused() {
    assertThrows(
        BadRequestException.class,
        () -> ContextMemoryResource.requireRecountTime(countedAt(NOW + SKEW + 1), NOW));
    assertThrows(
        BadRequestException.class,
        () -> ContextMemoryResource.requireRecountTime(countedAt(NOW * 1_000), NOW),
        "microseconds read as milliseconds");
  }

  @Test
  void aRecountInThePastOrWithinTheClockSkewIsAccepted() {
    assertDoesNotThrow(() -> ContextMemoryResource.requireRecountTime(countedAt(NOW - 1), NOW));
    assertDoesNotThrow(() -> ContextMemoryResource.requireRecountTime(countedAt(NOW + SKEW), NOW));
  }

  @Test
  void mostUsedBreaksAppliedCountTiesByRecordedUsage() {
    SearchSortFilter mostUsed = ContextMemoryResource.searchSort("appliedCount", "desc");

    assertEquals("outcomes.appliedCount", mostUsed.getSortField());
    assertEquals("usageCount", mostUsed.getThenSortField());
    assertNull(ContextMemoryResource.searchSort("updatedAt", "desc").getThenSortField());
  }

  @Test
  void derivationIdsAreCommaSeparatedUuidsWithinTheCap() {
    UUID first = UUID.randomUUID();
    UUID second = UUID.randomUUID();
    String tooMany =
        IntStream.rangeClosed(0, MemoryDerivations.MAX_ENTITIES)
            .mapToObj(i -> UUID.randomUUID().toString())
            .collect(Collectors.joining(","));

    assertEquals(
        List.of(first, second), ContextMemoryResource.parseDerivedIds(first + " , " + second));
    for (String invalid : Arrays.asList(null, "", "not-a-uuid", tooMany)) {
      assertThrows(BadRequestException.class, () -> ContextMemoryResource.parseDerivedIds(invalid));
    }
  }

  /**
   * The total counts only what the caller may list, on every page: a count-only call and a page
   * that hides nothing itself still recount when the database counted more rows than they show.
   */
  @Test
  void aListTotalIsRecountedWheneverItCountsMoreThanThePageShows() {
    assertEquals(
        3, ContextMemoryResource.listedTotal(5, 0, () -> 3), "limit=0 counts no hidden row");
    assertEquals(
        10,
        ContextMemoryResource.listedTotal(12, 10, () -> 10),
        "a full page while the hidden rows sit on the next one");
    assertEquals(
        15_000,
        ContextMemoryResource.listedTotal(20_000, 15_000, () -> 9_000),
        "a bounded recount never reports fewer rows than the page returns");
  }

  @Test
  void aPageShowingEveryCountedRowKeepsTheDatabaseTotal() {
    assertEquals(
        4,
        ContextMemoryResource.listedTotal(
            4,
            4,
            () -> {
              throw new AssertionError("nothing can be hidden, so nothing is recounted");
            }));
  }

  /** Availability is not a secret: a caller no policy grants anything still reads its reason. */
  @Test
  void anyAuthenticatedUserReadsWhyExtractionIsUnavailable() {
    AiProvider provider = mock(AiProvider.class);
    when(provider.extractionAvailability())
        .thenReturn(
            new ExtractionAvailability()
                .withAvailable(false)
                .withReason(ExtractionAvailability.Reason.ProviderUnavailable));
    AiProviderHolder.setForTesting(provider);

    assertEquals(
        "{\"available\":false,\"reason\":\"ProviderUnavailable\"}",
        JsonUtils.pojoToJson(readExtractionAvailability()));
  }

  @ParameterizedTest
  @CsvSource({"false,false", "false,true", "true,false"})
  void theBuiltInProviderNeedsTheLlmAndMemoryExtractionOn(
      boolean llmEnabled, boolean memoryExtractionEnabled) {
    useBuiltInProvider(llmEnabled, memoryExtractionEnabled);

    assertEquals(
        "{\"available\":false,\"reason\":\"ExtractionDisabled\"}",
        JsonUtils.pojoToJson(readExtractionAvailability()));
  }

  /** Switched on, a failed LLM build reads as unavailable; switched off, it still reads as off. */
  @ParameterizedTest
  @CsvSource({"true,ProviderUnavailable", "false,ExtractionDisabled"})
  void anLlmThatFailedToBuildIsUnavailableOnlyWhileExtractionIsSwitchedOn(
      boolean memoryExtractionEnabled, String reason) {
    useBuiltInProvider(
        new LLMConfiguration()
            .withEnabled(true)
            .withMemoryExtractionEnabled(memoryExtractionEnabled)
            .withProvider(LLMProvider.BEDROCK)
            .withBedrock(new LLMBedrockConfig().withAwsConfig(new AWSBaseConfig().withRegion(""))));

    assertEquals(
        "{\"available\":false,\"reason\":\"" + reason + "\"}",
        JsonUtils.pojoToJson(readExtractionAvailability()));
  }

  @Test
  void whileExtractionIsAvailableNoReasonIsGiven() {
    useBuiltInProvider(true, true);

    assertEquals("{\"available\":true}", JsonUtils.pojoToJson(readExtractionAvailability()));
  }

  private static MemoryOutcomes countedAt(long countedAt) {
    return new MemoryOutcomes().withAppliedCount(3).withCountedAt(countedAt);
  }

  private static void useBuiltInProvider(boolean llmEnabled, boolean memoryExtractionEnabled) {
    useBuiltInProvider(
        new LLMConfiguration()
            .withEnabled(llmEnabled)
            .withMemoryExtractionEnabled(memoryExtractionEnabled)
            .withProvider(LLMProvider.NOOP));
  }

  private static void useBuiltInProvider(LLMConfiguration config) {
    LLMClientHolder.initialize(config);
    AiProviderHolder.setForTesting(new LlmAiProvider());
  }

  private static ExtractionAvailability readExtractionAvailability() {
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity
          .when(() -> Entity.getEntityRepository(Entity.CONTEXT_MEMORY))
          .thenReturn(mock(ContextMemoryRepository.class));
      entity
          .when(() -> Entity.getEntityClassFromType(Entity.CONTEXT_MEMORY))
          .thenReturn(ContextMemory.class);
      return new ContextMemoryResource(refusingEveryCheck(), mock(Limits.class))
          .getExtractionAvailability();
    }
  }

  /** The endpoint must answer without asking the authorizer anything. */
  private static Authorizer refusingEveryCheck() {
    return mock(
        Authorizer.class,
        invocation -> {
          throw new AuthorizationException("No policy grants " + invocation.getMethod().getName());
        });
  }
}
