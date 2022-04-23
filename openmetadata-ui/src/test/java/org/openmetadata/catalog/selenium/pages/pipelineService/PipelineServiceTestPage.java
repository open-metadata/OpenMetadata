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

package org.openmetadata.catalog.selenium.pages.pipelineService;

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
import org.openmetadata.catalog.selenium.objectRepository.PipelineServicePage;
import org.openmetadata.catalog.selenium.properties.Property;
import org.openqa.selenium.NoSuchElementException;
import org.openqa.selenium.TimeoutException;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;

@Slf4j
@Order(10)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class PipelineServiceTestPage {
  static WebDriver webDriver;
  static Common common;
  static PipelineServicePage pipelineServicePage;
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
    pipelineServicePage = new PipelineServicePage(webDriver);
    actions = new Actions(webDriver);
    wait = new WebDriverWait(webDriver, Duration.ofSeconds(30));
    webDriver.manage().window().maximize();
    webDriver.get(url);
  }

  @Test
  @Order(1)
  void openPipelineServicePage() throws InterruptedException {
    Events.click(webDriver, common.closeWhatsNew()); // Close What's new
    Events.click(webDriver, common.headerSettings()); // Setting
    Events.click(webDriver, common.headerSettingsServices()); // Setting/Services
    Events.click(webDriver, common.selectServiceTab(4));
    Thread.sleep(waitTime);
  }

  @Test
  @Order(2)
  void addPipelineService() throws InterruptedException {
    openPipelineServicePage();
    Thread.sleep(waitTime);
    List<WebElement> webElementList = webDriver.findElements(common.addServiceButton());
    if (webElementList.isEmpty()) {
      Events.click(webDriver, common.noServicesAddServiceButton());
    } else {
      Events.click(webDriver, common.addServiceButton());
    }
    Events.click(webDriver, common.serviceType("Prefect"));
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
    Events.click(webDriver, common.nextButton());
    Events.sendKeys(webDriver, pipelineServicePage.pipelineServiceUrl(), "localhost:8080");
    Events.click(webDriver, common.saveServiceButton());
    Thread.sleep(waitTime);
    Events.click(webDriver, common.headerSettings());
    Events.click(webDriver, common.headerSettingsMenu("Services"));
    Events.click(webDriver, common.selectServiceTab(4));
    Thread.sleep(waitTime);
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
  void checkPipelineServiceDetails() throws InterruptedException {
    openPipelineServicePage();
    Events.click(webDriver, common.containsText(serviceName));
    Events.click(webDriver, common.editTagCategoryDescription());
    Events.click(webDriver, common.focusedDescriptionBox());
    Events.sendKeys(webDriver, common.focusedDescriptionBox(), faker.address().toString());
    Events.click(webDriver, common.editDescriptionSaveButton());
  }

  @Test
  @Order(4)
  void checkConnectionConfig() throws InterruptedException {
    openPipelineServicePage();
    Events.click(webDriver, common.containsText(serviceName));
    Events.click(webDriver, common.connectionConfig());
    Events.sendKeys(webDriver, pipelineServicePage.pipelineServiceUrl(), "test");
    Events.click(webDriver, common.saveServiceButton());
  }

  @Test
  @Order(5)
  void deletePipelineService() throws InterruptedException {
    openPipelineServicePage();
    Events.click(webDriver, common.deleteServiceButton(serviceName));
    Events.click(webDriver, common.saveEditedService());
    Thread.sleep(waitTime);
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
