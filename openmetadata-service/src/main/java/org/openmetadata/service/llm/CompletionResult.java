package org.openmetadata.service.llm;

/** Provider-neutral completion result carrying the model text and token usage. */
public record CompletionResult(String text, int inputTokens, int outputTokens) {}
