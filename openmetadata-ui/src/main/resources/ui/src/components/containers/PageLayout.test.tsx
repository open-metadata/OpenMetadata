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
import React from 'react';
import PageLayout from './PageLayout';

jest.mock('components/DocumentTitle/DocumentTitle', () =>
  jest.fn().mockImplementation(() => <div>DocumentTitle</div>)
);

describe('PageLayout', () => {
  it('Should render with children', () => {
    const { getByText } = render(
      <PageLayout pageTitle="Test Page Title">
        <div>Test Child Element</div>
      </PageLayout>
    );

    expect(getByText('Test Child Element')).toBeInTheDocument();
  });

  it('Should render with left panel', () => {
    const { getByText } = render(
      <PageLayout
        leftPanel={<div>Test Left Panel</div>}
        pageTitle="Test Page Title">
        <div>Test Child Element</div>
      </PageLayout>
    );

    expect(getByText('Test Left Panel')).toBeInTheDocument();
  });

  it('Should render with right panel', () => {
    const { getByText } = render(
      <PageLayout
        pageTitle="Test Page Title"
        rightPanel={<div>Test Right Panel</div>}>
        <div>Test Child Element</div>
      </PageLayout>
    );

    expect(getByText('Test Right Panel')).toBeInTheDocument();
  });

  it('Should render with header', () => {
    const { getByText } = render(
      <PageLayout header={<div>Test Header</div>} pageTitle="Test Page Title">
        <div>Test Child Element</div>
      </PageLayout>
    );

    expect(getByText('Test Header')).toBeInTheDocument();
  });
});
