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
import { APIRequestContext, Page } from '@playwright/test';
import { CustomPropertySupportedEntityList } from '../../constant/customProperty';
import { GlobalSettingOptions, ServiceTypes } from '../../constant/settings';
import {
  assignDataProduct,
  assignDomain,
  removeDataProduct,
  removeDomain,
} from '../../utils/common';
import {
  createCustomPropertyForEntity,
  CustomProperty,
  setValueForProperty,
  validateValueForProperty,
} from '../../utils/customProperty';
import {
  addMultiOwner,
  addOwner,
  assignCertification,
  assignGlossaryTerm,
  assignGlossaryTermToChildren,
  assignTag,
  assignTagToChildren,
  assignTier,
  checkExploreSearchFilter,
  createAnnouncement,
  createInactiveAnnouncement,
  deleteAnnouncement,
  downVote,
  editAnnouncement,
  followEntity,
  hardDeleteEntity,
  removeCertification,
  removeDisplayNameForEntityChildren,
  removeGlossaryTerm,
  removeGlossaryTermFromChildren,
  removeOwner,
  removeTag,
  removeTagsFromChildren,
  removeTier,
  replyAnnouncement,
  softDeleteEntity,
  unFollowEntity,
  updateDescription,
  updateDescriptionForChildren,
  updateDisplayNameForEntity,
  updateDisplayNameForEntityChildren,
  updateOwner,
  upVote,
  validateFollowedEntityToWidget,
} from '../../utils/entity';
import { DataProduct } from '../domain/DataProduct';
import { Domain } from '../domain/Domain';
import { GlossaryTerm } from '../glossary/GlossaryTerm';
import { TagClass } from '../tag/TagClass';
import { EntityTypeEndpoint, ENTITY_PATH } from './Entity.interface';

export class EntityClass {
  type = '';
  serviceCategory?: GlobalSettingOptions;
  serviceType?: ServiceTypes;
  childrenTabId?: string;
  childrenSelectorId?: string;
  childrenSelectorId2?: string;
  endpoint: EntityTypeEndpoint;
  cleanupUser?: (apiContext: APIRequestContext) => Promise<void>;

  customPropertyValue: Record<
    string,
    { value: string; newValue: string; property: CustomProperty }
  > = {};

  constructor(endpoint: EntityTypeEndpoint) {
    this.endpoint = endpoint;
  }

  public getType() {
    return this.type;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async visitEntityPage(_: Page) {
    // Override for entity visit
  }

  async prepareCustomProperty(apiContext: APIRequestContext) {
    // Create custom property only for supported entities
    if (CustomPropertySupportedEntityList.includes(this.endpoint)) {
      const data = await createCustomPropertyForEntity(
        apiContext,
        this.endpoint
      );

      this.customPropertyValue = data.customProperties;
      this.cleanupUser = data.cleanupUser;
    }
  }

  async cleanupCustomProperty(apiContext: APIRequestContext) {
    // Delete custom property only for supported entities
    if (CustomPropertySupportedEntityList.includes(this.endpoint)) {
      await this.cleanupUser?.(apiContext);
      const entitySchemaResponse = await apiContext.get(
        `/api/v1/metadata/types/name/${
          ENTITY_PATH[this.endpoint as keyof typeof ENTITY_PATH]
        }`
      );
      const entitySchema = await entitySchemaResponse.json();
      await apiContext.patch(`/api/v1/metadata/types/${entitySchema.id}`, {
        data: [
          {
            op: 'remove',
            path: '/customProperties',
          },
        ],
        headers: {
          'Content-Type': 'application/json-patch+json',
        },
      });
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
    await assignDomain(page, domain1);
    await assignDataProduct(page, domain1, dataProduct1);
    await assignDataProduct(page, domain1, dataProduct2, 'Edit');
    await removeDataProduct(page, dataProduct1);
    // Manual delay to ensure data product is removed
    await page.waitForTimeout(1000);
    await removeDataProduct(page, dataProduct2);
    await removeDomain(page, domain1);

    await assignDomain(page, domain2);
    await assignDataProduct(page, domain2, dataProduct3);
    await removeDataProduct(page, dataProduct3);
    await removeDomain(page, domain2);
  }

  async owner(
    page: Page,
    owner1: string[],
    owner2: string[],
    type: 'Teams' | 'Users' = 'Users',
    isEditPermission = true
  ) {
    if (type === 'Teams') {
      await addOwner({
        page,
        owner: owner1[0],
        type,
        endpoint: this.endpoint,
        dataTestId: 'data-assets-header',
      });
      if (isEditPermission) {
        await updateOwner({
          page,
          owner: owner2[0],
          type,
          endpoint: this.endpoint,
          dataTestId: 'data-assets-header',
        });
        await removeOwner({
          page,
          endpoint: this.endpoint,
          ownerName: owner2[0],
          type,
          dataTestId: 'data-assets-header',
        });
      }
    } else {
      await addMultiOwner({
        page,
        ownerNames: owner1,
        activatorBtnDataTestId: 'edit-owner',
        resultTestId: 'data-assets-header',
        endpoint: this.endpoint,
        type,
      });
      if (isEditPermission) {
        await addMultiOwner({
          page,
          ownerNames: owner2,
          activatorBtnDataTestId: 'edit-owner',
          resultTestId: 'data-assets-header',
          endpoint: this.endpoint,
          type,
        });
        await removeOwner({
          page,
          endpoint: this.endpoint,
          ownerName: owner2[0],
          type,
          dataTestId: 'data-assets-header',
        });
      }
    }
  }

  async tier(
    page: Page,
    tier1: string,
    tier2: string,
    tier2Fqn?: string,
    entity?: EntityClass
  ) {
    await assignTier(page, tier1, this.endpoint);
    await assignTier(page, tier2, this.endpoint);
    if (entity && tier2Fqn) {
      await checkExploreSearchFilter(
        page,
        'Tier',
        'tier.tagFQN',
        tier2Fqn,
        entity
      );
    }
    await removeTier(page, this.endpoint);
  }

  async certification(
    page: Page,
    certification1: TagClass,
    certification2: TagClass,
    entity?: EntityClass
  ) {
    await assignCertification(page, certification1, this.endpoint);
    if (entity) {
      await checkExploreSearchFilter(
        page,
        'Certification',
        'certification.tagLabel.tagFQN',
        certification1.responseData.fullyQualifiedName,
        entity
      );
    }
    await assignCertification(page, certification2, this.endpoint);
    if (entity) {
      await checkExploreSearchFilter(
        page,
        'Certification',
        'certification.tagLabel.tagFQN',
        certification2.responseData.fullyQualifiedName,
        entity
      );
    }
    await removeCertification(page, this.endpoint);
  }

  async descriptionUpdate(page: Page) {
    const description =
      // eslint-disable-next-line max-len
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus varius quam eu mi ullamcorper, in porttitor magna mollis. Duis a tellus aliquet nunc commodo bibendum. Donec euismod maximus porttitor. Aenean quis lacus ultrices, tincidunt erat ac, dapibus felis.';

    await updateDescription(page, description);
  }

  async descriptionUpdateChildren(
    page: Page,
    rowId: string,
    rowSelector: string,
    entityEndpoint: string
  ) {
    const description =
      // eslint-disable-next-line max-len
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus varius quam eu mi ullamcorper, in porttitor magna mollis. Duis a tellus aliquet nunc commodo bibendum. Donec euismod maximus porttitor. Aenean quis lacus ultrices, tincidunt erat ac, dapibus felis.';

    // Add description
    await updateDescriptionForChildren(
      page,
      description,
      rowId,
      rowSelector,
      entityEndpoint
    );

    // Update description
    await updateDescriptionForChildren(
      page,
      description + ' updated',

      rowId,
      rowSelector,
      entityEndpoint
    );

    // Remove description
    await updateDescriptionForChildren(
      page,
      '',
      rowId,
      rowSelector,
      entityEndpoint
    );
  }

  async tag(
    page: Page,
    tag1: string,
    tag2: string,
    entity: EntityClass,
    tag2Fqn?: string
  ) {
    await assignTag(page, tag1, 'Add', entity.endpoint, 'KnowledgePanel.Tags');
    await assignTag(
      page,
      tag2,
      'Edit',
      entity.endpoint,
      'KnowledgePanel.Tags',
      tag2Fqn
    );
    if (entity && tag2Fqn) {
      await checkExploreSearchFilter(
        page,
        'Tag',
        'tags.tagFQN',
        tag2Fqn,
        entity
      );
    }
    if (tag2Fqn) {
      await removeTag(page, [tag2Fqn]);
    } else {
      await removeTag(page, [tag2]);
    }
    await removeTag(page, [tag1]);

    await page
      .getByTestId('KnowledgePanel.Tags')
      .getByTestId('tags-container')
      .getByTestId('add-tag')
      .isVisible();
  }

  async tagChildren({
    page,
    tag1,
    tag2,
    rowId,
    rowSelector = 'data-row-key',
    entityEndpoint,
  }: {
    page: Page;
    tag1: string;
    tag2: string;
    rowId: string;
    rowSelector?: string;
    entityEndpoint: string;
  }) {
    await assignTagToChildren({
      page,
      tag: tag1,
      rowId,
      rowSelector,
      entityEndpoint,
    });
    await assignTagToChildren({
      page,
      tag: tag2,
      rowId,
      rowSelector,
      action: 'Edit',
      entityEndpoint,
    });
    await removeTagsFromChildren({
      page,
      tags: [tag2],
      rowId,
      rowSelector,
      entityEndpoint,
    });
    await removeTagsFromChildren({
      page,
      tags: [tag1],
      rowId,
      rowSelector,
      entityEndpoint,
    });

    await page
      .locator(`[${rowSelector}="${rowId}"]`)
      .getByTestId('tags-container')
      .getByTestId('add-tag')
      .isVisible();
  }

  async glossaryTerm(
    page: Page,
    glossaryTerm1: GlossaryTerm['responseData'],
    glossaryTerm2: GlossaryTerm['responseData'],
    entity?: EntityClass
  ) {
    await assignGlossaryTerm(page, glossaryTerm1);
    if (entity) {
      await checkExploreSearchFilter(
        page,
        'Tag',
        'tags.tagFQN',
        glossaryTerm1.fullyQualifiedName,
        entity
      );
    }
    await assignGlossaryTerm(page, glossaryTerm2, 'Edit');
    await removeGlossaryTerm(page, [glossaryTerm1, glossaryTerm2]);

    await page
      .getByTestId('KnowledgePanel.GlossaryTerms')
      .getByTestId('glossary-container')
      .getByTestId('add-tag')
      .isVisible();
  }

  async glossaryTermChildren({
    page,
    glossaryTerm1,
    glossaryTerm2,
    rowId,
    entityEndpoint,
    rowSelector = 'data-row-key',
  }: {
    page: Page;
    glossaryTerm1: GlossaryTerm['responseData'];
    glossaryTerm2: GlossaryTerm['responseData'];
    rowId: string;
    rowSelector?: string;
    entityEndpoint: string;
  }) {
    await assignGlossaryTermToChildren({
      page,
      glossaryTerm: glossaryTerm1,
      action: 'Add',
      rowId,
      rowSelector,
      entityEndpoint,
    });
    await assignGlossaryTermToChildren({
      page,
      glossaryTerm: glossaryTerm2,
      action: 'Edit',
      rowId,
      rowSelector,
      entityEndpoint,
    });
    await removeGlossaryTermFromChildren({
      page,
      glossaryTerms: [glossaryTerm1, glossaryTerm2],
      rowId,
      entityEndpoint,
      rowSelector,
    });

    await page
      .locator(`[${rowSelector}="${rowId}"]`)
      .getByTestId('glossary-container')
      .getByTestId('add-tag')
      .isVisible();
  }

  async upVote(page: Page) {
    await upVote(page, this.endpoint);
  }

  async downVote(page: Page) {
    await downVote(page, this.endpoint);
  }

  async followUnfollowEntity(page: Page, entity: string) {
    await followEntity(page, this.endpoint);
    await validateFollowedEntityToWidget(page, entity, true);
    await this.visitEntityPage(page);
    await unFollowEntity(page, this.endpoint);
    await validateFollowedEntityToWidget(page, entity, false);
  }

  async announcement(page: Page) {
    await createAnnouncement(page, {
      title: 'Playwright Test Announcement',
      description: 'Playwright Test Announcement Description',
    });
    await editAnnouncement(page, {
      title: 'Edited Playwright Test Announcement',
      description: 'Updated Playwright Test Announcement Description',
    });
    await replyAnnouncement(page);
    await deleteAnnouncement(page);
  }

  async inactiveAnnouncement(page: Page) {
    await createInactiveAnnouncement(page, {
      title: 'Inactive Playwright announcement',
      description: 'Inactive Playwright announcement description',
    });
    await deleteAnnouncement(page);
  }

  async renameEntity(page: Page, entityName: string) {
    await updateDisplayNameForEntity(
      page,
      `Cypress ${entityName} updated`,
      this.endpoint
    );
  }

  async displayNameChildren({
    page,
    columnName,
    rowSelector,
  }: {
    page: Page;
    columnName: string;
    rowSelector: string;
  }) {
    // Add display name
    await updateDisplayNameForEntityChildren(
      page,
      {
        oldDisplayName: '',
        newDisplayName: `Playwright ${columnName} updated`,
      },
      this.childrenSelectorId ?? '',
      rowSelector
    );

    // Update display name
    await updateDisplayNameForEntityChildren(
      page,
      {
        oldDisplayName: `Playwright ${columnName} updated`,
        newDisplayName: `Playwright ${columnName} updated again`,
      },
      this.childrenSelectorId ?? '',
      rowSelector
    );

    // Remove display name
    await removeDisplayNameForEntityChildren(
      page,
      `Playwright ${columnName} updated again`,
      this.childrenSelectorId ?? '',
      rowSelector
    );
  }

  async softDeleteEntity(page: Page, entityName: string, displayName?: string) {
    await softDeleteEntity(
      page,
      entityName,
      this.endpoint,
      displayName ?? entityName
    );
  }

  async hardDeleteEntity(page: Page, entityName: string, displayName?: string) {
    await hardDeleteEntity(page, displayName ?? entityName, this.endpoint);
  }

  async updateCustomProperty(
    page: Page,
    propertydetails: CustomProperty,
    value: string
  ) {
    await setValueForProperty({
      page,
      propertyName: propertydetails.name,
      value,
      propertyType: propertydetails.propertyType.name,
      endpoint: this.endpoint,
    });
    await validateValueForProperty({
      page,
      propertyName: propertydetails.name,
      value,
      propertyType: propertydetails.propertyType.name,
    });
  }
}
