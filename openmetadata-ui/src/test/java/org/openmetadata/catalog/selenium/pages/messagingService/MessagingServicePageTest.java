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

package org.openmetadata.catalog.selenium.pages.messagingService;

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
import org.openmetadata.catalog.selenium.objectRepository.DashboardServicePage;
import org.openmetadata.catalog.selenium.objectRepository.DatabaseServicePage;
import org.openmetadata.catalog.selenium.objectRepository.MessagingServicePage;
import org.openmetadata.catalog.selenium.objectRepository.TagsPage;
import org.openmetadata.catalog.selenium.properties.Property;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.WebDriverWait;

@Order(11)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class MessagingServicePageTest {
  static WebDriver webDriver;
  static TagsPage tagsPage;
  static DatabaseServicePage databaseServicePage;
  static DashboardServicePage dashboardServicePage;
  static MessagingServicePage messagingServicePage;
  static String url = Property.getInstance().getURL();
  static Faker faker = new Faker();
  static String serviceName = faker.name().firstName();
  static String enterDescription = "//div[@data-testid='enterDescription']/div/div[2]/div/div/div/div/div/div";
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
    tagsPage = new TagsPage(webDriver);
    databaseServicePage = new DatabaseServicePage(webDriver);
    dashboardServicePage = new DashboardServicePage(webDriver);
    messagingServicePage = new MessagingServicePage(webDriver);
    actions = new Actions(webDriver);
    wait = new WebDriverWait(webDriver, Duration.ofSeconds(30));
    webDriver.manage().window().maximize();
    webDriver.get(url);
  }

  @Test
  @Order(1)
  public void openMessagingServicePage() throws InterruptedException {
    Events.click(webDriver, tagsPage.closeWhatsNew()); // Close What's new
    Events.click(webDriver, tagsPage.headerSettings()); // Setting
    Events.click(webDriver, databaseServicePage.headerSettingsServices()); // Setting/Services
    Events.click(webDriver, dashboardServicePage.selectServiceTab(2));
    Thread.sleep(waitTime);
  }

  @Test
  @Order(2)
  public void addMessagingService() throws InterruptedException {
    openMessagingServicePage();
    Thread.sleep(2000);
    List<WebElement> webElementList = webDriver.findElements(databaseServicePage.addServiceButton());
    if (webElementList.isEmpty()) {
      Events.click(webDriver, databaseServicePage.noServicesAddServiceButton());
    } else {
      Events.click(webDriver, databaseServicePage.addServiceButton());
    }
    Events.click(webDriver, databaseServicePage.serviceType("Kafka"));
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
    Events.sendKeys(webDriver, messagingServicePage.messagingServiceBrokerUrl(), "localhost:8080, localhost:9092");
    Events.sendKeys(webDriver, messagingServicePage.messagingServiceSchemaRegistry(), "https://localhost:8081");
    Events.click(webDriver, databaseServicePage.nextButton());
    Events.click(webDriver, databaseServicePage.saveServiceButton());
  }

  @Test
  @Order(3)
  public void checkMessagingServiceDetails() throws InterruptedException {
    openMessagingServicePage();
    Thread.sleep(2000);
    Events.click(webDriver, tagsPage.containsText(serviceName));
    Events.click(webDriver, databaseServicePage.serviceDetailsTabs("connectionConfig"));
    Events.sendKeys(webDriver, messagingServicePage.messagingServiceBrokerUrl(), "1");
    Events.sendKeys(webDriver, messagingServicePage.messagingServiceSchemaRegistry(), "1");
    Events.click(webDriver, databaseServicePage.saveConnectionConfig());
  }

  @Test
  @Order(4)
  public void checkConnectionConfigTab() throws InterruptedException {
    openMessagingServicePage();
    Thread.sleep(2000);
    Events.click(webDriver, tagsPage.containsText(serviceName));
    Events.click(webDriver, databaseServicePage.serviceDetailsTabs("connectionConfig"));
    Events.sendKeys(webDriver, messagingServicePage.messagingServiceBrokerUrl(), "1");
    Events.sendKeys(webDriver, messagingServicePage.messagingServiceSchemaRegistry(), "1");
    Events.click(webDriver, databaseServicePage.saveConnectionConfig());
  }

  @Test
  @Order(5)
  public void deleteMessagingService() throws InterruptedException {
    openMessagingServicePage();
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
