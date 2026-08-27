package org.openmetadata.playwright.ui.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.assertions.LocatorAssertions;
import com.microsoft.playwright.assertions.PlaywrightAssertions;
import com.microsoft.playwright.options.AriaRole;
import com.microsoft.playwright.options.WaitForSelectorState;
import java.time.Duration;
import java.util.regex.Pattern;
import org.awaitility.Awaitility;
import org.openmetadata.playwright.ui.UiSession;

/**
 * Drives the Incident Manager flow used by
 * {@code openmetadata-ui/.../playwright/e2e/Features/IncidentManager.spec.ts} —
 * specifically the acknowledge-from-detail-page action.
 *
 * <p>The acknowledge flow has two anchors:
 * <ol>
 *   <li>{@code /incident-manager} list page — wait for the incident row to appear, then
 *       click into the test case detail page.
 *   <li>Test case detail (incident tab) — open resolution editor, set status to "Ack",
 *       confirm.
 * </ol>
 */
public final class IncidentManagerPage extends PageObject {

  private static final String INCIDENT_LIST_PATH = "/incident-manager";
  private static final String API_TASK_RESOLVE_REGEX = ".*/api/v1/tasks/.+/resolve";
  private static final String API_INCIDENT_STATUS_REGEX =
      ".*/api/v1/dataQuality/testCases/testCaseIncidentStatus.*";
  private static final Pattern PAGE_SIZE_50_OPTION =
      Pattern.compile("50.*page", Pattern.CASE_INSENSITIVE);
  private static final Duration PAGE_SIZE_RETRY_TIMEOUT = Duration.ofSeconds(60);
  private static final Duration PAGE_SIZE_RETRY_INTERVAL = Duration.ofSeconds(2);
  private static final double PAGE_SIZE_CLICK_TIMEOUT_MS = 5_000;
  private static final double PAGE_SIZE_RESPONSE_TIMEOUT_MS = 15_000;

  private IncidentManagerPage(final Page page, final UiSession session) {
    super(page, session);
  }

  public static IncidentManagerPage open(final UiSession ui) {
    final Page page = ui.newPage();
    page.navigate(ui.uiUrl(INCIDENT_LIST_PATH));
    final IncidentManagerPage instance = new IncidentManagerPage(page, ui);
    instance.waitForLoaded();
    return instance;
  }

  public Locator incidentTable() {
    return byTestId("test-case-incident-manager-table");
  }

  /**
   * Asserts a row referencing the test case (by name link) is rendered. The
   * {@code aria-label} on the link matches the test case name.
   */
  public IncidentManagerPage assertIncidentVisible(final String testCaseName) {
    PlaywrightAssertions.assertThat(
            page.getByRole(
                com.microsoft.playwright.options.AriaRole.LINK,
                new Page.GetByRoleOptions().setName(testCaseName)))
        .isVisible(new LocatorAssertions.IsVisibleOptions().setTimeout(60_000));
    return this;
  }

  /**
   * Click the test case link to navigate to its detail page (Incident tab).
   */
  public IncidentManagerPage openIncidentDetail(final String testCaseName) {
    page.getByRole(
            com.microsoft.playwright.options.AriaRole.LINK,
            new Page.GetByRoleOptions().setName(testCaseName))
        .first()
        .click();
    page.waitForLoadState();
    byTestId("edit-resolution-icon")
        .waitFor(new Locator.WaitForOptions().setState(WaitForSelectorState.VISIBLE));
    return this;
  }

  /**
   * Open the resolution-status editor on the test case detail page, choose "Ack",
   * and confirm. Awaits the status-update response so post-action assertions are
   * race-free.
   */
  public IncidentManagerPage acknowledgeFromDetail() {
    byTestId("edit-resolution-icon").click();
    byTestId("test-case-resolution-status-type").click();
    page.locator("[title='Ack']").click();
    page.waitForResponse(
        r -> r.url().matches(API_INCIDENT_STATUS_REGEX) || r.url().matches(API_TASK_RESOLVE_REGEX),
        () -> page.locator("#update-status-button").click());
    return this;
  }

  /**
   * Snapshot the visible status text of the named test case's row on the incident-manager
   * list page (e.g., "New", "Ack", "Resolved").
   */
  public String statusForTestCase(final String testCaseName) {
    final Locator badge = page.locator("[data-testid='" + testCaseName + "-status']").first();
    badge.waitFor(
        new Locator.WaitForOptions().setState(WaitForSelectorState.VISIBLE).setTimeout(30_000));
    final String text = badge.textContent();
    return text == null ? "" : text.trim();
  }

  /**
   * Assign an incident to {@code userName} (lowercased — matches the user testid in the
   * search popover). Triggered from the status chip on the incident-manager list page:
   * status → "Assigned" → search user → click → submit. Mirrors {@code assignIncident}
   * in the TS spec.
   */
  public IncidentManagerPage assignIncident(
      final String testCaseName, final String userName, final String userDisplayName) {
    page.locator("[data-testid='" + testCaseName + "-status']").click();
    byTestId("status-item-Assigned").click();
    byTestId(testCaseName + "-assignee-popover")
        .waitFor(new Locator.WaitForOptions().setState(WaitForSelectorState.VISIBLE));
    byTestId("assignee-search-input").click();
    page.waitForResponse(
        r -> r.url().contains("/api/v1/search/query") && r.url().contains("index=user"),
        () -> page.locator("[data-testid='assignee-search-input'] input").fill(userDisplayName));
    final Locator userOption = page.locator("[data-testid='" + userName.toLowerCase() + "']");
    userOption.waitFor(new Locator.WaitForOptions().setState(WaitForSelectorState.VISIBLE));
    userOption.click();
    page.waitForResponse(
        r -> r.url().matches(API_INCIDENT_STATUS_REGEX) || r.url().matches(API_TASK_RESOLVE_REGEX),
        () -> byTestId("submit-assignee-popover-button").click());
    waitForStatusText(testCaseName, "Assigned");
    return this;
  }

  /**
   * Resolve an incident from the list page: status → "Resolved" → choose
   * {@code MissingData} reason chip → fill comment → submit. Mirrors the simpler
   * resolve path in {@code IncidentManager.spec.ts → "Resolve task from incident list page"}.
   */
  public IncidentManagerPage resolveIncident(final String testCaseName, final String comment) {
    page.locator("[data-testid='" + testCaseName + "-status']").click();
    byTestId("status-item-Resolved").click();
    byTestId("reason-chip-MissingData").click();
    byTestId("resolved-comment-textarea").click();
    page.locator("[data-testid='resolved-comment-textarea'] textarea").first().fill(comment);
    page.waitForResponse(
        r -> r.url().matches(API_INCIDENT_STATUS_REGEX) || r.url().matches(API_TASK_RESOLVE_REGEX),
        () -> byTestId("submit-resolved-popover-button").click());
    waitForStatusText(testCaseName, "Resolved");
    return this;
  }

  // ---- Filter & pagination helpers (TS spec: "Verify filters" + "Incident Manager pagination")
  // ----

  private static final String API_LIST_REGEX =
      ".*/api/v1/dataQuality/testCases/testCaseIncidentStatus/search/list.*";

  /** Filter the incident list by status using the status select; awaits the filtered API. */
  public IncidentManagerPage filterByStatus(final String statusLabel) {
    byTestId("status-select").click();
    page.waitForResponse(
        r ->
            r.url().matches(API_LIST_REGEX)
                && r.url().contains("testCaseResolutionStatusType=" + statusLabel),
        () -> page.locator("[title='" + statusLabel + "']").click());
    return this;
  }

  /** Clear the active status filter via its close-circle icon. */
  public IncidentManagerPage clearStatusFilter() {
    page.waitForResponse(
        r -> r.url().matches(API_LIST_REGEX),
        () -> page.locator("[data-testid='status-select'] [aria-label='close-circle']").click());
    return this;
  }

  /** Filter the incident list by test case name (search + select option). */
  public IncidentManagerPage filterByTestCase(final String testCaseName) {
    byTestId("test-case-select").click();
    page.locator("[data-testid='test-case-select'] input").fill(testCaseName);
    page.waitForResponse(
        r -> r.url().matches(API_LIST_REGEX) && r.url().contains("testCaseFQN="),
        () -> page.locator("[title='" + testCaseName + "']").click());
    return this;
  }

  public IncidentManagerPage clearTestCaseFilter() {
    page.waitForResponse(
        r -> r.url().matches(API_LIST_REGEX),
        () -> page.locator("[data-testid='test-case-select'] [aria-label='close-circle']").click());
    return this;
  }

  // Pagination
  public Locator paginationContainer() {
    return byTestId("pagination");
  }

  public Locator pageIndicator() {
    return byTestId("page-indicator");
  }

  public IncidentManagerPage clickNext() {
    page.waitForResponse(r -> r.url().matches(API_LIST_REGEX), () -> byTestId("next").click());
    return this;
  }

  public IncidentManagerPage clickPrevious() {
    page.waitForResponse(r -> r.url().matches(API_LIST_REGEX), () -> byTestId("previous").click());
    return this;
  }

  /** Open page size dropdown, click the {@code 50 / Page} option, await list with limit=50. */
  public IncidentManagerPage selectPageSize50() {
    // The incident list refetches after a reindex; while it loads, paging.total briefly drops and
    // the pagination bar (which owns this dropdown) unmounts, collapsing the panel between
    // resolving
    // the "50 / page" item and clicking it — "<html> intercepts pointer events", then the item goes
    // not-visible. Re-open and re-click as one unit until the list actually reloads at limit=50.
    Awaitility.await("incident list page size set to 50")
        .atMost(PAGE_SIZE_RETRY_TIMEOUT)
        .pollInterval(PAGE_SIZE_RETRY_INTERVAL)
        .pollDelay(Duration.ZERO)
        .ignoreExceptions()
        .untilAsserted(this::openDropdownAndSelectPageSize50);
    return this;
  }

  private void openDropdownAndSelectPageSize50() {
    // Reset any panel a previous attempt left half-open — Ant toggles on trigger click, so opening
    // a
    // stuck-open menu would instead close it. Escape is a no-op when nothing is open.
    page.keyboard().press("Escape");
    final Locator menu = page.locator(".ant-dropdown:not(.ant-dropdown-hidden) .ant-dropdown-menu");
    openMenu(byTestId("page-size-selection-dropdown"), menu);
    // Click the visible menuitem page-wide (getByRole excludes the hidden/closed panels Ant leaves
    // in the DOM). Bounded click + response timeouts so a collapse fails this attempt fast and the
    // outer retry re-opens, instead of burning the full default timeout on a detached panel.
    final Locator option =
        page.getByRole(AriaRole.MENUITEM, new Page.GetByRoleOptions().setName(PAGE_SIZE_50_OPTION));
    page.waitForResponse(
        r -> r.url().matches(API_LIST_REGEX) && r.url().contains("limit=50"),
        new Page.WaitForResponseOptions().setTimeout(PAGE_SIZE_RESPONSE_TIMEOUT_MS),
        () -> option.click(new Locator.ClickOptions().setTimeout(PAGE_SIZE_CLICK_TIMEOUT_MS)));
  }

  /**
   * Block until the status badge for the named test case shows {@code expectedText}.
   * Necessary because the API response and the badge re-render are not synchronous —
   * reading {@code statusForTestCase} immediately after a mutation can catch the
   * pre-mutation text.
   */
  public IncidentManagerPage waitForStatusText(
      final String testCaseName, final String expectedText) {
    PlaywrightAssertions.assertThat(
            page.locator("[data-testid='" + testCaseName + "-status']").first())
        .containsText(
            expectedText,
            new com.microsoft.playwright.assertions.LocatorAssertions.ContainsTextOptions()
                .setTimeout(30_000));
    return this;
  }

  @Override
  protected void waitForLoaded() {
    incidentTable().waitFor(new Locator.WaitForOptions().setState(WaitForSelectorState.VISIBLE));
  }
}
