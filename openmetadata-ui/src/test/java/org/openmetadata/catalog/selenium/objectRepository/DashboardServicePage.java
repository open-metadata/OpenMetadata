package org.openmetadata.catalog.selenium.objectRepository;

import javax.annotation.Nonnull;
import lombok.Getter;
import lombok.NonNull;
import lombok.RequiredArgsConstructor;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;

@Getter
@RequiredArgsConstructor
public class DashboardServicePage {
  @NonNull WebDriver webDriver;

  By dashboardName = By.xpath("//h6[@data-testid='service-name-sample_superset']");
  By dashboardServiceUrl = By.cssSelector("[data-testid='dashboardUrl']");
}
