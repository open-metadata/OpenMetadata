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
import {
  getDeleteIcon,
  getTagAssetsQueryFilter,
  getUsageCountLink,
} from './TagsUtils';

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

    expect(result).toBe(`(tier.tagFQN:"${tagFQN}")`);
  });

  it('returns query filter for tagFQN starting with "Certification"', () => {
    const tagFQN = 'Certification.Gold';
    const result = getTagAssetsQueryFilter(tagFQN);

    expect(result).toBe(`(certification.tagLabel.tagFQN:"${tagFQN}")`);
  });

  it('returns common query filter for tagFQN starting with any name expect "Tier and Certification"', () => {
    const tagFQN = 'ClassificationTag.Gold';
    const result = getTagAssetsQueryFilter(tagFQN);

    expect(result).toBe(`(tags.tagFQN:"${tagFQN}")`);
  });
});
