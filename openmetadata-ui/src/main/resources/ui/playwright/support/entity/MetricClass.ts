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
import { APIRequestContext, expect, Page } from '@playwright/test';
import { Operation } from 'fast-json-patch';
import {
  createOrFetch,
  okJson,
  withNotFoundRetry,
} from '../../utils/apiResponse';
import { getApiContext, uuid } from '../../utils/common';
import {
  CustomProperty,
  setMetricCustomPropertyValue,
} from '../../utils/customProperty';
import { visitEntityPageByFqn } from '../../utils/entity';
import {
  expectMetricMetadataSelections,
  openMetricMetadataEditor,
  saveMetricMetadata,
  setMetricMetadataReferenceSelection,
} from '../../utils/metricMetadata';
import { DataProduct } from '../domain/DataProduct';
import { Domain } from '../domain/Domain';
import { GlossaryTerm } from '../glossary/GlossaryTerm';
import { TagClass } from '../tag/TagClass';
import { EntityTypeEndpoint, ResponseDataType } from './Entity.interface';
import { EntityClass } from './EntityClass';

interface MetadataSelectionAction {
  groupName: string;
  isSelected: boolean;
  referenceName: string;
}

interface MetadataSelectionExpectation {
  excluded?: string[];
  groupName: string;
  included: string[];
}

export class MetricClass extends EntityClass {
  private metricName: string;

  entity: {
    name: string;
    description: string;
    metricExpression: {
      code: string;
      language: string;
    };
    granularity: string;
    metricType: string;
    displayName: string;
    unitOfMeasurement: string;
    dimensions?: {
      name: string;
      type: string;
      expression: string;
      description: string;
    }[];
    measures?: {
      name: string;
      aggregation: string;
      expression: string;
      description: string;
    }[];
  };

  entityResponseData: ResponseDataType = {} as ResponseDataType;

  constructor() {
    super(EntityTypeEndpoint.METRIC);

    this.metricName = `playwright-metric-${uuid()}`;

    this.entity = {
      name: this.metricName,
      description: `Total sales over the last quarter ${this.metricName}`,
      metricExpression: {
        code: 'SUM(sales)',
        language: 'SQL',
      },
      granularity: 'QUARTER',
      metricType: 'SUM',
      displayName: this.metricName,
      unitOfMeasurement: 'DOLLARS',
      dimensions: [
        {
          name: 'order_date',
          type: 'TIME',
          expression: "DATE_TRUNC('day', o.created_at)",
          description: 'Day the order was placed.',
        },
        {
          name: 'region',
          type: 'CATEGORICAL',
          expression: 'c.region',
          description: 'Customer billing region.',
        },
      ],
      measures: [
        {
          name: 'engagements',
          aggregation: 'SUM',
          expression: 'likes + comments + shares',
          description: 'Total interactions across all engagement types.',
        },
      ],
    };

    this.type = 'Metric';
  }

  async create(apiContext: APIRequestContext) {
    this.entityResponseData = await createOrFetch(apiContext, {
      label: 'MetricClass.create',
      createPath: '/api/v1/metrics',
      fqnSegments: [this.entity.name],
      data: this.entity,
    });

    return {
      entity: this.entityResponseData,
    };
  }

  get() {
    return {
      entity: this.entityResponseData,
    };
  }

  public set(data: { entity: ResponseDataType }): void {
    this.entityResponseData = data.entity;
  }

  async patch({
    apiContext,
    patchData,
  }: {
    apiContext: APIRequestContext;
    patchData: Operation[];
  }) {
    const response = await withNotFoundRetry(() =>
      apiContext.patch(
        `/api/v1/metrics/name/${this.entityResponseData?.['fullyQualifiedName']}`,
        {
          data: patchData,
          headers: {
            'Content-Type': 'application/json-patch+json',
          },
        }
      )
    );

    this.entityResponseData = await okJson(response, 'MetricClass.patch');

    return {
      entity: this.entityResponseData,
    };
  }

  async visitEntityPage(page: Page) {
    await visitEntityPageByFqn({
      page,
      endpoint: this.endpoint,
      // A metric is a top-level entity, so its FQN is just its name. Fall back
      // to the created name when entityResponseData has not been populated yet.
      fqn: this.entityResponseData?.fullyQualifiedName ?? this.entity.name,
    });
  }

  async updateCustomProperty(
    page: Page,
    propertydetails: CustomProperty,
    value: string
  ) {
    await setMetricCustomPropertyValue({
      page,
      propertyName: propertydetails.name,
      value,
    });
  }

  private getMetricId() {
    const metricId = this.entityResponseData.id;
    if (!metricId) {
      throw new Error('Metric must be created before editing its metadata');
    }

    return metricId;
  }

  private async updateMetadataSelections(
    page: Page,
    actions: MetadataSelectionAction[],
    expectations: MetadataSelectionExpectation[]
  ) {
    const dialog = await openMetricMetadataEditor(page);

    for (const action of actions) {
      await setMetricMetadataReferenceSelection(
        dialog,
        action.groupName,
        action.referenceName,
        action.isSelected
      );
    }
    for (const expectation of expectations) {
      const group = dialog.getByRole('group', {
        exact: true,
        name: expectation.groupName,
      });
      await expectMetricMetadataSelections(
        group,
        expectation.included,
        expectation.excluded
      );
    }

    await saveMetricMetadata(page, dialog, this.getMetricId());
  }

  async updateOwnerSelection({
    page,
    added = [],
    removed = [],
    included,
  }: {
    page: Page;
    added?: string[];
    removed?: string[];
    included: string[];
  }) {
    await this.updateMetadataSelections(
      page,
      [
        ...removed.map((referenceName) => ({
          groupName: 'Owners',
          isSelected: false,
          referenceName,
        })),
        ...added.map((referenceName) => ({
          groupName: 'Owners',
          isSelected: true,
          referenceName,
        })),
      ],
      [
        {
          excluded: removed,
          groupName: 'Owners',
          included,
        },
      ]
    );

    const peopleCard = page.getByTestId('metric-metadata-people-card');
    for (const ownerName of included) {
      await expect(peopleCard).toContainText(ownerName);
    }
    for (const ownerName of removed) {
      await expect(peopleCard).not.toContainText(ownerName);
    }
  }

  async domain(
    page: Page,
    domain1: Domain['responseData'],
    domain2: Domain['responseData'],
    dataProduct1: DataProduct['responseData'],
    dataProduct2: DataProduct['responseData'],
    dataProduct3: DataProduct['responseData']
  ) {
    const domain1Name = domain1.displayName;
    const domain2Name = domain2.displayName;
    const dataProduct1Name = dataProduct1.displayName;
    const dataProduct2Name = dataProduct2.displayName;
    const dataProduct3Name = dataProduct3.displayName;
    const metadataRail = page.getByTestId('metric-metadata-rail');

    await this.updateMetadataSelections(
      page,
      [
        {
          groupName: 'Domains',
          isSelected: true,
          referenceName: domain1Name,
        },
        {
          groupName: 'Data Products',
          isSelected: true,
          referenceName: dataProduct1Name,
        },
      ],
      [
        { groupName: 'Domains', included: [domain1Name] },
        { groupName: 'Data Products', included: [dataProduct1Name] },
      ]
    );
    await expect(metadataRail).toContainText(domain1Name);
    await expect(metadataRail).toContainText(dataProduct1Name);

    await this.updateMetadataSelections(
      page,
      [
        {
          groupName: 'Data Products',
          isSelected: false,
          referenceName: dataProduct1Name,
        },
        {
          groupName: 'Data Products',
          isSelected: true,
          referenceName: dataProduct2Name,
        },
      ],
      [
        {
          excluded: [dataProduct1Name],
          groupName: 'Data Products',
          included: [dataProduct2Name],
        },
      ]
    );
    await expect(metadataRail).not.toContainText(dataProduct1Name);
    await expect(metadataRail).toContainText(dataProduct2Name);

    await this.updateMetadataSelections(
      page,
      [
        {
          groupName: 'Data Products',
          isSelected: false,
          referenceName: dataProduct2Name,
        },
        {
          groupName: 'Domains',
          isSelected: false,
          referenceName: domain1Name,
        },
        {
          groupName: 'Domains',
          isSelected: true,
          referenceName: domain2Name,
        },
        {
          groupName: 'Data Products',
          isSelected: true,
          referenceName: dataProduct3Name,
        },
      ],
      [
        {
          excluded: [domain1Name],
          groupName: 'Domains',
          included: [domain2Name],
        },
        {
          excluded: [dataProduct2Name],
          groupName: 'Data Products',
          included: [dataProduct3Name],
        },
      ]
    );
    await expect(metadataRail).not.toContainText(domain1Name);
    await expect(metadataRail).toContainText(domain2Name);
    await expect(metadataRail).not.toContainText(dataProduct2Name);
    await expect(metadataRail).toContainText(dataProduct3Name);

    await this.updateMetadataSelections(
      page,
      [
        {
          groupName: 'Data Products',
          isSelected: false,
          referenceName: dataProduct3Name,
        },
        {
          groupName: 'Domains',
          isSelected: false,
          referenceName: domain2Name,
        },
      ],
      [
        { excluded: [domain2Name], groupName: 'Domains', included: [] },
        {
          excluded: [dataProduct3Name],
          groupName: 'Data Products',
          included: [],
        },
      ]
    );
    await expect(metadataRail).not.toContainText(domain2Name);
    await expect(metadataRail).not.toContainText(dataProduct3Name);
  }

  async owner(
    page: Page,
    owner1: string[],
    owner2: string[],
    _type: 'Teams' | 'Users' = 'Users',
    isEditPermission = true
  ) {
    await this.updateOwnerSelection({
      added: owner1,
      included: owner1,
      page,
    });
    if (!isEditPermission) {
      return;
    }

    await this.updateOwnerSelection({
      added: owner2,
      included: owner2,
      page,
      removed: owner1,
    });
    await this.updateOwnerSelection({
      included: [],
      page,
      removed: owner2,
    });
  }

  async tier(page: Page, tier1: string, tier2: string) {
    const governanceCard = page.getByTestId('metric-metadata-governance-card');
    await this.updateMetadataSelections(
      page,
      [{ groupName: 'Tier', isSelected: true, referenceName: tier1 }],
      [{ groupName: 'Tier', included: [tier1] }]
    );
    await expect(governanceCard).toContainText(tier1);

    await this.updateMetadataSelections(
      page,
      [{ groupName: 'Tier', isSelected: true, referenceName: tier2 }],
      [{ excluded: [tier1], groupName: 'Tier', included: [tier2] }]
    );
    await expect(governanceCard).not.toContainText(tier1);
    await expect(governanceCard).toContainText(tier2);

    await this.updateMetadataSelections(
      page,
      [{ groupName: 'Tier', isSelected: false, referenceName: tier2 }],
      [{ excluded: [tier2], groupName: 'Tier', included: [] }]
    );
    await expect(governanceCard).not.toContainText(tier2);
  }

  async descriptionUpdate(page: Page) {
    const description = `Updated metric description ${uuid()}`;
    await this.patchFromPage(page, [
      { op: 'replace', path: '/description', value: description },
    ]);
    await page.reload();
    await expect(page.getByTestId('metric-header-description')).toHaveText(
      description
    );
    await expect(page.getByTestId('edit-description')).toHaveCount(0);
  }

  async tag(
    page: Page,
    tag1: string,
    tag2: string,
    _entity: EntityClass,
    _tag2Fqn?: string
  ) {
    const tag1Name = tag1.split('.').at(-1) ?? tag1;
    const taxonomyCard = page.getByTestId('metric-metadata-taxonomy-card');
    await this.updateMetadataSelections(
      page,
      [{ groupName: 'Tags', isSelected: true, referenceName: tag1Name }],
      [{ groupName: 'Tags', included: [tag1Name] }]
    );
    await expect(taxonomyCard).toContainText(tag1Name);

    await this.updateMetadataSelections(
      page,
      [{ groupName: 'Tags', isSelected: true, referenceName: tag2 }],
      [{ groupName: 'Tags', included: [tag1Name, tag2] }]
    );
    await expect(taxonomyCard).toContainText(tag1Name);
    await expect(taxonomyCard).toContainText(tag2);

    await this.updateMetadataSelections(
      page,
      [
        { groupName: 'Tags', isSelected: false, referenceName: tag1Name },
        { groupName: 'Tags', isSelected: false, referenceName: tag2 },
      ],
      [{ excluded: [tag1Name, tag2], groupName: 'Tags', included: [] }]
    );
    await expect(taxonomyCard).not.toContainText(tag1Name);
    await expect(taxonomyCard).not.toContainText(tag2);
  }

  async glossaryTerm(
    page: Page,
    glossaryTerm1: GlossaryTerm['responseData'],
    glossaryTerm2: GlossaryTerm['responseData']
  ) {
    const glossaryTerm1Name = glossaryTerm1.displayName;
    const glossaryTerm2Name = glossaryTerm2.displayName;
    const taxonomyCard = page.getByTestId('metric-metadata-taxonomy-card');
    await this.updateMetadataSelections(
      page,
      [
        {
          groupName: 'Glossary Terms',
          isSelected: true,
          referenceName: glossaryTerm1Name,
        },
      ],
      [{ groupName: 'Glossary Terms', included: [glossaryTerm1Name] }]
    );
    await expect(taxonomyCard).toContainText(glossaryTerm1Name);

    await this.updateMetadataSelections(
      page,
      [
        {
          groupName: 'Glossary Terms',
          isSelected: true,
          referenceName: glossaryTerm2Name,
        },
      ],
      [
        {
          groupName: 'Glossary Terms',
          included: [glossaryTerm1Name, glossaryTerm2Name],
        },
      ]
    );
    await expect(taxonomyCard).toContainText(glossaryTerm1Name);
    await expect(taxonomyCard).toContainText(glossaryTerm2Name);

    await this.updateMetadataSelections(
      page,
      [
        {
          groupName: 'Glossary Terms',
          isSelected: false,
          referenceName: glossaryTerm1Name,
        },
        {
          groupName: 'Glossary Terms',
          isSelected: false,
          referenceName: glossaryTerm2Name,
        },
      ],
      [
        {
          excluded: [glossaryTerm1Name, glossaryTerm2Name],
          groupName: 'Glossary Terms',
          included: [],
        },
      ]
    );
    await expect(taxonomyCard).not.toContainText(glossaryTerm1Name);
    await expect(taxonomyCard).not.toContainText(glossaryTerm2Name);
  }

  async certification(
    page: Page,
    _certification1: TagClass,
    _certification2: TagClass
  ) {
    const dialog = await openMetricMetadataEditor(page);
    await expect(
      dialog.getByRole('group', { exact: true, name: 'Certification' })
    ).toHaveCount(0);
    await dialog.getByRole('button', { exact: true, name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
  }

  async followUnfollowEntity(page: Page, _entity: string) {
    const metricPath = `/api/v1/metrics/${this.getMetricId()}/followers`;
    const followButton = page.getByRole('button', {
      exact: true,
      name: 'Follow',
    });
    const followingButton = page.getByRole('button', {
      exact: true,
      name: 'Following',
    });

    if (await followingButton.isVisible()) {
      const resetResponse = page.waitForResponse(
        (response) =>
          response.request().method() === 'DELETE' &&
          new URL(response.url()).pathname.startsWith(metricPath)
      );
      await followingButton.click();
      expect((await resetResponse).ok()).toBeTruthy();
      await expect(followButton).toBeVisible();
    }

    const followResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' &&
        new URL(response.url()).pathname === metricPath
    );
    await followButton.click();
    expect((await followResponse).ok()).toBeTruthy();
    await expect(followingButton).toBeVisible();

    const unfollowResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'DELETE' &&
        new URL(response.url()).pathname.startsWith(metricPath)
    );
    await followingButton.click();
    expect((await unfollowResponse).ok()).toBeTruthy();
    await expect(followButton).toBeVisible();
  }

  async renameEntity(page: Page, entityName: string) {
    const displayName = `Playwright ${entityName} updated`;
    await this.patchFromPage(page, [
      { op: 'replace', path: '/displayName', value: displayName },
    ]);
    await page.reload();
    await expect(
      page.getByRole('heading', { exact: true, name: displayName })
    ).toBeVisible();
    await expect(page.getByTestId('rename-button')).toHaveCount(0);
  }

  private async patchFromPage(page: Page, patchData: Operation[]) {
    const { afterAction, apiContext } = await getApiContext(page);
    try {
      const response = await apiContext.patch(
        `/api/v1/metrics/${this.getMetricId()}`,
        {
          data: patchData,
          headers: {
            'Content-Type': 'application/json-patch+json',
          },
        }
      );
      expect(response.ok()).toBeTruthy();
      this.entityResponseData = await response.json();
    } finally {
      await afterAction();
    }
  }

  async delete(apiContext: APIRequestContext) {
    const entityResponse = await apiContext.delete(
      `/api/v1/metrics/${this.entityResponseData?.['id']}?recursive=true&hardDelete=true`
    );

    return {
      entity: entityResponse.body,
    };
  }
}
