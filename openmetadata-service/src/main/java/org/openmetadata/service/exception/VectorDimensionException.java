package org.openmetadata.service.exception;

import lombok.Getter;

@Getter
public class VectorDimensionException extends Exception {
  private final String currentModel;
  private final int currentDimension;
  private final String requiredModel;
  private final int requiredDimension;

  public VectorDimensionException(
      String message,
      String currentModel,
      int currentDimension,
      String requiredModel,
      int requiredDimension) {
    super(message);
    this.currentModel = currentModel;
    this.currentDimension = currentDimension;
    this.requiredModel = requiredModel;
    this.requiredDimension = requiredDimension;
  }

  public boolean isModelMismatch() {
    return currentModel != null && requiredModel != null && !currentModel.equals(requiredModel);
  }

  public boolean isDimensionMismatch() {
    return currentDimension != requiredDimension;
  }
}
