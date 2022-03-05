package org.openmetadata.catalog.selenium.objectRepository;

import javax.annotation.Nonnull;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

@Getter
@RequiredArgsConstructor
public class MyDataPage {

  @Nonnull WebDriver webDriver;

  By closeWhatsNew = By.cssSelector("[data-testid='closeWhatsNew']");
  By openWhatsNew = By.xpath("//button[@data-testid='whatsnew-modal']");
  By page2 = By.xpath("//ul[@class='slick-dots testid-dots-button']//li[2]");
  By changeLog = By.xpath("//button[@data-testid='WhatsNewModalChangeLogs']");
  By version = By.cssSelector("p[class=\"tw-text-base tw-font-medium\"]");
  By tables = By.xpath("//a[@data-testid=\"tables\"]");
  By topics = By.xpath("//a[@data-testid=\"topics\"]");
  By dashboard = By.xpath("//a[@data-testid=\"dashboards\"]");
  By pipelines = By.xpath("//a[@data-testid=\"pipelines\"]");
  By services = By.xpath("//a[@data-testid=\"service\"]");
  // By ingestion = By.linkText("Ingestion");
  By users = By.xpath("//a[@data-testid=\"user\"]");
  By teams = By.xpath("//a[@data-testid=\"terms\"]");
  By searchBox = By.xpath("//input[@data-testid=\"searchBox\"]");
  By tableName = By.linkText("dim_address");
  By explore = By.xpath("//a[@data-testid=\"appbar-item\"]");
  By settings = By.xpath("(//button[@data-testid=\"menu-button\"])[1]");
  By tags = By.xpath("//a[@data-testid=\"menu-item-Tags\"]");
  By ingestions = By.linkText("Ingestions");
  By home = By.cssSelector("[data-testid='image']");
  By profile = By.cssSelector("[data-testid='dropdown-profile']");
  By logout = By.cssSelector("[data-testid='menu-item-Logout']");
  By help = By.xpath("(//button[@data-testid=\"menu-button\"])[2]");
  By following = By.xpath("//div[@data-testid=\"feedcard\"]");
  By recentlyViewed = By.xpath("//*[@id=\"left-panel\"]/div/div[3]/div/a/button");
  By recentSearch = By.xpath("//button[@data-testid=\"recently-searched\"]");
  By recentSearchWithSpace = By.cssSelector("[data-testid='Recently-Search- ']");
  By docs = By.xpath("//a[@data-testid=\"menu-item-Docs\"]");
  By api = By.xpath("//a[@data-testid=\"menu-item-API\"]");
  By slack = By.xpath("//a[@data-testid=\"menu-item-Slack\"]");
  By userName = By.cssSelector("[data-testid='greeting-text']");
  By serviceName = By.cssSelector("[data-testid='service-name']");
}
