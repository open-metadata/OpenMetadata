package org.openmetadata.catalog.selenium.objectRepository;

import java.util.List;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

public class TableDetails {
  public WebDriver webDriver;

  public TableDetails(WebDriver webDriver) {
    this.webDriver = webDriver;
  }

  By manage = By.xpath("//button[@data-testid=\"tab\"][id=\"manage\"]");
  By owner = By.cssSelector("button[data-testid=\"owner-dropdown\"]");
  By users = By.xpath("//div[@data-testid='dropdown-list']//div[2]//button[2]");
  By selectUser = By.xpath("//div[@data-testid=\"list-item\"]");
  By saveManage = By.cssSelector("[data-testid='saveManageTab']");
  By follow = By.cssSelector("button[data-testid='follow-button']");
  By schema = By.xpath("//button[@data-testid=\"tab\"][[id=\"schema\"]]");;
  By lineage = By.xpath("//button[@data-testid=\"tab\"][id=\"lineage\"]");;
  By lineageComponents = By.xpath("//div[@class=\"tw-relative nowheel \"]");
  By profiler = By.xpath("//button[@data-testid=\"tab\"][id=\"profiler\"]");;
  By sampleData = By.xpath("//button[@data-testid=\"tab\"][id=\"sampleData\"]");;
  By selectTier = By.xpath("(//div[@data-testid=\"icon\"])[1]");
  By tier1 = By.xpath("(/h4[@class='tw-text-base tw-mb-0']");
  By addTagTextbox = By.xpath("//input[@data-testid=\"associatedTagName\"]");
  By selectTag = By.xpath("//span[@data-testid=\"list-item\"][2]");
  By saveTag = By.xpath("//button[@data-testid=\"saveAssociatedTag\"]");
  By tagName = By.xpath("(//div[@data-testid=\"tag-conatiner\"])[1]");
  By removeTag = By.xpath("//span[@data-testid=\"remove\"]");
  By editDescriptionButton = By.xpath("//button[@data-testid= 'edit-description']");
  By editDescriptionBox = By.xpath("//div[@data-testid='enterDescription']/div/div[2]/div/div/div/div/div/div");
  By saveTableDescription = By.xpath("//button[@data-testid=\"save\"]");
  By selectedTag =
      By.xpath("//span[@class=\"tw-no-underline hover:tw-no-underline tw-py-0.5 tw-px-2 tw-pl-2 tw-pr-1\"]");
  By TagName = By.xpath("//div[@data-testid=\"breadcrumb-tags\"]");
  By version = By.xpath("//button[@data-testid=\"version-button\"]");
  By versionDetailsGrid = By.xpath("//div[@class=\"tw-grid tw-gap-0.5\"]");
  By versionRadioButton = By.xpath("//span[@data-testid=\"select-version\"]");
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
  By joinedTables = By.xpath("(//div[@data-testid='frequently-joined-columns']/span/a)");
  By joinedColumns = By.xpath("(//div[@data-testid='frequently-joined-columns']/span/a)");
  By sampleDataTable = By.xpath("//table[@data-testid=\"sample-data-table\"]");

  public By getSampleDataTable() {
    return sampleDataTable;
  }

  public By clickOwnerDropdown() {
    return owner;
  }

  public By clickUsers() {
    return users;
  }

  public By selectUser() {
    return selectUser;
  }

  public By saveManage() {
    return saveManage;
  }

  public By clickFollow() {
    return follow;
  }

  public By profiler() {
    return profiler;
  }

  public By lineage() {
    return lineage;
  }

  public By sampleData() {
    return sampleData;
  }

  public By manage() {
    return manage;
  }

  public By selectTier1() {
    return selectTier;
  }

  public By addTagTextBox() {
    return addTagTextbox;
  }

  public By selectTag() {
    return selectTag;
  }

  public By saveTag() {
    return saveTag;
  }

  public By tagName() {
    return tagName;
  }

  public By removeTag() {
    return removeTag;
  }

  public By editDescriptionButton() {
    return editDescriptionButton;
  }

  public By editDescriptionBox() {
    return editDescriptionBox;
  }

  public By saveTableDescription() {
    return saveTableDescription;
  }

  public By getSelectedTag() {
    return selectedTag;
  }

  public By TagName() {
    return TagName;
  }

  public By version() {
    return version;
  }

  public List<WebElement> versionDetailsGrid() {
    return webDriver.findElements(versionDetailsGrid);
  }

  public List<WebElement> versionRadioButton() {
    return webDriver.findElements(versionRadioButton);
  }

  public By descriptionBox() {
    return descriptionBox;
  }

  public List<WebElement> breadCrumb() {
    return webDriver.findElements(breadCrumb);
  }

  public List<WebElement> lineageNodes() {
    return webDriver.findElements(lineageComponents);
  }

  public By sideDrawer() {
    return sideDrawerLineage;
  }

  public By breadCrumbTier() {
    return breadCrumbTier;
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

  public By columnDescription() {
    return columnDescription;
  }

  public By columnDescriptionBox() {
    return columnDescriptionBox;
  }

  public By joinedTables() {
    return joinedTables;
  }

  public By joinedColumns() {
    return joinedColumns;
  }
}
