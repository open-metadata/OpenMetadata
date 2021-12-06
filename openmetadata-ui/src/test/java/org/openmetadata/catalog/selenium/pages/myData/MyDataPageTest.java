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

import io.github.artsok.RepeatedIfExceptionsTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.catalog.selenium.events.Events;
import org.openmetadata.catalog.selenium.properties.Property;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

import java.time.Duration;
import java.util.ArrayList;

@Order(1)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class MyDataPageTest {

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

  @RepeatedIfExceptionsTest(repeats = 2)
  @Order(1)
  public void checkWhatsNew() {
    Events.click(webDriver, By.xpath("//ul[@class='slick-dots testid-dots-button']//li[2]")); // What's new page 2
    Events.click(webDriver, By.cssSelector("[data-testid='WhatsNewModalChangeLogs']")); // Change Logs
    Events.click(webDriver, By.cssSelector("[data-testid='closeWhatsNew']")); // Close What's new
  }

  @RepeatedIfExceptionsTest(repeats = 2)
  @Order(2)
  public void checkTabs() {
    checkWhatsNew();
    Events.click(webDriver, By.cssSelector("[data-testid='tab'][id='myDataTab']")); // My Data
    Events.click(webDriver, By.cssSelector("[data-testid='tab'][id='followingTab']")); // Following
  }

  @RepeatedIfExceptionsTest(repeats = 2)
  @Order(3)
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
    Events.click(webDriver, By.cssSelector("[data-testid='terms']"));  // Teams
  }

  @RepeatedIfExceptionsTest(repeats = 2)
  @Order(4)
  public void checkSearchBar() throws InterruptedException {
    checkWhatsNew();
    wait.until(ExpectedConditions.elementToBeClickable(
        webDriver.findElement(By.cssSelector("[id='searchBox']")))); // Search bar/dim
    Events.sendKeys(webDriver, By.cssSelector("[id='searchBox']"), "dim"); // Search bar/dim
    Thread.sleep(waitTime);
    Events.click(webDriver, By.cssSelector("[data-testid='data-name']")); // Search bar/dim
  }


  @RepeatedIfExceptionsTest(repeats = 2)
  @Order(5)
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

  @RepeatedIfExceptionsTest(repeats = 2)
  @Order(6)
  public void checkMyDataTab() {
    checkWhatsNew();
    Events.click(webDriver, By.cssSelector("[data-testid='tables']")); // Tables
    Events.click(webDriver, By.xpath("(//a[@data-testid='table-link'])[last()]"));
    Events.click(webDriver, By.xpath("(//button[@data-testid='tab'])[4]")); // Manage
    Events.click(webDriver, By.cssSelector("[data-testid='owner-dropdown']")); // Owner
    Events.click(webDriver, By.xpath("//div[@data-testid='dropdown-list']//div[2]//button[2]"));
    Events.click(webDriver, By.cssSelector("[data-testid='list-item']")); // Select User/Team
    Events.click(webDriver, By.cssSelector("[data-testid='saveManageTab']")); // Save
    Events.click(webDriver, By.cssSelector("[data-testid='image']"));
    webDriver.navigate().refresh();
    Events.click(webDriver, By.cssSelector("[data-testid='tab'][id='myDataTab']")); // My Data
    Events.click(webDriver, By.xpath("//a[@data-testid='table-link']//button"));
  }

  @RepeatedIfExceptionsTest(repeats = 2)
  @Order(7)
  public void checkFollowingTab() {
    checkWhatsNew();
    Events.click(webDriver, By.cssSelector("[data-testid='tables']")); // Tables
    Events.click(webDriver, By.xpath("(//a[@data-testid='table-link'])[last()]"));
    Events.click(webDriver, By.cssSelector("[data-testid='follow-button']"));
    Events.click(webDriver, By.cssSelector("[data-testid='image']"));
    webDriver.navigate().refresh();
    Events.click(webDriver, By.cssSelector("[data-testid='tab'][id='followingTab']")); // Following
    Events.click(webDriver, By.xpath("//a[@data-testid='table-link']//button"));
  }

  @RepeatedIfExceptionsTest(repeats = 2)
  @Order(8)
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
