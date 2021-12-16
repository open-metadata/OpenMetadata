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

import java.time.Duration;
import java.util.ArrayList;
import java.util.logging.Logger;

@Order(14)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class PaginationAndFilterTest {

  private static final Logger LOG = Logger.getLogger(PaginationAndFilterTest.class.getName());

  static WebDriver webDriver;
  static String url = Property.getInstance().getURL();
  static Actions actions;
  static WebDriverWait wait;
  Integer waitTime = Property.getInstance().getSleepTime();

  @BeforeEach
  public void openMetadataWindow() {
    System.setProperty("webdriver.chrome.driver", "src/test/resources/drivers/linux/chromedriver");
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
  public void checkFlikerInFilter() throws Exception {
    Events.click(webDriver, By.cssSelector("[data-testid='closeWhatsNew']")); // Close What's new
    Thread.sleep(waitTime);
    Events.click(webDriver, By.cssSelector("[data-testid='tables']")); // Tables
    for (int i = 0; i <= 5; i++) {
      Events.click(webDriver, By.xpath("//div[@data-testid='pagination-button']//ul//li[2]")); // Next Page
    }
    Events.click(webDriver, By.cssSelector("[data-testid='checkbox'][id='BigQuery']")); // Select Filter
    try {
      WebElement noDataFound = wait.until(ExpectedConditions.presenceOfElementLocated(By.xpath(
          "//*[contains(text(), 'No matching data assets found')]")));
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
    Events.click(webDriver, By.cssSelector("[data-testid='closeWhatsNew']")); // Close What's new
    Thread.sleep(waitTime);
    Events.click(webDriver, By.cssSelector("[data-testid='tables']")); // Tables
    Events.click(webDriver, By.cssSelector("[data-testid='checkbox'][id='BigQuery']")); // Select Filter
    try {
      WebElement noDataFound = wait.until(ExpectedConditions.presenceOfElementLocated(By.xpath(
          "//*[contains(text(), 'No matching data assets found')]")));
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
    Events.click(webDriver, By.cssSelector("[data-testid='closeWhatsNew']")); // Close What's new
    Thread.sleep(waitTime);
    Events.click(webDriver, By.cssSelector("[data-testid='tables']")); // Tables
    Events.click(webDriver, By.cssSelector("[data-testid='checkbox'][id='Tier.Tier3']")); // Select Filter
    try {

      WebElement dataFound = wait.until(ExpectedConditions.presenceOfElementLocated(By.cssSelector(
          "[data-testid='search-results']")));
      if (dataFound.isDisplayed()) {
        throw new Exception("Data found with filter count 0");
      }
    } catch(TimeoutException exception) {
      LOG.info("Success");
    }
  }

  @Test
  @Order(4)
  public void leftPanelDisappearsCheck() throws InterruptedException {
    Events.click(webDriver, By.cssSelector("[data-testid='closeWhatsNew']")); // Close What's new
    Thread.sleep(waitTime);
    Events.sendKeys(webDriver, By.cssSelector("[data-testid='searchBox']"), "zzzz");
    Events.sendEnter(webDriver, By.cssSelector("[data-testid='searchBox']"));
    webDriver.navigate().refresh();
    Events.click(webDriver, By.cssSelector("[data-testid='appbar-item'][id='explore']")); // Explore
    Events.click(webDriver, By.cssSelector("[data-testid='checkbox'][id='BigQuery']")); // Tables
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
