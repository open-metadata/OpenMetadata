package org.openmetadata.service.llm;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/** One knowledge pill extracted from a file by an LLM. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record KnowledgePill(
    @JsonProperty("title") String title,
    @JsonProperty("question") String question,
    @JsonProperty("answer") String answer,
    @JsonProperty("summary") String summary,
    @JsonProperty("memoryType") String memoryType) {}
