package org.openmetadata.catalog.selenium.objectRepository;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

public class myDataPage {

  public WebDriver webDriver;

  public myDataPage(WebDriver webDriver) {
    this.webDriver = webDriver;
  }

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
  By following = By.xpath("//*[@id=\"feedData\"]/div[1]/div[2]/div[2]/div/div/div/p");
  By recentlyViewed = By.xpath("//*[@id=\"left-panel\"]/div/div[3]/div/a/button");
  By recentSearch = By.xpath("/html/body/div/div/div[1]/div[2]/div/div[1]/div/div[4]/div/a/button");
  By recentSearchWithSpace = By.cssSelector("[data-testid='Recently-Search- ']");
  By Docs = By.xpath("//span[contains(text(),'Docs')]");
  By API = By.xpath("//button[contains(text(),'API')]");
  By Slack = By.xpath("//span[contains(text(),'Slack')]");
  By userName = By.cssSelector("[data-testid='greeting-text']");
  By heading = By.className("tw-heading");

  public By heading() {
    return heading;
  }

  public By closeWhatsNew() {
    return closeWhatsNew;
  }

  public By openWhatsNew() {
    return openWhatsNew;
  }

  public By page2() {
    return page2;
  }

  public By changeLog() {
    return changeLog;
  }

  public By getVersion() {
    return version;
  }

  public By getTables() {
    return tables;
  }

  public By getTopics() {
    return topics;
  }

  public By getDashboard() {
    return dashboard;
  }

  public By getPipelines() {
    return pipelines;
  }

  public By getServices() {
    return services;
  }

  /*public By getIngestion() {
    return ingestion;
  }*/

  public By getUsers() {
    return users;
  }

  public By getTeams() {
    return teams;
  }

  public By getSearchBox() {
    return searchBox;
  }

  public By selectTable() {
    return tableName;
  }

  public By clickExplore() {
    return explore;
  }

  public By openSettings() {
    return settings;
  }

  public By getTags() {
    return tags;
  }

  public By getIngestions() {
    return ingestions;
  }

  public By clickHome() {
    return home;
  }

  public By profile() {
    return profile;
  }

  public By logout() {
    return logout;
  }

  public By help() {
    return help;
  }

  public By following() {
    return following;
  }

  public By recentlyViewed() {
    return recentlyViewed;
  }

  public By recentSearch() {
    return recentSearch;
  }

  public By recentSearchWithSpace() {
    return recentSearchWithSpace;
  }

  public By docs() {
    return Docs;
  }

  public By api() {
    return API;
  }

  public By slack() {
    return Slack;
  }

  public By userName() {
    return userName;
  }
}
