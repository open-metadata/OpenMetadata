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

package org.openmetadata.catalog.selenium.pages.teams;

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
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;

@Order(2)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class TeamsPageTest {

  static WebDriver webDriver;
  static String URL = Property.getInstance().getURL();
  Integer waitTime = Property.getInstance().getSleepTime();
  static Faker faker = new Faker();
  static String enterDescription = "//div[@data-testid='enterDescription']/div/div[2]/div/div/div/div/div/div";
  static String teamDisplayName = faker.name().lastName();
  static Actions actions;
  static WebDriverWait wait;
  String teamsFilterCountXpath = "//div[@data-testid='terms-summary']//span[@data-testid='filter-count']";
  String webDriverInstance = Property.getInstance().getWebDriver();
  String webDriverPath = Property.getInstance().getWebDriverPath();

  @BeforeEach
  public void openMetadataWindow() {
    System.setProperty(webDriverInstance, webDriverPath);
    ChromeOptions options = new ChromeOptions();
    options.addArguments("--no-sandbox");
    options.addArguments("--disable-dev-shm-usage");
    options.addArguments("--headless");
    webDriver = new ChromeDriver(options);
    actions = new Actions(webDriver);
    wait = new WebDriverWait(webDriver, Duration.ofSeconds(30));
    webDriver.manage().window().maximize();
    webDriver.get(URL);
  }

  @Test
  @Order(1)
  public void openTeamsPage() throws InterruptedException {
    Events.click(webDriver, By.cssSelector("[data-testid='closeWhatsNew']")); // Close What's new
    Events.click(webDriver, By.cssSelector("[data-testid='menu-button'][id='menu-button-Settings']")); // Setting
    Events.click(webDriver, By.cssSelector("[data-testid='menu-item-Teams']")); // Setting/Teams
    Thread.sleep(waitTime);
  }

  @Test
  @Order(2)
  public void createTeam() throws InterruptedException {
    openTeamsPage();
    Events.click(webDriver, By.cssSelector("[data-testid='add-teams']")); // add team
    Events.sendKeys(webDriver, By.name("name"), faker.name().firstName()); // name
    Events.sendKeys(webDriver, By.name("displayName"), teamDisplayName); // displayname
    Events.sendKeys(webDriver, By.xpath(enterDescription), faker.address().toString());
    Events.click(webDriver, By.cssSelector("[data-testid='boldButton']"));
    Events.click(webDriver, By.cssSelector("[data-testid='italicButton']"));
    Events.click(webDriver, By.cssSelector("[data-testid='linkButton']"));
    Events.click(webDriver, By.cssSelector("[data-testid='saveButton']"));
  }

  @Test
  @Order(3)
  public void addUser() throws InterruptedException {
    openTeamsPage();
    Events.click(webDriver, By.xpath("//*[text()[contains(.,'" + teamDisplayName + "')]] "));
    // Select the created listed team
    for (int i = 0; i <= 10; i++) {
      Events.click(webDriver, By.cssSelector("[data-testid='add-new-user-button']")); // select add user button
      Events.click(webDriver, By.cssSelector("[data-testid='checkboxAddUser']"));
      Events.click(webDriver, By.cssSelector("[data-testid='AddUserSave']"));
      Thread.sleep(waitTime);
    }
  }

  @Test
  @Order(4)
  public void editDescription() throws InterruptedException {
    openTeamsPage();
    Events.click(webDriver, By.xpath("//*[text()[contains(.,'" + teamDisplayName + "')]] "));
    // Select the created listed team
    Events.click(webDriver, By.cssSelector("[data-testid='edit-description']"));
    wait.until(ExpectedConditions.elementToBeClickable(By.xpath(enterDescription)));
    Events.sendKeys(webDriver, By.xpath(enterDescription), faker.address().toString() + "[google](www.google.com)");
    Events.click(webDriver, By.cssSelector("[data-testid='save']"));
    Events.click(webDriver, By.xpath("//div[@data-testid='description']//a"));
    Thread.sleep(2000);
    String currentUrl = webDriver.getCurrentUrl();
    Assert.assertEquals(currentUrl, "https://www.google.com/?gws_rd=ssl");
  }

  @Test
  @Order(5)
  public void addAsset() throws InterruptedException {
    openTeamsPage();
    Events.click(webDriver, By.xpath("//*[text()[contains(.,'" + teamDisplayName + "')]] "));
    // Select the created listed team
    Events.click(webDriver, By.cssSelector("[data-testid='assets']")); // Assets
    Events.click(webDriver, By.cssSelector("[data-testid='appbar-item'][id='explore']")); // Explore
    Events.click(webDriver, By.cssSelector("[data-testid='sortBy']")); // Sort By
    Events.click(webDriver, By.cssSelector("[data-testid='list-item']")); // Last Updated // Last Updated
    Events.click(webDriver, By.xpath("(//button[@data-testid='table-link'])[last()]"));
    Events.click(webDriver, By.xpath("(//button[@data-testid='tab'])[5]")); // Manage
    Events.click(webDriver, By.cssSelector("[data-testid='owner-dropdown']")); // Owner
    Events.sendKeys(webDriver, By.cssSelector("[data-testid='searchInputText']"), teamDisplayName);
    Events.click(webDriver, By.cssSelector("[data-testid='list-item']")); // Select User/Team
    Events.click(webDriver, By.cssSelector("[data-testid='saveManageTab']")); // Save
    Events.click(webDriver, By.cssSelector("[data-testid='menu-button'][id='menu-button-Settings']")); // Setting
    Events.click(webDriver, By.cssSelector("[data-testid='menu-item-Teams']")); // Setting/Teams
    Events.click(webDriver, By.xpath("//*[text()[contains(.,'" + teamDisplayName + "')]] "));
    // Select the created listed team
    Thread.sleep(waitTime);
    Events.click(webDriver, By.cssSelector("[data-testid='assets']"));
    Events.click(webDriver, By.cssSelector("[data-testid='user-card-container']"));
  }

  @Test
  @Order(6)
  public void ownerNameIsConsistentCheck() throws InterruptedException {
    openTeamsPage();
    Events.click(webDriver, By.xpath("//*[text()[contains(.,'" + teamDisplayName + "')]] "));
    Thread.sleep(waitTime);
    Events.click(webDriver, By.cssSelector("[data-testid='assets']"));
    Events.click(webDriver, By.cssSelector("[data-testid='user-card-container']"));
    Thread.sleep(2000);
    String ownerName = webDriver.findElement(By.xpath("//a[@data-testid='owner-link']/span")).getAttribute("innerHTML");
    Events.click(webDriver, By.xpath("(//li[@data-testid='breadcrumb-link'][2])/a"));
    Thread.sleep(2000);
    WebElement displayName = webDriver.findElement(By.xpath("//*[text()[contains(.,'" + teamDisplayName + "')]] "));
    if (displayName.isDisplayed()) {
      Assert.assertEquals(ownerName, teamDisplayName);
    } else {
      Events.click(webDriver, By.cssSelector("[data-testid='next']"));
      Assert.assertEquals(ownerName, teamDisplayName);
    }
  }

  @Test
  @Order(7)
  public void checkTeamsFilterCount() throws InterruptedException {
    openTeamsPage();
    for (int i = 0; i < 5; i++) {
      Events.click(webDriver, By.cssSelector("[data-testid='add-teams']")); // add team
      Events.sendKeys(webDriver, By.name("name"), faker.name().firstName()); // name
      Events.sendKeys(webDriver, By.name("displayName"), faker.name().lastName()); // displayname
      Events.sendKeys(webDriver, By.xpath(enterDescription), faker.address().toString());
      Events.click(webDriver, By.cssSelector("[data-testid='boldButton']"));
      Events.click(webDriver, By.cssSelector("[data-testid='italicButton']"));
      Events.click(webDriver, By.cssSelector("[data-testid='linkButton']"));
      Events.click(webDriver, By.cssSelector("[data-testid='saveButton']"));
    }
    Thread.sleep(2000);
    Object teamsListCount = webDriver.findElements(By.xpath("//div[@id='left-panel']//div")).size() - 1;
    Thread.sleep(2000);
    webDriver.navigate().back();
    Thread.sleep(2000);
    String teamsFilterCount = webDriver.findElement(By.xpath(teamsFilterCountXpath)).getAttribute("innerHTML");
    Events.click(webDriver, By.cssSelector("[data-testid='tables']")); // Tables
    Events.click(webDriver, By.xpath("(//button[@data-testid='table-link'])[last()]"));
    Events.click(webDriver, By.xpath("(//button[@data-testid='tab'])[5]")); // Manage
    Events.click(webDriver, By.cssSelector("[data-testid='owner-dropdown']")); // Owner
    Thread.sleep(2000);
    String teamsCount =
        webDriver
            .findElement(By.xpath("//button[@data-testid='tab']/span/span[@data-testid='filter-count']"))
            .getAttribute("innerHTML");
    Assert.assertEquals(teamsFilterCount, teamsListCount.toString());
    Assert.assertEquals(teamsCount, teamsFilterCount);
  }

  @Test
  @Order(7)
  public void ownerDropDownListTeamsCount() throws InterruptedException {
    Events.click(webDriver, By.cssSelector("[data-testid='closeWhatsNew']")); // Close What's new
    Events.click(webDriver, By.cssSelector("[data-testid='tables']")); // Tables
    Events.click(webDriver, By.xpath("(//button[@data-testid='table-link'])[last()]"));
    Events.click(webDriver, By.xpath("(//button[@data-testid='tab'])[5]")); // Manage
    Events.click(webDriver, By.cssSelector("[data-testid='owner-dropdown']")); // Owner
    Thread.sleep(2000);
    String teamsCount =
        webDriver
            .findElement(By.xpath("//button[@data-testid='tab']/span/span[@data-testid='filter-count']"))
            .getAttribute("innerHTML");
    webDriver.navigate().back();
    Events.click(webDriver, By.cssSelector("[data-testid='image']")); // home-page
    Thread.sleep(2000);
    String teamsFilterCount = webDriver.findElement(By.xpath(teamsFilterCountXpath)).getAttribute("innerHTML");
    Assert.assertEquals(teamsCount, teamsFilterCount);
  }

  @Test
  @Order(8)
  public void teamsWithSameDisplayNameCheck() throws Exception {
    for (int i = 0; i < 2; i++) {
      createTeam();
      webDriver.navigate().back();
      Events.click(webDriver, By.cssSelector("[data-testid='whatsnew-modal']")); // What's New
    }
    Events.click(webDriver, By.cssSelector("[data-testid='closeWhatsNew']")); // Close What's new
    Events.click(webDriver, By.cssSelector("[data-testid='menu-button'][id='menu-button-Settings']")); // Setting
    Events.click(webDriver, By.cssSelector("[data-testid='menu-item-Teams']")); // Setting/Teams
    Thread.sleep(2000);
    int teamsCount = webDriver.findElements(By.xpath("//*[text()[contains(.,'" + teamDisplayName + "')]] ")).size();
    if (teamsCount > 1) {
      throw new Exception("Two Team with same display-name exists");
    } else {
      Assert.assertEquals(teamsCount, 1);
    }
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
