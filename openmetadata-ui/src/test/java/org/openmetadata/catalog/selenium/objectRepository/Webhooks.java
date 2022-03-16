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
  By addWebhook = By.cssSelector("[data-testid='add-webhook-button']");
  By name = By.xpath("//input[@data-testid='name']");
  By descriptionBox = By.xpath("//div[@class='notranslate public-DraftEditor-content']");
  By endpoint = By.xpath("//input[@data-testid='endpoint-url']");
  By checkbox = By.xpath("//input[@data-testid='checkbox']");
  By entityCreatedMenu = By.xpath("(//button[@id='menu-button-select entities'])[1]");
  By allEntities = By.xpath("(//input[@type='checkbox'])[2]");
  By saveWebhook = By.xpath("//button[@data-testid='save-webhook']");
  By checkWebhook = By.xpath("//button[@data-testid='webhook-link']");
  By toast = By.xpath("(//div[@data-testid='toast']/div)[2]");
  By selectWebhook = By.xpath("(//button[@data-testid='webhook-link'])[1]");
  By deleteWebhook = By.xpath("//button[@data-testid='delete-webhook']");
  By save = By.xpath("//button[@data-testid='save-button']");
  By checkFilter = By.xpath("//div[@data-testid='card-body']/div/span/span");

  public By selectFilter(int index) {
    return By.xpath("(//div[@data-testid='filter-containers-1']/div/div/input)[" + index + "]");
  }
}
