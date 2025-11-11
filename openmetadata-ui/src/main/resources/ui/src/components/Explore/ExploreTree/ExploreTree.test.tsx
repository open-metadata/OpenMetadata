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
import { render, waitFor } from '@testing-library/react';
import ExploreTree from './ExploreTree';

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockReturnValue({
    tab: 'tables',
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: jest.fn().mockReturnValue({
    t: jest.fn().mockImplementation((key) => key),
  }),
}));

describe('ExploreTree', () => {
  it('renders the correct tree nodes', async () => {
    const { getByText, queryByTestId } = render(
      <ExploreTree onFieldValueSelect={jest.fn()} />
    );

    // Wait for loader to disappear
    await waitFor(() => {
      expect(queryByTestId('loader')).not.toBeInTheDocument();
    });

    expect(getByText('label.database-plural')).toBeInTheDocument();
    expect(getByText('label.dashboard-plural')).toBeInTheDocument();
    expect(getByText('label.topic-plural')).toBeInTheDocument();
    expect(getByText('label.container-plural')).toBeInTheDocument();
    expect(getByText('label.pipeline-plural')).toBeInTheDocument();
    expect(getByText('label.search-index-plural')).toBeInTheDocument();
    expect(getByText('label.ml-model-plural')).toBeInTheDocument();
    expect(getByText('label.governance')).toBeInTheDocument();
  });
});
