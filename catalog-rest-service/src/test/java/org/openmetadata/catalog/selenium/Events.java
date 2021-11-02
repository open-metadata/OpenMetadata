package org.openmetadata.catalog.selenium;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

public class Events {

    public static void click(WebDriver driver, By by) {
        (new WebDriverWait(driver, 30)).until(ExpectedConditions.elementToBeClickable(by));
        driver.findElement(by).click();
    }
}
