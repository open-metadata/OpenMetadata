package org.openmetadata.catalog.selenium.objectRepository;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

public class DatabaseServicePage {
  WebDriver webDriver;

  public DatabaseServicePage(WebDriver webDriver) {
    this.webDriver = webDriver;
  }

  By headerSettingsServices = By.cssSelector("[data-testid='menu-item-Services']");
  By noServicesAddServiceButton = By.cssSelector("[data-testid='add-new-user-button']");
  By addServiceButton = By.cssSelector("[data-testid='add-service-button']");
  By serviceName = By.cssSelector("[data-testid='name']");
  By serviceUrl = By.cssSelector("[data-testid='url']");
  By servicePort = By.cssSelector("[data-testid='port']");
  By serviceUsername = By.cssSelector("[name='username']");
  By servicePassword = By.cssSelector("[name='password']");
  By databaseName = By.cssSelector("[data-testid='database']");
  By nextButton = By.cssSelector("[data-testid='next-button']");
  By saveServiceButton = By.cssSelector("[data-testid='deploy-button']");
  By saveEditedService = By.cssSelector("[data-testid='save-button']");
  By runIngestion = By.cssSelector("[data-testid='run']");
  By editIngestion = By.cssSelector("[data-testid='edit']");
  By deleteIngestion = By.cssSelector("[data-testid='delete']");
  By saveConnectionConfig = By.cssSelector("[data-testid='saveManageTab']");
  By selectInterval = By.xpath("//select[@id='ingestionType']");

  public By headerSettingsServices() {
    return headerSettingsServices;
  }

  public By addServiceButton() {
    return addServiceButton;
  }

  public By noServicesAddServiceButton() {
    return noServicesAddServiceButton;
  }

  public By serviceType(String serviceType) {
    return By.cssSelector("[data-testid='" + serviceType + "']");
  }

  public By serviceName() {
    return serviceName;
  }

  public By servicePort() {
    return servicePort;
  }

  public By serviceUsername() {
    return serviceUsername;
  }

  public By servicePassword() {
    return servicePassword;
  }

  public By serviceUrl() {
    return serviceUrl;
  }

  public By databaseName() {
    return databaseName;
  }

  public By nextButton() {
    return nextButton;
  }

  public By saveServiceButton() {
    return saveServiceButton;
  }

  public By deleteServiceButton(String serviceName) {
    return By.cssSelector("[data-testid='delete-service-" + serviceName + "']");
  }

  public By saveEditedService() {
    return saveEditedService;
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

  public By saveConnectionConfig() {
    return saveConnectionConfig;
  }
}
