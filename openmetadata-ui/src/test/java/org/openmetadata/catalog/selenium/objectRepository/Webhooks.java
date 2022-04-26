package org.openmetadata.catalog.selenium.objectRepository;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.jetbrains.annotations.NotNull;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

@Getter
@RequiredArgsConstructor
public class Webhooks {
  @NotNull WebDriver webDriver;

  By webhookLink = By.linkText("Webhooks");
  By addWebhook = By.xpath("//button[@data-testid='add-webhook-button']");
  By name = By.xpath("//input[@data-testid='name']");
  By descriptionBox = By.xpath("//div[@class='ProseMirror']");
  By focusedDescriptionBox = By.xpath("//div[@class='ProseMirror ProseMirror-focused']");
  By endpoint = By.xpath("//input[@data-testid='endpoint-url']");
  By checkbox = By.xpath("//input[@data-testid='entity-created-checkbox']");
  By entityCreatedMenu = By.xpath("(//button[@id='menu-button-select entities'])[1]");
  By allEntities = By.xpath("(//input[@type='checkbox'])[2]");
  By toast = By.xpath("(//div[@class='Toastify__toast-body']/div)[2]");
  By clickToCloseDropdown = By.cssSelector("[class='page-container-v1 tw-bg-body-main']");

  public By checkWebhook(String webHookName) {
    return By.xpath("//button[@data-testid='webhook-link'][text()='" + webHookName + "']");
  }
}
