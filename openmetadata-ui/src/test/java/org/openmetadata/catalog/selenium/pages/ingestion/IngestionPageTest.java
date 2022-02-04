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

package org.openmetadata.catalog.selenium.pages.ingestion;

import com.github.javafaker.Faker;
import java.time.Duration;
import java.util.ArrayList;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.catalog.selenium.events.Events;
import org.openmetadata.catalog.selenium.properties.Property;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.WebDriverWait;

@Order(12)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class IngestionPageTest {

  static WebDriver webDriver;
  static String url = Property.getInstance().getURL();
  static Faker faker = new Faker();
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
    actions = new Actions(webDriver);
    wait = new WebDriverWait(webDriver, Duration.ofSeconds(30));
    webDriver.manage().window().maximize();
    webDriver.get(url);
  }

  @Test
  @Order(1)
  public void openIngestionPage() throws InterruptedException {
    Events.click(webDriver, By.cssSelector("[data-testid='closeWhatsNew']")); // Close What's new
    Thread.sleep(waitTime);
    Events.click(webDriver, By.cssSelector("[data-testid='menu-button'][id='menu-button-Settings']")); // Setting
    Events.click(webDriver, By.cssSelector("[data-testid='menu-item-Ingestions']")); // Setting/Services
    Thread.sleep(waitTime);
  }

  @Test
  @Order(2)
  public void addIngestionService() throws InterruptedException {
    openIngestionPage();
    Events.click(webDriver, By.cssSelector("[data-testid='add-new-ingestion-button']"));
    Events.sendKeys(webDriver, By.cssSelector("[id='name'][name='name']"), faker.name().firstName());
    Events.click(webDriver, By.cssSelector("[value='BigQuery$$bigquery_gcp']"));
    Events.click(webDriver, By.cssSelector("[value='bigquery']"));
    Events.click(webDriver, By.cssSelector("[data-testid='next-button']"));
    Events.sendKeys(webDriver, By.cssSelector("[name='username']"), "openmetadata_user");
    Events.sendKeys(webDriver, By.cssSelector("[name='password']"), "openmetadata_password");
    Events.sendKeys(webDriver, By.cssSelector("[name='host']"), "localhost:3306");
    Events.sendKeys(webDriver, By.cssSelector("[name='database']"), "openmetadata_db");
    Events.click(webDriver, By.cssSelector("[data-testid='next-button']"));
    Events.click(webDriver, By.cssSelector("[value='week']"));
    Events.click(webDriver, By.cssSelector("[value='4']"));
    Events.click(webDriver, By.cssSelector("[value='21']"));
    Events.sendKeys(webDriver, By.cssSelector("[data-testid='end-date']"), "21072022");
    Events.click(webDriver, By.cssSelector("[data-testid='next-button']"));
    Events.click(webDriver, By.cssSelector("[data-testid='deploy-button']"));
  }

  @Test
  @Order(3)
  public void runIngestionService() throws InterruptedException {
    openIngestionPage();
    Events.click(webDriver, By.cssSelector("[data-testid='run']"));
    webDriver.navigate().refresh();
  }

  @Test
  @Order(4)
  public void editIngestionService() throws InterruptedException {
    openIngestionPage();
    Events.click(webDriver, By.cssSelector("[data-testid='edit']"));
    Events.sendKeys(webDriver, By.cssSelector("[data-testid='include-filter-pattern']"), ",");
    Events.click(webDriver, By.cssSelector("[data-testid='next-button']"));
    Events.click(webDriver, By.cssSelector("[value='hour']"));
    Events.click(webDriver, By.cssSelector("[value='20']"));
    Events.click(webDriver, By.cssSelector("[data-testid='next-button']"));
    Events.click(webDriver, By.cssSelector("[data-testid='deploy-button']"));
  }

  @Test
  @Order(5)
  public void deleteIngestionService() throws InterruptedException {
    openIngestionPage();
    Events.click(webDriver, By.cssSelector("[data-testid='delete']"));
    Events.click(webDriver, By.cssSelector("[data-testid='save-button']"));
    webDriver.navigate().refresh();
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
