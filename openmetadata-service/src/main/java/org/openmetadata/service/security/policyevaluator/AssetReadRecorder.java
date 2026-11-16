package org.openmetadata.service.security.policyevaluator;

import java.lang.reflect.InvocationHandler;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.util.Set;

/**
 * Records whether evaluating a condition read anything about the asset behind a resource context.
 * Every accessor except the resource type name counts as an asset read, so a condition function
 * added to {@link RuleEvaluator} later is covered without being registered anywhere.
 */
final class AssetReadRecorder implements InvocationHandler {
  private static final Set<String> NON_ASSET_ACCESSORS = Set.of("getResource", "isEntityTypeLevel");

  private final ResourceContextInterface delegate;
  private final ResourceContextInterface recordingContext;
  private boolean assetRead;

  AssetReadRecorder(ResourceContextInterface delegate) {
    this.delegate = delegate;
    this.recordingContext =
        (ResourceContextInterface)
            Proxy.newProxyInstance(
                ResourceContextInterface.class.getClassLoader(),
                new Class<?>[] {ResourceContextInterface.class},
                this);
  }

  ResourceContextInterface context() {
    return recordingContext;
  }

  boolean hasReadAsset() {
    return assetRead;
  }

  @Override
  public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
    if (method.getDeclaringClass() != Object.class
        && !NON_ASSET_ACCESSORS.contains(method.getName())) {
      assetRead = true;
    }
    try {
      return method.invoke(delegate, args);
    } catch (InvocationTargetException invocationFailure) {
      throw invocationFailure.getCause();
    }
  }
}
