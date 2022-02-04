/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.catalog.selenium.objectRepository;

import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

public class TagsPage {
  WebDriver webDriver;
  static String enterDescription = "//div[@data-testid='enterDescription']/div/div[2]/div/div/div/div/div/div";

  public TagsPage(WebDriver webDriver) {
    this.webDriver = webDriver;
  }

  By closeWhatsNew = By.cssSelector("[data-testid='closeWhatsNew']");
  By addTagCategory = By.cssSelector("[data-testid='add-category']");
  By addTagButton = By.cssSelector("[data-testid='add-new-tag-button']");
  By editTagDescription = By.cssSelector("[data-testid='editTagDescription']");
  By addAssociatedTagButton = By.cssSelector("[data-testid='tags']");
  By enterAssociatedTagName = By.cssSelector("[data-testid='associatedTagName']");
  By tagListItem = By.cssSelector("[data-testid='list-item']");
  By saveAssociatedTag = By.cssSelector("[data-testid='saveAssociatedTag']");
  By removeAssociatedTag = By.cssSelector("[data-testid='remove']");
  By tables = By.cssSelector("[data-testid='tables']");
  By tableLink = By.xpath("//button[@data-testid='table-link']");
  By lastTableLink = By.xpath("//button[@data-testid='table-link'][last()]");
  By tagUsageCount = By.cssSelector("[data-testid='usage-count']");
  By editAssociatedTagButton = By.xpath("//div[@data-testid='tag-conatiner']//span");
  By headerSettingsTags = By.cssSelector("[data-testid='menu-item-Tags']");
  By headerExplore = By.cssSelector("[data-testid='appbar-item'][id='explore']");
  By sortBy = By.cssSelector("[data-testid='sortBy']");

  public By addTagCategory() {
    return addTagCategory;
  }

  public By addTagButton() {
    return addTagButton;
  }

  public By editTagDescription() {
    return editTagDescription;
  }

  public By addAssociatedTagButton() {
    return addAssociatedTagButton;
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

  public By removeAssociatedTag() {
    return removeAssociatedTag;
  }

  public By closeWhatsNew() {
    return closeWhatsNew;
  }

  public By tables() {
    return tables;
  }

  public By tagFilter(String tagCategoryDisplayName, String tagDisplayName) {
    return By.cssSelector("[data-testid='checkbox'][id='" + tagCategoryDisplayName + "." + tagDisplayName + "']");
  }

  public By tableLink() {
    return tableLink;
  }

  public By lastTableLink() {
    return lastTableLink;
  }

  public By tagUsageCount() {
    return tagUsageCount;
  }

  public By editAssociatedTagButton() {
    return editAssociatedTagButton;
  }

  public By usageCountElementIndex(int index) {
    return By.xpath("(//a[@data-testid='usage-count'])[" + index + "]");
  }

  public By headerSettingsTags() {
    return headerSettingsTags;
  }

  public By spanTagUsageCountElementIndex(int index) {
    return By.xpath("(//div[@data-testid='usage'])[" + index + "]/span[@data-testid='usage-count']");
  }

  public By aTagUsageCountElementIndex(int index) {
    return By.xpath("(//div[@data-testid='usage'])[" + index + "]/a[@data-testid='usage-count']");
  }

  public By tagFilterCount(int index) {
    return By.xpath("(//button[@data-testid='tab'])[" + index + "]//span[@data-testid='filter-count']");
  }

  public By entityTabIndex(int index) {
    return By.xpath("(//button[@data-testid='tab'])" + "[" + index + "]");
  }

  public By headerExplore() {
    return headerExplore;
  }

  public By sortBy() {
    return sortBy;
  }
}
