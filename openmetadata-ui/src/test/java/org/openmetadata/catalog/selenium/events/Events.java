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

package org.openmetadata.catalog.selenium.events;

import lombok.extern.slf4j.Slf4j;
import org.openqa.selenium.*;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

@Slf4j
public final class Events {

  @SuppressWarnings("unused")
  private Events() {}

  public static void click(WebDriver driver, By by) {
    (new WebDriverWait(driver, 15)).until(ExpectedConditions.elementToBeClickable(by));
    driver.findElement(by).click();
  }

  public static void sendKeys(WebDriver driver, By by, String sendKeys) {
    (new WebDriverWait(driver, 15)).until(ExpectedConditions.elementToBeClickable(by));
    driver.findElement(by).sendKeys(sendKeys);
  }

  public static void sendEnter(WebDriver driver, By by) {
    (new WebDriverWait(driver, 15)).until(ExpectedConditions.elementToBeClickable(by));
    driver.findElement(by).sendKeys(Keys.ENTER);
  }

  public static void sleep(int timeOutInSeconds) {
    try {
      Thread.sleep(timeOutInSeconds);
    } catch (InterruptedException e) {
      e.printStackTrace();
    }
  }

  public static boolean waitForElementToDisplay(WebDriver driver, By by, int timeOutInSeconds) {
    boolean isDisplayed = false;
    for (int i = 0; i < timeOutInSeconds; i++) {
      try {
        if (driver.findElement(by).isDisplayed()) {
          LOG.info("Element is displayed");
        }
      } catch (NoSuchElementException | TimeoutException e) {
        LOG.info("Element is not displayed");
        sleep(1);
      }
    }
    return isDisplayed;
  }
}
