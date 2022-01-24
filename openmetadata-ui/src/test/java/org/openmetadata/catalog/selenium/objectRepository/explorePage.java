package org.openmetadata.catalog.selenium.objectRepository;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;

import java.util.List;

public class explorePage {
    WebDriver webDriver;

    public explorePage(WebDriver webDriver) {
        this.webDriver = webDriver;
    }

    By explore = By.cssSelector("[data-testid='appbar-item'][id='explore']");
    By tableCount = By.xpath("(//span[@data-testid='filter-count'])[1]");
    By topicsCount = By.xpath("(//span[@data-testid='filter-count'])[2]");
    By dashboardCount = By.xpath("(//span[@data-testid='filter-count'])[3]");
    By pipelineCount = By.xpath("(//span[@data-testid='filter-count'])[4]");
    By tables = By.xpath("(//button[@data-testid='tab'])[1]");
    By topics = By.xpath("(//button[@data-testid='tab'])[2]");
    By dashboard = By.xpath("(//button[@data-testid='tab'])[3]");
    By pipeline = By.xpath("(//button[@data-testid='tab'])[4]");
    By next = By.linkText("Next");
    By pagination = By.xpath("//div[@data-testid=\"pagination-button\"]");
    By bigQueryCheckbox = By.xpath("//input[@id=\"BigQuery\"]");
    By serviceName = By.xpath("//div[@class=\"filters-title tw-w-40 tw-truncate custom-checkbox-label\"]");
    By countService = By.xpath("//span[@class=\"tw-py-px tw-px-1 tw-ml-1 tw-border tw-rounded tw-text-xs tw-min-w-badgeCount tw-text-center tw-bg-badge tw-py-0 tw-px-0\"]");
    By errorMessage = By.xpath("//p[@data-testid=\"no-search-results\"]");
    By glueCheckbox = By.xpath("//input[@id=\"Glue\"]");
    By selectTable = By.id("tabledatacard1Title");
    By addTag = By.xpath("(//span[@class=\"tw-no-underline hover:tw-no-underline tw-py-0.5 tw-px-2\"])[1]");
    By serviceText = By.xpath("//h6[contains(text(),'Service')]");
    By tierText = By.xpath("//h6[contains(text(),'Tier')]");
    By databaseText = By.xpath("//h6[contains(text(),'Database')]");
    By tagText = By.xpath("//h6[contains(text(),'Tags')]");
    By lastWeekSortDesc = By.xpath("//i[@class=\"fas fa-sort-amount-up-alt tw-text-base tw-text-primary\"]");
    By lastWeekSortAesc = By.xpath("//i[@class=\"fas fa-sort-amount-down-alt tw-text-base tw-text-primary\"]");
    By updatedDescription = By.xpath("(//div[@class=\"content-container\"])[1]");
    By shopifyCheckbox = By.id("shopify");
    By tagSpecialCategoryCheckbox = By.id("PersonalData.SpecialCategory");
    By tierTier3Checkbox = By.id("Tier.Tier3");
    By selectedCheckbox = By.xpath("//span[@class=\"tw-py-px tw-px-1 tw-ml-1 tw-border tw-rounded tw-text-xs tw-min-w-badgeCount tw-text-center tw-bg-primary tw-text-white tw-border-none tw-py-0 tw-px-0\"]");
    By Kafka = By.id("Kafka");
    By superset = By.id("Superset");
    By airflow = By.id("Airflow");


    public WebElement explore() {
        return webDriver.findElement(explore);
    }

    public WebElement getTableCount() {
        return webDriver.findElement(tableCount);
    }

    public WebElement getTopicCount() {
        return webDriver.findElement(topicsCount);
    }

    public WebElement getDashboardCount() {
        return webDriver.findElement(dashboardCount);
    }

    public WebElement getPipelineCount() {
        return webDriver.findElement(pipelineCount);
    }

    public WebElement dashboard() {
        return webDriver.findElement(dashboard);
    }

    public WebElement pipeline() {
        return webDriver.findElement(pipeline);
    }

    public WebElement tables() {
        return webDriver.findElement(tables);
    }

    public WebElement topics() {
        return webDriver.findElement(topics);
    }

    public WebElement pagination() {
        return webDriver.findElement(pagination);
    }

    public WebElement next() {
        return webDriver.findElement(next);
    }

    public WebElement bigQueryCheckbox() {
        return webDriver.findElement(bigQueryCheckbox);
    }

    public List<WebElement> serviceName() {
        return webDriver.findElements(serviceName);
    }

    public List<WebElement> serviceCount() {
        return webDriver.findElements(countService);
    }

    public WebElement errorMessage() {
        return webDriver.findElement(errorMessage);
    }

    public WebElement glueCheckbox() {
        return webDriver.findElement(glueCheckbox);
    }

    public WebElement selectTable() {
        return webDriver.findElement(selectTable);
    }

    public WebElement addTag() {
        return webDriver.findElement(addTag);
    }

    public WebElement serviceText() {
        return webDriver.findElement(serviceText);
    }

    public WebElement tierText() {
        return webDriver.findElement(tierText);
    }

    public WebElement databaseText() {
        return webDriver.findElement(databaseText);
    }

    public WebElement tagText() {
        return webDriver.findElement(tagText);
    }

    public WebElement lastWeekSortDesc() {
        return webDriver.findElement(lastWeekSortDesc);
    }

    public WebElement lastWeekSortAesc() {
        return webDriver.findElement(lastWeekSortAesc);
    }

    public WebElement descriptionCheck() {
        return webDriver.findElement(updatedDescription);
    }

    public WebElement shopifyCheckbox() {
        return webDriver.findElement(shopifyCheckbox);
    }

    public WebElement tagSpecialCategoryCheckbox() {
        return webDriver.findElement(tagSpecialCategoryCheckbox);
    }

    public WebElement tierTier3Checkbox() {
        return webDriver.findElement(tierTier3Checkbox);
    }

    public List<WebElement> selectedCheckbox() {
        return webDriver.findElements(selectedCheckbox);
    }

    public WebElement kafka() {
        return webDriver.findElement(Kafka);
    }

    public WebElement superset() {
        return webDriver.findElement(superset);
    }

    public WebElement airflow() {
        return webDriver.findElement(airflow);
    }
}