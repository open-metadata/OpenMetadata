package org.openmetadata.catalog.selenium.pages.explore;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

import org.apache.http.nio.reactor.EventMask;
import org.junit.jupiter.api.*;
import org.openmetadata.catalog.selenium.events.Events;
import org.openmetadata.catalog.selenium.objectRepository.*;
import org.openmetadata.catalog.selenium.pages.tableDetails.TableDetailsPageTest;
import org.openmetadata.catalog.selenium.properties.Property;
import org.openqa.selenium.Keys;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.interactions.Actions;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.Assert;

public class explore extends TableDetailsPageTest {
    WebDriver webDriver;
    static String url = Property.getInstance().getURL();
    static Actions actions;
    static WebDriverWait wait;
    Integer waitTime = Property.getInstance().getSleepTime();
    String tableName = "dim_address";
    myDataPage myDataPage;
    tagsPage tagsPage;
    servicesPage servicesPage;
    teamsPage teamsPage;
    ingestionPage ingestionPage;
    userListPage userListPage;
    tableDetails tableDetails;
    explorePage explorePage;

    @BeforeEach
    public void openMetadataWindow() {
        System.setProperty("webdriver.chrome.driver", "src/test/resources/drivers/linux/chromedriver");
        ChromeOptions options = new ChromeOptions();
        options.addArguments("--headless");
        options.addArguments("--window-size=1280,800");
        webDriver = new ChromeDriver();
        explorePage = new explorePage(webDriver);
        myDataPage = new myDataPage(webDriver);
        userListPage = new userListPage(webDriver);
        ingestionPage = new ingestionPage(webDriver);
        teamsPage = new teamsPage(webDriver);
        tagsPage = new tagsPage(webDriver);
        tableDetails = new tableDetails(webDriver);
        actions = new Actions(webDriver);
        wait = new WebDriverWait(webDriver, Duration.ofSeconds(30));
        webDriver.manage().window().maximize();
        webDriver.get(url);
    }

    @Test
    @Order(1)
    public void openExplorePage(){
        Events.click(webDriver, myDataPage.closeWhatsNew());
        Events.click(webDriver, explorePage.explore());
    }

    @Test
    @Order(2)
    public void checkTableCount() throws InterruptedException {
        openExplorePage();
        Thread.sleep(2000);
        WebElement tabCount = webDriver.findElement(explorePage.getTableCount());
        int tableCount = Integer.parseInt(tabCount.getText());
        int getServiceCount = 0;
        List<WebElement> listOfItems = explorePage.serviceName();
        List<WebElement> countOfItems = explorePage.serviceCount();
        List<String> Names = new ArrayList<>();
        List<Integer> count = new ArrayList<>();
        for (WebElement sName : listOfItems) {
            Names.add(sName.getText());
            if (Names.contains("Tier1")) {
                break;
            }
        }
        //Adding the service checkbox count and asserting with the table count displayed
        for (int i = 0; i < Names.size() - 1; i++) {
            count.add(Integer.parseInt(countOfItems.get(i).getText()));
            getServiceCount += count.get(i);
        }
        Assert.assertEquals(getServiceCount, tableCount);
    }

    @Test
    @Order(3)
    public void checkTopicCount() throws InterruptedException {
        openExplorePage();
        Thread.sleep(1000);
        Events.click(webDriver, explorePage.topics());
        WebElement topCount = webDriver.findElement(explorePage.getTopicCount());
        int topicCount = Integer.parseInt(topCount.getText());
        int getServiceCount = 0;
        List<WebElement> listOfItems = explorePage.serviceName();
        List<WebElement> countOfItems = explorePage.serviceCount();
        List<String> Names = new ArrayList<>();
        List<Integer> count = new ArrayList<>();
        for (WebElement sName : listOfItems) {
            Names.add(sName.getText());
            if (Names.contains("Tier1")) {
                break;
            }
        }
        //Adding the service checkbox count and asserting with the topic count displayed
        for (int i = 0; i < Names.size() - 1; i++) {
            count.add(Integer.parseInt(countOfItems.get(i).getText()));
            getServiceCount += count.get(i);
        }
        Assert.assertEquals(getServiceCount, topicCount);
    }

    @Test
    @Order(3)
    public void checkDashboardCount() throws InterruptedException {
        openExplorePage();
        Events.click(webDriver, explorePage.dashboard());
        WebElement dashCount = webDriver.findElement(explorePage.getDashboardCount());
        int dashboardCount = Integer.parseInt(dashCount.getText());
        int getServiceCount = 0;
        List<WebElement> listOfItems = explorePage.serviceName();
        List<WebElement> countOfItems = explorePage.serviceCount();
        List<String> Names = new ArrayList<>();
        List<Integer> count = new ArrayList<>();
        for (WebElement sName : listOfItems) {
            Names.add(sName.getText());
            if (Names.contains("Tier1")) {
                break;
            }
        }
        //Adding the service checkbox count and asserting with the dashboard count displayed
        for (int i = 0; i < Names.size() - 1; i++) {
            count.add(Integer.parseInt(countOfItems.get(i).getText()));
            getServiceCount += count.get(i);
        }
        Assert.assertEquals(getServiceCount, dashboardCount);
    }

    @Test
    public void checkPipelineCount() throws InterruptedException {
        openExplorePage();
        Thread.sleep(1000);
        Events.click(webDriver, explorePage.pipeline());
        Thread.sleep(1000);
        WebElement pipCount = webDriver.findElement(explorePage.getPipelineCount());
        int pipelineCount = Integer.parseInt(pipCount.getText());
        int getServiceCount = 0;
        List<WebElement> listOfItems = explorePage.serviceName();
        List<WebElement> countOfItems = explorePage.serviceCount();
        List<String> Names = new ArrayList<>();
        List<Integer> count = new ArrayList<>();
        for (WebElement sName : listOfItems) {
            Names.add(sName.getText());
            if (Names.contains("Tier1")) {
                break;
            }
        }
        //Adding the service checkbox count and asserting with the pipeline count displayed
        for (int i = 0; i < Names.size() - 1; i++) {
            count.add(Integer.parseInt(countOfItems.get(i).getText()));
            getServiceCount += count.get(i);
        }
        Assert.assertEquals(getServiceCount, pipelineCount);
    }

    @Test
    public void checkBasics() throws Exception {
        openExplorePage();
        //Doing add tags first to get Tags checkbox in the left panel
        Events.click(webDriver, explorePage.selectTable());
        Events.click(webDriver, explorePage.addTag());
        Events.click(webDriver, tableDetails.addTagTextBox());
        Events.sendKeys(webDriver, tableDetails.addTagTextBox(), "P");
        Events.click(webDriver, tableDetails.selectTag());
        Events.click(webDriver, tableDetails.saveTag());
        webDriver.navigate().back();
        Events.click(webDriver, explorePage.explore());
        WebElement serviceText = webDriver.findElement(explorePage.serviceText());
        WebElement tierText = webDriver.findElement(explorePage.tierText());
        WebElement tagText = webDriver.findElement(explorePage.tagText());
        WebElement databaseText = webDriver.findElement(explorePage.databaseText());
        try {
            serviceText.isDisplayed();
        } catch (Exception e) {
            throw new Exception("Service Text Not displayed");
        }
        try {
            tierText.isDisplayed();
        } catch (Exception e) {
            throw new Exception("Tier Text Not displayed");
        }
        try {
            tagText.isDisplayed();
        } catch (Exception e) {
            throw new Exception("Tags Text Not displayed");
        }
        try {
            databaseText.isDisplayed();
        } catch (Exception e) {
            throw new Exception("Database Text Not displayed");
        }
    }

    @Test
    public void checkLastUpdatedSort() throws InterruptedException {
        String sendKeys = "Description Added";
        openExplorePage();
        //Adding description to check last updated sort
        Events.click(webDriver, explorePage.selectTable());
        Events.click(webDriver, tableDetails.editDescriptionButton());
        Events.sendKeys(webDriver, tableDetails.editDescriptionBox(), Keys.CONTROL + "A");
        Events.sendKeys(webDriver, tableDetails.editDescriptionBox(), sendKeys);
        Events.click(webDriver, tableDetails.saveTableDescription());
        Events.click(webDriver, explorePage.explore());
        Events.click(webDriver, explorePage.lastWeekSortDesc());
        Events.click(webDriver, explorePage.lastWeekSortAesc());
        WebElement descriptionCheck = webDriver.findElement(explorePage.descriptionCheck());
        Assert.assertEquals(sendKeys, descriptionCheck.getText());
    }

    @Test
    public void checkRandomTableCount() throws InterruptedException {
        Integer[] check;
        openExplorePage();
        Events.click(webDriver, explorePage.bigQueryCheckbox());
        Events.click(webDriver, explorePage.shopifyCheckbox());
        Events.click(webDriver, explorePage.tagSpecialCategoryCheckbox());
        Events.click(webDriver, explorePage.tierTier3Checkbox());
        List<WebElement> selectedCheckbox = explorePage.selectedCheckbox();
        List<Integer> count = new ArrayList<>();
        for (WebElement e : selectedCheckbox) {
            count.add(Integer.parseInt(e.getText()));
        }
        //Checking count to selected checkbox count
        check = new Integer[count.size()];
        check = count.toArray(check);
        for (int i = 0; i < check.length - 1; i++) {
            Assert.assertEquals(check[i], check[i + 1]);
        }
    }

    @Test
    public void checkRandomTopicCount() throws InterruptedException {
        Integer[] check;
        openExplorePage();
        Events.click(webDriver, explorePage.topics());
        Events.click(webDriver, explorePage.tierTier3Checkbox());
        Events.click(webDriver, explorePage.kafka());
        Thread.sleep(1000);
        List<WebElement> selectedCheckbox = explorePage.selectedCheckbox();
        List<Integer> count = new ArrayList<>();
        check = new Integer[count.size()];
        System.out.println("Ssize=" + selectedCheckbox.size());
        System.out.println("Ssize=" + check.length);
        for (WebElement e : selectedCheckbox) {
            count.add(Integer.parseInt(e.getText()));
        }
        //Checking count to selected checkbox count
        check = count.toArray(check);
        for (int i = 0; i < check.length - 1; i++) {
            Assert.assertEquals(check[i], check[i + 1]);
        }
    }

    @Test
    public void checkRandomDashboardCount() throws InterruptedException {
        Integer[] check;
        openExplorePage();
        Events.click(webDriver, explorePage.dashboard());
        Events.click(webDriver, explorePage.tierTier3Checkbox());
        Events.click(webDriver, explorePage.superset());
        List<WebElement> selectedCheckbox = explorePage.selectedCheckbox();
        List<Integer> count = new ArrayList<>();
        check = new Integer[count.size()];
        for (WebElement e : selectedCheckbox) {
            count.add(Integer.parseInt(e.getText()));
        }
        //Checking count to selected checkbox count
        check = count.toArray(check);
        for (int i = 0; i < check.length - 1; i++) {
            Assert.assertEquals(check[i], check[i + 1]);
        }
    }

    @Test
    public void checkRandomPipelineCount() throws InterruptedException {
        Integer[] check;
        openExplorePage();
        Events.click(webDriver, explorePage.pipeline());
        Events.click(webDriver, explorePage.tierTier3Checkbox());
        Events.click(webDriver, explorePage.airflow());
        List<WebElement> selectedCheckbox = explorePage.selectedCheckbox();
        List<Integer> count = new ArrayList<>();
        check = new Integer[count.size()];
        System.out.println("Ssize=" + selectedCheckbox.size());
        System.out.println("Ssize=" + check.length);
        for (WebElement e : selectedCheckbox) {
            count.add(Integer.parseInt(e.getText()));
        }
        //Checking count to selected checkbox count
        check = count.toArray(check);
        for (int i = 0; i < check.length - 1; i++) {
            Assert.assertEquals(check[i], check[i + 1]);
        }
    }

    @Test
    public void checkSearchBarInvalidValue() throws InterruptedException {
        String searchCriteria = "asasds";
        Events.click(webDriver, myDataPage.closeWhatsNew());
        Events.sendKeys(webDriver, myDataPage.getSearchBox(), searchCriteria);
        Events.sendEnter(webDriver, myDataPage.getSearchBox());
        Thread.sleep(1000);
        try {
            WebElement errorMessage = webDriver.findElement(explorePage.errorMessage());
            Assert.assertEquals(errorMessage.getText(), "No matching data assets found for " + searchCriteria);
        } catch (Exception e) {
            e.printStackTrace();
        }
        Thread.sleep(1000);
    }

    @AfterEach
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
