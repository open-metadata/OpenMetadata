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

import { render, screen } from '@testing-library/react';
import { ReactElement } from 'react';
import { usePageHeader } from './usePageHeader';

jest.mock('../../ProfilePicture/ProfilePicture', () =>
  jest.fn().mockImplementation(() => <div data-testid="profile-picture" />)
);

jest.mock('../../../Learning/LearningIcon/LearningIcon.component', () => ({
  LearningIcon: jest
    .fn()
    .mockImplementation(() => <div data-testid="learning-icon" />),
}));

jest.mock('../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockImplementation(() => ({
    currentUser: { name: 'reethika', displayName: 'Reethika' },
  })),
}));

type HarnessProps = Parameters<typeof usePageHeader>[0];

const Harness = (props: HarnessProps): ReactElement => {
  const { pageHeader } = usePageHeader(props);

  return <>{pageHeader}</>;
};

const baseConfig: HarnessProps = {
  titleKey: 'label.data-product-plural',
  descriptionMessageKey: 'message.data-product-description',
};

describe('usePageHeader', () => {
  it('renders the default variant with title and description', () => {
    render(<Harness {...baseConfig} />);

    expect(screen.getByText('label.data-product-plural')).toBeInTheDocument();
    expect(
      screen.getByText('message.data-product-description')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('page-header-container')
    ).not.toBeInTheDocument();
  });

  it('renders the add button in the default variant when permitted', () => {
    render(
      <Harness
        {...baseConfig}
        createPermission
        addButtonLabelKey="label.add-data-product"
        onAddClick={jest.fn()}
      />
    );

    expect(screen.getByTestId('add-entity-button')).toBeInTheDocument();
  });

  it('renders the greeting variant with avatar and greeting title', () => {
    render(<Harness {...baseConfig} variant="greeting" />);

    expect(screen.getByTestId('profile-picture')).toBeInTheDocument();
    expect(screen.getByText('label.hey-comma-name')).toBeInTheDocument();
    expect(screen.getByTestId('page-header-container')).toBeInTheDocument();
  });

  it('renders the search node and add button in the search variant', () => {
    render(
      <Harness
        {...baseConfig}
        createPermission
        addButtonLabelKey="label.add-data-product"
        search={<input data-testid="header-search" />}
        variant="search"
        onAddClick={jest.fn()}
      />
    );

    expect(screen.getByTestId('header-search')).toBeInTheDocument();
    expect(screen.getByTestId('add-entity-button')).toBeInTheDocument();
  });

  it('renders the beta badge in the beta variant', () => {
    render(<Harness {...baseConfig} variant="beta" />);

    expect(screen.getByText('label.beta')).toBeInTheDocument();
  });
});
