/*
 *  Copyright 2023 Collate.
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
import { render } from '@testing-library/react';
import { getTermQuery } from './SearchPureUtils';
import {
    buildTagFqnIncludeRegex,
    getTagAssetsQueryFilter,
    getTagUsageAggregationField,
    getUsageCountLink,
    parseTagUsageBuckets
} from './TagsPureUtils';
import { getDeleteIcon } from './TagsUtils';

describe('getDeleteIcon', () => {
  it('renders CheckOutlined icon when deleteTagId matches id and status is "success"', () => {
    const arg = {
      deleteTagId: 'tag1',
      id: 'tag1',
      status: 'success',
    };

    const { container } = render(getDeleteIcon(arg));

    // Assert that the CheckOutlined icon is rendered
    expect(
      container.querySelector('[data-testid="check-outline"]')
    ).toBeInTheDocument();
  });

  it('renders Loader component when deleteTagId matches id and status is not "success"', () => {
    const arg = {
      deleteTagId: 'tag1',
      id: 'tag1',
      status: 'loading',
    };

    const { container } = render(getDeleteIcon(arg));

    // Assert that the Loader component is rendered
    expect(container.querySelector('.loader')).toBeInTheDocument();
  });

  it('renders DeleteIcon component when deleteTagId does not match id', () => {
    const arg = {
      deleteTagId: 'tag2',
      id: 'tag1',
    };

    const { container } = render(getDeleteIcon(arg));

    // Assert that the DeleteIcon component is rendered
    expect(
      container.querySelector('[data-testid="delete-icon"]')
    ).toBeInTheDocument();
  });
});

describe('getUsageCountLink', () => {
  it('returns the correct explore path for tagFQN starting with "Tier"', () => {
    const tagFQN = 'Tier1';

    const result = getUsageCountLink(tagFQN);

    // Assert that the correct explore path is returned
    expect(result).toBe(
      // eslint-disable-next-line max-len
      '/explore/tables?page=1&quickFilter=%7B%22query%22%3A%7B%22bool%22%3A%7B%22must%22%3A%5B%7B%22bool%22%3A%7B%22should%22%3A%5B%7B%22term%22%3A%7B%22tier.tagFQN%22%3A%22Tier1%22%7D%7D%5D%7D%7D%5D%7D%7D%7D'
    );
  });

  it('returns the correct explore path for tagFQN not starting with "Tier"', () => {
    const tagFQN = 'Tag1';

    const result = getUsageCountLink(tagFQN);

    // Assert that the correct explore path is returned
    expect(result).toBe(
      // eslint-disable-next-line max-len
      '/explore/tables?page=1&quickFilter=%7B%22query%22%3A%7B%22bool%22%3A%7B%22must%22%3A%5B%7B%22bool%22%3A%7B%22should%22%3A%5B%7B%22term%22%3A%7B%22tags.tagFQN%22%3A%22Tag1%22%7D%7D%5D%7D%7D%5D%7D%7D%7D'
    );
  });
});

describe('getTagAssetsQueryFilter', () => {
  it('returns query filter for tagFQN starting with "Tier"', () => {
    const tagFQN = 'Tier.Tier1';
    const result = getTagAssetsQueryFilter(tagFQN);
    const queryFilter = getTermQuery({ 'tier.tagFQN': tagFQN });

    expect(result).toEqual(queryFilter);
  });

  it('returns query filter for tagFQN starting with "Certification"', () => {
    const tagFQN = 'Certification.Gold';
    const result = getTagAssetsQueryFilter(tagFQN);
    const queryFilter = getTermQuery({
      'certification.tagLabel.tagFQN': tagFQN,
    });

    expect(result).toEqual(queryFilter);
  });

  it('returns common query filter for tagFQN starting with any name expect "Tier and Certification"', () => {
    const tagFQN = 'ClassificationTag.Gold';
    const result = getTagAssetsQueryFilter(tagFQN);
    const queryFilter = getTermQuery({ 'tags.tagFQN': tagFQN });

    expect(result).toEqual(queryFilter);
  });

  it('returns common query filter when classification name ends with "Tier"', () => {
    const tagFQN = 'DataTier.Bronze';
    const result = getTagAssetsQueryFilter(tagFQN);
    const queryFilter = getTermQuery({ 'tags.tagFQN': tagFQN });

    expect(result).toEqual(queryFilter);
  });

  it('returns common query filter when classification name ends with "Certification"', () => {
    const tagFQN = 'DataCertification.Gold';
    const result = getTagAssetsQueryFilter(tagFQN);
    const queryFilter = getTermQuery({ 'tags.tagFQN': tagFQN });

    expect(result).toEqual(queryFilter);
  });
});

describe('getTagUsageAggregationField', () => {
  it('should return the tier field for the Tier classification', () => {
    expect(getTagUsageAggregationField('Tier')).toBe('tier.tagFQN');
  });

  it('should return the certification field for the Certification classification', () => {
    expect(getTagUsageAggregationField('Certification')).toBe(
      'certification.tagLabel.tagFQN'
    );
  });

  it('should return the tags field for any other classification', () => {
    expect(getTagUsageAggregationField('PII')).toBe('tags.tagFQN');
  });
});

describe('buildTagFqnIncludeRegex', () => {
  it('should lowercase and alternate the given FQNs inside a group', () => {
    expect(buildTagFqnIncludeRegex(['PII.Sensitive', 'PII.NonSensitive'])).toBe(
      '(pii\\.sensitive|pii\\.nonsensitive)'
    );
  });

  it('should escape regex metacharacters so an FQN cannot widen the match', () => {
    expect(buildTagFqnIncludeRegex(['PII."a.b"'])).toBe('(pii\\.\\"a\\.b\\")');
  });

  it('should return an empty group for an empty list', () => {
    expect(buildTagFqnIncludeRegex([])).toBe('()');
  });
});

describe('parseTagUsageBuckets', () => {
  const field = 'tags.tagFQN';

  it('should map the sterms-prefixed buckets to lowercased FQN counts', () => {
    const result = parseTagUsageBuckets(
      {
        [`sterms#${field}`]: {
          buckets: [
            { key: 'pii.sensitive', doc_count: 7 },
            { key: 'PII.NonSensitive', doc_count: 2 },
          ],
        },
      },
      field
    );

    expect(result).toEqual({ 'pii.sensitive': 7, 'pii.nonsensitive': 2 });
  });

  it('should return an empty map when there are no aggregations', () => {
    expect(parseTagUsageBuckets(undefined, field)).toEqual({});
  });
});
