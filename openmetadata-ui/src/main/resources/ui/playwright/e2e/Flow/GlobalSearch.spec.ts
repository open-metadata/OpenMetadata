import test, { expect } from '@playwright/test';
import { redirectToHomePage } from '../../utils/common';

const DESCRIPTION_SEARCH =
  'The dimension table contains data about your customers. The customers table contains one row per customer. It includes historical metrics (such as the total amount that each customer has spent in your store) as well as forward-looking metrics (such as the predicted number of days between future orders and the expected order value in the next 30 days). This table also includes columns that segment customers into various categories (such as new, returning, promising, at risk, dormant, and loyal), which you can use to target marketing activities.The dimension table contains data about your customers. The customers table contains one row per customer. It includes historical metrics (such as the total amount that each customer has spent in your store) as well as forward-looking metrics (such as the predicted number of days between future orders and the expected order value in the next 30 days). This table also includes columns that segment customers into various categories (such as new, returning, promising, at risk, dormant, and loyal), which you can use to target marketing activities.';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

test('searching for longer description should work', async ({ page }) => {
  await redirectToHomePage(page);

  await page.waitForLoadState('networkidle');

  await page.getByTestId('global-search-selector').click();
  await page.getByTestId('global-search-select-option-Table').click();

  await page
    .getByTestId('navbar-search-container')
    .getByTestId('searchBox')
    .fill(DESCRIPTION_SEARCH);

  await page.keyboard.press('Enter');

  await expect(
    page
      .getByTestId('search-results')
      .getByTestId(
        'table-data-card_sample_data.ecommerce_db.shopify.dim_customer'
      )
  ).toBeVisible();

  expect(
    page
      .getByTestId('search-results')
      .getByTestId(
        'table-data-card_sample_data.ecommerce_db.shopify.dim_customer'
      )
      .getByTestId('entity-link')
  ).toHaveText('dim_customer');

  expect(page.getByTestId('alert-bar')).not.toBeVisible();
});
