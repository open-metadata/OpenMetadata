package org.openmetadata.catalog.selenium.objectRepository;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

public class DashboardDetails {

    public WebDriver webDriver;

    public DashboardDetails(WebDriver webDriver){
        this.webDriver = webDriver;
    }

    By dashboard = By.xpath("(//button[@data-testid='tab'])[3]");

    public By dashboard() {
        return dashboard;
    }

}
