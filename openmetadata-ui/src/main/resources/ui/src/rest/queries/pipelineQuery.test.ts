/*
 *  Copyright 2026 Collate.
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
import { QueryClient } from '@tanstack/react-query';
import { act } from '@testing-library/react';
import { TabSpecificField } from '../../enums/entity.enum';
import { Pipeline } from '../../generated/entity/data/pipeline';
import { defaultFields } from '../../utils/PipelineDetailsUtils';
import { getPipelineByFqn } from '../pipelineAPI';
import {
  normalizeFields,
  pipelineQueryKey,
  prefetchPipeline,
  prefetchPipelineByFqn,
  PREFETCH_PIPELINE_FIELDS,
} from './pipelineQuery';

jest.mock('../pipelineAPI', () => ({
  getPipelineByFqn: jest.fn(),
}));

const getPipelineByFqnMock = getPipelineByFqn as jest.MockedFunction<
  typeof getPipelineByFqn
>;

const FQN = 'svc.airflow.etl_users';

const fixturePipeline = {
  id: 'pipe-1',
  name: 'etl_users',
  fullyQualifiedName: FQN,
  serviceType: 'Airflow',
} as Pipeline;

const buildQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, refetchOnMount: false },
    },
  });

describe('pipelineQuery', () => {
  describe('normalizeFields', () => {
    it('strips spaces after commas so spacing variants share a cache slot', () => {
      expect(normalizeFields('followers, tags, owners')).toBe(
        'followers,tags,owners'
      );
    });

    it('strips all whitespace kinds (spaces, tabs, newlines)', () => {
      expect(normalizeFields('followers,\n\ttags , owners')).toBe(
        'followers,tags,owners'
      );
    });

    it('leaves an already-canonical (space-free) string unchanged', () => {
      expect(normalizeFields('followers,tags,owners')).toBe(
        'followers,tags,owners'
      );
    });

    it('returns the empty string for empty input', () => {
      expect(normalizeFields('')).toBe('');
    });
  });

  describe('pipelineQueryKey', () => {
    it('normalizes the fields element of the key', () => {
      expect(pipelineQueryKey(FQN, 'followers, tags, owners')).toEqual([
        'pipeline',
        FQN,
        'followers,tags,owners',
      ]);
    });

    it('keeps the [entityType, fqn] prefix for SuggestionsProvider invalidation', () => {
      expect(pipelineQueryKey(FQN, 'f').slice(0, 2)).toEqual(['pipeline', FQN]);
    });

    it('maps logically-equivalent spacing variants to identical keys (cache slot equality)', () => {
      expect(
        pipelineQueryKey(FQN, 'followers,tags,owners,usageSummary')
      ).toEqual(pipelineQueryKey(FQN, 'followers, tags, owners, usageSummary'));
    });
  });

  describe('prefetch <-> detail page cache slot synchronization', () => {
    let queryClient: QueryClient;

    beforeEach(() => {
      queryClient = buildQueryClient();
      getPipelineByFqnMock.mockResolvedValue(fixturePipeline);
    });

    afterEach(() => {
      getPipelineByFqnMock.mockReset();
    });

    it('warms the exact cache slot the page reads with ViewUsage permission', async () => {
      await act(async () => {
        await prefetchPipeline(queryClient, FQN);
      });

      // PipelineDetailsPage.component.tsx builds this exact string when the viewer
      // holds ViewUsage permission. Before the fix this lookup was a MISS because the
      // prefetch key had no spaces while defaultFields carries stray spaces.
      const pageFieldsWithUsage = `${defaultFields},${TabSpecificField.USAGE_SUMMARY}`;
      const detailPageKey = pipelineQueryKey(FQN, pageFieldsWithUsage);

      expect(queryClient.getQueryData(detailPageKey)).toEqual(fixturePipeline);
    });

    it('fires exactly one network request per prefetch', async () => {
      await act(async () => {
        await prefetchPipeline(queryClient, FQN);
      });

      expect(getPipelineByFqnMock).toHaveBeenCalledTimes(1);
      expect(getPipelineByFqnMock).toHaveBeenCalledWith(FQN, {
        fields: PREFETCH_PIPELINE_FIELDS,
      });
    });

    it('does not refetch when the page reads the warmed slot', async () => {
      await act(async () => {
        await prefetchPipeline(queryClient, FQN);
      });

      getPipelineByFqnMock.mockClear();

      const pageFieldsWithUsage = `${defaultFields},${TabSpecificField.USAGE_SUMMARY}`;

      await act(async () => {
        await queryClient.fetchQuery({
          queryKey: pipelineQueryKey(FQN, pageFieldsWithUsage),
          queryFn: () => getPipelineByFqn(FQN, { fields: pageFieldsWithUsage }),
        });
      });

      expect(getPipelineByFqnMock).not.toHaveBeenCalled();
    });

    it('page key without ViewUsage permission is a different slot (not the prefetch slot)', async () => {
      await act(async () => {
        await prefetchPipeline(queryClient, FQN);
      });

      // The prefetch always requests usageSummary; the page without ViewUsage does not,
      // so they legitimately differ in field set and the prefetch slot is not consumed
      // (this matches the documented, accepted restricted-viewer tradeoff).
      const pageFieldsWithoutUsage = defaultFields;
      const detailPageKey = pipelineQueryKey(FQN, pageFieldsWithoutUsage);

      expect(queryClient.getQueryData(detailPageKey)).toBeUndefined();
    });

    it('a prefetch using the page fields directly also produces a hit (sanity check that the miss was purely whitespace)', async () => {
      const pageFieldsWithUsage = `${defaultFields},${TabSpecificField.USAGE_SUMMARY}`;

      await act(async () => {
        await prefetchPipelineByFqn(queryClient, FQN, pageFieldsWithUsage);
      });

      expect(
        queryClient.getQueryData(pipelineQueryKey(FQN, pageFieldsWithUsage))
      ).toEqual(fixturePipeline);
    });
  });

  describe('keep-in-sync guard with PipelineDetailsUtils.defaultFields', () => {
    it('prefetch fields equal the page default fields + usageSummary (same members, same order, same cache slot)', () => {
      const pageFieldsWithUsage = `${defaultFields},${TabSpecificField.USAGE_SUMMARY}`;

      // Exact normalized string equality is what makes the two React Query slots match.
      expect(normalizeFields(PREFETCH_PIPELINE_FIELDS)).toBe(
        normalizeFields(pageFieldsWithUsage)
      );
    });

    it('the prefetch key and the page key are identical for a ViewUsage-permitted viewer', () => {
      const pageFieldsWithUsage = `${defaultFields},${TabSpecificField.USAGE_SUMMARY}`;

      expect(pipelineQueryKey(FQN, pageFieldsWithUsage)).toEqual(
        pipelineQueryKey(FQN, PREFETCH_PIPELINE_FIELDS)
      );
    });

    it('base field sets match (without usageSummary)', () => {
      const prefetchBaseMembers = PREFETCH_PIPELINE_FIELDS.split(',').filter(
        (f) => f !== TabSpecificField.USAGE_SUMMARY
      );
      const pageBaseMembers = normalizeFields(defaultFields).split(',');

      expect(prefetchBaseMembers).toEqual(pageBaseMembers);
    });
  });
});
