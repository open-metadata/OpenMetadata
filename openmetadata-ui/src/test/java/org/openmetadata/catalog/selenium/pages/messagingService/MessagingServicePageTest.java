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
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.catalog.selenium.events.Events;
import org.openmetadata.catalog.selenium.objectRepository.Common;
import org.openmetadata.catalog.selenium.objectRepository.MessagingServicePage;
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
@Order(11)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class MessagingServicePageTest {
  static WebDriver webDriver;
  static Common common;
  static MessagingServicePage messagingServicePage;
  static String url = Property.getInstance().getURL();
  static Faker faker = new Faker();
  static String serviceName = faker.name().firstName();
  static Actions actions;
  static WebDriverWait wait;
  Integer waitTime = Property.getInstance().getSleepTime();
  String webDriverInstance = Property.getInstance().getWebDriver();
  String webDriverPath = Property.getInstance().getWebDriverPath();

  @BeforeEach
  void openMetadataWindow() {
    System.setProperty(webDriverInstance, webDriverPath);
    ChromeOptions options = new ChromeOptions();
    options.addArguments("--headless");
    options.addArguments("--window-size=1280,800");
    webDriver = new ChromeDriver(options);
    common = new Common(webDriver);
    messagingServicePage = new MessagingServicePage(webDriver);
    actions = new Actions(webDriver);
    wait = new WebDriverWait(webDriver, Duration.ofSeconds(30));
    webDriver.manage().window().maximize();
    webDriver.get(url);
  }

  @Test
  @Order(1)
  void openMessagingServicePage() {
    Events.click(webDriver, common.closeWhatsNew()); // Close What's new
    Events.click(webDriver, common.headerSettings()); // Setting
    Events.click(webDriver, common.headerSettingsServices()); // Setting/Services
    Events.click(webDriver, common.selectServiceTab(2));
  }

  @Test
  @Order(2)
  void addMessagingService() {
    openMessagingServicePage();
    List<WebElement> webElementList = webDriver.findElements(common.addServiceButton());
    if (webElementList.isEmpty()) {
      Events.click(webDriver, common.noServicesAddServiceButton());
    } else {
      Events.click(webDriver, common.addServiceButton());
    }
    Events.click(webDriver, common.serviceType("Kafka"));
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
    Events.sendKeys(webDriver, common.linkText(), faker.name().firstName());
    Events.click(webDriver, common.okButton());
    Events.click(webDriver, common.nextButton());
    Events.sendKeys(
        webDriver, messagingServicePage.messagingServiceBootstrapServers(), "localhost:8080, localhost:9092");
    Events.sendKeys(webDriver, messagingServicePage.messagingServiceSchemaRegistry(), "https://localhost:8081");
    Events.click(webDriver, common.saveServiceButton());
    Events.click(webDriver, common.addIngestion());
    Events.click(webDriver, common.nextButton());
    Events.click(webDriver, common.deployButton());
    Events.click(webDriver, common.headerSettings());
    Events.click(webDriver, common.headerSettingsMenu("Services"));
    Events.click(webDriver, common.selectServiceTab(2));
    try {
      if (webDriver.getPageSource().contains(serviceName)) {
        LOG.info("Success");
      }
    } catch (NoSuchElementException | TimeoutException r) {
      Assert.fail("Service not added");
    }
  }

  @Test
  @Order(4)
  void checkConnectionConfigTab() {
    openMessagingServicePage();
    Events.click(webDriver, common.containsText(serviceName));
    Events.click(webDriver, common.connectionConfig());
    Events.sendKeys(webDriver, messagingServicePage.messagingServiceBootstrapServers(), "test");
    Events.sendKeys(webDriver, messagingServicePage.messagingServiceSchemaRegistry(), "test");
    Events.click(webDriver, common.saveServiceButton());
  }

  @Test
  @Order(5)
  void deleteMessagingService() {
    openMessagingServicePage();
    Events.click(webDriver, common.containsText(serviceName));
    Events.click(webDriver, common.manage());
    Events.click(webDriver, messagingServicePage.deleteMessagingService());
    Events.sendKeys(webDriver, messagingServicePage.confirmationDeleteText(), "DELETE");
    Events.click(webDriver, common.confirmButton());
    wait.until(ExpectedConditions.urlMatches("http://localhost:8585/my-data"));
    Events.click(webDriver, common.headerSettings()); // Setting
    Events.click(webDriver, common.headerSettingsServices());
    Events.click(webDriver, common.selectServiceTab(2));
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
