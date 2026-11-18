package org.openmetadata.service.alerting.content.template.sandbox;

import com.github.jknack.handlebars.Decorator;
import com.github.jknack.handlebars.Helper;
import com.github.jknack.handlebars.HelperRegistry;
import com.github.jknack.handlebars.helper.EachHelper;
import com.github.jknack.handlebars.helper.IfHelper;
import com.github.jknack.handlebars.helper.LookupHelper;
import com.github.jknack.handlebars.helper.UnlessHelper;
import com.github.jknack.handlebars.helper.WithHelper;
import java.io.File;
import java.io.InputStream;
import java.io.Reader;
import java.net.URI;
import java.nio.charset.Charset;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;

/**
 * The helpers a template may call: the block helpers of the language and the product helpers
 * given to the sandbox. Nothing else is registered, and every product helper hands its result back
 * to the template as plain data.
 */
final class SandboxHelperRegistry implements HelperRegistry {

  private static final Map<String, Helper<?>> LANGUAGE_HELPERS =
      Map.of(
          "if", IfHelper.INSTANCE,
          "unless", UnlessHelper.INSTANCE,
          "each", EachHelper.INSTANCE,
          "with", WithHelper.INSTANCE,
          "lookup", LookupHelper.INSTANCE);

  private final Map<String, Helper<?>> helpers = new HashMap<>(LANGUAGE_HELPERS);
  private boolean sealed;

  void seal() {
    sealed = true;
  }

  Set<String> helperNames() {
    return Set.copyOf(helpers.keySet());
  }

  @Override
  @SuppressWarnings("unchecked")
  public <C> Helper<C> helper(String name) {
    return (Helper<C>) helpers.get(name);
  }

  @Override
  public Set<Map.Entry<String, Helper<?>>> helpers() {
    return Set.copyOf(helpers.entrySet());
  }

  @Override
  public <H> HelperRegistry registerHelper(String name, Helper<H> helper) {
    requireOpen();
    helpers.put(name, returningData(helper));
    return this;
  }

  @Override
  public <H> HelperRegistry registerHelperMissing(Helper<H> helper) {
    throw notOffered("a custom missing-helper handler");
  }

  @Override
  public HelperRegistry registerHelpers(Object helperSource) {
    throw notOffered("helpers from an object");
  }

  @Override
  public HelperRegistry registerHelpers(Class<?> helperSource) {
    throw notOffered("helpers from a class");
  }

  @Override
  public HelperRegistry registerHelpers(URI location) {
    throw notOffered("helpers from a script");
  }

  @Override
  public HelperRegistry registerHelpers(File input) {
    throw notOffered("helpers from a script");
  }

  @Override
  public HelperRegistry registerHelpers(String filename, Reader source) {
    throw notOffered("helpers from a script");
  }

  @Override
  public HelperRegistry registerHelpers(String filename, InputStream source) {
    throw notOffered("helpers from a script");
  }

  @Override
  public HelperRegistry registerHelpers(String filename, String source) {
    throw notOffered("helpers from a script");
  }

  @Override
  public Decorator decorator(String name) {
    return null;
  }

  @Override
  public HelperRegistry registerDecorator(String name, Decorator decorator) {
    throw notOffered("decorators");
  }

  @Override
  public HelperRegistry setCharset(Charset charset) {
    return this;
  }

  private void requireOpen() {
    if (sealed) {
      throw notOffered("helpers registered after the sandbox is built");
    }
  }

  @SuppressWarnings("unchecked")
  private static <H> Helper<Object> returningData(Helper<H> helper) {
    Helper<Object> untyped = (Helper<Object>) helper;
    return (context, options) -> TemplateData.of(untyped.apply(context, options));
  }

  private static UnsupportedOperationException notOffered(String what) {
    return new UnsupportedOperationException(
        String.format("The template sandbox does not accept %s", what));
  }
}
