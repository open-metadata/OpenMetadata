package org.openmetadata.catalog.selenium.pagesWithoutData.myData;

import java.time.Duration;
import java.util.ArrayList;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.openmetadata.catalog.selenium.events.Events;
import org.openmetadata.catalog.selenium.objectRepository.Common;
import org.openmetadata.catalog.selenium.properties.Property;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;

public class MyDataPageTest {

  static WebDriver webDriver;
  static Common common;
  static String url = Property.getInstance().getURL();
  static Actions actions;
  static WebDriverWait wait;
  String webDriverInstance = Property.getInstance().getWebDriver();
  String webDriverPath = Property.getInstance().getWebDriverPath();

  @BeforeEach
  public void openMetadataWindow() {
    System.setProperty(webDriverInstance, webDriverPath);
    ChromeOptions options = new ChromeOptions();
    options.addArguments("--headless");
    options.addArguments("--window-size=1280,800");
    webDriver = new ChromeDriver(options);
    common = new Common(webDriver);
    actions = new Actions(webDriver);
    wait = new WebDriverWait(webDriver, Duration.ofSeconds(30));
    webDriver.manage().window().maximize();
    webDriver.get(url);
  }

  @Test
  @Order(1)
  public void checkWhatsNew() {
    Events.click(webDriver, common.whatsNewDotButtons(2)); // What's new page 2
    Events.click(webDriver, common.whatsNewModalChangeLogs()); // Change Logs
    Events.click(webDriver, common.closeWhatsNew()); // Close What's new
  }

  @Test
  @Order(2)
  public void checkOverview() {
    checkWhatsNew();
    String tablesCount = webDriver.findElement(common.overviewFilterCount("tables")).getText();
    Assert.assertEquals(tablesCount, "0");

    String topicsCount = webDriver.findElement(common.overviewFilterCount("topics")).getText();
    Assert.assertEquals(topicsCount, "0");

    String dashboardsCount = webDriver.findElement(common.overviewFilterCount("dashboards")).getText();
    Assert.assertEquals(dashboardsCount, "0");

    String pipelinesCount = webDriver.findElement(common.overviewFilterCount("pipelines")).getText();
    Assert.assertEquals(pipelinesCount, "0");

    String servicesCount = webDriver.findElement(common.overviewFilterCount("service")).getText();
    Assert.assertEquals(servicesCount, "0");

    String ingestionCount = webDriver.findElement(common.overviewFilterCount("ingestion")).getText();
    Assert.assertEquals(ingestionCount, "0");

    String usersCount = webDriver.findElement(common.overviewFilterCount("user")).getText();
    Assert.assertEquals(usersCount, "1");

    String teamsCount = webDriver.findElement(common.overviewFilterCount("terms")).getText();
    Assert.assertEquals(teamsCount, "0");
  }

  @Test
  @Order(3)
  public void checkRecentViews() throws Exception {
    checkWhatsNew();
    WebElement recentViews = webDriver.findElement(common.containsText("No recently viewed data."));
    if (!recentViews.isDisplayed()) {
      Assert.fail("There shouldn't be any viewed data");
    }
  }

  @Test
  @Order(4)
  public void checkRecentSearch() throws Exception {
    checkWhatsNew();
    WebElement recentSearch = webDriver.findElement(common.containsText("No searched terms."));
    if (!recentSearch.isDisplayed()) {
      Assert.fail("There shouldn't be any searched terms");
    }
  }

  @Test
  @Order(5)
  public void checkMyDataTab() throws Exception {
    checkWhatsNew();
    WebElement myDataResults = webDriver.findElement(common.containsText("You have not owned anything yet."));
    if (!myDataResults.isDisplayed()) {
      Assert.fail("There shouldn't be any owned data");
    }
  }

  @Test
  @Order(6)
  public void checkFollowingTab() throws Exception {
    checkWhatsNew();
    WebElement followResults = webDriver.findElement(common.containsText("You have not followed anything yet."));
    if (!followResults.isDisplayed()) {
      Assert.fail("There shouldn't be any followed data");
    }
  }

  @Test
  @Order(7)
  public void checkSearchResults() throws Exception {
    checkWhatsNew();
    Events.sendEnter(webDriver, common.searchBar());
    Thread.sleep(2000);
    String searchedEntity = webDriver.findElement(common.noSearchResult()).getText();
    Assert.assertEquals(searchedEntity, "No matching data assets found");
  }

  @AfterEach
  public void closeTabs() {
    ArrayList<String> tabs = new ArrayList<>(webDriver.getWindowHandles());
    String originalHandle = webDriver.getWindowHandle();
    for (String handle : webDriver.getWindowHandles()) {
      if (!handle.equals(originalHandle)) {
        webDriver.switchTo().window(handle);
        webDriver.close();
      }
    }
    webDriver.switchTo().window(tabs.get(0)).close();
  }
}
