package org.openmetadata.catalog.selenium.objectRepository;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

public class DatabaseServicePage {
  WebDriver webDriver;

  public DatabaseServicePage(WebDriver webDriver) {
    this.webDriver = webDriver;
  }

  By serviceUrl = By.cssSelector("[data-testid='url']");
  By servicePort = By.cssSelector("[data-testid='port']");
  By databaseName = By.cssSelector("[data-testid='database']");
  By runIngestion = By.cssSelector("[data-testid='run']");
  By editIngestion = By.cssSelector("[data-testid='edit']");
  By deleteIngestion = By.cssSelector("[data-testid='delete']");
  By selectInterval = By.xpath("//select[@id='ingestionType']");

  public By serviceType(String serviceType) {
    return By.cssSelector("[data-testid='" + serviceType + "']");
  }

  public By servicePort() {
    return servicePort;
  }

  public By serviceUrl() {
    return serviceUrl;
  }

  public By databaseName() {
    return databaseName;
  }

  public By deleteServiceButton(String serviceName) {
    return By.cssSelector("[data-testid='delete-service-" + serviceName + "']");
  }

  public By serviceDetailsTabs(String tab) {
    return By.cssSelector("[data-testid='tab'][id='" + tab + "']");
  }

  public By runIngestion() {
    return runIngestion;
  }

  public By editIngestion() {
    return editIngestion;
  }

  public By deleteIngestion() {
    return deleteIngestion;
  }

  public By selectInterval() {
    return selectInterval;
  }

  public By ingestionInterval(String interval) {
    return By.xpath("//select[@id='ingestionType']/option[@value='" + interval + "']");
  }
}
