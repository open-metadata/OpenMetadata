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

package org.openmetadata.catalog.selenium.pages.tags;

import com.github.javafaker.Faker;
import org.junit.jupiter.api.Test;
import org.openmetadata.catalog.selenium.events.Events;
import org.openmetadata.catalog.selenium.properties.Property;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.MethodOrderer;

import java.time.Duration;
import java.util.ArrayList;

@Order(3)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class TagsPageTest {

  static WebDriver webDriver;
  static String url = Property.getInstance().getURL();
  static Faker faker = new Faker();
  static String tagCategoryDisplayName = faker.name().firstName();
  static String tagDisplayName = faker.name().firstName();
  static String enterDescription = "//div[@data-testid='enterDescription']/div/div[2]/div/div/div/div/div/div";
  static Actions actions;
  static WebDriverWait wait;
  Integer waitTime = Property.getInstance().getSleepTime();

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
  public void openTagsPage() throws InterruptedException {
    Events.click(webDriver, By.cssSelector("[data-testid='closeWhatsNew']")); // Close What's new
    Events.click(webDriver, By.cssSelector("[data-testid='menu-button'][id='menu-button-Settings']")); // Setting
    Events.click(webDriver, By.cssSelector("[data-testid='menu-item-Tags']")); // Setting/Tags
    Thread.sleep(waitTime);
  }

  @Test
  @Order(2)
  public void addTagCategory() throws InterruptedException {
    openTagsPage();
    Events.click(webDriver, By.cssSelector("[data-testid='add-category']"));
    wait.until(ExpectedConditions.elementToBeClickable(webDriver.findElement(By.name("name"))));
    Events.sendKeys(webDriver, By.name("name"), tagCategoryDisplayName);
    Events.click(webDriver, By.cssSelector("[data-testid='boldButton']"));
    Events.sendKeys(webDriver, By.xpath(enterDescription), faker.address().toString());
    Events.click(webDriver, By.xpath(enterDescription));
    Events.sendEnter(webDriver, By.xpath(enterDescription));
    Events.click(webDriver, By.cssSelector("[data-testid='italicButton']"));
    Events.sendKeys(webDriver, By.xpath(enterDescription), faker.address().toString());
    Events.click(webDriver, By.xpath(enterDescription));
    Events.sendEnter(webDriver, By.xpath(enterDescription));
    Events.click(webDriver, By.cssSelector("[data-testid='linkButton']"));
    Events.sendKeys(webDriver, By.xpath(enterDescription), faker.address().toString());
    Events.click(webDriver, By.cssSelector("[data-testid='saveButton']"));
  }

  @Test
  @Order(3)
  public void editTagCategoryDescription() throws InterruptedException {
    openTagsPage();
    Events.click(webDriver, By.xpath("//*[text()[contains(.,'" + tagCategoryDisplayName + "')]] "));
    Events.click(webDriver, By.cssSelector("[data-testid='edit-description']"));
    wait.until(ExpectedConditions.presenceOfElementLocated(By.xpath(enterDescription)));
    Events.sendKeys(webDriver, By.xpath(enterDescription), faker.address().toString());
    Events.click(webDriver, By.cssSelector("[data-testid='save']"));
  }

  @Test
  @Order(4)
  public void addTag() throws InterruptedException {
    openTagsPage();
    Events.click(webDriver, By.xpath("//*[text()[contains(.,'" + tagCategoryDisplayName + "')]] "));
    // Select the created listed team
    Events.click(webDriver, By.cssSelector("[data-testid='add-new-tag-button']"));
    wait.until(ExpectedConditions.elementToBeClickable(By.name("name")));
    Events.sendKeys(webDriver, By.name("name"), tagDisplayName);
    Events.click(webDriver, By.cssSelector("[data-testid='boldButton']"));
    Events.sendKeys(webDriver, By.xpath(enterDescription), faker.address().toString());
    Events.click(webDriver, By.xpath(enterDescription));
    Events.sendEnter(webDriver, By.xpath(enterDescription));
    Events.click(webDriver, By.cssSelector("[data-testid='italicButton']"));
    Events.sendKeys(webDriver, By.xpath(enterDescription), faker.address().toString());
    Events.click(webDriver, By.xpath(enterDescription));
    Events.sendEnter(webDriver, By.xpath(enterDescription));
    Events.click(webDriver, By.cssSelector("[data-testid='linkButton']"));
    Events.sendKeys(webDriver, By.xpath(enterDescription), faker.address().toString());
    wait.until(ExpectedConditions.elementToBeClickable(By.cssSelector("[data-testid='saveButton']")));
    Events.click(webDriver, By.cssSelector("[data-testid='saveButton']"));
  }

  @Test
  @Order(5)
  public void changeTagDescription() throws InterruptedException {
    openTagsPage();
    Events.click(webDriver, By.xpath("//*[text()[contains(.,'" + tagCategoryDisplayName + "')]] "));
    // Select the created listed team
    actions.moveToElement(webDriver.findElement(By.cssSelector("[data-testid='editTagDescription']"))).perform();
    Events.click(webDriver, By.cssSelector("[data-testid='editTagDescription']"));
    wait.until(ExpectedConditions.elementToBeClickable(By.xpath(enterDescription)));
    Events.sendKeys(webDriver, By.xpath(enterDescription), faker.address().toString());
    Events.click(webDriver, By.cssSelector("[data-testid='save']"));
  }

  @Test
  @Order(6)
  public void addAssociatedTag() throws InterruptedException {
    openTagsPage();
    Events.click(webDriver, By.xpath("//*[text()[contains(.,'" + tagCategoryDisplayName + "')]] "));
    // Select the created listed team
    actions.moveToElement(webDriver.findElement(By.cssSelector("[data-testid='tags']"))).perform();
    Events.click(webDriver, By.cssSelector("[data-testid='tags']"));
    Events.click(webDriver, By.cssSelector("[data-testid='associatedTagName']"));
    for (int i = 0; i <= 1; i++) {
      Events.sendKeys(webDriver, By.cssSelector("[data-testid='associatedTagName']"), "P");
      Events.click(webDriver, By.cssSelector("[data-testid='list-item']"));
    }
    Events.click(webDriver, By.cssSelector("[data-testid='saveAssociatedTag']"));
  }

  @Test
  @Order(7)
  public void removeAssociatedTag() throws InterruptedException {
    openTagsPage();
    Events.click(webDriver, By.xpath("//*[text()[contains(.,'" + tagCategoryDisplayName + "')]] "));
    // Select the created listed team
    actions.moveToElement(webDriver.findElement(By.cssSelector("[data-testid='tags']"))).perform();
    Events.click(webDriver, By.cssSelector("[data-testid='tags']"));
    Events.click(webDriver, By.cssSelector("[data-testid='remove']"));
    Events.click(webDriver, By.cssSelector("[data-testid='remove']"));
    Events.click(webDriver, By.cssSelector("[data-testid='saveAssociatedTag']"));
  }

  @Test
  @Order(8)
  public void addTagToTableColumn() throws InterruptedException {
    Events.click(webDriver, By.cssSelector("[data-testid='closeWhatsNew']")); // Close What's new
    Events.click(webDriver, By.cssSelector("[data-testid='appbar-item'][id='explore']")); // Explore
    Events.click(webDriver, By.cssSelector("[data-testid='sortBy']")); // Sort By
    Events.click(webDriver, By.cssSelector("[data-testid='list-item']")); // Last Updated
    Events.click(webDriver, By.xpath("(//a[@data-testid='table-link'])[last()]"));
    Thread.sleep(waitTime);
    actions.moveToElement(webDriver.findElement(By.cssSelector("[data-testid='tags']"))).perform();
    Thread.sleep(waitTime);
    Events.click(webDriver, By.cssSelector("[data-testid='tags']"));
    Events.click(webDriver, By.cssSelector("[data-testid='associatedTagName']"));
    Events.sendKeys(webDriver, By.cssSelector("[data-testid='associatedTagName']"),
        tagCategoryDisplayName + "." + tagDisplayName);
    Events.click(webDriver, By.cssSelector("[data-testid='list-item']"));
    Events.click(webDriver, By.cssSelector("[data-testid='saveAssociatedTag']"));
    Events.click(webDriver, By.cssSelector("[data-testid='menu-button'][id='menu-button-Settings']")); // Setting
    Events.click(webDriver, By.cssSelector("[data-testid='menu-item-Tags']")); // Setting/Tags
    Events.click(webDriver, By.xpath("//*[text()[contains(.,'" + tagCategoryDisplayName + "')]] "));
    Events.click(webDriver, By.cssSelector("[data-testid='usage-count']"));
    webDriver.navigate().refresh();
  }

  @Test
  @Order(9)
  public void checkAddedTagToTableColumn() {
    Events.click(webDriver, By.cssSelector("[data-testid='closeWhatsNew']")); // Close What's new
    Events.click(webDriver, By.cssSelector("[data-testid='tables']")); // Tables
    Events.click(webDriver, By.cssSelector("[data-testid='checkbox']" +
        "[id='" + tagCategoryDisplayName + "." + tagDisplayName + "']"));
    Events.click(webDriver, By.xpath("//a[@data-testid='table-link']//button"));
  }

  @Test
  @Order(10)
  public void removeTagFromTableColumn() throws InterruptedException {
    openTagsPage();
    Events.click(webDriver, By.xpath("//*[text()[contains(.,'" + tagCategoryDisplayName + "')]] "));
    Events.click(webDriver, By.cssSelector("[data-testid='usage-count']"));
    Events.click(webDriver, By.xpath("//a[@data-testid='table-link']//button"));
    Thread.sleep(waitTime);
    actions.moveToElement(webDriver.findElement(By.xpath("//div[@data-testid='tag-conatiner']//span"))).perform();
    Events.click(webDriver, By.xpath("//div[@data-testid='tag-conatiner']//span"));
    Events.click(webDriver, By.cssSelector("[data-testid='remove']"));
    Events.click(webDriver, By.cssSelector("[data-testid='saveAssociatedTag']"));
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
