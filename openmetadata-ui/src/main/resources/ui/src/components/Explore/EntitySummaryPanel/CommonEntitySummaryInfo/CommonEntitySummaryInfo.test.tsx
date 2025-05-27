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

import {
  getByTestId,
  queryByText,
  render,
  screen,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DRAWER_NAVIGATION_OPTIONS } from '../../../../utils/EntityUtils';
import { mockCommonEntityInfo } from '../mocks/CommonEntitySummaryInfo.mock';
import CommonEntitySummaryInfo from './CommonEntitySummaryInfo';
import { CommonEntitySummaryInfoProps } from './CommonEntitySummaryInfo.interface';

const mockProps: CommonEntitySummaryInfoProps = {
  entityInfo: mockCommonEntityInfo,
  componentType: DRAWER_NAVIGATION_OPTIONS.explore,
};

describe('CommonEntitySummaryInfo component', () => {
  it('Component should render correct fields for Explore page', () => {
    render(<CommonEntitySummaryInfo {...mockProps} />, {
      wrapper: MemoryRouter,
    });

    expect(screen.getByTestId('Type-label')).toHaveTextContent('Type');
    expect(screen.getByTestId('Type-value')).toHaveTextContent('Regular');
    expect(screen.getByTestId('Columns-label')).toHaveTextContent('Columns');
    expect(screen.getByTestId('Columns-value')).toHaveTextContent('-');
    expect(screen.getByTestId('Pipeline URL-label')).toHaveTextContent(
      'Pipeline URL'
    );

    const externalURL = screen.getByTestId('Pipeline URL-value');

    expect(externalURL).toHaveTextContent('Presto ETL');

    expect(externalURL.getAttribute('href')).toEqual(
      'http://localhost:8080/tree?dag_id=presto_etl'
    );
    expect(externalURL.getAttribute('target')).toEqual('_blank');
    expect(getByTestId(externalURL, 'external-link-icon')).toBeInTheDocument();
  });

  it('Component should render correct fields for Lineage page', () => {
    render(
      <CommonEntitySummaryInfo
        {...mockProps}
        componentType={DRAWER_NAVIGATION_OPTIONS.lineage}
      />,
      {
        wrapper: MemoryRouter,
      }
    );

    expect(screen.queryByTestId('label.owner-label')).not.toBeInTheDocument();
    expect(screen.getByTestId('label.owner-plural-value')).toHaveTextContent(
      'No Owner'
    );
    expect(screen.getByTestId('Type-label')).toHaveTextContent('Type');
    expect(screen.getByTestId('Type-value')).toHaveTextContent('Regular');
    expect(screen.getByTestId('Columns-label')).toHaveTextContent('Columns');
    expect(screen.getByTestId('Columns-value')).toHaveTextContent('-');
    expect(screen.getByTestId('Usage-label')).toHaveTextContent('Usage');
    expect(screen.getByTestId('Usage-value')).toHaveTextContent('-');
    expect(screen.getByTestId('Pipeline URL-label')).toHaveTextContent(
      'Pipeline URL'
    );
    expect(screen.getByTestId('Service-label')).toHaveTextContent('Service');

    const externalURL = screen.getByTestId('Pipeline URL-value');
    const serviceURL = screen.getByTestId('Service-value');

    expect(externalURL).toHaveTextContent('Presto ETL');
    expect(serviceURL).toHaveTextContent('sample_airflow');
    expect(serviceURL).toHaveTextContent('sample_airflow');

    expect(externalURL.getAttribute('href')).toEqual(
      'http://localhost:8080/tree?dag_id=presto_etl'
    );
    expect(externalURL.getAttribute('target')).toEqual('_blank');
    expect(serviceURL.getAttribute('href')).toEqual(
      '/service/databaseServices/sample_airflow'
    );
    expect(getByTestId(externalURL, 'external-link-icon')).toBeInTheDocument();
    expect(
      queryByText(serviceURL, 'external-link-icon')
    ).not.toBeInTheDocument();
  });
});
