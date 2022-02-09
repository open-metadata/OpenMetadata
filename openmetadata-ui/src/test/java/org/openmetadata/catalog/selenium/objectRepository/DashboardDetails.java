package org.openmetadata.catalog.selenium.objectRepository;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;

public class DashboardDetails {

  public WebDriver webDriver;

  public DashboardDetails(WebDriver webDriver) {
    this.webDriver = webDriver;
  }

  By dashboard = By.xpath("(//button[@data-testid='tab'])[3]");
  By editChartDescription = By.xpath("(//img[@data-testid='image']/parent::button)[3]");
  By descriptionBox = By.xpath("(//div[@data-testid='description'])[2]");
  By addChartTag = By.xpath("(//div[@data-testid='tag-conatiner'])[2]");
  By selectedTag = By.xpath("//span[@class='tw-no-underline hover:tw-no-underline tw-py-0.5 tw-px-2 tw-pl-2 tw-pr-1']");
  By chartTags = By.xpath("(//div[@data-testid='tag-conatiner'])[2]");

  public By dashboard() {
    return dashboard;
  }

  public By editChartDescription() {
    return editChartDescription;
  }

  public WebElement getDescriptionBox() {
    return webDriver.findElement(descriptionBox);
  }

  public By getSelectedTag() {
    return selectedTag;
  }

  public By addChartTag() {
    return addChartTag;
  }

  public By getChartTags() {
    return chartTags;
  }
}
