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
import org.openmetadata.catalog.selenium.properties.Property;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;

import java.time.Duration;
import java.util.ArrayList;

public class TableDetailsPageTest {
    static WebDriver webDriver;
    static String url = Property.getInstance().getURL();
    Integer waitTime = Property.getInstance().getSleepTime();
    static Faker faker = new Faker();
    String tableName= "dim_address";
    static String enterDescription = "//div[@data-testid='enterDescription']/div/div[2]/div/div/div/div/div/div";
    static Actions actions;
    static WebDriverWait wait;

    @BeforeMethod
    public void openMetadataWindow() {
        System.setProperty("webdriver.chrome.driver", "src/test/resources/drivers/macM1/chromedriver");
        webDriver = new ChromeDriver();
        actions = new Actions(webDriver);
        wait = new WebDriverWait(webDriver, Duration.ofSeconds(5));
        webDriver.manage().window().maximize();
        webDriver.get(url);
    }

    @Test(priority = 1)
    public void openExplorePage() throws InterruptedException {
        webDriver.findElement(By.cssSelector("[data-testid='closeWhatsNew']")).click(); // Close What's new
        webDriver.findElement(By.cssSelector("[data-testid='appbar-item'][id='explore']")).click(); // Explore
        Thread.sleep(waitTime);
    }

    @Test(priority = 2)
    public void checkTabs() throws InterruptedException {
        openExplorePage();
        webDriver.findElement(By.cssSelector("[data-testid='searchBox']")).sendKeys(tableName);
        webDriver.findElement(By.cssSelector("[data-testid='data-name']")).click();
        wait.until(ExpectedConditions.elementToBeClickable(By.xpath("(//button[@data-testid='tab'])[2]")));
        webDriver.findElement(By.xpath("(//button[@data-testid='tab'])[2]")).click(); // Profiler
        webDriver.findElement(By.xpath("(//button[@data-testid='tab'])[3]")).click(); // Lineage
        webDriver.findElement(By.xpath("(//button[@data-testid='tab'])[4]")).click(); // Manage
    }

    @Test(priority = 3)
    public void editDescription() throws InterruptedException {
        openExplorePage();
        webDriver.findElement(By.cssSelector("[data-testid='searchBox']")).sendKeys(tableName);
        webDriver.findElement(By.cssSelector("[data-testid='data-name']")).click();
        wait.until(ExpectedConditions.elementToBeClickable(By.cssSelector("[data-testid='edit-description']")));
        webDriver.findElement(By.cssSelector("[data-testid='edit-description']")).click();
        webDriver.findElement(By.xpath(enterDescription)).sendKeys(faker.address().toString());
        wait.until(ExpectedConditions.elementToBeClickable(By.cssSelector("[data-testid='save']")));
        webDriver.findElement(By.cssSelector("[data-testid='save']")).click();
    }

    @Test(priority = 4)
    public void searchColumnAndEditDescription() throws InterruptedException {
        openExplorePage();
        webDriver.findElement(By.cssSelector("[data-testid='searchBox']")).sendKeys(tableName);
        webDriver.findElement(By.cssSelector("[data-testid='data-name']")).click();
        wait.until(ExpectedConditions.elementToBeClickable(By.cssSelector("[data-testid='searchbar']")));
        webDriver.findElement(By.cssSelector("[data-testid='searchbar']")).sendKeys("address1");
        Thread.sleep(2000);
        actions.moveToElement(webDriver.findElement(By.xpath("//div[@data-testid='description']//button"))).perform();
        webDriver.findElement(By.xpath("//div[@data-testid='description']//button")).click();
        webDriver.findElement(By.xpath(enterDescription)).sendKeys(faker.address().toString());
        wait.until(ExpectedConditions.elementToBeClickable(By.cssSelector("[data-testid='save']")));
        webDriver.findElement(By.cssSelector("[data-testid='save']")).click();
    }

    @Test(priority = 5)
    public void addTagsToColumn() throws InterruptedException {
        openExplorePage();
        webDriver.findElement(By.cssSelector("[data-testid='searchBox']")).sendKeys(tableName);
        webDriver.findElement(By.cssSelector("[data-testid='data-name']")).click();
        Thread.sleep(waitTime);
        actions.moveToElement(webDriver.findElement(By.xpath("//div[@data-testid='tag-conatiner']//span"))).perform();
        webDriver.findElement(By.xpath("//div[@data-testid='tag-conatiner']//span")).click();
        wait.until(ExpectedConditions.elementToBeClickable(By.cssSelector("[data-testid='associatedTagName']")));
        webDriver.findElement(By.cssSelector("[data-testid='associatedTagName']")).click();
        for (int i = 0; i <=1; i++){
            wait.until(ExpectedConditions.elementToBeClickable(
                            webDriver.findElement(By.cssSelector("[data-testid='associatedTagName']"))))
                    .sendKeys("P");
            wait.until(ExpectedConditions.elementToBeClickable(
                    webDriver.findElement(By.cssSelector("[data-testid='list-item']")))).click();
        }
        webDriver.findElement(By.cssSelector("[data-testid='saveAssociatedTag']")).click();
    }

    @Test(priority = 6)
    public void removeTagsFromColumn() throws InterruptedException {
        openExplorePage();
        webDriver.findElement(By.cssSelector("[data-testid='searchBox']")).sendKeys(tableName);
        webDriver.findElement(By.cssSelector("[data-testid='data-name']")).click();
        Thread.sleep(waitTime);
        actions.moveToElement(webDriver.findElement(By.xpath("//div[@data-testid='tag-conatiner']//span"))).perform();
        webDriver.findElement(By.xpath("//div[@data-testid='tag-conatiner']//span")).click();
        wait.until(ExpectedConditions.elementToBeClickable(
                webDriver.findElement(By.cssSelector("[data-testid='remove']")))).click();
        wait.until(ExpectedConditions.elementToBeClickable(
                webDriver.findElement(By.cssSelector("[data-testid='remove']")))).click();
        wait.until(ExpectedConditions.elementToBeClickable(
                webDriver.findElement(By.cssSelector("[data-testid='saveAssociatedTag']")))).click();
    }

    @Test(priority = 7)
    public void basicChecks() throws InterruptedException {
        openExplorePage();
        webDriver.findElement(By.cssSelector("[data-testid='searchBox']")).sendKeys(tableName);
        webDriver.findElement(By.cssSelector("[data-testid='data-name']")).click();
        wait.until(ExpectedConditions.elementToBeClickable(By.cssSelector("[data-testid='follow-button']")));
        webDriver.findElement(By.cssSelector("[data-testid='follow-button']")).click();
        webDriver.findElement(By.cssSelector("[data-testid='getFollowerDetail']")).click();
        webDriver.findElement(By.cssSelector("[data-testid='follow-button']")).click();
        webDriver.findElement(By.cssSelector("[data-testid='getFollowerDetail']")).click();
        webDriver.findElement(By.cssSelector("[data-testid='sample-data-button']")).click();
    }

    @Test(priority = 8)
    public void checkProfiler() throws InterruptedException {
        openExplorePage();
        webDriver.findElement(By.cssSelector("[data-testid='searchBox']")).sendKeys(tableName);
        webDriver.findElement(By.cssSelector("[data-testid='data-name']")).click();
        wait.until(ExpectedConditions.elementToBeClickable(By.xpath("(//button[@data-testid='tab'])[2]")));
        webDriver.findElement(By.xpath("(//button[@data-testid='tab'])[2]")).click(); // Profiler
        for (int i =1; i<=4; i++) {
            webDriver.findElement(
                    By.xpath("(//td[@data-testid='tableBody-cell']//span)" + "[" + i + "]")).click(); // Profiler
            actions.moveToElement(
                    webDriver.findElement(By.xpath("(//tr[@data-testid='tableBody-row']//td" + "[" + i + "]" + ")")))
                    .perform();
            webDriver.findElement(
                    By.xpath("(//td[@data-testid='tableBody-cell']//span)" + "[" + i + "]")).click(); // Profiler
            Thread.sleep(waitTime);
        }
    }

    @Test(priority = 9)
    public void checkManage() throws InterruptedException {
        openExplorePage();
        webDriver.findElement(By.cssSelector("[data-testid='sortBy']")).click(); // Sort By
        webDriver.findElement(By.cssSelector("[data-testid='list-item']")).click(); // Last Updated
        Thread.sleep(3000);
        webDriver.findElement(By.xpath("(//a[@data-testid='table-link'])[10]")).click();
        wait.until(ExpectedConditions.elementToBeClickable(By.xpath("(//button[@data-testid='tab'])[4]"))); // Manage
        webDriver.findElement(By.xpath("(//button[@data-testid='tab'])[4]")).click(); // Manage
        wait.until(ExpectedConditions.elementToBeClickable(By.cssSelector("[data-testid='owner-dropdown']"))); // Owner
        webDriver.findElement(By.cssSelector("[data-testid='owner-dropdown']")).click(); // Owner
        wait.until(ExpectedConditions.elementToBeClickable(
                webDriver.findElement(By.cssSelector("[data-testid='searchInputText']"))));
        webDriver.findElement(By.cssSelector("[data-testid='searchInputText']")).sendKeys("Cloud");
        webDriver.findElement(By.cssSelector("[data-testid='list-item']")).click(); // Select User/Team
        webDriver.findElement(By.cssSelector("[data-testid='card-list']")).click(); // Select Tier
        webDriver.findElement(By.cssSelector("[data-testid='saveManageTab']")).click(); // Save
        webDriver.findElement(By.cssSelector("[data-testid='appbar-item'][id='explore']")).click(); // Explore
        wait.until(ExpectedConditions.elementToBeClickable(
                By.cssSelector("[data-testid='checkbox'][id='Tier.Tier1']")));
        webDriver.findElement(By.cssSelector("[data-testid='checkbox'][id='Tier.Tier1']")).click();
        wait.until(ExpectedConditions.elementToBeClickable(By.cssSelector("[data-testid='table-link']")));
        webDriver.findElement(By.cssSelector("[data-testid='table-link']")).click();
    }

    @Test(priority = 10)
    public void checkLineage() throws InterruptedException {
        openExplorePage();
        webDriver.findElement(By.cssSelector("[data-testid='searchBox']")).sendKeys(tableName);
        webDriver.findElement(By.cssSelector("[data-testid='data-name']")).click();
        wait.until(ExpectedConditions.elementToBeClickable(By.xpath("(//button[@data-testid='tab'])[3]")));
        webDriver.findElement(By.xpath("(//button[@data-testid='tab'])[3]")).click();
        for (int i=1; i<=3; i++) {
            WebElement lineageEntity = webDriver.findElement(
                    By.xpath("(//p[@data-testid='lineage-entity'])" + "[" + i + "]"));
            actions.dragAndDropBy(lineageEntity, 100, 200).build().perform();
        }
    }

    @AfterMethod
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
