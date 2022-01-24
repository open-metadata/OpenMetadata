package org.openmetadata.catalog.selenium.objectRepository;


import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

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
    By tables = By.linkText("Tables");
    By topics = By.linkText("Topics");
    By dashboard = By.linkText("Dashboards");
    By pipelines = By.linkText("Pipelines");
    By services = By.linkText("Services");
    By ingestion = By.linkText("Ingestion");
    By users = By.linkText("Users");
    By teams = By.linkText("Teams");
    By searchBox = By.id("searchBox");
    By tableName = By.linkText("dim_address");
    By explore = By.linkText("Explore");
    By settings = By.id("menu-button-Settings");
    By tags = By.id("menu-item-2");
    By ingestions = By.linkText("Ingestions");
    By home = By.cssSelector("[data-testid='image']");
    By profile = By.cssSelector("[data-testid='dropdown-profile']");
    By logout = By.cssSelector("[data-testid='menu-item-Logout']");
    By help = By.xpath("//button[@id='menu-button-Need Help']");
    By following = By.xpath("//*[@id=\"feedData\"]/div[1]/div[2]/div[2]/div/div/div/p");
    By recentlyViewed = By.xpath("//*[@id=\"left-panel\"]/div/div[3]/div/a/button");
    By recentSearch = By.xpath("/html/body/div/div/div[1]/div[2]/div/div[1]/div/div[4]/div/a/button");
    By recentSearchWithSpace = By.cssSelector("[data-testid='Recently-Search- ']");
    By Docs = By.xpath("//span[contains(text(),'Docs')]");
    By API = By.xpath("//button[contains(text(),'API')]");
    By Slack = By.xpath("//span[contains(text(),'Slack')]");
    By userName = By.cssSelector("[data-testid='greeting-text']");
    By heading = By.className("tw-heading");

    public WebElement heading() {
        return webDriver.findElement(heading);
    }

    public WebElement closeWhatsNew() {
        return webDriver.findElement(closeWhatsNew);
    }

    public WebElement openWhatsNew() {
        return webDriver.findElement(openWhatsNew);
    }

    public WebElement page2() {
        return webDriver.findElement(page2);
    }

    public WebElement changeLog() {
        return webDriver.findElement(changeLog);
    }

    public String getVersion() {
        return webDriver.findElement(version).getText();
    }

    public WebElement getTables() {
        return webDriver.findElement(tables);
    }

    public WebElement getTopics() {
        return webDriver.findElement(topics);
    }

    public WebElement getDashboard() {
        return webDriver.findElement(dashboard);
    }

    public WebElement getPipelines() {
        return webDriver.findElement(pipelines);
    }

    public WebElement getServices() {
        return webDriver.findElement(services);
    }

    public WebElement getIngestion() {
        return webDriver.findElement(ingestion);
    }

    public WebElement getUsers() {
        return webDriver.findElement(users);
    }

    public WebElement getTeams() {
        return webDriver.findElement(teams);
    }

    public WebElement getSearchBox() {
        return webDriver.findElement(searchBox);
    }

    public WebElement selectTable() {
        return webDriver.findElement(tableName);
    }

    public WebElement clickExplore() {
        return webDriver.findElement(explore);
    }

    public WebElement openSettings() {
        return webDriver.findElement(settings);
    }

    public WebElement getTags() {
        return webDriver.findElement(tags);
    }

    public WebElement getIngestions() {
        return webDriver.findElement(ingestions);
    }

    public WebElement clickHome() {
        return webDriver.findElement(home);
    }

    public WebElement profile() {
        return webDriver.findElement(profile);
    }

    public WebElement logout() {
        return webDriver.findElement(logout);
    }

    public WebElement help() {
        return webDriver.findElement(help);
    }

    public WebElement following() {
        return webDriver.findElement(following);
    }

    public WebElement recentlyViewed() {
        return webDriver.findElement(recentlyViewed);
    }

    public WebElement recentSearch() {
        return webDriver.findElement(recentSearch);
    }

    public WebElement recentSearchWithSpace() {
        return webDriver.findElement(recentSearchWithSpace);
    }

    public WebElement docs() {
        return webDriver.findElement(Docs);
    }

    public WebElement api() {
        return webDriver.findElement(API);
    }

    public WebElement slack() {
        return webDriver.findElement(Slack);
    }

    public WebElement userName() {
        return webDriver.findElement(userName);
    }
}
