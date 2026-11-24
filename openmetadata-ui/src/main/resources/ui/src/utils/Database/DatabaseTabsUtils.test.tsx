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
import { FEED_COUNT_INITIAL_DATA } from '../../constants/entity.constants';
import { EntityTabs } from '../../enums/entity.enum';
import { Database } from '../../generated/entity/data/database';
import { DatabaseDetailPageTabProps } from './DatabaseClassBase';
import { getDatabasePageBaseTabs } from './DatabaseTabsUtils';

jest.mock('../../components/common/TabsLabel/TabsLabel.component', () =>
  jest
    .fn()
    .mockImplementation(({ id, name }) => (
      <div data-testid={`tab-label-${id}`}>{name}</div>
    ))
);

jest.mock('../../components/Customization/GenericTab/GenericTab', () => ({
  GenericTab: jest.fn(),
}));

jest.mock('../../components/DataAssets/CommonWidgets/CommonWidgets', () => ({
  CommonWidgets: jest.fn(),
}));

jest.mock('../i18next/LocalUtil', () => ({
  t: (key: string) => key,
}));

const mockProps: DatabaseDetailPageTabProps = {
  activeTab: EntityTabs.SCHEMAS,
  database: {} as Database,
  viewAllPermission: true,
  viewCustomPropertiesPermission: true,
  schemaInstanceCount: 3,
  feedCount: FEED_COUNT_INITIAL_DATA,
  handleFeedCount: jest.fn(),
  getEntityFeedCount: jest.fn(),
  deleted: false,
  editCustomAttributePermission: true,
  getDetailsByFQN: jest.fn(),
};

const renderSchemasTabLabel = (props: DatabaseDetailPageTabProps) => {
  const schemasTab = getDatabasePageBaseTabs(props).find(
    (tab) => tab.key === EntityTabs.SCHEMAS
  );

  render(<>{schemasTab?.label}</>);

  return screen.getByTestId(`tab-label-${EntityTabs.SCHEMAS}`);
};

describe('getDatabasePageBaseTabs', () => {
  it('names the schemas tab in the plural when no persona renamed it', () => {
    expect(renderSchemasTabLabel(mockProps)).toHaveTextContent(
      'label.schema-plural'
    );
  });

  it('uses the persona label for the schemas tab when one is set', () => {
    expect(
      renderSchemasTabLabel({
        ...mockProps,
        labelMap: { [EntityTabs.SCHEMAS]: 'Persona Schemas' } as Record<
          EntityTabs,
          string
        >,
      })
    ).toHaveTextContent('Persona Schemas');
  });
});
