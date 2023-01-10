/*
 *  Copyright 2022 Collate.
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

import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import {
  deleteGlossary,
  deleteGlossaryTerm,
  patchGlossaryTerm,
} from 'rest/glossaryAPI';
import { MOCK_GLOSSARY } from './glossary.mock';
import GlossaryPageV1 from './GlossaryPageV1.component';

const mockSearchData = {
  data: {
    took: 28,
    timed_out: false,
    _shards: { total: 5, successful: 5, skipped: 0, failed: 0 },
    hits: {
      total: { value: 1, relation: 'eq' },
      max_score: 2.1288848,
      hits: [
        {
          _index: 'table_search_index',
          _type: '_doc',
          _id: 'c514ca18-2ea4-44b1-aa06-0c66bc0cd355',
          _score: 2.1288848,
          _source: {
            id: 'c514ca18-2ea4-44b1-aa06-0c66bc0cd355',
            name: 'raw_order',
            fullyQualifiedName: 'sample_data.ecommerce_db.shopify.raw_order',
            description:
              'This is a raw orders table as represented in our online DB.',
            version: 0.8,
            updatedAt: 1664445302349,
            updatedBy: 'bharatdussa',
            href: 'http://localhost:8585/api/v1/tables/c514ca18-2ea4-44b1-aa06-0c66bc0cd355',
            tableType: 'Regular',
            columns: [
              {
                dataLength: 1,
                dataType: 'STRING',
                name: 'comments',
                constraint: 'NULL',
                fullyQualifiedName:
                  'sample_data.ecommerce_db.shopify.raw_order.comments',
                ordinalPosition: 1,
                dataTypeDisplay: 'string',
                tags: [
                  {
                    tagFQN: 'PersonalData.Personal',
                    labelType: 'Manual',
                    description:
                      'Data that can be used to directly or indirectly identify a person.',
                    source: 'Tag',
                    state: 'Confirmed',
                  },
                  {
                    tagFQN: 'PersonalData.SpecialCategory',
                    labelType: 'Manual',
                    description:
                      'GDPR special category data is personal information of data subjects that is especially sensitive.',
                    source: 'Tag',
                    state: 'Confirmed',
                  },
                ],
                customMetrics: [],
              },
              {
                dataLength: 1,
                dataType: 'STRING',
                name: 'creditcard',
                constraint: 'NULL',
                fullyQualifiedName:
                  'sample_data.ecommerce_db.shopify.raw_order.creditcard',
                ordinalPosition: 2,
                dataTypeDisplay: 'string',
                tags: [],
                customMetrics: [],
              },
              {
                dataLength: 1,
                dataType: 'STRING',
                name: 'membership',
                constraint: 'NULL',
                fullyQualifiedName:
                  'sample_data.ecommerce_db.shopify.raw_order.membership',
                ordinalPosition: 4,
                dataTypeDisplay: 'string',
                tags: [],
                customMetrics: [],
              },
              {
                dataLength: 1,
                dataType: 'ARRAY',
                name: 'orders',
                constraint: 'NULL',
                fullyQualifiedName:
                  'sample_data.ecommerce_db.shopify.raw_order.orders',
                ordinalPosition: 5,
                dataTypeDisplay:
                  'array<struct<product_id:character varying(24),price:int,onsale:boolean,tax:int,weight:int,others:int,vendor:character varying(64)>>',
                arrayDataType: 'STRUCT',
                tags: [],
                customMetrics: [],
              },
            ],
            databaseSchema: {
              deleted: false,
              name: 'shopify',
              description:
                'This **mock** database contains schema related to shopify sales and orders with related dimension tables.',
              id: '85217879-eff9-4990-9f76-806a563c500b',
              href: 'http://localhost:8585/api/v1/databaseSchemas/85217879-eff9-4990-9f76-806a563c500b',
              type: 'databaseSchema',
              fullyQualifiedName: 'sample_data.ecommerce_db.shopify',
            },
            database: {
              deleted: false,
              name: 'ecommerce_db',
              description:
                'This **mock** database contains schemas related to shopify sales and orders with related dimension tables.',
              id: '0b37dd2c-b235-4243-8ea8-7485f9b7c4a3',
              href: 'http://localhost:8585/api/v1/databases/0b37dd2c-b235-4243-8ea8-7485f9b7c4a3',
              type: 'database',
              fullyQualifiedName: 'sample_data.ecommerce_db',
            },
            service: {
              deleted: false,
              name: 'sample_data',
              id: '3768e7fe-ce05-480d-9021-38baf0d0f637',
              href: 'http://localhost:8585/api/v1/services/databaseServices/3768e7fe-ce05-480d-9021-38baf0d0f637',
              type: 'databaseService',
              fullyQualifiedName: 'sample_data',
            },
            serviceType: 'BigQuery',
            tags: [
              {
                tagFQN: 'PersonalData.Personal',
                labelType: 'Manual',
                description:
                  'Data that can be used to directly or indirectly identify a person.',
                source: 'Tag',
                state: 'Confirmed',
              },
            ],
            usageSummary: {
              dailyStats: { count: 0, percentileRank: 0.0 },
              weeklyStats: { count: 0, percentileRank: 0.0 },
              monthlyStats: { count: 0, percentileRank: 0.0 },
              date: '2022-09-29',
            },
            followers: [],
            tableQueries: [],
            deleted: false,
            tier: null,
            suggest: [
              {
                input: 'sample_data.ecommerce_db.shopify.raw_order',
                weight: 5,
              },
              { input: 'raw_order', weight: 10 },
            ],
            service_suggest: [{ input: 'sample_data', weight: 5 }],
            column_suggest: [
              { input: 'comments', weight: 5 },
              { input: 'creditcard', weight: 5 },
              { input: 'membership', weight: 5 },
              { input: 'orders', weight: 5 },
            ],
            schema_suggest: [{ input: 'shopify', weight: 5 }],
            database_suggest: [{ input: 'ecommerce_db', weight: 5 }],
            entityType: 'table',
            owner: {
              deleted: false,
              displayName: 'Bharat Dussa',
              name: 'bharatdussa',
              id: 'f187364d-114c-4426-b941-baf6a15f70e4',
              href: 'http://localhost:8585/api/v1/users/f187364d-114c-4426-b941-baf6a15f70e4',
              type: 'user',
              fullyQualifiedName: 'bharatdussa',
            },
          },
        },
      ],
    },
    aggregations: {
      'sterms#EntityType': {
        doc_count_error_upper_bound: 0,
        sum_other_doc_count: 0,
        buckets: [{ key: 'table', doc_count: 1 }],
      },
      'sterms#Tags': {
        doc_count_error_upper_bound: 0,
        sum_other_doc_count: 0,
        buckets: [
          { key: 'PII.NonSensitive', doc_count: 1 },
          { key: 'PII.None', doc_count: 1 },
          { key: 'PII.Sensitive', doc_count: 1 },
          { key: 'PersonalData.Personal', doc_count: 1 },
          { key: 'PersonalData.SpecialCategory', doc_count: 1 },
          { key: 'test-category.test-glossary-term-tag', doc_count: 1 },
          { key: 'test-glossary.test-glossary-term', doc_count: 1 },
        ],
      },
    },
  },
};
jest.useRealTimers();

jest.mock('react-router-dom', () => ({
  useHistory: () => ({
    push: jest.fn(),
  }),
  useParams: jest.fn().mockReturnValue({
    glossaryName: 'GlossaryName',
  }),
}));

jest.mock('rest/miscAPI', () => ({
  searchData: jest
    .fn()
    .mockImplementation(() => Promise.resolve(mockSearchData)),
}));

jest.mock('components/Glossary/GlossaryV1.component', () => {
  return jest.fn().mockImplementation((props) => (
    <div>
      <p> Glossary.component</p>
      <button
        data-testid="handleAddGlossaryClick"
        onClick={props.handleAddGlossaryClick}>
        handleAddGlossaryClick
      </button>
      <button
        data-testid="handleAddGlossaryTermClick"
        onClick={props.handleAddGlossaryTermClick}>
        handleAddGlossaryTermClick
      </button>
      <button
        data-testid="handleChildLoading"
        onClick={() => props.handleChildLoading(false)}>
        handleChildLoading
      </button>
      <button
        data-testid="handleExpandedKey"
        onClick={() => props.handleExpandedKey(['test', 'test1'], true)}>
        handleExpandedKey
      </button>
      <button
        data-testid="handleExpandedKeyDefaultValue"
        onClick={() => props.handleExpandedKey(['test', 'test1'], false)}>
        handleExpandedKeyDefaultValue
      </button>
      <button
        data-testid="handleGlossaryTermUpdate"
        onClick={() => props.handleGlossaryTermUpdate(MOCK_GLOSSARY)}>
        handleGlossaryTermUpdate
      </button>
      <button
        data-testid="handleGlossaryDelete"
        onClick={() => props.onGlossaryDelete(MOCK_GLOSSARY.id)}>
        handleGlossaryDelete
      </button>
      <button
        data-testid="handleGlossaryTermDelete"
        onClick={() => props.onGlossaryTermDelete(MOCK_GLOSSARY.id)}>
        handleGlossaryTermDelete
      </button>
      <button
        data-testid="handleRelatedTermClick"
        onClick={() => props.onRelatedTermClick(MOCK_GLOSSARY.id)}>
        handleRelatedTermClick
      </button>
      <button
        data-testid="handleAssetPagination"
        onClick={() => props.onAssetPaginate('next')}>
        handleAssetPagination
      </button>
      <button
        data-testid="handleUserRedirection"
        onClick={() => props.handleUserRedirection('test')}>
        handleUserRedirection
      </button>
      <button
        data-testid="handleSearchText"
        onClick={() => props.handleSearchText('test')}>
        handleSearchText
      </button>
      <button
        data-testid="updateGlossary"
        onClick={() => props.updateGlossary(MOCK_GLOSSARY)}>
        updateGlossary
      </button>
    </div>
  ));
});

jest.mock('rest/glossaryAPI', () => ({
  deleteGlossary: jest.fn().mockImplementation(() => Promise.resolve()),
  deleteGlossaryTerm: jest.fn().mockImplementation(() => Promise.resolve()),
  patchGlossaryTerm: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: MOCK_GLOSSARY })),
  patchGlossaries: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: MOCK_GLOSSARY })),
}));

jest.mock('../../utils/GlossaryUtils', () => ({
  getGlossariesWithRootTerms: jest
    .fn()
    .mockImplementation(() => Promise.resolve([MOCK_GLOSSARY])),
  getHierarchicalKeysByFQN: jest.fn().mockReturnValue(['test', 'test1']),
  getChildGlossaryTerms: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: [MOCK_GLOSSARY] })),
  getTermDataFromGlossary: jest.fn().mockReturnValue(MOCK_GLOSSARY),
  getTermPosFromGlossaries: jest.fn().mockReturnValue([1, 2]),
  updateGlossaryListBySearchedTerms: jest.fn().mockReturnValue([MOCK_GLOSSARY]),
}));

describe('Test GlossaryComponent page', () => {
  it('GlossaryComponent Page Should render', async () => {
    render(<GlossaryPageV1 />);

    const glossaryComponent = await screen.findByText(/Glossary.component/i);

    expect(glossaryComponent).toBeInTheDocument();
  });

  it('All Function call should work properly - part 1', async () => {
    await act(async () => {
      render(<GlossaryPageV1 />);

      const glossaryComponent = await screen.findByText(/Glossary.component/i);
      const handleExpandedKeyDefaultValue = await screen.findByTestId(
        'handleExpandedKeyDefaultValue'
      );
      const handleRelatedTermClick = await screen.findByTestId(
        'handleRelatedTermClick'
      );
      const handleAssetPagination = await screen.findByTestId(
        'handleAssetPagination'
      );
      const handleUserRedirection = await screen.findByTestId(
        'handleUserRedirection'
      );
      const updateGlossary = await screen.findByTestId('updateGlossary');

      expect(glossaryComponent).toBeInTheDocument();

      fireEvent.click(handleExpandedKeyDefaultValue);
      fireEvent.click(handleRelatedTermClick);
      fireEvent.click(handleAssetPagination);
      fireEvent.click(handleUserRedirection);
      fireEvent.click(updateGlossary);
    });
  });

  it('All Function call should work properly - part 2', async () => {
    await act(async () => {
      render(<GlossaryPageV1 />);

      const glossaryComponent = await screen.findByText(/Glossary.component/i);
      const handleAddGlossaryClick = await screen.findByTestId(
        'handleAddGlossaryClick'
      );
      const handleAddGlossaryTermClick = await screen.findByTestId(
        'handleAddGlossaryTermClick'
      );
      const handleChildLoading = await screen.findByTestId(
        'handleChildLoading'
      );
      const handleExpandedKey = await screen.findByTestId('handleExpandedKey');
      const handleGlossaryDelete = await screen.findByTestId(
        'handleGlossaryDelete'
      );
      const handleGlossaryTermUpdate = await screen.findByTestId(
        'handleGlossaryTermUpdate'
      );
      const handleGlossaryTermDelete = await screen.findByTestId(
        'handleGlossaryTermDelete'
      );
      const handleSearchText = await screen.findByTestId('handleSearchText');

      expect(glossaryComponent).toBeInTheDocument();

      fireEvent.click(handleAddGlossaryClick);
      fireEvent.click(handleAddGlossaryTermClick);
      fireEvent.click(handleChildLoading);
      fireEvent.click(handleExpandedKey);
      fireEvent.click(handleGlossaryDelete);

      fireEvent.click(handleGlossaryTermUpdate);
      fireEvent.click(handleGlossaryTermDelete);

      fireEvent.click(handleSearchText);
    });
  });

  describe('Render Sad Paths', () => {
    it('show error if deleteGlossaryTerm API fails', async () => {
      (deleteGlossaryTerm as jest.Mock).mockImplementationOnce(() =>
        Promise.reject()
      );
      render(<GlossaryPageV1 />);
      const handleGlossaryTermDelete = await screen.findByTestId(
        'handleGlossaryTermDelete'
      );

      expect(handleGlossaryTermDelete).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(handleGlossaryTermDelete);
      });
    });

    it('show error if deleteGlossary API fails', async () => {
      (deleteGlossary as jest.Mock).mockImplementationOnce(() =>
        Promise.reject()
      );
      render(<GlossaryPageV1 />);
      const handleGlossaryDelete = await screen.findByTestId(
        'handleGlossaryDelete'
      );

      expect(handleGlossaryDelete).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(handleGlossaryDelete);
      });
    });

    it('show error if patchGlossaryTerm API resolves without data', async () => {
      (patchGlossaryTerm as jest.Mock).mockImplementation(() =>
        Promise.resolve({ data: '' })
      );
      render(<GlossaryPageV1 />);
      const handleGlossaryTermUpdate = await screen.findByTestId(
        'handleGlossaryTermUpdate'
      );

      expect(handleGlossaryTermUpdate).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(handleGlossaryTermUpdate);
      });
    });
  });
});
