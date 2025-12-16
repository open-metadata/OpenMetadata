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

import { getByTestId, render } from '@testing-library/react';
import * as reactI18next from 'react-i18next';
import { ELASTICSEARCH_ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import ErrorPlaceHolderES from './ErrorPlaceHolderES';

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockReturnValue(jest.fn()),
}));

jest.mock('../../../utils/useRequiredParams', () => ({
  useRequiredParams: jest.fn().mockReturnValue({
    tab: 'tables',
  }),
}));

jest.mock('./FilterErrorPlaceHolder', () => {
  return jest
    .fn()
    .mockReturnValue(
      <div data-testid="FilterErrorPlaceHolder">FilterErrorPlaceHolder</div>
    );
});

jest.mock('../../../utils/BrandData/BrandClassBase', () => ({
  __esModule: true,
  default: {
    getPageTitle: jest.fn().mockReturnValue('OpenMetadata'),
  },
}));

const mockErrorMessage =
  'An exception with message [Elasticsearch exception [type=index_not_found_exception, reason=no such index [test_search_index]]] was thrown while processing request.';

describe('Test Error placeholder ingestion Component', () => {
  it('Component should render error placeholder', () => {
    const { container } = render(
      <ErrorPlaceHolderES type={ELASTICSEARCH_ERROR_PLACEHOLDER_TYPE.ERROR} />
    );

    expect(getByTestId(container, 'es-error')).toBeInTheDocument();
  });

  it('Component should render no data placeholder', () => {
    const { container } = render(
      <ErrorPlaceHolderES type={ELASTICSEARCH_ERROR_PLACEHOLDER_TYPE.NO_DATA} />
    );

    expect(getByTestId(container, 'no-search-results')).toBeInTheDocument();
  });

  it('Component should render Filter Placeholder for query search', () => {
    const { container } = render(
      <ErrorPlaceHolderES
        query={{ search: 'test' }}
        type={ELASTICSEARCH_ERROR_PLACEHOLDER_TYPE.NO_DATA}
      />
    );
    const noDataES = getByTestId(container, 'no-search-results');
    const searchFilterPlaceholder = getByTestId(
      noDataES,
      'FilterErrorPlaceHolder'
    );

    expect(searchFilterPlaceholder).toBeInTheDocument();
  });

  it('Component should render error placeholder with ES index', () => {
    const { container } = render(
      <ErrorPlaceHolderES
        errorMessage={mockErrorMessage}
        type={ELASTICSEARCH_ERROR_PLACEHOLDER_TYPE.ERROR}
      />
    );
    const errorES = getByTestId(container, 'es-error');
    const errMsg = getByTestId(errorES, 'error-text');

    expect(errMsg.textContent).toMatch('message.unable-to-error-elasticsearch');
  });

  it('should render with correct brandName (OpenMetadata or Collate)', () => {
    // Mock useTranslation to handle brandName interpolation
    const mockT = jest.fn((key: string, params?: Record<string, string>) => {
      if (key === 'message.welcome-to-open-metadata' && params?.brandName) {
        return `Welcome to ${params.brandName}!`;
      }

      return key;
    });

    jest.spyOn(reactI18next, 'useTranslation').mockReturnValue({
      t: mockT,
      i18n: { language: 'en-US' },
      ready: true,
    } as any);

    const { container } = render(
      <ErrorPlaceHolderES
        errorMessage={mockErrorMessage}
        type={ELASTICSEARCH_ERROR_PLACEHOLDER_TYPE.ERROR}
      />
    );
    const errorES = getByTestId(container, 'es-error');

    expect(errorES).toBeInTheDocument();
    // Verify the actual brand name is rendered, not the placeholder
    expect(errorES.textContent).toMatch(/OpenMetadata|Collate/);
    expect(errorES.textContent).not.toContain('{{brandName}}');

    // Verify the translation function was called with brandName parameter
    expect(mockT).toHaveBeenCalledWith('message.welcome-to-open-metadata', {
      brandName: 'OpenMetadata',
    });
  });
});
