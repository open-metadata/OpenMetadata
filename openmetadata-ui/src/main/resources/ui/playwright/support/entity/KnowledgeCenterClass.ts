import { APIRequestContext, expect, Page } from '@playwright/test';
import cryptoRandomString from 'crypto-random-string-with-promisify-polyfill';
import { navigateToArticle } from '../../utils/KnowledgeCenter';
import { TableClass } from './TableClass';
import {
  KnowledgeCenterData,
  KnowledgeCenterResponseDataType,
} from './KnowledgeCenter.interface';

export class KnowledgeCenterClass {
  data: KnowledgeCenterData;
  responseData: KnowledgeCenterResponseDataType =
    {} as KnowledgeCenterResponseDataType;
  knowledgePages: KnowledgeCenterResponseDataType[] = [];
  dataAsset: TableClass;

  constructor(
    data?: Partial<KnowledgeCenterData>,
    owners?: Array<{ type: string; id: string }>,
    dataAsset?: TableClass
  ) {
    const instanceName = `Article_${cryptoRandomString({
      length: 8,
      type: 'alphanumeric',
    })}`;

    this.dataAsset = dataAsset ?? new TableClass();

    this.data = {
      name: data?.name ?? instanceName,
      displayName: data?.displayName ?? instanceName,
      description: data?.description ?? instanceName,
      pageType: data?.pageType ?? 'Article',
      page: data?.page ?? {
        publicationDate: new Date(),
        relatedArticles: [],
      },
      owners: owners ?? data?.owners,
      relatedEntities: data?.relatedEntities,
    };
  }

  async create(apiContext: APIRequestContext, numberOfPages = 1) {
    if (!this.dataAsset.entityResponseData?.id) {
      await this.dataAsset.create(apiContext);
    }

    for (let i = 0; i < numberOfPages; i++) {
      const instanceName = `Article_${cryptoRandomString({
        length: 8,
        type: 'alphanumeric',
      })}`;

      const apiData = {
        name: instanceName,
        displayName: instanceName,
        description: instanceName,
        pageType: this.data.pageType,
        page: {
          publicationDate: new Date().getTime(),
          relatedArticles: [],
        },
        ...(this.data.owners && { owners: this.data.owners }),
        ...(this.data.relatedEntities && {
          relatedEntities: this.data.relatedEntities,
        }),
      };

      const response = await apiContext.post('/api/v1/knowledgeCenter', {
        data: apiData,
      });

      const pageData = await response.json();
      this.knowledgePages.push(pageData);

      if (i === 0) {
        this.responseData = pageData;
      }
    }

    return this.responseData;
  }

  async patch(
    apiContext: APIRequestContext,
    data: Record<string, unknown>[],
    pageId?: string
  ) {
    const id = pageId ?? this.responseData?.id;
    if (!id) {
      throw new Error('Cannot patch: KnowledgeCenter has not been created');
    }

    const response = await apiContext.patch(`/api/v1/knowledgeCenter/${id}`, {
      data,
      headers: {
        'Content-Type': 'application/json-patch+json',
      },
    });

    if (!response.ok()) {
      const errorText = await response.text();
      throw new Error(
        `Failed to patch KnowledgeCenter ${id}: ${response.status()} - ${errorText}`
      );
    }

    const updatedData = await response.json();

    const pageIndex = this.knowledgePages.findIndex((p) => p.id === id);
    if (pageIndex !== -1) {
      this.knowledgePages[pageIndex] = updatedData;
    }

    if (id === this.responseData?.id) {
      this.responseData = updatedData;
    }

    return updatedData;
  }

  async addDataAssetToPage(
    apiContext: APIRequestContext,
    pageId?: string
  ): Promise<void> {
    const targetPageId = pageId ?? this.responseData?.id;
    const targetPage = this.knowledgePages.find((p) => p.id === targetPageId);

    const dataAssetEntity = {
      id: this.dataAsset.entityResponseData.id,
      type: 'table',
      name: this.dataAsset.entityResponseData.name,
      fullyQualifiedName: this.dataAsset.entityResponseData.fullyQualifiedName,
      description: this.dataAsset.entityResponseData.description,
      displayName: this.dataAsset.entityResponseData.displayName,
      deleted: false,
    };

    const currentRelatedEntitiesCount =
      targetPage?.relatedEntities?.length ?? 0;

    const updatedData = await this.patch(
      apiContext,
      [
        {
          op: 'add',
          path: `/relatedEntities/${currentRelatedEntitiesCount}`,
          value: dataAssetEntity,
        },
      ],
      targetPageId
    );

    expect(updatedData.relatedEntities).toBeDefined();
    const addedEntity = updatedData.relatedEntities?.find(
      (entity: { id: string }) => entity.id === dataAssetEntity.id
    );
    expect(addedEntity).toBeDefined();
  }

  async visitPage(page: Page, pageIndex = 0) {
    const targetPage = this.knowledgePages[pageIndex] || this.responseData;

    await navigateToArticle(page, targetPage.fullyQualifiedName);

    await expect(page.getByTestId('entity-header-display-name')).toHaveValue(
      targetPage.displayName
    );
  }

  getEntityType(): string {
    return 'table';
  }

  get() {
    return {
      knowledgePages: this.knowledgePages,
      dataAsset: this.dataAsset,
      responseData: this.responseData,
    };
  }

  async delete(
    apiContext: APIRequestContext,
    deletePages = true,
    deleteDataAsset = true
  ) {
    if (deletePages) {
      for (const page of this.knowledgePages) {
        if (page.id) {
          await apiContext.delete(
            `/api/v1/knowledgeCenter/${page.id}?hardDelete=true&recursive=true`
          );
        }
      }
      this.knowledgePages = [];
    }

    if (deleteDataAsset && this.dataAsset.entityResponseData?.id) {
      await this.dataAsset.delete(apiContext);
    }
  }
}
