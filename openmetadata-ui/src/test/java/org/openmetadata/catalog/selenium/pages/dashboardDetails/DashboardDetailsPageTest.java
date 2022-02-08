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

package org.openmetadata.catalog.selenium.pages.dashboardDetails;

import com.github.javafaker.Faker;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.logging.Logger;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.catalog.selenium.events.Events;
import org.openmetadata.catalog.selenium.objectRepository.Common;
import org.openmetadata.catalog.selenium.objectRepository.DashboardDetails;
import org.openmetadata.catalog.selenium.objectRepository.TopicDetails;
import org.openmetadata.catalog.selenium.properties.Property;
import org.openqa.selenium.By;
import org.openqa.selenium.Keys;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;

@Order(5)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class DashboardDetailsPageTest {
  static WebDriver webDriver;
  static String url = Property.getInstance().getURL();
  Integer waitTime = Property.getInstance().getSleepTime();
  static Faker faker = new Faker();
  String dashboardName = "Misc Charts";
  Common common;
  DashboardDetails dashboardDetails;
  static String enterDescription = "//div[@data-testid='enterDescription']/div/div[2]/div/div/div/div/div/div";
  static Actions actions;
  static WebDriverWait wait;
  String webDriverInstance = Property.getInstance().getWebDriver();
  String webDriverPath = Property.getInstance().getWebDriverPath();
  private static final Logger LOG = Logger.getLogger(TopicDetails.class.getName());
  String description = "Test@1234";
  String updatedDescription = "Updated Description";

  @BeforeEach
  public void openMetadataWindow() {
    System.setProperty(webDriverInstance, webDriverPath);
    ChromeOptions options = new ChromeOptions();
    options.addArguments("--headless");
    options.addArguments("--window-size=1280,800");
    webDriver = new ChromeDriver(options);
    actions = new Actions(webDriver);
    common = new Common(webDriver);
    dashboardDetails = new DashboardDetails(webDriver);
    wait = new WebDriverWait(webDriver, Duration.ofSeconds(30));
    webDriver.manage().window().maximize();
    webDriver.get(url);
  }

  @Test
  @Order(1)
  void openExplorePage() throws InterruptedException {
    Events.click(webDriver, common.closeWhatsNew());
    Events.click(webDriver, common.explore());
    Thread.sleep(3000);
    if (webDriver.findElement(common.getTableCount()).isDisplayed()) {
      LOG.info("Passed");
    } else {
      Assert.fail();
    }
  }

  @Test
  @Order(2)
  void editDescription() throws InterruptedException {
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    openExplorePage();
    Events.click(webDriver, dashboardDetails.dashboard());
    Events.click(webDriver, common.selectTable());
    Events.click(webDriver, common.editDescriptionButton());
    Events.sendKeys(webDriver, common.editDescriptionBox(), Keys.CONTROL + "A");
    Events.sendKeys(webDriver, common.editDescriptionBox(), description);
    Events.click(webDriver, common.editDescriptionSaveButton());
    Thread.sleep(waitTime);
    webDriver.navigate().refresh();
    Events.click(webDriver, common.editDescriptionButton());
    Events.sendKeys(webDriver, common.editDescriptionBox(), Keys.CONTROL + "A");
    Events.sendKeys(webDriver, common.editDescriptionBox(), updatedDescription);
    Events.click(webDriver, common.editDescriptionSaveButton());
    webDriver.navigate().refresh();
    String checkDescription = webDriver.findElement(common.descriptionContainer()).getText();
    Assert.assertEquals(checkDescription, updatedDescription);
  }

  @Test
  @Order(4)
  public void addTags() throws InterruptedException {
    webDriver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
    openExplorePage();
    String[] selectedTag = new String[3];
    Events.click(webDriver, dashboardDetails.dashboard());
    Events.click(webDriver, common.selectTable());
    Events.click(webDriver, common.addTag());
    Events.click(webDriver, common.enterAssociatedTagName());
    for (int i = 0; i < 3; i++) {
      Events.sendKeys(webDriver, common.enterAssociatedTagName(), "P");
      Events.click(webDriver, common.tagListItem());
      selectedTag[i] = common.tagListItem().toString();
    }
    Events.click(webDriver, common.saveAssociatedTag());
    webDriver.navigate().refresh();
    List<WebElement> TagDisplayed = webDriver.findElements(common.breadCrumbTag());
    Thread.sleep(waitTime);
    for (int j = 0; j < TagDisplayed.size(); j++) {
      Assert.assertEquals(TagDisplayed.get(j).getText(), selectedTag[j]);
    }
  }

  @Test
  @Order(4)
  public void removeTag() throws InterruptedException {
    openExplorePage();
    Events.click(webDriver, By.cssSelector("[data-testid='sortBy']")); // Sort By
    Events.click(webDriver, By.cssSelector("[data-testid='list-item']")); // Last Updated
    Events.click(webDriver, By.xpath("(//button[@data-testid='table-link'])[1]"));
    Events.click(webDriver, By.cssSelector("[data-testid='tag-conatiner']"));
    Events.click(webDriver, By.cssSelector("[data-testid='remove']"));
    Events.click(webDriver, By.cssSelector("[data-testid='remove']"));
    Events.click(webDriver, By.cssSelector("[data-testid='saveAssociatedTag']"));
  }

  @Test
  @Order(5)
  public void editChartDescription() throws InterruptedException {
    openExplorePage();
    String editDescription = faker.address().toString();
    String updateDescription = faker.address().toString();
    Events.click(webDriver, By.cssSelector("[data-testid='sortBy']")); // Sort By
    Events.click(webDriver, By.cssSelector("[data-testid='list-item']")); // Last Updated
    Events.click(webDriver, By.xpath("(//button[@data-testid='table-link'])[last()]"));
    Thread.sleep(waitTime);
    actions.moveToElement(webDriver.findElement(By.xpath("//div[@data-testid='description']/button"))).perform();
    Events.click(webDriver, By.xpath("//div[@data-testid='description']/button"));
    Events.sendKeys(webDriver, By.xpath(enterDescription), editDescription);
    Events.click(webDriver, By.cssSelector("[data-testid='save']"));
    webDriver.navigate().refresh();
    Thread.sleep(2000);
    actions.moveToElement(webDriver.findElement(By.xpath("//div[@data-testid='description']/button"))).perform();
    Events.click(webDriver, By.xpath("//div[@data-testid='description']/button"));
    Thread.sleep(1000);
    webDriver.findElement(By.xpath("//*[text()[contains(.,'" + editDescription + "')]] "));
    Events.sendKeys(webDriver, By.xpath(enterDescription), updateDescription);
    Events.click(webDriver, By.cssSelector("[data-testid='save']"));
    webDriver.navigate().refresh();
    Thread.sleep(2000);
    actions.moveToElement(webDriver.findElement(By.xpath("//div[@data-testid='description']/button"))).perform();
    Events.click(webDriver, By.xpath("//div[@data-testid='description']/button"));
    Thread.sleep(1000);
    webDriver.findElement(By.xpath("//*[text()[contains(.,'" + editDescription + updateDescription + "')]] "));
    Events.click(webDriver, By.cssSelector("[data-testid='cancel']"));
  }

  @Test
  @Order(6)
  public void addChartTags() throws InterruptedException {
    openExplorePage();
    Events.sendKeys(webDriver, By.cssSelector("[data-testid='searchBox']"), dashboardName);
    Events.click(webDriver, By.cssSelector("[data-testid='data-name']"));
    Thread.sleep(waitTime);
    Events.click(webDriver, By.xpath("//table[@data-testid='schema-table']//div[@data-testid='tag-conatiner']//span"));
    Events.click(webDriver, By.cssSelector("[data-testid='associatedTagName']"));
    for (int i = 0; i <= 1; i++) {
      Events.sendKeys(webDriver, By.cssSelector("[data-testid='associatedTagName']"), "P");
      Events.click(webDriver, By.cssSelector("[data-testid='list-item']"));
    }
    Events.click(webDriver, By.cssSelector("[data-testid='saveAssociatedTag']"));
  }

  @Test
  @Order(7)
  public void removeChartTag() throws InterruptedException {
    openExplorePage();
    Events.sendKeys(webDriver, By.cssSelector("[data-testid='searchBox']"), dashboardName);
    Events.click(webDriver, By.cssSelector("[data-testid='data-name']"));
    Thread.sleep(waitTime);
    actions.moveToElement(webDriver.findElement(By.cssSelector("[data-testid='edit-tags']"))).perform();
    Events.click(webDriver, By.cssSelector("[data-testid='edit-tags']"));
    Thread.sleep(waitTime);
    Events.click(webDriver, By.cssSelector("[data-testid='remove']"));
    Thread.sleep(waitTime);
    Events.click(webDriver, By.cssSelector("[data-testid='remove']"));
    Thread.sleep(waitTime);
    Events.click(webDriver, By.cssSelector("[data-testid='saveAssociatedTag']"));
  }

  @Test
  @Order(8)
  public void checkManage() throws InterruptedException {
    openExplorePage();
    Events.click(webDriver, By.cssSelector("[data-testid='sortBy']")); // Sort By
    Events.click(webDriver, By.cssSelector("[data-testid='list-item']")); // Last Updated
    Events.click(webDriver, By.xpath("(//button[@data-testid='table-link'])[last()]"));
    Events.click(webDriver, By.xpath("(//button[@data-testid='tab'])[3]"));
    Events.click(webDriver, By.cssSelector("[data-testid='owner-dropdown']")); // Owner
    Events.sendKeys(webDriver, By.cssSelector("[data-testid='searchInputText']"), "Cloud");
    Events.click(webDriver, By.cssSelector("[data-testid='list-item']")); // Select User/Team
    Events.click(webDriver, By.cssSelector("[data-testid='card-list']")); // Select Tier
    Events.click(webDriver, By.cssSelector("[data-testid='saveManageTab']")); // Save
    webDriver.navigate().back();
    webDriver.navigate().refresh();
  }

  @Test
  @Order(9)
  public void checkBreadCrumb() throws InterruptedException {
    openExplorePage();
    String editDescription = faker.address().toString();
    String updateDescription = faker.address().toString();
    Events.sendKeys(webDriver, By.cssSelector("[data-testid='searchBox']"), dashboardName);
    Events.click(webDriver, By.cssSelector("[data-testid='data-name']"));
    Thread.sleep(waitTime);
    Events.click(webDriver, By.cssSelector("[data-testid='breadcrumb-link']"));
    Events.click(webDriver, By.cssSelector("[data-testid='edit-description']")); // edit description
    Events.sendKeys(webDriver, By.xpath(enterDescription), editDescription);
    Events.click(webDriver, By.cssSelector("[data-testid='save']"));
    webDriver.navigate().refresh();
    Events.click(webDriver, By.cssSelector("[data-testid='edit-description']"));
    Thread.sleep(1000);
    webDriver.findElement(By.xpath("//*[text()[contains(.,'" + editDescription + "')]] "));
    Events.sendKeys(webDriver, By.xpath(enterDescription), updateDescription);
    Events.click(webDriver, By.cssSelector("[data-testid='save']"));
    webDriver.navigate().refresh();
    Events.click(webDriver, By.cssSelector("[data-testid='edit-description']"));
    Thread.sleep(1000);
    webDriver.findElement(By.xpath("//*[text()[contains(.,'" + editDescription + updateDescription + "')]] "));
    Events.click(webDriver, By.cssSelector("[data-testid='cancel']"));
    for (int i = 1; i <= 3; i++) { // check topics in service
      Events.click(webDriver, By.xpath("(//tr[@data-testid='column']//td[1]/a)" + "[" + i + "]")); // dashboards
      Events.click(webDriver, By.cssSelector("[data-testid='edit-description']")); // edit description
      Events.sendKeys(webDriver, By.xpath(enterDescription), editDescription);
      Events.click(webDriver, By.cssSelector("[data-testid='save']"));
      webDriver.navigate().refresh();
      Events.click(webDriver, By.cssSelector("[data-testid='edit-description']"));
      Thread.sleep(1000);
      webDriver.findElement(By.xpath("//*[text()[contains(.,'" + editDescription + "')]] "));
      Events.sendKeys(webDriver, By.xpath(enterDescription), updateDescription);
      Events.click(webDriver, By.cssSelector("[data-testid='save']"));
      webDriver.navigate().refresh();
      Events.click(webDriver, By.cssSelector("[data-testid='edit-description']"));
      Thread.sleep(1000);
      webDriver.findElement(By.xpath("//*[text()[contains(.,'" + editDescription + updateDescription + "')]] "));
      Events.click(webDriver, By.cssSelector("[data-testid='cancel']"));
      webDriver.navigate().refresh();
      Thread.sleep(waitTime);
      webDriver.navigate().back();
    }
  }

  @Test
  @Order(10)
  public void checkVersion() throws InterruptedException {
    openExplorePage();
    Events.click(webDriver, By.xpath("(//button[@data-testid='table-link'])[last()]"));
    Events.click(webDriver, By.cssSelector("[data-testid='version-button']"));
    Events.click(webDriver, By.cssSelector("[data-testid='closeDrawer']"));
    Events.click(webDriver, By.cssSelector("[data-testid='edit-description']"));
    Events.sendKeys(webDriver, By.xpath(enterDescription), faker.address().toString());
    Events.click(webDriver, By.cssSelector("[data-testid='save']"));
    Events.click(webDriver, By.cssSelector("[data-testid='version-button']"));
    Events.click(webDriver, By.xpath("(//span[@data-testid='select-version'])[2]"));
    Events.click(webDriver, By.xpath("(//span[@data-testid='select-version'])[1]"));
    Events.click(webDriver, By.cssSelector("[data-testid='closeDrawer']"));
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
