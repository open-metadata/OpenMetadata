/*
 *  Copyright 2024 Collate.
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

import { expect, Page } from '@playwright/test';
import { ALERT_UPDATED_DESCRIPTION } from '../constant/alert';
import {
  AlertDetails,
  ObservabilityCreationDetails,
} from '../constant/alert.interface';
import { SidebarItem } from '../constant/sidebar';
import { Domain } from '../support/domain/Domain';
import { EntityTypeEndpoint } from '../support/entity/Entity.interface';
import { PipelineClass } from '../support/entity/PipelineClass';
import { TableClass } from '../support/entity/TableClass';
import { UserClass } from '../support/user/UserClass';
import {
  addDomainFilter,
  addEntityFQNFilter,
  addOwnerFilter,
  addPipelineStatusUpdatesAction,
  checkRecentEventDetails,
  inputBasicAlertInformation,
  visitAlertDetailsPage,
  visitEditAlertPage,
  waitForRecentEventsToFinishExecution,
} from './alert';
import { clickOutside, descriptionBox, redirectToHomePage } from './common';
import { addMultiOwner, updateDescription } from './entity';
import { addInternalDestination } from './notificationAlert';
import { sidebarClick } from './sidebar';

export const visitObservabilityAlertPage = async (page: Page) => {
  await redirectToHomePage(page);
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('[data-testid="loader"]', {
    state: 'detached',
  });
  const getAlerts = page.waitForResponse(
    '/api/v1/events/subscriptions?*alertType=Observability*'
  );
  await sidebarClick(page, SidebarItem.OBSERVABILITY_ALERT);
  await page.waitForURL('**/observability/alerts');
  await getAlerts;
};

export const addExternalDestination = async ({
  page,
  destinationNumber,
  category,
  secretKey,
  input = '',
}: {
  page: Page;
  destinationNumber: number;
  category: string;
  input?: string;
  secretKey?: string;
}) => {
  // Select destination category
  await page.click(
    `[data-testid="destination-category-select-${destinationNumber}"]`
  );

  // Select external tab
  await page.click(`[data-testid="tab-label-external"]:visible`);

  // Select destination category option
  await page.click(
    `[data-testid="destination-category-dropdown-${destinationNumber}"]:visible [data-testid="${category}-external-option"]:visible`
  );

  // Input the destination receivers value
  if (category === 'Email') {
    await page.fill(
      `[data-testid="email-input-${destinationNumber}"] [role="combobox"]`,
      input
    );
    await page.keyboard.press('Enter');
  } else {
    await page.fill(
      `[data-testid="endpoint-input-${destinationNumber}"]`,
      input
    );
  }

  // Input the secret key value
  if (category === 'Webhook' && secretKey) {
    await page
      .getByTestId(`destination-${destinationNumber}`)
      .getByText('Advanced Configuration')
      .click();

    await expect(
      page.getByTestId(`secret-key-input-${destinationNumber}`)
    ).toBeVisible();

    await page.fill(
      `[data-testid="secret-key-input-${destinationNumber}"]`,
      secretKey
    );
  }

  await clickOutside(page);
};

export const getObservabilityCreationDetails = ({
  tableName1,
  tableName2,
  testCaseName,
  ingestionPipelineName,
  domainName,
  domainDisplayName,
  userName,
  testSuiteFQN,
}: {
  tableName1: string;
  tableName2: string;
  testCaseName: string;
  ingestionPipelineName: string;
  domainName: string;
  domainDisplayName: string;
  userName: string;
  testSuiteFQN: string;
}): Array<ObservabilityCreationDetails> => {
  return [
    {
      source: 'table',
      sourceDisplayName: 'Table',
      filters: [
        {
          name: 'Table Name',
          inputSelector: 'fqn-list-select',
          inputValue: tableName1,
          exclude: true,
        },
        {
          name: 'Domain',
          inputSelector: 'domain-select',
          inputValue: domainName,
          inputValueId: domainDisplayName,
          exclude: false,
        },
        {
          name: 'Owner Name',
          inputSelector: 'owner-name-select',
          inputValue: userName,
          exclude: true,
        },
      ],
      actions: [
        {
          name: 'Get Schema Changes',
          exclude: true,
        },
        {
          name: 'Get Table Metrics Updates',
          exclude: false,
        },
      ],
      destinations: [
        {
          mode: 'internal',
          category: 'Owners',
          type: 'Email',
        },
        {
          mode: 'external',
          category: 'Webhook',
          inputValue: 'https://webhook.com',
          secretKey: 'secret_key',
        },
      ],
    },
    {
      source: 'ingestionPipeline',
      sourceDisplayName: 'Ingestion Pipeline',
      filters: [
        {
          name: 'Ingestion Pipeline Name',
          inputSelector: 'fqn-list-select',
          inputValue: ingestionPipelineName,
          exclude: false,
        },
        {
          name: 'Domain',
          inputSelector: 'domain-select',
          inputValue: domainName,
          inputValueId: domainDisplayName,
          exclude: false,
        },
        {
          name: 'Owner Name',
          inputSelector: 'owner-name-select',
          inputValue: userName,
          exclude: true,
        },
      ],
      actions: [
        {
          name: 'Get Ingestion Pipeline Status Updates',
          inputs: [
            {
              inputSelector: 'pipeline-status-select',
              inputValue: 'Queued',
            },
          ],
          exclude: false,
        },
      ],
      destinations: [
        {
          mode: 'internal',
          category: 'Owners',
          type: 'Email',
        },
        {
          mode: 'external',
          category: 'Email',
          inputValue: 'test@example.com',
        },
      ],
    },
    {
      source: 'testCase',
      sourceDisplayName: 'Test case',
      filters: [
        {
          name: 'Test Case Name',
          inputSelector: 'fqn-list-select',
          inputValue: testCaseName,
          exclude: true,
        },
        {
          name: 'Domain',
          inputSelector: 'domain-select',
          inputValue: domainName,
          inputValueId: domainDisplayName,
          exclude: false,
        },
        {
          name: 'Owner Name',
          inputSelector: 'owner-name-select',
          inputValue: userName,
          exclude: true,
        },
        {
          name: 'Table Name A Test Case Belongs To',
          inputSelector: 'table-name-select',
          inputValue: tableName2,
          exclude: false,
        },
      ],
      actions: [
        {
          name: 'Get Test Case Status Updates',
          inputs: [
            {
              inputSelector: 'test-result-select',
              inputValue: 'Success',
            },
          ],
          exclude: false,
        },
        {
          name: 'Get Test Case Status Updates belonging to a Test Suite',
          inputs: [
            {
              inputSelector: 'test-suite-select',
              inputValue: testSuiteFQN,
              waitForAPI: true,
            },
            {
              inputSelector: 'test-status-select',
              inputValue: 'Failed',
            },
          ],
          exclude: false,
        },
      ],
      destinations: [
        {
          mode: 'internal',
          category: 'Users',
          inputSelector: 'User-select',
          inputValue: userName,
          type: 'Email',
        },
        {
          mode: 'external',
          category: 'Webhook',
          inputValue: 'https://webhook.com',
        },
      ],
    },
    {
      source: 'testSuite',
      sourceDisplayName: 'Test Suite',
      filters: [
        {
          name: 'Test Suite Name',
          inputSelector: 'fqn-list-select',
          inputValue: testSuiteFQN,
          exclude: true,
        },
        {
          name: 'Domain',
          inputSelector: 'domain-select',
          inputValue: domainName,
          inputValueId: domainDisplayName,
          exclude: false,
        },
        {
          name: 'Owner Name',
          inputSelector: 'owner-name-select',
          inputValue: userName,
          exclude: false,
        },
      ],
      actions: [
        {
          name: 'Get Test Suite Status Updates',
          inputs: [
            {
              inputSelector: 'test-result-select',
              inputValue: 'Failed',
            },
          ],
          exclude: false,
        },
      ],
      destinations: [
        {
          mode: 'external',
          category: 'Slack',
          inputValue: 'https://slack.com',
        },
      ],
    },
  ];
};

export const editObservabilityAlert = async ({
  page,
  alertDetails,
  sourceName,
  sourceDisplayName,
  user,
  domain,
  pipeline,
}: {
  page: Page;
  alertDetails: AlertDetails;
  sourceName: string;
  sourceDisplayName: string;
  user: UserClass;
  domain: Domain;
  pipeline: PipelineClass;
}) => {
  await visitEditAlertPage(page, alertDetails, false);

  // Update description
  await page.locator(descriptionBox).clear();
  await page.locator(descriptionBox).fill(ALERT_UPDATED_DESCRIPTION);

  // Update source
  await page.click('[data-testid="source-select"]');
  await page
    .getByTestId(`${sourceName}-option`)
    .getByText(sourceDisplayName)
    .click();

  // Filters should reset after source change
  await expect(page.getByTestId('filter-select-0')).not.toBeAttached();

  // Add owner filter
  await page.click('[data-testid="add-filters"]');
  await addOwnerFilter({
    page,
    filterNumber: 0,
    ownerName: user.getUserName(),
    selectId: 'Owner Name',
  });

  // Add entityFQN filter
  await page.click('[data-testid="add-filters"]');
  await addEntityFQNFilter({
    page,
    filterNumber: 1,
    entityFQN: (pipeline.entityResponseData as { fullyQualifiedName: string })
      .fullyQualifiedName,
    selectId: 'Pipeline Name',
    exclude: true,
  });
  // Add domain filter
  await page.click('[data-testid="add-filters"]');
  await addDomainFilter({
    page,
    filterNumber: 2,
    domainName: domain.responseData.name,
    domainDisplayName: domain.responseData.displayName,
  });

  // Add trigger
  await page.click('[data-testid="add-trigger"]');

  await addPipelineStatusUpdatesAction({
    page,
    filterNumber: 0,
    statusName: 'Successful',
    exclude: true,
  });

  // Add multiple destinations
  await page.click('[data-testid="add-destination-button"]');
  await addInternalDestination({
    page,
    destinationNumber: 0,
    category: 'Owners',
    type: 'G Chat',
  });

  // Add team Slack destination
  await page.click('[data-testid="add-destination-button"]');
  await addInternalDestination({
    page,
    destinationNumber: 1,
    category: 'Teams',
    type: 'Slack',
    typeId: 'Team-select',
    searchText: 'Organization',
  });
};

export const createCommonObservabilityAlert = async ({
  page,
  alertName,
  alertDetails,
  sourceName,
  sourceDisplayName,
  filters,
  actions,
}: {
  page: Page;
  alertName: string;
  alertDetails: ObservabilityCreationDetails;
  sourceName: string;
  sourceDisplayName: string;
  filters: {
    name: string;
    inputSelector: string;
    inputValue: string;
    inputValueId?: string;
    exclude?: boolean;
  }[];
  actions: {
    name: string;
    exclude?: boolean;
    inputs?: Array<{
      inputSelector: string;
      inputValue: string;
      waitForAPI?: boolean;
    }>;
  }[];
}) => {
  await inputBasicAlertInformation({
    page,
    name: alertName,
    sourceName,
    sourceDisplayName,
    createButtonId: 'create-observability',
  });

  for (const filter of filters) {
    const filterNumber = filters.indexOf(filter);

    await page.click('[data-testid="add-filters"]');

    // Select filter
    await page.click(`[data-testid="filter-select-${filterNumber}"]`);
    await page.click(
      `.ant-select-dropdown:visible [data-testid="${filter.name}-filter-option"]`
    );

    // Search and select filter input value
    const searchOptions = page.waitForResponse('/api/v1/search/query?q=*');
    await page.fill(
      `[data-testid="${filter.inputSelector}"] [role="combobox"]`,
      filter.inputValue,
      {
        force: true,
      }
    );

    await searchOptions;

    await page.click(
      `.ant-select-dropdown:visible [title="${
        filter.inputValueId ?? filter.inputValue
      }"]`
    );

    // Check if option is selected
    await expect(
      page.locator(
        `[data-testid="${filter.inputSelector}"] [title="${
          filter.inputValueId ?? filter.inputValue
        }"]`
      )
    ).toBeAttached();

    if (filter.exclude) {
      // Change filter effect
      await page.click(`[data-testid="filter-switch-${filterNumber}"]`);
    }
  }

  // Add triggers
  for (const action of actions) {
    const actionNumber = actions.indexOf(action);

    await page.click('[data-testid="add-trigger"]');

    // Select action
    await page.click(`[data-testid="trigger-select-${actionNumber}"]`);

    // Adding the dropdown visibility check to avoid flakiness here
    await page.waitForSelector(`.ant-select-dropdown:visible`, {
      state: 'visible',
    });
    await page.click(
      `.ant-select-dropdown:visible [data-testid="${action.name}-filter-option"]:visible`
    );
    await page.waitForSelector(`.ant-select-dropdown:visible`, {
      state: 'hidden',
    });

    if (action.inputs && action.inputs.length > 0) {
      for (const input of action.inputs) {
        const getSearchResult = page.waitForResponse(
          '/api/v1/search/query?q=*'
        );
        await page.fill(
          `[data-testid="${input.inputSelector}"] [role="combobox"]`,
          input.inputValue,
          {
            force: true,
          }
        );
        if (input.waitForAPI) {
          await getSearchResult;
        }
        await page.click(`[title="${input.inputValue}"]:visible`);

        // eslint-disable-next-line jest/no-conditional-expect
        await expect(page.getByTestId(input.inputSelector)).toHaveText(
          input.inputValue
        );

        await clickOutside(page);
      }
    }

    if (action.exclude) {
      // Change filter effect
      await page.click(`[data-testid="trigger-switch-${actionNumber}"]`);
    }
  }

  // Add Destinations
  for (const destination of alertDetails.destinations) {
    const destinationNumber = alertDetails.destinations.indexOf(destination);

    await page.click('[data-testid="add-destination-button"]');

    if (destination.mode === 'internal') {
      await addInternalDestination({
        page,
        destinationNumber,
        category: destination.category,
        type: destination.type,
        typeId: destination.inputSelector,
        searchText: destination.inputValue,
      });
    } else {
      await addExternalDestination({
        page,
        destinationNumber,
        category: destination.category,
        input: destination.inputValue,
        secretKey: destination.secretKey,
      });
    }
  }
};

export const checkAlertConfigDetails = async ({
  page,
  sourceName,
  tableName,
}: {
  page: Page;
  sourceName: string;
  tableName: string;
}) => {
  // Verify alert configs
  await expect(page.getByTestId('source-select')).toHaveText(sourceName);

  await expect(page.getByTestId('filter-select-0')).toHaveText('Table Name');
  await expect(
    page.getByTestId('fqn-list-select').getByTitle(tableName)
  ).toBeAttached();

  await expect(
    page
      .getByTestId('trigger-select-0')
      .getByTestId('Get Schema Changes-filter-option')
  ).toBeAttached();

  await expect(
    page
      .getByTestId('destination-category-select-0')
      .getByTestId('Slack-external-option')
  ).toBeAttached();
  await expect(page.getByTestId('endpoint-input-0')).toHaveValue(
    'https://slack.com'
  );
};

export const checkAlertFlowForWithoutPermissionUser = async ({
  page,
  alertDetails,
  sourceName,
  table,
}: {
  page: Page;
  alertDetails: AlertDetails;
  sourceName: string;
  table: TableClass;
}) => {
  await visitObservabilityAlertPage(page);

  await expect(page.getByTestId('create-observability')).not.toBeAttached();

  await expect(
    page.getByTestId(`alert-edit-${alertDetails.name}`)
  ).not.toBeAttached();

  await expect(
    page.getByTestId(`alert-delete-${alertDetails.name}`)
  ).not.toBeAttached();

  // Wait for events to finish execution
  await waitForRecentEventsToFinishExecution(page, alertDetails.name, 1);

  await visitAlertDetailsPage(page, alertDetails);

  await expect(page.getByTestId('edit-owner')).not.toBeAttached();

  await expect(page.getByTestId('edit-description')).not.toBeAttached();

  await expect(page.getByTestId('edit-button')).not.toBeAttached();

  await expect(page.getByTestId('delete-button')).not.toBeAttached();

  await checkAlertConfigDetails({
    page,
    sourceName,
    tableName: table.entity.name,
  });
  await checkRecentEventDetails({
    page,
    alertDetails,
    table,
    totalEventsCount: 1,
  });
};

export const checkAlertDetailsForWithPermissionUser = async ({
  page,
  alertDetails,
  sourceName,
  table,
  user,
}: {
  page: Page;
  alertDetails: AlertDetails;
  sourceName: string;
  table: TableClass;
  user: UserClass;
}) => {
  await visitObservabilityAlertPage(page);
  await visitAlertDetailsPage(page, alertDetails);

  // Change alert owner
  await addMultiOwner({
    page,
    ownerNames: [user.responseData.displayName],
    activatorBtnDataTestId: 'edit-owner',
    endpoint: EntityTypeEndpoint.NotificationAlert,
    type: 'Users',
  });

  // UpdateDescription
  await updateDescription(page, ALERT_UPDATED_DESCRIPTION, true);

  // Check other configs
  await checkAlertConfigDetails({
    page,
    sourceName,
    tableName: table.entity.name,
  });
  await checkRecentEventDetails({
    page,
    alertDetails,
    table,
    totalEventsCount: 1,
  });
};
