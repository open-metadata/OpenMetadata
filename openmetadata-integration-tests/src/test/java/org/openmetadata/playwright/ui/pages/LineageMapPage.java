package org.openmetadata.playwright.ui.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.assertions.LocatorAssertions;
import com.microsoft.playwright.assertions.PlaywrightAssertions;
import com.microsoft.playwright.options.AriaRole;
import com.microsoft.playwright.options.Cookie;
import com.microsoft.playwright.options.WaitForSelectorState;
import java.net.URI;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import org.openmetadata.playwright.ui.UiSession;

/**
 * Page object for the hierarchical lineage map at {@code /lineage}.
 *
 * <p>{@link #waitForLoaded()} is the first-render signal the scale benchmark times against, and it
 * is deliberately a composite of three conditions rather than "the canvas appeared". The map defers
 * {@code setLoading(false)} until after ELK has positioned the nodes, so the loader disappearing —
 * not the {@code /lineage/scene} response landing — is what means "graph ready". The canvas itself
 * only renders once the scene has at least one node, and {@code onlyRenderVisibleElements} means
 * only the visible subset of nodes is ever in the DOM, so we wait for one node rather than all.
 */
public final class LineageMapPage extends PageObject implements AutoCloseable {

  private static final String PLATFORM_LINEAGE_PATH = "/lineage";
  private static final String TESTID_CANVAS = "lineage-map-canvas";
  private static final String TESTID_LOADER = "loader";
  private static final String TESTID_ZOOM_IN = "zoom-in";
  private static final String TESTID_ZOOM_OUT = "zoom-out";
  private static final String TESTID_FIT_SCREEN = "fit-screen";
  private static final String TESTID_BREADCRUMBS = "lineage-map-breadcrumbs";
  private static final String BAND_TESTID_PREFIX = "lineage-map-band-";
  private static final String NODE_TESTID_PREFIX = "lineage-node-";
  private static final String NODE_SELECTOR = "[data-testid^='lineage-node-']";
  private static final String ACTIVE_RAIL_DOT = ".lineage-map-rail-dot.active";
  private static final String FIT_TO_SCREEN_ITEM = "Fit to screen";
  // The map renders this button only on expandable nodes, which makes it the drillability probe.
  private static final String DRILL_BUTTON_LABEL = "Zoom In";
  // Rendered only on a scene's origin/focus node — see awaitFocusedSceneSettled.
  private static final String ROOT_NODE_BADGE = ".lineage-node-badge";
  private static final double DRILL_REGISTER_TIMEOUT_MS = 15_000;
  private static final String BAND_QUERY_PARAM = "lineageBand";
  private static final String FOCUS_QUERY_PARAM = "lineageFocus";
  private static final String ONBOARDING_COOKIE = "lineageMapsOnboardingSeen";
  private static final String ONBOARDING_COOKIE_SEEN = "true";
  private static final double RENDER_TIMEOUT_MS = 120_000;

  /**
   * React Flow's zoom button steps by 1.2x. From a post-fit zoom of <= 1.0, four steps clear the
   * map's 1.9 drill-in threshold (1.0 -> 1.2 -> 1.44 -> 1.728 -> 2.074); the same count clears 0.5
   * going out. One extra for headroom, since the starting zoom depends on how fit-view framed the
   * graph.
   */
  private static final int SEMANTIC_ZOOM_STEPS = 5;

  /**
   * The map suppresses semantic zoom for 1200ms after every scene load and every navigation, and
   * rebases its zoom-crossing baseline when that window closes. A gesture inside the window is
   * silently dropped — this is why the existing TS helper's ten rapid zoom-out clicks never change
   * band. There is no DOM signal for the window, so the only correct move is to wait it out, and it
   * is deliberately outside the timed region: it is the app's cooldown, not its latency.
   */
  private static final double SEMANTIC_ZOOM_SUPPRESSION_MS = 1_500;

  /** Reads the browser's own navigation timing, mirroring {@code bundle.smoke.ts}. */
  private static final String NAVIGATION_DURATION_SCRIPT =
      "() => { const [nav] = performance.getEntriesByType('navigation');"
          + " return nav ? Math.round(nav.duration) : -1; }";

  private LineageMapPage(final Page page, final UiSession session) {
    super(page, session);
  }

  /**
   * Suppresses the first-use onboarding dialog for every page opened on this context. The dialog is
   * modal, so without this the first sample measures a blocked render and every later sample
   * measures an unblocked one.
   */
  public static void suppressOnboarding(final UiSession ui) {
    ui.context()
        .addCookies(
            List.of(new Cookie(ONBOARDING_COOKIE, ONBOARDING_COOKIE_SEEN).setUrl(ui.uiUrl("/"))));
  }

  /**
   * Opens the platform lineage map deep-linked to one scene. The caller owns the returned page and
   * must close it — the benchmark opens a fresh page per sample so nothing is warm across samples
   * except the server.
   */
  public static LineageMapPage openScene(
      final UiSession ui, final String focusFqn, final String entityType, final String band) {
    final Page page = ui.newPage();
    page.navigate(ui.uiUrl(sceneUrl(focusFqn, entityType, band)));
    final LineageMapPage instance = new LineageMapPage(page, ui);
    instance.waitForLoaded();
    return instance;
  }

  /**
   * Opens the unfocused platform scene — the top of the hierarchy, where a real exploration starts.
   * From here a drill walks LAYER -&gt; ASSET -&gt; FIELD, which is what the interaction benchmark
   * measures.
   */
  public static LineageMapPage openPlatformScene(final UiSession ui, final String band) {
    final Page page = ui.newPage();
    page.navigate(ui.uiUrl(PLATFORM_LINEAGE_PATH + "?lineageLens=service&lineageBand=" + band));
    final LineageMapPage instance = new LineageMapPage(page, ui);
    instance.waitForLoaded();
    return instance;
  }

  static String sceneUrl(final String focusFqn, final String entityType, final String band) {
    return PLATFORM_LINEAGE_PATH
        + "?lineageLens=service&lineageBand="
        + band
        + "&lineageFocus="
        + urlEncode(focusFqn)
        + "&lineageEntityType="
        + urlEncode(entityType);
  }

  // ---------------- exploration ----------------

  /**
   * Drills into a node by clicking it, then waits for the scene focused on that node.
   *
   * <p>The target band is the map's decision, not the caller's: {@code getDrillBand} sends a
   * container node (database, schema) to another ASSET scene and only an asset node (a table) to
   * FIELD. So readiness is keyed on the focus rather than the band. The click lands at the node's
   * top-left corner because the map's click handler ignores clicks inside a {@code button},
   * {@code input}, {@code a}, a React Flow handle or a column container.
   */
  public LineageMapPage drillIntoNode(final String nodeFqn) {
    byTestId(NODE_TESTID_PREFIX + nodeFqn)
        .click(new Locator.ClickOptions().setPosition(10, 10).setTimeout(RENDER_TIMEOUT_MS));
    awaitDrillRegistered(nodeFqn);
    awaitFocusedSceneSettled(nodeFqn);
    return this;
  }

  /** Switches band from the right-hand rail. */
  public LineageMapPage switchBand(final String band) {
    requireBandChange(band);
    byTestId(BAND_TESTID_PREFIX + band)
        .click(new Locator.ClickOptions().setTimeout(RENDER_TIMEOUT_MS));
    awaitSceneSettled(band);
    return this;
  }

  /**
   * Zooms past the map's drill-in threshold. This does not simply deepen the band: the map picks
   * the expandable node nearest the viewport centre and drills into that, so the focus changes too.
   */
  public LineageMapPage semanticZoomIn(final String expectedBand) {
    return semanticZoom(TESTID_ZOOM_IN, expectedBand);
  }

  /** Zooms out past the pop threshold, which navigates to the parent scene. */
  public LineageMapPage semanticZoomOut(final String expectedBand) {
    return semanticZoom(TESTID_ZOOM_OUT, expectedBand);
  }

  private LineageMapPage semanticZoom(final String zoomTestId, final String expectedBand) {
    requireBandChange(expectedBand);
    final Locator zoom = byTestId(zoomTestId);
    for (int step = 0; step < SEMANTIC_ZOOM_STEPS; step++) {
      zoom.click(new Locator.ClickOptions().setTimeout(RENDER_TIMEOUT_MS));
    }
    awaitSceneSettled(expectedBand);
    return this;
  }

  /**
   * Lets the map's post-render background work finish: the semantic-zoom suppression window, and
   * the 300ms-debounced prefetch of adjacent bands. Call from an interaction's untimed setup — both
   * are the app's own scheduling, not its latency, and neither has a DOM signal to wait on.
   */
  public LineageMapPage settle() {
    page.waitForTimeout(SEMANTIC_ZOOM_SUPPRESSION_MS);
    return this;
  }

  /** Pops to an ancestor scene via the breadcrumb trail. */
  public LineageMapPage popBreadcrumb(final int index, final String expectedBand) {
    requireBandChange(expectedBand);
    byTestId(TESTID_BREADCRUMBS)
        .waitFor(
            new Locator.WaitForOptions()
                .setState(WaitForSelectorState.VISIBLE)
                .setTimeout(RENDER_TIMEOUT_MS));
    // The testid sits on a Typography inside the clickable row, and middle crumbs collapse into an
    // overflow menu at narrow widths, so click the enclosing element rather than the label itself.
    byTestId("lineage-map-breadcrumb-" + index)
        .locator("xpath=ancestor-or-self::*[self::li or self::button or self::a][1]")
        .click(new Locator.ClickOptions().setTimeout(RENDER_TIMEOUT_MS));
    awaitSceneSettled(expectedBand);
    return this;
  }

  /**
   * Re-frames the graph. Client-only — no scene fetch — so this isolates the ELK layout and
   * viewport cost from the server's.
   */
  public LineageMapPage fitToScreen() {
    final Locator item =
        page.getByRole(AriaRole.MENUITEM, new Page.GetByRoleOptions().setName(FIT_TO_SCREEN_ITEM));
    byTestId(TESTID_FIT_SCREEN).click(new Locator.ClickOptions().setTimeout(RENDER_TIMEOUT_MS));
    item.click(new Locator.ClickOptions().setTimeout(RENDER_TIMEOUT_MS));
    // The dropdown's exit animation leaves a second dialog in the DOM; not waiting for it out
    // produces strict-mode violations on the next interaction.
    item.waitFor(
        new Locator.WaitForOptions()
            .setState(WaitForSelectorState.DETACHED)
            .setTimeout(RENDER_TIMEOUT_MS));
    return this;
  }

  /**
   * The first node a deeper drill would move into: expandable, and a child of the current focus.
   *
   * <p>Drillability is read from the node's own drill button, which the map renders only on
   * expandable nodes — a non-expandable pick would make the drill a silent no-op. Requiring a child
   * of the focus keeps the drill going down the hierarchy rather than sideways into a lineage
   * neighbour or up into an ancestor shown for context.
   */
  public String firstDrillableChildFqn() {
    final Optional<String> focus = currentFocus();
    for (final Locator node : page.locator(NODE_SELECTOR).all()) {
      final String fqn = nodeFqn(node);
      if (isChildOf(fqn, focus) && isDrillable(node)) {
        return fqn;
      }
    }
    throw new IllegalStateException(
        "No expandable child of "
            + focus.orElse("the root scene")
            + " is rendered, so there is nothing to drill into");
  }

  /** At the unfocused root every node counts as a child. */
  private static boolean isChildOf(final String fqn, final Optional<String> focus) {
    return !fqn.isBlank() && focus.map(parent -> fqn.startsWith(parent + ".")).orElse(true);
  }

  private String nodeFqn(final Locator node) {
    final String testId = node.getAttribute("data-testid");
    return testId == null ? "" : testId.substring(NODE_TESTID_PREFIX.length());
  }

  private boolean isDrillable(final Locator node) {
    return node.getByRole(
                AriaRole.BUTTON, new Locator.GetByRoleOptions().setName(DRILL_BUTTON_LABEL))
            .count()
        > 0;
  }

  public String currentBand() {
    return queryParam(BAND_QUERY_PARAM).orElse("");
  }

  public Optional<String> currentFocus() {
    return queryParam(FOCUS_QUERY_PARAM);
  }

  private Optional<String> queryParam(final String name) {
    final String query = URI.create(page.url()).getQuery();
    if (query == null) {
      return Optional.empty();
    }
    return Arrays.stream(query.split("&"))
        .map(pair -> pair.split("=", 2))
        .filter(pair -> pair.length == 2 && pair[0].equals(name))
        .map(pair -> URLDecoder.decode(pair[1], StandardCharsets.UTF_8))
        .findFirst();
  }

  /**
   * Fails fast when a click did not register as a drill, rather than spending the full render
   * timeout on a scene that was never requested. The map writes the new focus into the URL
   * synchronously from its click handler, before any fetch starts.
   */
  private void awaitDrillRegistered(final String nodeFqn) {
    page.waitForCondition(
        () -> currentFocus().filter(nodeFqn::equals).isPresent(),
        new Page.WaitForConditionOptions().setTimeout(DRILL_REGISTER_TIMEOUT_MS));
  }

  /**
   * The ready signal for a drill, which has to cover the two shapes a focused scene takes.
   *
   * <p>A <b>container</b> scene (service, database, schema) opens the focused container into its
   * children: the container itself is no longer a node, its siblings stay as collapsed context, and
   * nothing carries a root badge. Those children exist only once the scene is committed. An
   * <b>asset</b> scene keeps the asset as its focused node, which the map marks as the root and
   * badges. Either way node data is committed after ELK layout, so whichever appears first means
   * that specific scene is laid out. The rail dot cannot do this — it cannot tell one ASSET scene
   * from the next.
   */
  private void awaitFocusedSceneSettled(final String focusFqn) {
    final Locator childOfFocus =
        page.locator(
            "[data-testid^='" + cssStringValue(NODE_TESTID_PREFIX + focusFqn + ".") + "']");
    final Locator focusedAsset = byTestId(NODE_TESTID_PREFIX + focusFqn).locator(ROOT_NODE_BADGE);
    childOfFocus
        .or(focusedAsset)
        .first()
        .waitFor(
            new Locator.WaitForOptions()
                .setState(WaitForSelectorState.ATTACHED)
                .setTimeout(RENDER_TIMEOUT_MS));
    PlaywrightAssertions.assertThat(byTestId(TESTID_LOADER))
        .hasCount(0, new LocatorAssertions.HasCountOptions().setTimeout(RENDER_TIMEOUT_MS));
  }

  /** Escapes a value for a single-quoted CSS attribute selector — FQNs may contain quotes. */
  private static String cssStringValue(final String value) {
    return value.replace("\\", "\\\\").replace("'", "\\'");
  }

  /**
   * Guards every rail-dot wait. The dot is only a readiness signal when the band changes: on a
   * same-band transition it is already active, and the wait would return before the new scene
   * exists — publishing a fast number for work that was never measured.
   */
  private void requireBandChange(final String expectedBand) {
    if (expectedBand.equals(currentBand())) {
      throw new IllegalStateException(
          "Already on band "
              + expectedBand
              + "; the rail dot cannot detect a same-band transition. Wait on the focus instead.");
    }
  }

  /**
   * The ready signal for a band-changing interaction, and the reason it is not just "the loader
   * went away".
   *
   * <p>The map pre-warms adjacent bands 300ms after every render, so a band switch on an unchanged
   * focus is usually a cache hit: no request, no loader, nothing to wait on. The rail's active dot
   * is driven by {@code scene.band} and therefore flips only when the new scene object is committed
   * to state — which happens after ELK has positioned the nodes, not when the response lands. Only
   * valid when the band changes; {@link #requireBandChange} enforces that.
   */
  private void awaitSceneSettled(final String expectedBand) {
    byTestId(BAND_TESTID_PREFIX + expectedBand)
        .locator(ACTIVE_RAIL_DOT)
        .waitFor(
            new Locator.WaitForOptions()
                .setState(WaitForSelectorState.VISIBLE)
                .setTimeout(RENDER_TIMEOUT_MS));
    PlaywrightAssertions.assertThat(byTestId(TESTID_LOADER))
        .hasCount(0, new LocatorAssertions.HasCountOptions().setTimeout(RENDER_TIMEOUT_MS));
    page.locator(NODE_SELECTOR)
        .first()
        .waitFor(
            new Locator.WaitForOptions()
                .setState(WaitForSelectorState.ATTACHED)
                .setTimeout(RENDER_TIMEOUT_MS));
  }

  @Override
  protected void waitForLoaded() {
    byTestId(TESTID_CANVAS)
        .waitFor(
            new Locator.WaitForOptions()
                .setState(WaitForSelectorState.VISIBLE)
                .setTimeout(RENDER_TIMEOUT_MS));
    PlaywrightAssertions.assertThat(byTestId(TESTID_LOADER))
        .hasCount(0, new LocatorAssertions.HasCountOptions().setTimeout(RENDER_TIMEOUT_MS));
    page.locator(NODE_SELECTOR)
        .first()
        .waitFor(
            new Locator.WaitForOptions()
                .setState(WaitForSelectorState.ATTACHED)
                .setTimeout(RENDER_TIMEOUT_MS));
  }

  /** Nodes currently in the DOM — the visible subset, not the whole scene. */
  public int renderedNodeCount() {
    return page.locator(NODE_SELECTOR).count();
  }

  public long navigationDurationMillis() {
    final Object duration = page.evaluate(NAVIGATION_DURATION_SCRIPT);
    return (duration instanceof Number number) ? number.longValue() : -1;
  }

  @Override
  public void close() {
    page.close();
  }

  private static String urlEncode(final String value) {
    return URLEncoder.encode(value, StandardCharsets.UTF_8);
  }
}
