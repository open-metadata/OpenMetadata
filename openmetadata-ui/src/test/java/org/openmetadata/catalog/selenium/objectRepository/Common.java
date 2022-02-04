package org.openmetadata.catalog.selenium.objectRepository;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

public class Common {
  WebDriver webDriver;
  static String enterDescription = "//div[@data-testid='enterDescription']/div/div[2]/div/div/div/div/div/div";

  public Common(WebDriver webDriver) {
    this.webDriver = webDriver;
  }

  By displayName = By.name("name");
  By descriptionBoldButton = By.cssSelector("[data-testid='boldButton']");
  By descriptionItalicButton = By.cssSelector("[data-testid='italicButton']");
  By descriptionLinkButton = By.cssSelector("[data-testid='linkButton']");
  By descriptionSaveButton = By.cssSelector("[data-testid='saveButton']");
  By addDescriptionString = By.xpath(enterDescription);
  By editTagCategoryDescription = By.cssSelector("[data-testid='edit-description']");
  By editDescriptionSaveButton = By.cssSelector("[data-testid='save']");
  By closeWhatsNew = By.cssSelector("[data-testid='closeWhatsNew']");
  By headerSettings = By.cssSelector("[data-testid='menu-button'][id='menu-button-Settings']");

  By headerSettingsServices = By.cssSelector("[data-testid='menu-item-Services']");
  By addServiceButton = By.cssSelector("[data-testid='add-service-button']");
  By noServicesAddServiceButton = By.cssSelector("[data-testid='add-new-user-button']");
  By serviceName = By.cssSelector("[data-testid='name']");
  By serviceUsername = By.cssSelector("[name='username']");
  By servicePassword = By.cssSelector("[name='password']");
  By nextButton = By.cssSelector("[data-testid='next-button']");
  By saveServiceButton = By.cssSelector("[data-testid='deploy-button']");
  By saveEditedService = By.cssSelector("[data-testid='save-button']");
  By saveConnectionConfig = By.cssSelector("[data-testid='saveManageTab']");
  By searchResults = By.cssSelector("[data-testid='search-results']");
  By searchBar = By.cssSelector("[data-testid='searchBox']");
  By searchSuggestion = By.cssSelector("[data-testid='data-name']");
  By editAssociatedTagButton = By.xpath("//div[@data-testid='tag-conatiner']//span");
  By enterAssociatedTagName = By.cssSelector("[data-testid='associatedTagName']");
  By tagListItem = By.cssSelector("[data-testid='list-item']");
  By saveAssociatedTag = By.cssSelector("[data-testid='saveAssociatedTag']");
  By searchResultsList = By.xpath("//div[@data-testid='search-results']/div");
  By ownerDropdown = By.cssSelector("[data-testid='owner-dropdown']");
  By ownerSearchBox = By.cssSelector("[data-testid='searchInputText']");
  By closeErrorMessage = By.cssSelector("[data-testid='dismiss']");
  By serviceUrl = By.cssSelector("[data-testid='url']");
  By servicePort = By.cssSelector("[data-testid='port']");
  By databaseName = By.cssSelector("[data-testid='database']");

  public By displayName() {
    return displayName;
  }

  public By descriptionBoldButton() {
    return descriptionBoldButton;
  }

  public By descriptionItalicButton() {
    return descriptionItalicButton;
  }

  public By descriptionLinkButton() {
    return descriptionLinkButton;
  }

  public By descriptionSaveButton() {
    return descriptionSaveButton;
  }

  public By addDescriptionString() {
    return addDescriptionString;
  }

  public By editTagCategoryDescription() {
    return editTagCategoryDescription;
  }

  public By editDescriptionSaveButton() {
    return editDescriptionSaveButton;
  }

  public By containsText(String matchingText) {
    return By.xpath("//*[text()[contains(.,'" + matchingText + "')]] ");
  }

  public By closeWhatsNew() {
    return closeWhatsNew;
  }

  public By headerSettings() {
    return headerSettings;
  }

  public By headerSettingsServices() {
    return headerSettingsServices;
  }

  public By addServiceButton() {
    return addServiceButton;
  }

  public By noServicesAddServiceButton() {
    return noServicesAddServiceButton;
  }

  public By serviceType(String serviceType) {
    return By.cssSelector("[data-testid='" + serviceType + "']");
  }

  public By serviceName() {
    return serviceName;
  }

  public By serviceUsername() {
    return serviceUsername;
  }

  public By servicePassword() {
    return servicePassword;
  }

  public By nextButton() {
    return nextButton;
  }

  public By saveServiceButton() {
    return saveServiceButton;
  }

  public By deleteServiceButton(String serviceName) {
    return By.cssSelector("[data-testid='delete-service-" + serviceName + "']");
  }

  public By saveEditedService() {
    return saveEditedService;
  }

  public By serviceDetailsTabs(String tab) {
    return By.cssSelector("[data-testid='tab'][id='" + tab + "']");
  }

  public By saveConnectionConfig() {
    return saveConnectionConfig;
  }

  public By selectServiceTab(int index) {
    return By.xpath("(//div[@data-testid='tab'])[" + index + "]");
  }

  public By headerSettingsMenu(String menuItem) {
    return By.cssSelector("[data-testid='menu-item-" + menuItem + "']");
  }

  public By selectOverview(String overview) {
    return By.cssSelector("[data-testid='" + overview + "']");
  }

  public By explorePagination(int index) {
    return By.xpath("//div[@data-testid='pagination-button']//ul//li[" + index + "]");
  }

  public By selectFilterExplore(String filter) {
    return By.cssSelector("[data-testid='checkbox'][id='" + filter + "']");
  }

  public By searchResults() {
    return searchResults;
  }

  public By searchBar() {
    return searchBar;
  }

  public By headerItem(String item) {
    return By.cssSelector("[data-testid='appbar-item'][id='" + item + "']");
  }

  public By searchSuggestion() {
    return searchSuggestion;
  }

  public By editAssociatedTagButton() {
    return editAssociatedTagButton;
  }

  public By enterAssociatedTagName() {
    return enterAssociatedTagName;
  }

  public By tagListItem() {
    return tagListItem;
  }

  public By saveAssociatedTag() {
    return saveAssociatedTag;
  }

  public By searchResultsList() {
    return searchResultsList;
  }

  public By exploreFilterCount(String filter) {
    return By.xpath("//div[@data-testid='filter-container-" + filter + "']//span[@data-testid='filter-count']");
  }

  public By entityTabIndex(int index) {
    return By.xpath("(//button[@data-testid='tab'])" + "[" + index + "]");
  }

  public By selectSuggestionSearch(String result) {
    return By.cssSelector("[data-testid='data-name'][id='" + result + "']");
  }

  public By ownerDropdown() {
    return ownerDropdown;
  }

  public By ownerSearchBox() {
    return ownerSearchBox;
  }

  public By closeErrorMessage() {
    return closeErrorMessage;
  }

  public By serviceUrl() {
    return serviceUrl;
  }

  public By servicePort() {
    return servicePort;
  }

  public By databaseName() {
    return databaseName;
  }
}
