package org.openmetadata.catalog.selenium.objectRepository;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

public class DashboardServicePage {
  WebDriver webDriver;

  public DashboardServicePage(WebDriver webDriver) {
    this.webDriver = webDriver;
  }

  By dashboardServiceUrl = By.cssSelector("[data-testid='dashboard-url']");

  public By selectServiceTab(int index) {
    return By.xpath("(//div[@data-testid='tab'])[" + index + "]");
  }

  public By dashboardServiceUrl() {
    return dashboardServiceUrl;
  }
}
