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
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.catalog.selenium.events.Events;
import org.openmetadata.catalog.selenium.objectRepository.DatabaseServicePage;
import org.openmetadata.catalog.selenium.objectRepository.TagsPage;
import org.openmetadata.catalog.selenium.properties.Property;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.WebDriverWait;

@Order(8)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class DatabaseServicePageTest {

  static WebDriver webDriver;
  static TagsPage tagsPage;
  static DatabaseServicePage databaseServicePage;
  static String url = Property.getInstance().getURL();
  static Faker faker = new Faker();
  static String serviceName = faker.name().firstName();
  static Actions actions;
  static WebDriverWait wait;
  Integer waitTime = Property.getInstance().getSleepTime();

  @BeforeEach
  public void openMetadataWindow() {
    System.setProperty("webdriver.chrome.driver", "src/test/resources/drivers/linux/chromedriver");
    ChromeOptions options = new ChromeOptions();
    options.addArguments("--headless");
    webDriver = new ChromeDriver(options);
    tagsPage = new TagsPage(webDriver);
    databaseServicePage = new DatabaseServicePage(webDriver);
    actions = new Actions(webDriver);
    wait = new WebDriverWait(webDriver, Duration.ofSeconds(30));
    webDriver.manage().window().maximize();
    webDriver.get(url);
  }

  @Test
  @Order(1)
  public void openDatabaseServicePage() throws InterruptedException {
    Events.click(webDriver, tagsPage.closeWhatsNew()); // Close What's new
    Thread.sleep(waitTime);
    Events.click(webDriver, tagsPage.headerSettings()); // Setting
    Events.click(webDriver, databaseServicePage.headerSettingsServices()); // Setting/Services
    Thread.sleep(waitTime);
  }

  @Test
  @Order(2)
  public void addDatabaseService() throws InterruptedException {
    openDatabaseServicePage();
    List<WebElement> webElementList = webDriver.findElements(databaseServicePage.addServiceButton());
    if (webElementList.isEmpty()) {
      Events.click(webDriver, databaseServicePage.noServicesAddServiceButton());
    } else {
      Events.click(webDriver, databaseServicePage.addServiceButton());
    }
    Events.click(webDriver, databaseServicePage.serviceType("MySQL"));
    Events.click(webDriver, databaseServicePage.nextButton());
    Events.sendKeys(webDriver, databaseServicePage.serviceName(), serviceName);
    Events.click(webDriver, tagsPage.descriptionBoldButton());
    Events.sendKeys(webDriver, tagsPage.addDescriptionString(), faker.address().toString());
    Events.click(webDriver, tagsPage.addDescriptionString());
    Events.sendEnter(webDriver, tagsPage.addDescriptionString());
    Events.click(webDriver, tagsPage.descriptionItalicButton());
    Events.sendKeys(webDriver, tagsPage.addDescriptionString(), faker.address().toString());
    Events.click(webDriver, tagsPage.addDescriptionString());
    Events.sendEnter(webDriver, tagsPage.addDescriptionString());
    Events.click(webDriver, tagsPage.descriptionLinkButton());
    Events.sendKeys(webDriver, tagsPage.addDescriptionString(), faker.address().toString());
    Events.click(webDriver, databaseServicePage.nextButton());
    Events.sendKeys(webDriver, databaseServicePage.serviceUrl(), "localhost");
    Events.sendKeys(webDriver, databaseServicePage.servicePort(), "3306");
    Events.sendKeys(webDriver, databaseServicePage.serviceUsername(), "openmetadata_user");
    Events.sendKeys(webDriver, databaseServicePage.servicePassword(), "openmetadata_password");
    Events.sendKeys(webDriver, databaseServicePage.databaseName(), "openmetadata_db");
    Events.click(webDriver, databaseServicePage.nextButton());
    Events.click(webDriver, databaseServicePage.nextButton());
    Events.click(webDriver, databaseServicePage.saveServiceButton());
  }

  @Test
  @Order(3)
  public void checkDatabaseServiceDetails() throws InterruptedException {
    openDatabaseServicePage();
    Thread.sleep(2000);
    Events.click(webDriver, tagsPage.containsText(serviceName));
    Events.click(webDriver, tagsPage.editTagCategoryDescription());
    Events.click(webDriver, tagsPage.addDescriptionString());
    Events.sendKeys(webDriver, tagsPage.addDescriptionString(), faker.address().toString());
    Events.click(webDriver, tagsPage.editDescriptionSaveButton());
  }

  @Test
  @Order(4)
  public void checkIngestionTab() throws InterruptedException {
    openDatabaseServicePage();
    Thread.sleep(2000);
    Events.click(webDriver, tagsPage.containsText("Demo1"));
    Events.click(webDriver, databaseServicePage.serviceDetailsTabs("ingestions"));
    Events.click(webDriver, databaseServicePage.runIngestion()); // run ingestion

    Events.click(webDriver, databaseServicePage.editIngestion()); // edit ingestion
    Events.click(webDriver, databaseServicePage.nextButton());
    Events.click(webDriver, databaseServicePage.selectInterval());
    Events.click(webDriver, databaseServicePage.ingestionInterval("day"));
    Events.click(webDriver, databaseServicePage.nextButton());
    Events.click(webDriver, databaseServicePage.saveServiceButton());

    Events.click(webDriver, databaseServicePage.deleteIngestion()); // delete ingestion
    Events.click(webDriver, databaseServicePage.saveEditedService());
  }

  @Test
  @Order(5)
  public void checkConnectionConfigTab() throws InterruptedException {
    openDatabaseServicePage();
    Thread.sleep(2000);
    Events.click(webDriver, tagsPage.containsText(serviceName));
    Events.click(webDriver, databaseServicePage.serviceDetailsTabs("connectionConfig"));
    Events.sendKeys(webDriver, databaseServicePage.serviceUsername(), "1");
    Events.sendKeys(webDriver, databaseServicePage.servicePassword(), "1");
    Events.sendKeys(webDriver, databaseServicePage.databaseName(), "1");
    Events.click(webDriver, databaseServicePage.saveConnectionConfig());
  }

  @Test
  @Order(6)
  public void deleteDatabaseService() throws InterruptedException {
    openDatabaseServicePage();
    Thread.sleep(2000);
    Events.click(webDriver, databaseServicePage.deleteServiceButton(serviceName));
    Events.click(webDriver, databaseServicePage.saveEditedService());
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
