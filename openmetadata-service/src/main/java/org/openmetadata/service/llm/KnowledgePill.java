package org.openmetadata.service.llm;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * DTO for a single knowledge pill as returned by the LLM during file extraction — deliberately
 * <b>not</b> the {@link org.openmetadata.schema.entity.context.ContextMemory} entity. It is the
 * anti-corruption boundary between untrusted model JSON and the trusted entity model, kept
 * intentionally narrow and tolerant. {@code ContextMemoryExtractor.toMemory} maps a validated pill
 * into a {@code ContextMemory}, adding the server-owned envelope (id, name, FQN, status, sourceType,
 * sourceFile, shareConfig, updatedBy/At). Deserializing the model's JSON straight into
 * {@code ContextMemory} is intentionally avoided because:
 *
 * <ul>
 *   <li><b>Field scope.</b> Only the five fields the model is asked to produce live here (see
 *       {@code ContextMemoryExtractor.SYSTEM_PROMPT}); the entity's identity/status/source fields
 *       are server-generated, never model-supplied, so they must not leak into the model contract.
 *   <li><b>Unknown-field tolerance.</b> {@code @JsonIgnoreProperties(ignoreUnknown = true)} lets a
 *       model that emits a stray key still parse. {@code ContextMemory} is generated with
 *       {@code additionalProperties:false} and parsed by a default {@code ObjectMapper}
 *       ({@code FAIL_ON_UNKNOWN_PROPERTIES} on), so a single unexpected key would fail the whole
 *       array parse.
 *   <li><b>Enum leniency.</b> {@code memoryType} is a raw String, not the {@code ContextMemoryType}
 *       enum, so an off-spec value (casing/variant) degrades to {@code NOTE} in
 *       {@code ContextMemoryExtractor.parseType} instead of throwing on deserialization.
 * </ul>
 *
 * <p>See {@code docs/company-context-knowledge-pills.md} (§9, "The KnowledgePill DTO boundary").
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record KnowledgePill(
    @JsonProperty("title") String title,
    @JsonProperty("question") String question,
    @JsonProperty("answer") String answer,
    @JsonProperty("summary") String summary,
    @JsonProperty("memoryType") String memoryType) {}
