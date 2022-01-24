package org.openmetadata.catalog.selenium.objectRepository;

import java.util.List;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

public class tableDetails {
  public WebDriver webDriver;

  public tableDetails(WebDriver webDriver) {
    this.webDriver = webDriver;
  }

  By manage = By.xpath("//button[@id='manage']");
  By owner = By.cssSelector("button[data-testid=\"owner-dropdown\"]");
  By users = By.xpath("//div[@data-testid='dropdown-list']//div[2]//button[2]");
  By selectUser = By.xpath("//div[@class=\"tw-py-1 tw-max-h-60 tw-overflow-y-auto\"]");
  By saveManage = By.cssSelector("[data-testid='saveManageTab']");
  By follow = By.cssSelector("button[data-testid='follow-button']");
  By schema = By.xpath("//button[@id='schema']");
  By lineage = By.xpath("//button[@id='lineage']");
  By lineageComponents = By.xpath("//div[@class=\"tw-relative nowheel \"]");
  By profiler = By.xpath("//button[@id='profiler']");
  By sampleData = By.xpath("//button[@id='sample data']");
  By selectTier = By.xpath("(//p[@class=\"tw-font-medium tw-pr-2\"])[1]");
  By tier1 = By.xpath("(/h4[@class='tw-text-base tw-mb-0']");
  By addTagTextbox = By.xpath("//input[@data-testid=\"associatedTagName\"]");
  By selectTag = By.xpath("//span[@data-testid=\"list-item\"][2]");
  By saveTag = By.xpath("//button[@data-testid=\"saveAssociatedTag\"]");
  By tagName = By.xpath("(//div[@class=\"tw-flex tw-flex-wrap\"])[1]");
  By removeTag = By.xpath("//span[@data-testid=\"remove\"]");
  By editDescriptionButton = By.xpath("//button[@data-testid= 'edit-description']");
  By editDescriptionBox = By.xpath("//div[@data-testid='enterDescription']/div/div[2]/div/div/div/div/div/div");
  By saveTableDescription = By.xpath("//button[@data-testid=\"save\"]");
  By selectedTag =
      By.xpath("//span[@class=\"tw-no-underline hover:tw-no-underline tw-py-0.5 tw-px-2 tw-pl-2 tw-pr-1\"]");
  By TagName = By.xpath("(//span[@class=\"tw-no-underline hover:tw-no-underline tw-px-1\"])[1]");
  By version = By.xpath("//button[@data-testid=\"version-button\"]");
  By versionDetailsGrid = By.xpath("//div[@class=\"tw-grid tw-gap-0.5\"]");
  By versionRadioButton = By.xpath("//span[@data-testid=\"select-version\"]");
  By versionDrawer = By.xpath("//div[@class='timeline-drawer open']");
  By descriptionBox = By.xpath("//div[@data-testid = \"description\"]");
  By breadCrumb = By.xpath("//li[@data-testid=\"breadcrumb-link\"]");
  By sideDrawerLineage = By.xpath("//header[@class=\"tw-flex tw-justify-between\"]");
  By breadCrumbTier = By.xpath("//div[@class=\"tw-flex tw-gap-1 tw-mb-2 tw-mt-1 tw-ml-7 tw-flex-wrap\"]");
  By profilerDrawer = By.cssSelector("span[class = \"tw-mr-2 tw-cursor-pointer\"]");
  By chart = By.xpath("//div[@class=\"recharts-wrapper\"]");
  By toolTip =
      By.xpath("//div[@class=\"recharts-tooltip-wrapper recharts-tooltip-wrapper-left recharts-tooltip-wrapper-top\"]");
  By columnDescription = By.xpath("(//td[@class=\"tableBody-cell tw-group tw-relative\"]/div/span/span/div/div)[1]");
  By columnDescriptionBox = By.xpath("//div[@data-testid='enterDescription']/div/div[2]/div/div/div/div/div/div");

  public WebElement clickOwnerDropdown() {
    return webDriver.findElement(owner);
  }

  public WebElement clickUsers() {
    return webDriver.findElement(users);
  }

  public WebElement selectUser() {
    return webDriver.findElement(selectUser);
  }

  public WebElement saveManage() {
    return webDriver.findElement(saveManage);
  }

  public WebElement clickFollow() {
    return webDriver.findElement(follow);
  }

  public WebElement profiler() {
    return webDriver.findElement(profiler);
  }

  public WebElement lineage() {
    return webDriver.findElement(lineage);
  }

  public WebElement sampleData() {
    return webDriver.findElement(sampleData);
  }

  public WebElement manage() {
    return webDriver.findElement(manage);
  }

  public WebElement selectTier1() {
    return webDriver.findElement(selectTier);
  }

  public WebElement addTagTextBox() {
    return webDriver.findElement(addTagTextbox);
  }

  public WebElement selectTag() {
    return webDriver.findElement(selectTag);
  }

  public WebElement saveTag() {
    return webDriver.findElement(saveTag);
  }

  public WebElement tagName() {
    return webDriver.findElement(tagName);
  }

  public WebElement removeTag() {
    return webDriver.findElement(removeTag);
  }

  public WebElement editDescriptionButton() {
    return webDriver.findElement(editDescriptionButton);
  }

  public WebElement editDescriptionBox() {
    return webDriver.findElement(editDescriptionBox);
  }

  public WebElement saveTableDescription() {
    return webDriver.findElement(saveTableDescription);
  }

  public WebElement getSelectedTag() {
    return webDriver.findElement(selectedTag);
  }

  public WebElement TagName() {
    return webDriver.findElement(TagName);
  }

  public WebElement version() {
    return webDriver.findElement(version);
  }

  public List<WebElement> versionDetailsGrid() {
    return webDriver.findElements(versionDetailsGrid);
  }

  public List<WebElement> versionRadioButton() {
    return webDriver.findElements(versionRadioButton);
  }

  public WebElement versionDrawer() {
    return webDriver.findElement(versionDrawer);
  }

  public WebElement descriptionBox() {
    return webDriver.findElement(descriptionBox);
  }

  public List<WebElement> breadCrumb() {
    return webDriver.findElements(breadCrumb);
  }

  public List<WebElement> lineageNodes() {
    return webDriver.findElements(lineageComponents);
  }

  public WebElement sideDrawer() {
    return webDriver.findElement(sideDrawerLineage);
  }

  public WebElement breadCrumbTier() {
    return webDriver.findElement(breadCrumbTier);
  }

  public List<WebElement> profilerColumn() {
    return webDriver.findElements(profilerDrawer);
  }

  public List<WebElement> chart() {
    return webDriver.findElements(chart);
  }

  public List<WebElement> toolTip() {
    return webDriver.findElements(toolTip);
  }

  public WebElement columnDescription() {
    return webDriver.findElement(columnDescription);
  }

  public WebElement columnDescriptionBox() {
    return webDriver.findElement(columnDescriptionBox);
  }
}
