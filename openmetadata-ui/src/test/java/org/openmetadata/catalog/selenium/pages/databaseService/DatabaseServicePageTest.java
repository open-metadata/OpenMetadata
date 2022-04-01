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

package org.openmetadata.catalog.selenium.pages.databaseService;

import com.github.javafaker.Faker;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.catalog.selenium.events.Events;
import org.openmetadata.catalog.selenium.objectRepository.Common;
import org.openmetadata.catalog.selenium.objectRepository.DatabaseServicePage;
import org.openmetadata.catalog.selenium.properties.Property;
import org.openqa.selenium.NoSuchElementException;
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
@Order(8)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class DatabaseServicePageTest {

  static WebDriver webDriver;
  static Common common;
  static DatabaseServicePage databaseServicePage;
  static String url = Property.getInstance().getURL();
  static Faker faker = new Faker();
  static String serviceName = faker.name().firstName();
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
    databaseServicePage = new DatabaseServicePage(webDriver);
    actions = new Actions(webDriver);
    wait = new WebDriverWait(webDriver, Duration.ofSeconds(30));
    webDriver.manage().window().maximize();
    webDriver.get(url);
  }

  @Test
  @Order(1)
  public void openDatabaseServicePage() throws InterruptedException {
    Events.click(webDriver, common.closeWhatsNew()); // Close What's new
    Thread.sleep(waitTime);
    Events.click(webDriver, common.headerSettings()); // Setting
    Events.click(webDriver, common.headerSettingsServices()); // Setting/Services
    Thread.sleep(waitTime);
  }

  @Test
  @Order(2)
  public void addDatabaseService() throws InterruptedException {
    openDatabaseServicePage();
    List<WebElement> webElementList = webDriver.findElements(common.addServiceButton());
    if (webElementList.isEmpty()) {
      Events.click(webDriver, common.noServicesAddServiceButton());
    } else {
      Events.click(webDriver, common.addServiceButton());
    }
    Events.click(webDriver, common.serviceType("MySQL"));
    Events.click(webDriver, common.nextButton());
    Events.sendKeys(webDriver, common.serviceName(), serviceName);
    Events.click(webDriver, common.descriptionBoldButton());
    Events.sendKeys(webDriver, common.addDescriptionString(), faker.address().toString());
    Events.click(webDriver, common.addDescriptionString());
    Events.sendEnter(webDriver, common.addDescriptionString());
    Events.click(webDriver, common.descriptionItalicButton());
    Events.sendKeys(webDriver, common.addDescriptionString(), faker.address().toString());
    Events.click(webDriver, common.addDescriptionString());
    Events.sendEnter(webDriver, common.addDescriptionString());
    Events.click(webDriver, common.descriptionLinkButton());
    Events.sendKeys(webDriver, common.addDescriptionString(), faker.address().toString());
    Events.click(webDriver, common.nextButton());
    Events.sendKeys(webDriver, common.serviceUrl(), "localhost");
    Events.sendKeys(webDriver, common.servicePort(), "3306");
    Events.sendKeys(webDriver, common.serviceUsername(), "openmetadata_user");
    Events.sendKeys(webDriver, common.servicePassword(), "openmetadata_password");
    Events.sendKeys(webDriver, common.databaseName(), "openmetadata_db");
    Events.click(webDriver, common.nextButton());
    Events.click(webDriver, common.nextButton());
    Events.click(webDriver, common.saveServiceButton());
    Thread.sleep(waitTime);
    webDriver.navigate().refresh();
    Events.click(webDriver, common.containsText(serviceName));
    // Thread.sleep(5000); // for data ingestion
  }

  @Test
  @Order(3)
  public void checkDatabaseServiceDetails() throws InterruptedException {
    openDatabaseServicePage();
    Thread.sleep(2000);
    Events.click(webDriver, common.containsText(serviceName));
    Events.click(webDriver, common.editTagCategoryDescription());
    Events.click(webDriver, common.addDescriptionString());
    Events.sendKeys(webDriver, common.addDescriptionString(), faker.address().toString());
    Events.click(webDriver, common.editDescriptionSaveButton());
  }

  @Test
  @Order(4)
  public void checkIngestionTab() throws InterruptedException {
    openDatabaseServicePage();
    Thread.sleep(2000);
    Events.click(webDriver, common.containsText(serviceName));
    Events.click(webDriver, common.ingestion());
    try {
      WebElement runIngestion =
          wait.until(ExpectedConditions.presenceOfElementLocated(databaseServicePage.runIngestion()));
      if (runIngestion.isDisplayed()) {
        Events.click(webDriver, databaseServicePage.runIngestion()); // run ingestion
      }
    } catch (NoSuchElementException | TimeoutException e) {
      Assert.fail("Ingestion is not created");
    }
    webDriver.navigate().refresh();
    Events.click(webDriver, databaseServicePage.editIngestion()); // edit ingestion
    Events.click(webDriver, common.nextButton());
    try {
      WebElement nextButton = wait.until(ExpectedConditions.presenceOfElementLocated(common.nextButton()));
      Thread.sleep(2000);
      if (nextButton.isDisplayed()) {
        nextButton.click();
      }
    } catch (TimeoutException | NoSuchElementException e) {
      Assert.fail("Next button not found");
    }
    Events.click(webDriver, common.saveServiceButton());

    webDriver.navigate().refresh();
    Thread.sleep(waitTime);
    Events.click(webDriver, databaseServicePage.deleteIngestion()); // delete ingestion
    Events.click(webDriver, common.saveEditedService());
  }

  @Test
  @Order(5)
  public void checkConnectionConfigTab() throws InterruptedException {
    openDatabaseServicePage();
    Thread.sleep(2000);
    Events.click(webDriver, common.containsText(serviceName));
    Events.click(webDriver, common.connectionConfig());
    Events.sendKeys(webDriver, common.serviceUsername(), "1");
    Events.sendKeys(webDriver, common.servicePassword(), "1");
    Events.sendKeys(webDriver, common.databaseName(), "1");
    Events.click(webDriver, common.saveConnectionConfig());
    Thread.sleep(2000);
    try {
      WebElement errorText = webDriver.findElement(common.containsText("Error while updating service"));
      if (errorText.isDisplayed()) {
        Assert.fail("Error while updating service");
      }
    } catch (NoSuchElementException e) {
      LOG.info("Success");
    }
  }

  @Test
  @Order(6)
  public void deleteDatabaseService() throws InterruptedException {
    openDatabaseServicePage();
    Thread.sleep(2000);
    Events.click(webDriver, common.deleteServiceButton(serviceName));
    Events.click(webDriver, common.saveEditedService());
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
