package org.openmetadata.service.llm;

public class LLMCompletionException extends RuntimeException {
  public LLMCompletionException(String message) {
    super(message);
  }

  public LLMCompletionException(String message, Throwable cause) {
    super(message, cause);
  }
}
