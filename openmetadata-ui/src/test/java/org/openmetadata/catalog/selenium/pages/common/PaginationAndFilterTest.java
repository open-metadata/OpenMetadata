/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.catalog.selenium.pages.common;

import java.time.Duration;
import java.util.ArrayList;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.catalog.selenium.events.Events;
import org.openmetadata.catalog.selenium.objectRepository.Common;
import org.openmetadata.catalog.selenium.properties.Property;
import org.openqa.selenium.Keys;
import org.openqa.selenium.TimeoutException;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;

@Slf4j
@Order(14)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class PaginationAndFilterTest {
  static WebDriver webDriver;
  static Common common;
  static String url = Property.getInstance().getURL();
  static Actions actions;
  static WebDriverWait wait;
  Integer waitTime = Property.getInstance().getSleepTime();
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
  public void checkFlikerInFilter() throws Exception {
    Events.click(webDriver, common.closeWhatsNew());
    Thread.sleep(waitTime);
    Events.click(webDriver, common.selectOverview("tables"));
    for (int i = 0; i <= 5; i++) {
      Events.click(webDriver, common.explorePagination(2));
    }
    Events.click(webDriver, common.selectFilterExplore("BigQuery"));
    try {
      WebElement noDataFound =
          wait.until(ExpectedConditions.presenceOfElementLocated(common.containsText("No matching data assets found")));
      if (noDataFound.isDisplayed()) {
        throw new Exception("Flakiness exists");
      }
    } catch (TimeoutException exception) {
      LOG.info("Success");
    }
  }

  @Test
  @Order(2)
  public void noDataPresentWithFilter() throws Exception {
    Events.click(webDriver, common.closeWhatsNew());
    Thread.sleep(waitTime);
    Events.click(webDriver, common.selectOverview("tables"));
    Events.click(webDriver, common.selectFilterExplore("BigQuery"));
    try {
      WebElement noDataFound =
          wait.until(ExpectedConditions.presenceOfElementLocated(common.containsText("No matching data assets found")));
      if (noDataFound.isDisplayed()) {
        throw new Exception("Data not found with filter count more than 0");
      }
    } catch (TimeoutException exception) {
      LOG.info("Success");
    }
  }

  @Test
  @Order(3)
  public void dataPresentWithFilter() throws Exception {
    Events.click(webDriver, common.closeWhatsNew());
    Thread.sleep(waitTime);
    Events.click(webDriver, common.selectOverview("tables"));
    Events.click(webDriver, common.selectFilterExplore("Tier.Tier3"));
    try {
      WebElement dataFound = wait.until(ExpectedConditions.presenceOfElementLocated(common.searchResults()));
      if (dataFound.isDisplayed()) {
        throw new Exception("Data found with filter count 0");
      }
    } catch (TimeoutException exception) {
      LOG.info("Success");
    }
  }

  @Test
  @Order(4)
  public void leftPanelDisappearsCheck() throws InterruptedException {
    Events.click(webDriver, common.closeWhatsNew());
    Thread.sleep(waitTime);
    Events.sendKeys(webDriver, common.searchBar(), "zzzz");
    Events.sendEnter(webDriver, common.searchBar());
    webDriver.navigate().refresh();
    Events.click(webDriver, common.headerItem("explore"));
    Events.click(webDriver, common.selectFilterExplore("BigQuery"));
  }

  @Test
  @Order(5)
  public void filterDisappearsAfterSearchCheck() throws Exception {
    Events.click(webDriver, common.closeWhatsNew());
    Thread.sleep(waitTime);
    Events.click(webDriver, common.headerItem("explore"));
    Events.click(webDriver, common.selectFilterExplore("BigQuery"));
    Events.sendKeys(webDriver, common.searchBar(), "dim");
    Events.sendEnter(webDriver, common.searchBar());
    Thread.sleep(2000);
    WebElement clearSearchBox = webDriver.findElement(common.searchBar());
    clearSearchBox.sendKeys(Keys.CONTROL + "a");
    clearSearchBox.sendKeys(Keys.DELETE);
    Events.sendEnter(webDriver, common.searchBar());
    try {
      Events.click(webDriver, common.selectFilterExplore("Glue"));
      Events.click(webDriver, common.selectFilterExplore("default"));
    } catch (TimeoutException exception) {
      throw new Exception("filters are missing");
    }
  }

  @Test
  @Order(6)
  public void databaseFilterCountCheck() throws InterruptedException {
    Events.click(webDriver, common.closeWhatsNew());
    Thread.sleep(waitTime);
    Events.click(webDriver, common.headerItem("explore"));
    Events.sendKeys(webDriver, common.searchBar(), "dim_api_client");
    Events.click(webDriver, common.searchSuggestion());
    Thread.sleep(waitTime);
    actions.moveToElement(webDriver.findElement(common.editAssociatedTagButton())).perform();
    Events.click(webDriver, common.editAssociatedTagButton());
    Events.click(webDriver, common.enterAssociatedTagName());
    for (int i = 0; i <= 4; i++) {
      Events.sendKeys(webDriver, common.enterAssociatedTagName(), "P");
      Events.click(webDriver, common.tagListItem());
    }
    Events.click(webDriver, common.saveAssociatedTag());
    webDriver.navigate().back();
    webDriver.navigate().refresh();
    Thread.sleep(2000);
    Events.click(webDriver, common.selectFilterExplore("PII.None"));
    Events.click(webDriver, common.selectFilterExplore("shopify"));
    Thread.sleep(2000);
    Object filteredResults = webDriver.findElements(common.searchResultsList()).size();
    String databaseCount = webDriver.findElement(common.exploreFilterCount("shopify")).getAttribute("innerHTML");
    Assert.assertEquals(databaseCount, filteredResults.toString());
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
