package org.openmetadata.catalog.selenium.objectRepository;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

public class servicesPage {
    WebDriver webDriver;

    public servicesPage(WebDriver webDriver) {
        this.webDriver = webDriver;
    }

    By databaseService = By.xpath("(//button[@data-testid=\"tab\"])[1]");

    public WebElement databaseService() {
        return webDriver.findElement(databaseService);
    }
}

