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

import { act, fireEvent, render, screen } from '@testing-library/react';
import { ENTITY_PERMISSIONS } from '../../../mocks/Permissions.mock';
import { topicVersionMockProps } from '../../../mocks/TopicVersion.mock';
import TopicVersion from './TopicVersion.component';

const mockPush = jest.fn();

jest.mock(
  '../../DataAssets/DataAssetsVersionHeader/DataAssetsVersionHeader',
  () => jest.fn().mockImplementation(() => <div>DataAssetsVersionHeader</div>)
);

jest.mock('../../common/TabsLabel/TabsLabel.component', () =>
  jest.fn().mockImplementation(({ name }) => <div>{name}</div>)
);

jest.mock('../../Tag/TagsContainerV2/TagsContainerV2', () =>
  jest.fn().mockImplementation(() => <div>TagsContainerV2</div>)
);

jest.mock('../../common/CustomPropertyTable/CustomPropertyTable', () => ({
  CustomPropertyTable: jest
    .fn()
    .mockImplementation(() => <div>CustomPropertyTable</div>),
}));

jest.mock('../../common/EntityDescription/DescriptionV1', () =>
  jest.fn().mockImplementation(() => <div>DescriptionV1</div>)
);

jest.mock('../../common/ErrorWithPlaceholder/ErrorPlaceHolder', () =>
  jest.fn().mockImplementation(() => <div>ErrorPlaceHolder</div>)
);

jest.mock('../../Entity/EntityVersionTimeLine/EntityVersionTimeLine', () =>
  jest.fn().mockImplementation(() => <div>EntityVersionTimeLine</div>)
);

jest.mock('../../Topic/TopicSchema/TopicSchema', () =>
  jest.fn().mockImplementation(() => <div>TopicSchema</div>)
);

jest.mock('../../common/Loader/Loader', () =>
  jest.fn().mockImplementation(() => <div>Loader</div>)
);

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockReturnValue({
    tab: 'topics',
  }),
  useNavigate: jest.fn().mockImplementation(() => mockPush),
}));

describe('TopicVersion tests', () => {
  it('Should render component properly if not loading', async () => {
    await act(async () => {
      render(<TopicVersion {...topicVersionMockProps} />);
    });

    const dataAssetsVersionHeader = screen.getByText('DataAssetsVersionHeader');
    const description = screen.getByText('DescriptionV1');
    const schemaTabLabel = screen.getByText('label.schema');
    const customPropertyTabLabel = screen.getByText(
      'label.custom-property-plural'
    );
    const entityVersionTimeLine = screen.getByText('EntityVersionTimeLine');
    const topicSchema = screen.getByText('TopicSchema');

    expect(dataAssetsVersionHeader).toBeInTheDocument();
    expect(description).toBeInTheDocument();
    expect(schemaTabLabel).toBeInTheDocument();
    expect(customPropertyTabLabel).toBeInTheDocument();
    expect(entityVersionTimeLine).toBeInTheDocument();
    expect(topicSchema).toBeInTheDocument();
  });

  it('Should display Loader if isVersionLoading is true', async () => {
    await act(async () => {
      render(<TopicVersion {...topicVersionMockProps} isVersionLoading />);
    });

    const loader = screen.getByText('Loader');
    const entityVersionTimeLine = screen.getByText('EntityVersionTimeLine');
    const dataAssetsVersionHeader = screen.queryByText(
      'DataAssetsVersionHeader'
    );
    const schemaTabLabel = screen.queryByText('label.schema');
    const customPropertyTabLabel = screen.queryByText(
      'label.custom-property-plural'
    );
    const topicSchema = screen.queryByText('TopicSchema');

    expect(loader).toBeInTheDocument();
    expect(entityVersionTimeLine).toBeInTheDocument();
    expect(dataAssetsVersionHeader).toBeNull();
    expect(schemaTabLabel).toBeNull();
    expect(customPropertyTabLabel).toBeNull();
    expect(topicSchema).toBeNull();
  });

  it('Should update url on click of tab', async () => {
    render(
      <TopicVersion
        {...topicVersionMockProps}
        entityPermissions={ENTITY_PERMISSIONS}
      />
    );

    const customPropertyTabLabel = screen.getByText(
      'label.custom-property-plural'
    );

    expect(customPropertyTabLabel).toBeInTheDocument();

    fireEvent.click(customPropertyTabLabel);

    expect(mockPush).toHaveBeenCalledWith(
      '/topic/sample_kafka.sales/versions/0.3/custom_properties'
    );
  });
});
