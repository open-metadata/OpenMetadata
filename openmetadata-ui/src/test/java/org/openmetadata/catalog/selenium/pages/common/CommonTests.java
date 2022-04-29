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

import com.github.javafaker.Faker;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.catalog.selenium.events.Events;
import org.openmetadata.catalog.selenium.objectRepository.Common;
import org.openmetadata.catalog.selenium.properties.Property;
import org.openqa.selenium.*;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;

@Slf4j
@Order(17)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class CommonTests {
  static WebDriver webDriver;
  static Common common;
  static Actions actions;
  static Faker faker = new Faker();
  static String tagCategoryDisplayName = faker.name().firstName();
  static WebDriverWait wait;
  static String url = Property.getInstance().getURL();
  static String urlTag = "/api/v1/tags/";
  Integer waitTime = Property.getInstance().getSleepTime();
  String tableName = "fact_line_item";
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
    actions = new Actions(webDriver);
    wait = new WebDriverWait(webDriver, Duration.ofSeconds(30));
    webDriver.manage().window().maximize();
    webDriver.get(url);
  }

  public void pause(Integer milliseconds) {
    try {
      TimeUnit.MILLISECONDS.sleep(milliseconds);
    } catch (InterruptedException e) {
      e.printStackTrace();
    }
  }

  @Test
  @Order(1)
  void tagDuplicationCheck() throws InterruptedException {
    Events.click(webDriver, common.closeWhatsNew());
    Events.click(webDriver, common.selectOverview("tables"));
    Events.sendKeys(webDriver, common.searchBar(), "dim_location");
    Events.click(webDriver, common.searchSuggestion());
    Events.click(webDriver, common.editAssociatedTagButton());
    Events.click(webDriver, common.enterAssociatedTagName());
    Events.sendKeys(webDriver, common.enterAssociatedTagName(), "PersonalData.Personal");
    Events.click(webDriver, common.tagListItem());
    Events.sendKeys(webDriver, common.enterAssociatedTagName(), "PII.None");
    Events.click(webDriver, common.tagListItem());
    Events.click(webDriver, common.saveAssociatedTag());
    webDriver.navigate().refresh();
    pause(waitTime);
    Object tagCount = webDriver.findElements(common.containsText("#PersonalData.Personal")).size();
    Assert.assertEquals(tagCount, 1);
  }

  @Test
  @Order(2)
  void addTagWithSpaceCheck() throws InterruptedException, IOException {
    Events.click(webDriver, common.closeWhatsNew());
    Events.click(webDriver, common.headerSettings()); // Setting
    Events.click(webDriver, common.headerSettingsMenu("Tags")); // Setting/Tags
    Events.click(webDriver, common.addTagCategory());
    Events.sendKeys(webDriver, common.displayName(), tagCategoryDisplayName);
    Events.click(webDriver, common.descriptionBox());
    Events.sendKeys(webDriver, common.focusedDescriptionBox(), faker.address().toString());
    Events.click(webDriver, common.descriptionSaveButton());
    webDriver.navigate().refresh();
    Events.click(webDriver, common.containsText(tagCategoryDisplayName));
    Events.click(webDriver, common.addTagButton());
    wait.until(ExpectedConditions.elementToBeClickable(common.displayName()));
    Events.sendKeys(webDriver, common.displayName(), "Testing Tag");
    Events.click(webDriver, common.descriptionBox());
    Events.sendKeys(webDriver, common.focusedDescriptionBox(), faker.address().toString());
    Events.click(webDriver, common.descriptionSaveButton());
    URL tagUrl = new URL(url + urlTag + tagCategoryDisplayName + "/");
    HttpURLConnection http = (HttpURLConnection) tagUrl.openConnection();
    http.setRequestMethod("HEAD");
    http.connect();
    Assert.assertEquals(http.getResponseCode(), 200);
  }

  @Test
  @Order(3)
  void addTagCategoryWithSpaceCheck() throws InterruptedException, IOException {
    Events.click(webDriver, common.closeWhatsNew());
    Events.click(webDriver, common.headerSettings()); // Setting
    Events.click(webDriver, common.headerSettingsMenu("Tags")); // Setting/Tags
    Events.click(webDriver, common.addTagCategory());
    Events.sendKeys(webDriver, common.displayName(), "Space Tag");
    Events.click(webDriver, common.descriptionBox());
    Events.sendKeys(webDriver, common.focusedDescriptionBox(), faker.address().toString());
    Events.click(webDriver, common.descriptionSaveButton());
    webDriver.navigate().refresh();
    pause(waitTime);
    URL tagUrl = new URL(url + urlTag);
    HttpURLConnection http = (HttpURLConnection) tagUrl.openConnection();
    http.setRequestMethod("HEAD");
    http.connect();
    Assert.assertEquals(http.getResponseCode(), 200);
  }

  @Test
  @Order(4)
  void onlySpaceAsNameForServiceCheck() throws InterruptedException {
    Events.click(webDriver, common.closeWhatsNew());
    Events.click(webDriver, common.selectOverview("service"));
    List<WebElement> webElementList = webDriver.findElements(common.noServicesAddServiceButton());
    if (webElementList.isEmpty()) {
      Events.click(webDriver, common.addServiceButton());
    } else {
      Events.click(webDriver, common.noServicesAddServiceButton());
    }
    Events.click(webDriver, common.serviceType("Mysql"));
    Events.click(webDriver, common.nextButton());
    Events.sendKeys(webDriver, common.serviceName(), " ");
    Events.click(webDriver, common.descriptionBoldButton());
    Events.sendKeys(webDriver, common.focusedDescriptionBox(), faker.address().toString());
    Events.click(webDriver, common.nextButton());
    wait.until(ExpectedConditions.presenceOfElementLocated(common.containsText("Service name is required.")));
    WebElement emptyName = webDriver.findElement(common.containsText("Service name is required."));
    if (!emptyName.isDisplayed()) {
      Assert.fail("Excepting space as name");
    }
  }

  // DO NOT DELETE THIS TEST
  /*@Test
  @Order(5)
  public void addMultipleTagsCheck() throws InterruptedException {
    openHomePage();
    Events.sendKeys(webDriver, common.searchBar(), "raw_product_catalog");
    Events.click(webDriver, common.selectSuggestionSearch("bigquery_gcpshopifyraw_product_catalog"));
    Events.click(webDriver, common.editAssociatedTagButton());
    Events.click(webDriver, common.enterAssociatedTagName());
    for (int i = 0; i <= 10; i++) {
      Events.sendKeys(webDriver, common.enterAssociatedTagName(), "P");
      Events.click(webDriver, common.tagListItem());

    }
    Events.click(webDriver, common.saveAssociatedTag());
    webDriver.navigate().refresh();
    Thread.sleep(2000);
    Object tagCount = webDriver.findElements(common.tagCount()).size();
    Assert.assertEquals(tagCount, 11);
  }*/

  @Test
  @Order(6)
  void sameNameTagCategoryUIMessageCheck() throws InterruptedException {
    Events.click(webDriver, common.closeWhatsNew());
    Events.click(webDriver, common.headerSettings());
    Events.click(webDriver, common.headerSettingsMenu("Tags"));
    Events.click(webDriver, common.addTagCategory());
    wait.until(ExpectedConditions.elementToBeClickable(common.displayName()));
    Events.sendKeys(webDriver, common.displayName(), "personalData");
    Events.click(webDriver, common.descriptionBox());
    Events.sendKeys(webDriver, common.focusedDescriptionBox(), faker.address().toString());
    Events.click(webDriver, common.descriptionSaveButton());
    String errorMessage = webDriver.findElement(common.errorMessage()).getAttribute("innerHTML");
    Assert.assertEquals(errorMessage, "Name already exists");
  }

  @Test
  @Order(7)
  void sameNameTagUIMessageCheck() throws InterruptedException {
    Events.click(webDriver, common.closeWhatsNew());
    Events.click(webDriver, common.headerSettings());
    Events.click(webDriver, common.headerSettingsMenu("Tags"));
    Events.click(webDriver, common.containsText("PersonalData"));
    Events.click(webDriver, common.addTagButton());
    wait.until(ExpectedConditions.elementToBeClickable(common.displayName()));
    Events.sendKeys(webDriver, common.displayName(), "personal");
    Events.click(webDriver, common.descriptionBox());
    Events.sendKeys(webDriver, common.focusedDescriptionBox(), faker.address().toString());
    Events.click(webDriver, common.descriptionSaveButton());
    String errorMessage = webDriver.findElement(common.errorMessage()).getAttribute("innerHTML");
    Assert.assertEquals(errorMessage, "Name already exists");
  }

  @Test
  @Order(8)
  void shortTagCategoryNameUIMessageCheck() throws InterruptedException {
    Events.click(webDriver, common.closeWhatsNew());
    Events.click(webDriver, common.headerSettings());
    Events.click(webDriver, common.headerSettingsMenu("Tags"));
    Events.click(webDriver, common.addTagCategory());
    wait.until(ExpectedConditions.elementToBeClickable(common.displayName()));
    Events.sendKeys(webDriver, common.displayName(), "P");
    Events.click(webDriver, common.descriptionBox());
    Events.sendKeys(webDriver, common.focusedDescriptionBox(), faker.address().toString());
    Events.click(webDriver, common.descriptionSaveButton());
    String errorMessage = webDriver.findElement(common.errorMessage()).getAttribute("innerHTML");
    Assert.assertEquals(errorMessage, "Name size must be between 2 and 25");
  }

  @Test
  @Order(9)
  void longTagCategoryNameUIMessageCheck() throws InterruptedException {
    Events.click(webDriver, common.closeWhatsNew());
    Events.click(webDriver, common.headerSettings());
    Events.click(webDriver, common.headerSettingsMenu("Tags"));
    Events.click(webDriver, common.addTagCategory());
    wait.until(ExpectedConditions.elementToBeClickable(common.displayName()));
    Events.sendKeys(webDriver, common.displayName(), "PersonalData-DataPlatform-PersonalData");
    Events.click(webDriver, common.descriptionBox());
    Events.sendKeys(webDriver, common.focusedDescriptionBox(), faker.address().toString());
    Events.click(webDriver, common.descriptionSaveButton());
    String errorMessage = webDriver.findElement(common.errorMessage()).getAttribute("innerHTML");
    Assert.assertEquals(errorMessage, "Name size must be between 2 and 25");
  }

  @Test
  @Order(10)
  void shortTagNameUIMessageCheck() throws InterruptedException {
    Events.click(webDriver, common.closeWhatsNew());
    Events.click(webDriver, common.headerSettings());
    Events.click(webDriver, common.headerSettingsMenu("Tags"));
    Events.click(webDriver, common.containsText("PersonalData"));
    Events.click(webDriver, common.addTagButton());
    wait.until(ExpectedConditions.elementToBeClickable(common.displayName()));
    Events.sendKeys(webDriver, common.displayName(), "P");
    Events.click(webDriver, common.descriptionBox());
    Events.sendKeys(webDriver, common.focusedDescriptionBox(), faker.address().toString());
    Events.click(webDriver, common.descriptionSaveButton());
    String errorMessage = webDriver.findElement(common.errorMessage()).getAttribute("innerHTML");
    Assert.assertEquals(errorMessage, "Name size must be between 2 and 25");
  }

  @Test
  @Order(11)
  void longTagNameUIMessageCheck() throws InterruptedException {
    Events.click(webDriver, common.closeWhatsNew());
    Events.click(webDriver, common.headerSettings());
    Events.click(webDriver, common.headerSettingsMenu("Tags"));
    Events.click(webDriver, common.containsText("PersonalData"));
    Events.click(webDriver, common.addTagButton());
    wait.until(ExpectedConditions.elementToBeClickable(common.displayName()));
    Events.sendKeys(webDriver, common.displayName(), "PersonalData-DataPlatform-PersonalData");
    Events.click(webDriver, common.descriptionBox());
    Events.sendKeys(webDriver, common.focusedDescriptionBox(), faker.address().toString());
    Events.click(webDriver, common.descriptionSaveButton());
    String errorMessage = webDriver.findElement(common.errorMessage()).getAttribute("innerHTML");
    Assert.assertEquals(errorMessage, "Name size must be between 2 and 25");
  }

  @Test
  @Order(12)
  void searchMatchesCountCheck() throws InterruptedException {
    Events.click(webDriver, common.closeWhatsNew());
    Events.sendKeys(webDriver, common.searchBar(), "address"); // Search bar/dim
    Events.sendEnter(webDriver, common.searchBar());
    pause(waitTime);
    Object tagCount = webDriver.findElements(common.tagCountSearch()).size();
    String matchesInDescription = webDriver.findElement(common.matchesInDescription()).getAttribute("innerHTML");
    Assert.assertEquals((tagCount + " in Description,"), matchesInDescription);
  }

  @Test
  @Order(13)
  void overviewLinksAfterTour() throws InterruptedException {
    Events.click(webDriver, common.closeWhatsNew());
    Events.click(webDriver, common.selectOverview("tour"));
    webDriver.navigate().back();
    Events.click(webDriver, common.selectOverview("tables"));
    pause(waitTime);
    String tablesUrl = webDriver.getCurrentUrl();
    Assert.assertEquals(tablesUrl, url + "/explore/tables/");
  }

  @Test
  @Order(14)
  void tourStepSkippingCheck() throws InterruptedException {
    Events.click(webDriver, common.closeWhatsNew());
    Events.click(webDriver, common.selectOverview("tour"));
    for (int i = 0; i < 2; i++) {
      pause(waitTime);
      Events.click(webDriver, common.tourNavigationArrow("right-arrow"));
    }
    Events.sendKeys(webDriver, common.searchBar(), "dim_a"); // Search bar/dim
    Events.sendEnter(webDriver, common.searchBar()); // Search bar/dim
  }

  @Test
  @Order(15)
  void tagFilterCountCheck() throws InterruptedException {
    int count = 0;
    Events.click(webDriver, common.closeWhatsNew());
    Events.sendKeys(webDriver, common.searchBar(), tableName);
    Events.click(webDriver, common.searchSuggestion());
    Events.click(webDriver, common.editAssociatedTagButton());
    Events.click(webDriver, common.enterAssociatedTagName());
    for (int i = 0; i <= 2; i++) {
      Events.sendKeys(webDriver, common.enterAssociatedTagName(), "P");
      Events.click(webDriver, common.tagListItem());
      count = count + 1;
    }
    Events.click(webDriver, common.saveAssociatedTag());
    try {
      Events.click(webDriver, common.editAssociatedTagButton());
    } catch (StaleElementReferenceException e) {
      webDriver.findElement(common.editAssociatedTagButton()).click();
    }

    Events.click(webDriver, common.enterAssociatedTagName());
    for (int i = 0; i < 2; i++) {
      Events.sendKeys(webDriver, common.enterAssociatedTagName(), "P");
      Events.click(webDriver, common.tagListItem());
      count = count + 1;
    }
    Events.click(webDriver, common.saveAssociatedTag());
    Events.click(webDriver, common.editAssociatedTagButton());
    Events.click(webDriver, common.explore());

    try {
      Events.click(webDriver, common.viewMore());
      pause(waitTime);
      Object tagsFilterCount = webDriver.findElements(common.tagFilterCount()).size();
      Assert.assertEquals(Integer.parseInt(tagsFilterCount.toString()), count);
    } catch (NoSuchElementException | TimeoutException e) {
      pause(waitTime);
      Object tagsFilterCount = webDriver.findElements(common.tagFilterCount()).size();
      Assert.assertEquals(Integer.parseInt(tagsFilterCount.toString()), count);
    }
  }

  @Test
  @Order(16)
  void differentSearchDifferentResultCheck() throws InterruptedException {
    Events.click(webDriver, common.closeWhatsNew());
    Events.sendKeys(webDriver, common.searchBar(), "!");
    Events.sendEnter(webDriver, common.searchBar());
    pause(waitTime);
    String search1 = webDriver.findElement(common.noSearchResult()).getText();
    Assert.assertEquals(search1, "No matching data assets found for !");
    webDriver.navigate().back();
    Events.sendKeys(webDriver, common.searchBar(), "{");
    Events.sendEnter(webDriver, common.searchBar());
    pause(waitTime);
    try {
      String search2 = webDriver.findElement(common.noSearchResult()).getText();
      Assert.assertEquals(search2, "No matching data assets found for {");
    } catch (NoSuchElementException exception) {
      LOG.info("Search results are not similar for no data found!");
    }
  }

  @Test
  @Order(17)
  void missingMatchesForSearchCheck() throws InterruptedException {
    Events.click(webDriver, common.closeWhatsNew());
    Events.click(webDriver, common.selectOverview("dashboards"));
    Events.sendKeys(webDriver, common.searchBar(), "sales");
    Events.sendEnter(webDriver, common.searchBar());
    pause(waitTime);
    String resultsCount = webDriver.findElement(common.resultsCount()).getAttribute("innerHTML");
    Object matchesCount = webDriver.findElements(common.matchesStats()).size();
    Assert.assertEquals(matchesCount + " results", resultsCount);
  }

  @Test
  @Order(18)
  void searchNotShowingResultsCheck() throws InterruptedException {
    Events.click(webDriver, common.closeWhatsNew());
    Events.click(webDriver, common.selectOverview("pipelines"));
    Events.sendKeys(webDriver, common.searchBar(), "sample");
    Events.sendEnter(webDriver, common.searchBar());
    try {
      WebElement searchResult = wait.until(ExpectedConditions.presenceOfElementLocated(common.searchResults()));
      if (searchResult.isDisplayed()) {
        LOG.info("Success");
      }
    } catch (TimeoutException exception) {
      Assert.fail("No search results found");
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
