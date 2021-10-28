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

package org.openmetadata.catalog.selenium.pages.myData;

import io.github.bonigarcia.wdm.WebDriverManager;
import org.openmetadata.catalog.selenium.properties.Property;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Order;

import java.time.Duration;
import java.util.ArrayList;

public class MyDataPageTest {

    static WebDriver webDriver;
    static String url = Property.getInstance().getURL();
    Integer waitTime = Property.getInstance().getSleepTime();
    static Actions actions;
    static WebDriverWait wait;

    @BeforeEach
    public void openMetadataWindow() {
        WebDriverManager.chromedriver().setup();
        ChromeOptions options = new ChromeOptions();
        options.addArguments("--headless");
        webDriver = new ChromeDriver(options);
        actions = new Actions(webDriver);
        wait = new WebDriverWait(webDriver, Duration.ofSeconds(5));
        webDriver.manage().window().maximize();
        webDriver.get(url);
    }

    @Test
    @Order(1)
    public void checkWhatsNew() {
        webDriver.findElement(
                By.xpath("//ul[@class='slick-dots testid-dots-button']//li[2]")).click(); // What's new page 2
        webDriver.findElement(
                By.xpath("//ul[@class='slick-dots testid-dots-button']//li[3]")).click(); // What's new page 3
        webDriver.findElement(
                By.xpath("//ul[@class='slick-dots testid-dots-button']//li[4]")).click(); // What's new page 4
        webDriver.findElement(
                By.xpath("//ul[@class='slick-dots testid-dots-button']//li[5]")).click(); // What's new page 5
        webDriver.findElement(By.cssSelector("[data-testid='WhatsNewModalChangeLogs']")).click(); // Change Logs
        webDriver.findElement(By.cssSelector("[data-testid='closeWhatsNew']")).click(); // Close What's new
    }

    @Test
    @Order(2)
    public void checkTabs() {
        checkWhatsNew();
        wait.until(ExpectedConditions.elementToBeClickable(
                webDriver.findElement(By.cssSelector("[data-testid='tab'][id='myDataTab']")))).click(); // My Data
        wait.until(ExpectedConditions.elementToBeClickable(
                webDriver.findElement(By.cssSelector("[data-testid='tab'][id='followingTab']")))).click(); // Following
    }

    @Test
    @Order(3)
    public void checkOverview() throws InterruptedException {
        checkWhatsNew();
        wait.until(ExpectedConditions.presenceOfElementLocated(By.cssSelector("[data-testid='tables']")));
        webDriver.findElement(By.cssSelector("[data-testid='tables']")).click(); // Tables
        webDriver.navigate().back();
        wait.until(ExpectedConditions.presenceOfElementLocated(By.cssSelector("[data-testid='topics']")));
        webDriver.findElement(By.cssSelector("[data-testid='topics']")).click(); // Topics
        webDriver.navigate().back();
        wait.until(ExpectedConditions.presenceOfElementLocated(By.cssSelector("[data-testid='dashboards']")));
        webDriver.findElement(By.cssSelector("[data-testid='dashboards']")).click(); // Dashboard
        webDriver.navigate().back();
        wait.until(ExpectedConditions.presenceOfElementLocated(By.cssSelector("[data-testid='pipelines']")));
        webDriver.findElement(By.cssSelector("[data-testid='pipelines']")).click(); // Pipeline
        webDriver.navigate().back();
        wait.until(ExpectedConditions.presenceOfElementLocated(By.cssSelector("[data-testid='service']")));
        webDriver.findElement(By.cssSelector("[data-testid='service']")).click(); // Services
        webDriver.navigate().back();
        wait.until(ExpectedConditions.presenceOfElementLocated(By.cssSelector("[data-testid='user']")));
        webDriver.findElement(By.cssSelector("[data-testid='user']")).click(); // Users
        webDriver.navigate().back();
        wait.until(ExpectedConditions.presenceOfElementLocated(By.cssSelector("[data-testid='terms']")));
        webDriver.findElement(By.cssSelector("[data-testid='terms']")).click();  // Teams
    }

    @Test
    @Order(4)
    public void checkSearchBar() throws InterruptedException {
        checkWhatsNew();
        wait.until(ExpectedConditions.elementToBeClickable(
                webDriver.findElement(By.cssSelector("[id='searchBox']")))); // Search bar/dim
        webDriver.findElement(By.cssSelector("[id='searchBox']")).sendKeys("dim"); // Search bar/dim
        Thread.sleep(waitTime);
        wait.until(ExpectedConditions.elementToBeClickable(
                webDriver.findElement(By.cssSelector("[data-testid='data-name']")))); // Search bar/dim
        webDriver.findElement(By.cssSelector("[data-testid='data-name']")).click(); // Search bar/dim
    }


    @Test
    @Order(5)
    public void checkHeaders() {
        checkWhatsNew();
        ArrayList<String> tabs = new ArrayList<>(webDriver.getWindowHandles());
        webDriver.findElement(By.cssSelector("[data-testid='appbar-item'][id='explore']")).click(); // Explore
        webDriver.navigate().back();
        wait.until(ExpectedConditions.presenceOfElementLocated(
                By.cssSelector("[data-testid='menu-button'][id='menu-button-Settings']")));
        webDriver.findElement(
                By.cssSelector("[data-testid='menu-button'][id='menu-button-Settings']")).click(); // Setting
        wait.until(ExpectedConditions.presenceOfElementLocated(By.cssSelector("[data-testid='menu-item-Teams']")));
        webDriver.findElement(By.cssSelector("[data-testid='menu-item-Teams']")).click(); // Setting/Teams
        webDriver.navigate().back();
        wait.until(ExpectedConditions.presenceOfElementLocated(
                By.cssSelector("[data-testid='menu-button'][id='menu-button-Settings']")));
        webDriver.findElement(
                By.cssSelector("[data-testid='menu-button'][id='menu-button-Settings']")).click(); // Setting
        wait.until(ExpectedConditions.presenceOfElementLocated(By.cssSelector("[data-testid='menu-item-Tags']")));
        webDriver.findElement(By.cssSelector("[data-testid='menu-item-Tags']")).click(); // Setting/Tags
        webDriver.navigate().back();
        wait.until(ExpectedConditions.presenceOfElementLocated(
                By.cssSelector("[data-testid='menu-button'][id='menu-button-Settings']")));
        webDriver.findElement(
                By.cssSelector("[data-testid='menu-button'][id='menu-button-Settings']")).click(); // Setting
        wait.until(ExpectedConditions.presenceOfElementLocated(By.cssSelector("[data-testid='menu-item-Services']")));
        webDriver.findElement(By.cssSelector("[data-testid='menu-item-Services']")).click(); // Setting/Services
        webDriver.findElement(By.cssSelector("[data-testid='whatsnew-modal']")).click(); // What's New
        checkWhatsNew();
        wait.until(ExpectedConditions.presenceOfElementLocated(
                By.cssSelector("[data-testid='menu-button'][id='menu-button-Need Help']")));
        webDriver.findElement(By.cssSelector("[data-testid='menu-button'][id='menu-button-Need Help']")).click();
        wait.until(ExpectedConditions.presenceOfElementLocated(By.cssSelector("[data-testid='menu-item-Docs']")));
        webDriver.findElement(By.cssSelector("[data-testid='menu-item-Docs']")).click();
        webDriver.switchTo().window(tabs.get(0));

        wait.until(ExpectedConditions.presenceOfElementLocated(
                By.cssSelector("[data-testid='menu-button'][id='menu-button-Need Help']")));
        webDriver.findElement(By.cssSelector("[data-testid='menu-button'][id='menu-button-Need Help']")).click();
        wait.until(ExpectedConditions.presenceOfElementLocated(By.cssSelector("[data-testid='menu-item-API']")));
        webDriver.findElement(By.cssSelector("[data-testid='menu-item-API']")).click();
        webDriver.navigate().back();

        wait.until(ExpectedConditions.presenceOfElementLocated(
                By.cssSelector("[data-testid='menu-button'][id='menu-button-Need Help']")));
        webDriver.findElement(By.cssSelector("[data-testid='menu-button'][id='menu-button-Need Help']")).click();
        wait.until(ExpectedConditions.presenceOfElementLocated(By.cssSelector("[data-testid='menu-item-Slack']")));
        webDriver.findElement(By.cssSelector("[data-testid='menu-item-Slack']")).click();
        webDriver.switchTo().window(tabs.get(0));
    }

    @Test
    @Order(6)
    public void checkLogout() {
        checkWhatsNew();
        webDriver.findElement(By.cssSelector("[data-testid='greeting-text']")).click();
        webDriver.findElement(By.cssSelector("[data-testid='menu-item-Logout']")).click();
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
