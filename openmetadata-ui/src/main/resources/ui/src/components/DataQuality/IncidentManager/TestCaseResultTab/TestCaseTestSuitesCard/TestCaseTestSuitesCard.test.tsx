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
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TestSuite } from '../../../../../generated/tests/testSuite';
import TestCaseTestSuitesCard from './TestCaseTestSuitesCard';

const tableSuite = {
  id: 'table-suite-id',
  name: 'sample_data.ecommerce_db.shopify.dim_address.testSuite',
  fullyQualifiedName: 'sample_data.ecommerce_db.shopify.dim_address.testSuite',
  basic: true,
  basicEntityReference: {
    id: 'table-id',
    type: 'table',
    name: 'dim_address',
    fullyQualifiedName: 'sample_data.ecommerce_db.shopify.dim_address',
  },
} as TestSuite;

const bundleSuite = {
  id: 'bundle-suite-id',
  name: 'critical_orders',
  fullyQualifiedName: 'critical_orders',
  basic: false,
} as TestSuite;

const renderCard = (testSuites?: TestSuite[]) =>
  render(<TestCaseTestSuitesCard testSuites={testSuites} />, {
    wrapper: MemoryRouter,
  });

describe('TestCaseTestSuitesCard', () => {
  it('lists the table suite as a link to its table', () => {
    renderCard([tableSuite]);

    const link = screen.getByRole('link', { name: 'label.table dim_address' });

    expect(link).toHaveAttribute(
      'href',
      '/table/sample_data.ecommerce_db.shopify.dim_address/profiler/data-quality'
    );
  });

  it('lists every suite, telling a table suite from a bundle suite', () => {
    renderCard([tableSuite, bundleSuite]);

    const items = within(
      screen.getByTestId('test-suites-container')
    ).getAllByRole('listitem');

    expect(items).toHaveLength(2);
    expect(
      screen.getByRole('link', { name: 'label.table dim_address' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'label.bundle-suite critical_orders' })
    ).toHaveAttribute('href', '/test-suites/critical_orders');
  });

  it('shows only the collapsed header when the test case belongs to no suite', () => {
    renderCard([]);

    expect(screen.getByTestId('test-suites-container')).toHaveTextContent(
      'label.test-suite-plural'
    );
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('expand-collapse-icon')
    ).not.toBeInTheDocument();
  });

  it('can be collapsed like the other rail panels', () => {
    renderCard([tableSuite]);

    expect(screen.getByTestId('expand-collapse-icon')).toBeInTheDocument();
  });

  it('shows the first five suites and reveals the rest on demand', () => {
    const bundleSuites = Array.from(
      { length: 7 },
      (_, index) =>
        ({
          ...bundleSuite,
          id: `bundle-suite-${index}`,
          name: `bundle_${index}`,
          fullyQualifiedName: `bundle_${index}`,
        } as TestSuite)
    );
    renderCard([tableSuite, ...bundleSuites]);

    expect(screen.getAllByRole('listitem')).toHaveLength(5);

    fireEvent.click(
      screen.getByRole('button', { name: 'label.plus-count-more' })
    );

    expect(screen.getAllByRole('listitem')).toHaveLength(8);

    fireEvent.click(screen.getByRole('button', { name: 'label.less' }));

    expect(screen.getAllByRole('listitem')).toHaveLength(5);
  });

  it('has no show-more toggle when every suite fits', () => {
    renderCard([tableSuite, bundleSuite]);

    expect(
      screen.queryByTestId('test-suites-show-more')
    ).not.toBeInTheDocument();
  });
});
