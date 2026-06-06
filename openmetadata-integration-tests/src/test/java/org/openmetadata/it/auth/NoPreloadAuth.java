package org.openmetadata.it.auth;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Skip the per-test auth injection done by {@code UiSessionExtension}, so the test starts
 * with a clean {@code BrowserContext} that lands on the OM sign-in page instead of an
 * authenticated home view.
 *
 * <p>Use only on tests that explicitly drive the sign-in UI (basic-auth credentials, the
 * "Sign in with &lt;provider&gt;" button, callback handling). Every other test should
 * accept the default token-injected fast path.
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface NoPreloadAuth {}
