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

package org.openmetadata.catalog.selenium.pages.myData;

import java.time.Duration;
import java.util.ArrayList;
import java.util.logging.Logger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.catalog.selenium.events.Events;
import org.openmetadata.catalog.selenium.properties.Property;
import org.openqa.selenium.By;
import org.openqa.selenium.TimeoutException;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

@Order(1)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class MyDataPageTest {

  private static final Logger LOG = Logger.getLogger(MyDataPageTest.class.getName());

  static WebDriver webDriver;
  static String url = Property.getInstance().getURL();
  static Actions actions;
  static WebDriverWait wait;
  static String table = "dim_product_variant";
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
    actions = new Actions(webDriver);
    wait = new WebDriverWait(webDriver, Duration.ofSeconds(30));
    webDriver.manage().window().maximize();
    webDriver.get(url);
  }

  @Test
  @Order(1)
  public void checkWhatsNew() {
    Events.click(webDriver, By.xpath("//ul[@class='slick-dots testid-dots-button']//li[2]")); // What's new page 2
    Events.click(webDriver, By.cssSelector("[data-testid='WhatsNewModalChangeLogs']")); // Change Logs
    Events.click(webDriver, By.cssSelector("[data-testid='closeWhatsNew']")); // Close What's new
  }

  @Test
  @Order(2)
  public void checkOverview() throws InterruptedException {
    checkWhatsNew();
    Events.click(webDriver, By.cssSelector("[data-testid='tables']")); // Tables
    webDriver.navigate().back();
    Events.click(webDriver, By.cssSelector("[data-testid='topics']")); // Topics
    webDriver.navigate().back();
    Events.click(webDriver, By.cssSelector("[data-testid='dashboards']")); // Dashboard
    webDriver.navigate().back();
    Events.click(webDriver, By.cssSelector("[data-testid='pipelines']")); // Pipeline
    webDriver.navigate().back();
    Events.click(webDriver, By.cssSelector("[data-testid='service']")); // Services
    webDriver.navigate().back();
    Events.click(webDriver, By.cssSelector("[data-testid='ingestion']")); // Services
    webDriver.navigate().back();
    Events.click(webDriver, By.cssSelector("[data-testid='user']")); // Users
    webDriver.navigate().back();
    Events.click(webDriver, By.cssSelector("[data-testid='terms']")); // Teams
  }

  @Test
  @Order(3)
  public void checkSearchBar() throws InterruptedException {
    checkWhatsNew();
    wait.until(
        ExpectedConditions.elementToBeClickable(
            webDriver.findElement(By.cssSelector("[id='searchBox']")))); // Search bar/dim
    Events.sendKeys(webDriver, By.cssSelector("[id='searchBox']"), "dim"); // Search bar/dim
    Thread.sleep(waitTime);
    Events.click(webDriver, By.cssSelector("[data-testid='data-name']")); // Search bar/dim
  }

  @Test
  @Order(4)
  public void checkHeaders() {
    checkWhatsNew();
    ArrayList<String> tabs = new ArrayList<>(webDriver.getWindowHandles());
    Events.click(webDriver, By.cssSelector("[data-testid='appbar-item'][id='explore']")); // Explore
    webDriver.navigate().back();
    Events.click(webDriver, By.cssSelector("[data-testid='menu-button'][id='menu-button-Settings']")); // Setting
    Events.click(webDriver, By.cssSelector("[data-testid='menu-item-Teams']")); // Setting/Teams
    webDriver.navigate().back();
    Events.click(webDriver, By.cssSelector("[data-testid='menu-button'][id='menu-button-Settings']")); // Setting
    Events.click(webDriver, By.cssSelector("[data-testid='menu-item-Tags']")); // Setting/Tags
    webDriver.navigate().back();
    Events.click(webDriver, By.cssSelector("[data-testid='menu-button'][id='menu-button-Settings']")); // Setting
    Events.click(webDriver, By.cssSelector("[data-testid='menu-item-Services']")); // Setting/Services
    Events.click(webDriver, By.cssSelector("[data-testid='whatsnew-modal']")); // What's New
    checkWhatsNew();
    Events.click(webDriver, By.cssSelector("[data-testid='menu-button'][id='menu-button-Need Help']"));
    Events.click(webDriver, By.cssSelector("[data-testid='menu-item-Docs']"));
    webDriver.switchTo().window(tabs.get(0));

    Events.click(webDriver, By.cssSelector("[data-testid='menu-button'][id='menu-button-Need Help']"));
    Events.click(webDriver, By.cssSelector("[data-testid='menu-item-API']"));
    webDriver.navigate().back();

    Events.click(webDriver, By.cssSelector("[data-testid='menu-button'][id='menu-button-Need Help']"));
    Events.click(webDriver, By.cssSelector("[data-testid='menu-item-Slack']"));
    webDriver.switchTo().window(tabs.get(0));
  }

  @Test
  @Order(5)
  public void checkMyDataTab() {
    checkWhatsNew();
    Events.click(webDriver, By.cssSelector("[data-testid='tables']")); // Tables
    Events.sendKeys(webDriver, By.cssSelector("[data-testid='searchBox']"), table);
    Events.click(webDriver, By.cssSelector("[data-testid='data-name'][id='bigquery_gcpshopifydim_product_variant']"));
    Events.click(webDriver, By.xpath("(//button[@data-testid='tab'])[5]")); // Manage
    Events.click(webDriver, By.cssSelector("[data-testid='owner-dropdown']")); // Owner
    Events.click(webDriver, By.xpath("//div[@data-testid='dropdown-list']//div[2]//button[2]"));
    Events.click(webDriver, By.cssSelector("[data-testid='list-item']")); // Select User/Team
    Events.click(webDriver, By.cssSelector("[data-testid='saveManageTab']")); // Save
    Events.click(webDriver, By.cssSelector("[data-testid='image']"));
    webDriver.navigate().refresh();
    Events.click(webDriver, By.cssSelector("[data-testid='My data-" + table + "']"));
    webDriver.navigate().back();
    Events.click(webDriver, By.cssSelector("[data-testid='my-data']")); // My Data
    Events.click(webDriver, By.xpath("//button[@data-testid='table-link']"));
  }

  @Test
  @Order(6)
  public void checkFollowingTab() {
    checkWhatsNew();
    Events.click(webDriver, By.cssSelector("[data-testid='tables']")); // Tables
    Events.sendKeys(webDriver, By.cssSelector("[data-testid='searchBox']"), table);
    Events.click(webDriver, By.cssSelector("[data-testid='data-name'][id='bigquery_gcpshopifydim_product_variant']"));
    Events.click(webDriver, By.cssSelector("[data-testid='follow-button']"));
    Events.click(webDriver, By.cssSelector("[data-testid='image']"));
    webDriver.navigate().refresh();
    Events.click(webDriver, By.xpath("//div[@data-testid='Following data-" + table + "']/div/a/button"));
    webDriver.navigate().back();
    Events.click(webDriver, By.cssSelector("[data-testid='following-data']")); // Following
    Events.click(webDriver, By.xpath("//button[@data-testid='table-link']"));
  }

  @Test
  @Order(7)
  public void checkRecentlyViewed() {
    checkWhatsNew();
    Events.click(webDriver, By.cssSelector("[data-testid='tables']")); // Tables
    Events.sendKeys(webDriver, By.cssSelector("[data-testid='searchBox']"), "fact_line_item");
    Events.click(webDriver, By.cssSelector("[data-testid='data-name'][id='bigquery_gcpshopifyfact_line_item']"));
    Events.click(webDriver, By.cssSelector("[data-testid='image']"));
    webDriver.navigate().refresh();
    Events.click(webDriver, By.cssSelector("[data-testid='Recently Viewed-fact_line_item']"));
  }

  @Test
  @Order(8)
  public void checkRecentlySearched() {
    checkWhatsNew();
    Events.sendKeys(webDriver, By.cssSelector("[id='searchBox']"), "dim"); // Search bar/dim
    Events.sendEnter(webDriver, By.cssSelector("[id='searchBox']"));
    Events.click(webDriver, By.cssSelector("[data-testid='table-link']"));
    Events.click(webDriver, By.cssSelector("[data-testid='image']"));
    Events.click(webDriver, By.cssSelector("[data-testid='Recently-Search-dim']"));
  }

  @Test
  @Order(9)
  public void checkRecentSearchWithSpaces() throws Exception {
    checkWhatsNew();
    Events.sendKeys(webDriver, By.cssSelector("[id='searchBox']"), " "); // Search bar/Empty Space " "
    Events.sendEnter(webDriver, By.cssSelector("[id='searchBox']"));
    Events.click(webDriver, By.cssSelector("[data-testid='table-link']"));
    Events.click(webDriver, By.cssSelector("[data-testid='image']"));
    Thread.sleep(2000);
    try {
      WebElement spaceSearch =
          wait.until(ExpectedConditions.presenceOfElementLocated(By.cssSelector("[data-testid='Recently-Search- ']")));
      if (spaceSearch.isDisplayed()) {
        throw new Exception("Spaces are captured in Recent Search");
      }
    } catch (TimeoutException exception) {
      LOG.info("Success");
    }
  }

  @Test
  @Order(10)
  public void checkLogout() {
    checkWhatsNew();
    Events.click(webDriver, By.cssSelector("[data-testid='dropdown-profile']"));
    Events.click(webDriver, By.cssSelector("[data-testid='greeting-text']"));
    Events.click(webDriver, By.cssSelector("[data-testid='menu-item-Logout']"));
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
