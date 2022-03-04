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

import javax.annotation.Nonnull;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

@Getter
@RequiredArgsConstructor
public class TagsPage {
  @Nonnull WebDriver webDriver;

  By closeWhatsNew = By.cssSelector("[data-testid='closeWhatsNew']");
  By addTagButton = By.cssSelector("[data-testid='add-new-tag-button']");
  By editTagDescription = By.cssSelector("[data-testid='editTagDescription']");
  By addAssociatedTagButton = By.cssSelector("[data-testid='tags']");
  By removeAssociatedTag = By.cssSelector("[data-testid='remove']");
  By tables = By.cssSelector("[data-testid='tables']");
  By tableLink = By.xpath("//button[@data-testid='table-link']");
  By lastTableLink = By.xpath("//button[@data-testid='table-link'][last()]");
  By tagUsageCount = By.cssSelector("[data-testid='usage-count']");
  By headerSettingsTags = By.cssSelector("[data-testid='menu-item-Tags']");
  By sortBy = By.cssSelector("[data-testid='sortBy']");

  public By tagFilter(String tagCategoryDisplayName, String tagDisplayName) {
    return By.cssSelector("[data-testid='checkbox'][id='" + tagCategoryDisplayName + "." + tagDisplayName + "']");
  }

  public By usageCountElementIndex(int index) {
    return By.xpath("(//a[@data-testid='usage-count'])[" + index + "]");
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

  public By headerItem(String item) {
    return By.cssSelector("[data-testid='appbar-item'][id='" + item + "']");
  }

  public By addAssociatedTagIndex(int index) {
    return By.xpath("(//span[@data-testid='tags'])[" + index + "]");
  }
}
