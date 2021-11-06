package org.openmetadata.catalog.selenium.pages.pipelineDetails;

import com.github.javafaker.Faker;
import org.openmetadata.catalog.selenium.events.Events;
import org.openmetadata.catalog.selenium.properties.Property;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;

import java.time.Duration;
import java.util.ArrayList;

public class PipelineDetailsPageTest {
    static WebDriver webDriver;
    static String url = Property.getInstance().getURL();
    Integer waitTime = Property.getInstance().getSleepTime();
    static Faker faker = new Faker();
    String pipelineName = "dim_product etl";
    static String enterDescription = "//div[@data-testid='enterDescription']/div/div[2]/div/div/div/div/div/div";
    static Actions actions;
    static WebDriverWait wait;

    @BeforeMethod
    public void openMetadataWindow() {
        System.setProperty("webdriver.chrome.driver", "src/test/resources/drivers/linux/chromedriver");
        ChromeOptions options = new ChromeOptions();
        options.addArguments("--headless");
        webDriver = new ChromeDriver();
        actions = new Actions(webDriver);
        wait = new WebDriverWait(webDriver, Duration.ofSeconds(5));
        webDriver.manage().window().maximize();
        webDriver.get(url);
    }

    @Test(priority = 1)
    public void openExplorePage() throws InterruptedException {
        Events.click(webDriver, By.cssSelector("[data-testid='closeWhatsNew']")); // Close What's new
        Events.click(webDriver, By.cssSelector("[data-testid='appbar-item'][id='explore']")); // Explore
        Events.click(webDriver, By.xpath("(//button[@data-testid='tab'])[4]")); // Pipeline
        Thread.sleep(waitTime);
    }

    @Test(priority = 2)
    public void editDescription() throws InterruptedException {
        openExplorePage();
        Events.click(webDriver, By.cssSelector("[data-testid='sortBy']")); // Sort By
        Events.click(webDriver, By.cssSelector("[data-testid='list-item']")); // Last Updated
        Events.click(webDriver, By.xpath("(//a[@data-testid='table-link'])[last()]"));
        Events.click(webDriver, By.cssSelector("[data-testid='edit-description']"));
        webDriver.findElement(By.xpath(enterDescription)).sendKeys(faker.address().toString());
        Events.click(webDriver, By.cssSelector("[data-testid='save']"));
    }

    @Test(priority = 3)
    public void addTag() throws InterruptedException {
        openExplorePage();
        Events.click(webDriver, By.cssSelector("[data-testid='sortBy']")); // Sort By
        Events.click(webDriver, By.cssSelector("[data-testid='list-item']")); // Last Updated
        Events.click(webDriver, By.xpath("(//a[@data-testid='table-link'])[last()]"));
        Thread.sleep(waitTime);
        Events.click(webDriver, By.cssSelector("[data-testid='tags']"));
        Events.click(webDriver, By.cssSelector("[data-testid='associatedTagName']"));
        for (int i = 1; i <=2; i++){
            wait.until(ExpectedConditions.elementToBeClickable(
                            webDriver.findElement(By.cssSelector("[data-testid='associatedTagName']"))))
                    .sendKeys("P");
            Events.click(webDriver, By.cssSelector("[data-testid='list-item']"));
        }
        Events.click(webDriver, By.cssSelector("[data-testid='saveAssociatedTag']"));
        webDriver.navigate().back();
        webDriver.navigate().refresh();
    }

    @Test(priority = 4)
    public void removeTag() throws InterruptedException {
        openExplorePage();
        Events.click(webDriver, By.cssSelector("[data-testid='sortBy']")); // Sort By
        Events.click(webDriver, By.cssSelector("[data-testid='list-item']")); // Last Updated
        Events.click(webDriver, By.xpath("(//a[@data-testid='table-link'])[1]"));
        Events.click(webDriver, By.cssSelector("[data-testid='tag-conatiner']"));
        Events.click(webDriver, By.cssSelector("[data-testid='remove']"));
        Events.click(webDriver, By.cssSelector("[data-testid='remove']"));
        Events.click(webDriver, By.cssSelector("[data-testid='saveAssociatedTag']"));
    }

    @Test(priority = 5)
    public void editTaskDescription() throws InterruptedException {
        openExplorePage();
        Events.click(webDriver, By.cssSelector("[data-testid='sortBy']")); // Sort By
        Events.click(webDriver, By.cssSelector("[data-testid='list-item']")); // Last Updated
        Events.click(webDriver, By.xpath("(//a[@data-testid='table-link'])[last()]"));
        Thread.sleep(waitTime);
        actions.moveToElement(webDriver.findElement(By.xpath("//div[@data-testid='description']/button"))).perform();
        Events.click(webDriver, By.xpath("//div[@data-testid='description']/button"));
        webDriver.findElement(By.xpath(enterDescription)).sendKeys(faker.address().toString());
        Events.click(webDriver, By.cssSelector("[data-testid='save']"));
    }

    @Test(priority = 6)
    public void checkLineage() throws InterruptedException {
        openExplorePage();
        webDriver.findElement(By.cssSelector("[data-testid='searchBox']")).sendKeys(pipelineName);
        Events.click(webDriver, By.cssSelector("[data-testid='data-name'][id ='sample_airflowdim_product_etl']"));
        Events.click(webDriver, By.xpath("(//button[@data-testid='tab'])[2]"));
        for (int i=1; i<=3; i++) {
            WebElement lineageEntity = webDriver.findElement(
                    By.xpath("(//span[@data-testid='lineage-entity'])" + "[" + i + "]"));
            actions.dragAndDropBy(lineageEntity, 100, 200).build();
        }
    }

    @Test(priority = 7)
    public void checkManage() throws InterruptedException {
        openExplorePage();
        Events.click(webDriver, By.cssSelector("[data-testid='sortBy']")); // Sort By
        Events.click(webDriver, By.cssSelector("[data-testid='list-item']")); // Last Updated
        Events.click(webDriver, By.xpath("(//a[@data-testid='table-link'])[last()]"));
        Events.click(webDriver, By.xpath("(//button[@data-testid='tab'])[3]"));
        Events.click(webDriver, By.cssSelector("[data-testid='owner-dropdown']")); // Owner
        wait.until(ExpectedConditions.elementToBeClickable(
                webDriver.findElement(By.cssSelector("[data-testid='searchInputText']"))));
        webDriver.findElement(By.cssSelector("[data-testid='searchInputText']")).sendKeys("Cloud");
        Events.click(webDriver, By.cssSelector("[data-testid='list-item']")); // Select User/Team
        Events.click(webDriver, By.cssSelector("[data-testid='card-list']")); // Select Tier
        Events.click(webDriver, By.cssSelector("[data-testid='saveManageTab']")); // Save
        webDriver.navigate().back();
        webDriver.navigate().refresh();
    }

    @Test(priority = 8)
    public void checkBreadCrumb() throws InterruptedException {
        openExplorePage();
        webDriver.findElement(By.cssSelector("[data-testid='searchBox']")).sendKeys(pipelineName);
        Events.click(webDriver, By.cssSelector("[data-testid='data-name'][id ='sample_airflowdim_product_etl']"));
        Thread.sleep(waitTime);
        Events.click(webDriver, By.cssSelector("[data-testid='breadcrumb-link']"));
        Events.click(webDriver, By.cssSelector("[data-testid='description-edit']")); // edit description
        webDriver.findElement(By.xpath(enterDescription)).sendKeys(faker.address().toString());
        Events.click(webDriver, By.cssSelector("[data-testid='save']"));
        for (int i = 1; i <= 3; i++) { //check topics in service
            Events.click(webDriver, By.xpath("(//tr[@data-testid='column']//td[1]/a)" + "[" + i + "]")); // pipelines
            Thread.sleep(waitTime);
            webDriver.navigate().back();
        }
    }

    @AfterMethod
    public void closeTabs() {
        ArrayList<String> tabs = new ArrayList<>(webDriver.getWindowHandles());
        String originalHandle = webDriver.getWindowHandle();
        for (String handle : webDriver.getWindowHandles()) {
            if (!handle.equals(originalHandle)) {
                webDriver.switchTo().window(handle);
                webDriver.close();
            }
        }
        webDriver.switchTo().window(tabs.get(0)).close();
    }
}
