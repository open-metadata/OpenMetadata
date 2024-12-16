import { Locator, Page } from '@playwright/test';

const selectOption = async (
  page: Page,
  dropdownLocator: Locator,
  optionTitle: string
) => {
  await dropdownLocator.click();

  await page.waitForSelector(`.ant-select-dropdown:visible`, {
    state: 'visible',
  });
  await page.click(`.ant-select-dropdown:visible [title="${optionTitle}"]`);
};

export const updateServiceNameFilter = async (
  page: Page,
  serviceName: string
) => {
  // clear existing filters
  const deleteButtons = await page.$$(
    'button[data-testid="delete-condition-button"]:visible'
  );
  for (const button of deleteButtons) {
    await button.click();
  }

  await page
    .getByTestId('query-builder-form-field')
    .getByTestId('add-condition-button')
    .last()
    .click();

  // Select Item
  await selectOption(
    page,
    page
      .getByTestId('query-builder-form-field')
      .getByTestId('advanced-search-field-select')
      .last(),
    'Service'
  );

  // Select Value
  await selectOption(
    page,
    page
      .locator('div')
      .filter({ hasText: /^Select value$/ })
      .last(),
    serviceName
  );
};
