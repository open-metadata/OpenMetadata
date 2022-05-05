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
import org.openqa.selenium.*;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.Select;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;

@Slf4j
@Order(8)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class DatabaseServicePageTest {

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
  JavascriptExecutor js;

  @BeforeEach
  void openMetadataWindow() {
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
    js = (JavascriptExecutor) webDriver;
  }

  @Test
  @Order(1)
  void openDatabaseServicePage() throws InterruptedException {
    Events.click(webDriver, common.closeWhatsNew()); // Close What's new
    Events.click(webDriver, common.headerSettings()); // Setting
    Events.click(webDriver, common.headerSettingsServices()); // Setting/Services
  }

  @Test
  @Order(2)
  void addDatabaseService() throws InterruptedException {
    openDatabaseServicePage();
    try {
      Events.waitForElementToDisplay(webDriver, common.noServicesAddServiceButton(), 10, 2);
      Events.click(webDriver, common.noServicesAddServiceButton());
    } catch (NoSuchElementException | TimeoutException e) {
      Events.waitForElementToDisplay(webDriver, common.addServiceButton(), 10, 2);
      Events.click(webDriver, common.addServiceButton());
    }
    Events.click(webDriver, common.serviceType("Mysql"));
    Events.click(webDriver, common.nextButton());
    Events.sendKeys(webDriver, common.serviceName(), serviceName);
    Events.click(webDriver, common.descriptionBoldButton());
    Events.sendKeys(webDriver, common.focusedDescriptionBox(), faker.address().toString());
    Events.click(webDriver, common.focusedDescriptionBox());
    Events.sendEnter(webDriver, common.focusedDescriptionBox());
    Events.click(webDriver, common.descriptionItalicButton());
    Events.sendKeys(webDriver, common.focusedDescriptionBox(), faker.address().toString());
    Events.click(webDriver, common.focusedDescriptionBox());
    Events.sendEnter(webDriver, common.focusedDescriptionBox());
    Events.click(webDriver, common.descriptionLinkButton());
    Events.sendKeys(webDriver, common.urlLink(), faker.address().toString());
    Events.sendKeys(webDriver, common.linkText(), faker.address().firstName());
    Events.click(webDriver, common.okButton());
    Events.click(webDriver, common.nextButton());
    Events.click(webDriver, common.serviceUsername());
    Events.sendKeys(webDriver, common.serviceUsername(), "openmetadata_user");
    Events.click(webDriver, common.servicePassword());
    Events.sendKeys(webDriver, common.servicePassword(), "openmetadata_password");
    Events.click(webDriver, common.hostPort());
    Events.sendKeys(webDriver, common.hostPort(), "localhost:3306");
    Events.click(webDriver, common.databaseName());
    Events.sendKeys(webDriver, common.databaseName(), "openmetadata_db");
    js.executeAsyncScript("window.setTimeout(arguments[arguments.length - 1], " + waitTime + ");");
    Events.click(webDriver, databaseServicePage.testConnection());
    Events.click(webDriver, common.saveServiceButton());
    Events.click(webDriver, common.addIngestion());
    Events.click(webDriver, common.nextButton());
    Select selectDBTSource = new Select(webDriver.findElement(databaseServicePage.dbtDropdown()));
    selectDBTSource.selectByVisibleText("None");
    Events.click(webDriver, common.saveServiceButton());
    Events.click(webDriver, common.deployButton());
    Events.click(webDriver, common.headerSettings());
    Events.click(webDriver, common.headerSettingsMenu("Services"));
    try {
      if (webDriver.getPageSource().contains(serviceName)) {
        LOG.info("Success");
      }
    } catch (NoSuchElementException | TimeoutException r) {
      Assert.fail("Service not added");
    }
  }

  @Test
  @Order(3)
  void checkDatabaseServiceDetails() throws InterruptedException {
    openDatabaseServicePage();
    Events.click(webDriver, databaseServicePage.serviceName(serviceName));
    Events.click(webDriver, common.editTagCategoryDescription());
    Events.sendKeys(webDriver, common.focusedDescriptionBox(), faker.address().toString());
    Events.click(webDriver, common.editDescriptionSaveButton());
  }

  @Test
  @Order(4)
  void checkIngestionTab() throws InterruptedException {
    openDatabaseServicePage();
    Events.click(webDriver, databaseServicePage.serviceName(serviceName));
    Events.waitForElementToDisplay(webDriver, databaseServicePage.databaseTable(), 10, 2);
    Events.click(webDriver, common.ingestion());
    try {
      Events.click(webDriver, databaseServicePage.runIngestion()); // run ingestion
    } catch (NoSuchElementException | TimeoutException e) {
      Assert.fail("Ingestion is not created");
    }
    Events.click(webDriver, databaseServicePage.editIngestion()); // edit ingestion
    Events.click(webDriver, common.nextButton());
    Select selectDBTSource = new Select(webDriver.findElement(databaseServicePage.dbtDropdown()));
    selectDBTSource.selectByVisibleText("None");
    Events.click(webDriver, common.saveServiceButton());
    Events.click(webDriver, common.deployButton());
    Events.click(webDriver, databaseServicePage.viewService());
    Events.click(webDriver, databaseServicePage.deleteIngestion()); // delete ingestion
    Events.sendKeys(webDriver, databaseServicePage.confirmationDeleteText(), "DELETE");
    Events.click(webDriver, common.confirmButton());
  }

  @Test
  @Order(5)
  void checkConnectionConfigTab() throws InterruptedException {
    openDatabaseServicePage();
    Events.click(webDriver, databaseServicePage.serviceName(serviceName));
    Events.click(webDriver, common.connectionConfig());
    Events.sendKeys(webDriver, common.serviceUsername(), "test");
    Events.sendKeys(webDriver, common.servicePassword(), "test");
    Events.sendKeys(webDriver, common.databaseName(), "test");
    Events.click(webDriver, common.saveServiceButton());
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
  void deleteDatabaseService() throws InterruptedException {
    openDatabaseServicePage();
    Events.click(webDriver, databaseServicePage.serviceName(serviceName));
    Events.click(webDriver, common.manage());
    Events.click(webDriver, databaseServicePage.deleteDatabase());
    Events.sendKeys(webDriver, databaseServicePage.confirmationDeleteText(), "DELETE");
    Events.click(webDriver, common.confirmButton());
    wait.until(ExpectedConditions.urlMatches("http://localhost:8585/my-data"));
    Events.click(webDriver, common.headerSettings());
    Events.click(webDriver, common.headerSettingsServices());
    try {
      if (webDriver.findElement(common.containsText(serviceName)).isDisplayed()) {
        Assert.fail("Service not deleted");
      }
    } catch (NoSuchElementException | TimeoutException e) {
      LOG.info("Success");
    }
  }

  @AfterEach
  void closeTabs() {
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
