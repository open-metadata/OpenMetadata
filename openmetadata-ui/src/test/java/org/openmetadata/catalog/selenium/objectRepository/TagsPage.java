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
import org.openqa.selenium.WebElement;

public class TagsPage {
  WebDriver webDriver;
  static String enterDescription = "//div[@data-testid='enterDescription']/div/div[2]/div/div/div/div/div/div";

  public TagsPage(WebDriver webDriver) {
    this.webDriver = webDriver;
  }

  By addTagCategory = By.cssSelector("[data-testid='add-category']");
  By displayName = By.name("name");
  By descriptionBoldButton = By.cssSelector("[data-testid='boldButton']");
  By descriptionItalicButton = By.cssSelector("[data-testid='italicButton']");
  By descriptionLinkButton = By.cssSelector("[data-testid='linkButton']");
  By descriptionSaveButton = By.cssSelector("[data-testid='saveButton']");
  By addDescriptionString = By.xpath(enterDescription);


  public WebElement addTagCategory() {
    return webDriver.findElement(addTagCategory);
  }

  public WebElement displayName() {
    return webDriver.findElement(displayName);
  }

  public WebElement descriptionBoldButton() {
    return webDriver.findElement(descriptionBoldButton);
  }

  public WebElement descriptionItalicButton() {
    return webDriver.findElement(descriptionItalicButton);
  }

  public WebElement descriptionLinkButton() {
    return webDriver.findElement(descriptionLinkButton);
  }

  public WebElement descriptionSaveButton() {
    return webDriver.findElement(descriptionSaveButton);
  }

  public WebElement addDescriptionString() {
    return webDriver.findElement(addDescriptionString);
  }

}
