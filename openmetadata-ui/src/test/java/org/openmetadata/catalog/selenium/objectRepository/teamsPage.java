package org.openmetadata.catalog.selenium.objectRepository;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

public class teamsPage {
   WebDriver webDriver;

    public teamsPage(WebDriver webDriver) {
        this.webDriver = webDriver;
    }

   By heading = By.className("tw-heading");

    public WebElement heading() {
        return webDriver.findElement(heading);
    }
}

