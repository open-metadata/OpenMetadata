/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.catalog.selenium.pages.tableDetails;

import com.github.javafaker.Faker;
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
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.MethodOrderer;

import java.time.Duration;
import java.util.ArrayList;

@Order(4)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class TableDetailsPageTest {
  static WebDriver webDriver;
  static String url = Property.getInstance().getURL();
  static Faker faker = new Faker();
  static String enterDescription = "//div[@data-testid='enterDescription']/div/div[2]/div/div/div/div/div/div";
  static Actions actions;
  static WebDriverWait wait;
  Integer waitTime = Property.getInstance().getSleepTime();
  String tableName = "dim_address";

  @BeforeEach
  public void openMetadataWindow() {
    System.setProperty("webdriver.chrome.driver", "src/test/resources/drivers/linux/chromedriver");
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
  public void openExplorePage() throws InterruptedException {
    Events.click(webDriver, By.cssSelector("[data-testid='closeWhatsNew']")); // Close What's new
    Events.click(webDriver, By.cssSelector("[data-testid='appbar-item'][id='explore']")); // Explore
    Thread.sleep(waitTime);
  }

  @Test
  @Order(2)
  public void checkTabs() throws InterruptedException {
    openExplorePage();
    Events.sendKeys(webDriver, By.cssSelector("[data-testid='searchBox']"), tableName);
    Events.click(webDriver, By.cssSelector("[data-testid='data-name']"));
    Events.click(webDriver, By.xpath("(//button[@data-testid='tab'])[2]")); // Profiler
    Events.click(webDriver, By.xpath("(//button[@data-testid='tab'])[3]")); // Lineage
    Events.click(webDriver, By.xpath("(//button[@data-testid='tab'])[4]")); // Manage
  }

  @Test
  @Order(3)
  public void editDescription() throws InterruptedException {
    openExplorePage();
    Events.sendKeys(webDriver, By.cssSelector("[data-testid='searchBox']"), tableName);
    Events.click(webDriver, By.cssSelector("[data-testid='data-name']"));
    Events.click(webDriver, By.cssSelector("[data-testid='edit-description']"));
    Events.sendKeys(webDriver, By.xpath(enterDescription), faker.address().toString());
    Events.click(webDriver, By.cssSelector("[data-testid='save']"));
  }

  @Test
  @Order(4)
  public void searchColumnAndEditDescription() throws InterruptedException {
    openExplorePage();
    Events.sendKeys(webDriver, By.cssSelector("[data-testid='searchBox']"), tableName);
    Events.click(webDriver, By.cssSelector("[data-testid='data-name']"));
    wait.until(ExpectedConditions.elementToBeClickable(By.cssSelector("[data-testid='searchbar']")));
    Events.sendKeys(webDriver, By.cssSelector("[data-testid='searchbar']"), "address1");
    Thread.sleep(2000);
    actions.moveToElement(webDriver.findElement(By.xpath("//div[@data-testid='description']//button"))).perform();
    Events.click(webDriver, By.xpath("//div[@data-testid='description']//button"));
    Events.sendKeys(webDriver, By.xpath(enterDescription), faker.address().toString());
    Events.click(webDriver, By.cssSelector("[data-testid='save']"));
  }

  @Test
  @Order(5)
  public void addTagsToColumn() throws InterruptedException {
    openExplorePage();
    Events.sendKeys(webDriver, By.cssSelector("[data-testid='searchBox']"), tableName);
    Events.click(webDriver, By.cssSelector("[data-testid='data-name']"));
    Thread.sleep(waitTime);
    actions.moveToElement(webDriver.findElement(By.xpath("//div[@data-testid='tag-conatiner']//span"))).perform();
    Events.click(webDriver, By.xpath("//div[@data-testid='tag-conatiner']//span"));
    Events.click(webDriver, By.cssSelector("[data-testid='associatedTagName']"));
    for (int i = 0; i <= 1; i++) {
      Events.sendKeys(webDriver, By.cssSelector("[data-testid='associatedTagName']"), "P");
      Events.click(webDriver, By.cssSelector("[data-testid='list-item']"));
    }
    Events.click(webDriver, By.cssSelector("[data-testid='saveAssociatedTag']"));
  }

  @Test
  @Order(6)
  public void removeTagsFromColumn() throws InterruptedException {
    openExplorePage();
    Events.sendKeys(webDriver, By.cssSelector("[data-testid='searchBox']"), tableName);
    Events.click(webDriver, By.cssSelector("[data-testid='data-name']"));
    Thread.sleep(waitTime);
    actions.moveToElement(webDriver.findElement(By.xpath("//div[@data-testid='tag-conatiner']//span"))).perform();
    Events.click(webDriver, By.xpath("//div[@data-testid='tag-conatiner']//span"));
    Events.click(webDriver, By.cssSelector("[data-testid='remove']"));
    Events.click(webDriver, By.cssSelector("[data-testid='remove']"));
    Events.click(webDriver, By.cssSelector("[data-testid='saveAssociatedTag']"));
  }

//    @Test
//    @Order(7)
//    public void basicChecks() throws InterruptedException {
//        openExplorePage();
//        Events.sendKeys(webDriver, By.cssSelector("[data-testid='searchBox']"), tableName);
//        Events.click(webDriver, By.cssSelector("[data-testid='data-name']"));
//        Thread.sleep(2000);
//        Events.click(webDriver, By.cssSelector("[data-testid='follow-button']"));
//        Events.click(webDriver, By.cssSelector("[data-testid='getFollowerDetail']"));
//        Events.click(webDriver, By.cssSelector("[data-testid='follow-button']"));
//        Events.click(webDriver, By.cssSelector("[data-testid='getFollowerDetail']"));
//        Events.click(webDriver, By.cssSelector("[data-testid='sample-data-button']"));
//    }

  @Test
  @Order(8)
  public void checkProfiler() throws InterruptedException {
    openExplorePage();
    Events.sendKeys(webDriver, By.cssSelector("[data-testid='searchBox']"), tableName);
    Events.click(webDriver, By.cssSelector("[data-testid='data-name']"));
    Events.click(webDriver, By.xpath("(//button[@data-testid='tab'])[2]")); // Profiler
//    for (int i = 1; i <= 4; i++) {
//      Events.click(
//          webDriver, By.xpath("(//td[@data-testid='tableBody-cell']//span)" + "[" + i + "]")); // Profiler
//      actions.moveToElement(
//              webDriver.findElement(By.xpath("(//tr[@data-testid='tableBody-row']//td" + "[" + i + "]" + ")")))
//          .perform();
//      Events.click(
//          webDriver, By.xpath("(//td[@data-testid='tableBody-cell']//span)" + "[" + i + "]")); // Profiler
//      Thread.sleep(waitTime);
//    }
  }

  @Test
  @Order(9)
  public void checkManage() throws InterruptedException {
    openExplorePage();
    Events.click(webDriver, By.cssSelector("[data-testid='sortBy']")); // Sort By
    Events.click(webDriver, By.cssSelector("[data-testid='list-item']")); // Last Updated
    Thread.sleep(3000);
    Events.click(webDriver, By.xpath("(//a[@data-testid='table-link'])[last()]"));
    Events.click(webDriver, By.xpath("(//button[@data-testid='tab'])[4]")); // Manage
    Events.click(webDriver, By.cssSelector("[data-testid='owner-dropdown']")); // Owner
    Events.sendKeys(webDriver, By.cssSelector("[data-testid='searchInputText']"), "Cloud");
    Events.click(webDriver, By.cssSelector("[data-testid='list-item']")); // Select User/Team
    Events.click(webDriver, By.cssSelector("[data-testid='card-list']")); // Select Tier
    Events.click(webDriver, By.cssSelector("[data-testid='saveManageTab']")); // Save
    Events.click(webDriver, By.cssSelector("[data-testid='appbar-item'][id='explore']")); // Explore
    webDriver.navigate().refresh();
  }

  @Test
  @Order(10)
  public void checkLineage() throws InterruptedException {
    openExplorePage();
    Events.sendKeys(webDriver, By.cssSelector("[data-testid='searchBox']"), tableName);
    Events.click(webDriver, By.cssSelector("[data-testid='data-name']"));
    Events.click(webDriver, By.xpath("(//button[@data-testid='tab'])[3]"));
    for (int i = 1; i <= 3; i++) {
      WebElement lineageEntity = webDriver.findElement(
          By.xpath("(//span[@data-testid='lineage-entity'])" + "[" + i + "]"));
      actions.dragAndDropBy(lineageEntity, 100, 200).build();
    }
  }

  @Test
  @Order(11)
  public void checkBreadCrumb() throws InterruptedException {
    openExplorePage();
    Events.click(webDriver, By.xpath("(//a[@data-testid='table-link'])[last()]"));
    Events.click(webDriver, By.cssSelector("[data-testid='breadcrumb-link']"));
//    Events.click(webDriver, By.cssSelector("[data-testid='description-edit']")); // edit description
//    Events.sendKeys(webDriver, By.xpath(enterDescription), faker.address().toString());
//    Events.click(webDriver, By.cssSelector("[data-testid='save']"));
    Events.click(webDriver, By.xpath("(//tr[@data-testid='column']//td[1]/a)[1]")); // database
//    Events.click(webDriver, By.cssSelector("[data-testid='description-edit-button']")); // edit description
//    Events.sendKeys(webDriver, By.xpath(enterDescription), faker.address().toString());
//    Events.click(webDriver, By.cssSelector("[data-testid='save']"));
    for (int i = 1; i <= 3; i++) { //check topics in service
      Events.click(
          webDriver, By.xpath("(//tr[@data-testid='tabale-column']//td[1]/a)" + "[" + i + "]")); // tables
      Thread.sleep(waitTime);
      webDriver.navigate().back();
    }
  }

  @Test
  @Order(12)
  public void checkVersion() throws InterruptedException {
    openExplorePage();
    Events.click(webDriver, By.xpath("(//a[@data-testid='table-link'])[last()]"));
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

  @Test
  @Order(13)
  public void checkFrequentlyJoinedTables() throws InterruptedException {
    openExplorePage();
    webDriver.findElement(By.cssSelector("[data-testid='searchBox']")).sendKeys("fact_sale");
    Events.click(webDriver, By.cssSelector("[data-testid='data-name']"));
    Events.click(webDriver, By.xpath("(//div[@data-testid='related-tables-data']/a)"));
//    for (int i = 1; i <= 3; i++) {
//      Events.click(webDriver, By.xpath("(//div[@data-testid='related-tables-data']//a)" + "[" + i + "]"));
//      webDriver.navigate().back();
//      Thread.sleep(waitTime);
//    }
//    for (int i = 1; i <= 3; i++) {
//      Events.click(webDriver, By.xpath("(//div[@data-testid='related-tables-data']//div//span)"));
//      Events.click(webDriver, By.xpath("(//span[@data-testid='more-related-tables-data'])" + "[" + i + "]"));
//      webDriver.navigate().back();
//      Thread.sleep(waitTime);
//    }
  }

  @Test
  @Order(14)
  public void checkFrequentlyJoinedColumns() throws InterruptedException {
    openExplorePage();
    webDriver.findElement(By.cssSelector("[data-testid='searchBox']")).sendKeys("fact_sale");
    Events.click(webDriver, By.cssSelector("[data-testid='data-name']"));
    Events.click(webDriver, By.xpath(
        "(//div[@data-testid='frequently-joined-columns']/span/a)"));
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
