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

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import {
  mlModelVersionMockProps,
  mockMlModelDetails,
} from '../../mocks/MlModelVersion.mock';
import MlModelVersion from './MlModelVersion.component';

const mockPush = jest.fn();

jest.mock(
  '../../components/DataAssets/DataAssetsVersionHeader/DataAssetsVersionHeader',
  () => jest.fn().mockImplementation(() => <div>DataAssetsVersionHeader</div>)
);

jest.mock('../../components/TabsLabel/TabsLabel.component', () =>
  jest.fn().mockImplementation(({ name }) => <div>{name}</div>)
);

jest.mock('../../components/Tag/TagsContainerV2/TagsContainerV2', () =>
  jest.fn().mockImplementation(() => <div>TagsContainerV2</div>)
);

jest.mock(
  '../../components/common/CustomPropertyTable/CustomPropertyTable',
  () => ({
    CustomPropertyTable: jest
      .fn()
      .mockImplementation(() => <div>CustomPropertyTable</div>),
  })
);

jest.mock('../../components/common/description/DescriptionV1', () =>
  jest.fn().mockImplementation(() => <div>DescriptionV1</div>)
);

jest.mock(
  '../../components/common/error-with-placeholder/ErrorPlaceHolder',
  () => jest.fn().mockImplementation(() => <div>ErrorPlaceHolder</div>)
);

jest.mock(
  '../../components/Entity/EntityVersionTimeLine/EntityVersionTimeLine',
  () => jest.fn().mockImplementation(() => <div>EntityVersionTimeLine</div>)
);

jest.mock('../../components/VersionTable/VersionTable.component', () =>
  jest.fn().mockImplementation(() => <div>VersionTable</div>)
);

jest.mock('../../components/Loader/Loader', () =>
  jest.fn().mockImplementation(() => <div>Loader</div>)
);

jest.mock('react-router-dom', () => ({
  useHistory: jest.fn().mockImplementation(() => ({
    push: mockPush,
  })),
  useParams: jest.fn().mockReturnValue({
    tab: 'container',
  }),
}));

describe('MlModelVersion tests', () => {
  it('Should render component properly if not loading', async () => {
    await act(async () => {
      render(<MlModelVersion {...mlModelVersionMockProps} />);
    });

    const dataAssetsVersionHeader = screen.getByText('DataAssetsVersionHeader');
    const description = screen.getByText('DescriptionV1');
    const featureTabLabel = screen.getByText('label.feature-plural');
    const customPropertyTabLabel = screen.getByText(
      'label.custom-property-plural'
    );
    const entityVersionTimeLine = screen.getByText('EntityVersionTimeLine');

    expect(dataAssetsVersionHeader).toBeInTheDocument();
    expect(description).toBeInTheDocument();
    expect(featureTabLabel).toBeInTheDocument();
    expect(customPropertyTabLabel).toBeInTheDocument();
    expect(entityVersionTimeLine).toBeInTheDocument();
  });

  it('Should display Loader if isVersionLoading is true', async () => {
    await act(async () => {
      render(<MlModelVersion {...mlModelVersionMockProps} isVersionLoading />);
    });

    const loader = screen.getByText('Loader');
    const entityVersionTimeLine = screen.getByText('EntityVersionTimeLine');
    const dataAssetsVersionHeader = screen.queryByText(
      'DataAssetsVersionHeader'
    );
    const featureTabLabel = screen.queryByText('label.feature-plural');
    const customPropertyTabLabel = screen.queryByText(
      'label.custom-property-plural'
    );

    expect(loader).toBeInTheDocument();
    expect(entityVersionTimeLine).toBeInTheDocument();
    expect(dataAssetsVersionHeader).toBeNull();
    expect(featureTabLabel).toBeNull();
    expect(customPropertyTabLabel).toBeNull();
  });

  it('No data placeholder should be displayed if no mlFeatures are present in the mlModel data', async () => {
    await act(async () => {
      render(
        <MlModelVersion
          {...mlModelVersionMockProps}
          currentVersionData={{ ...mockMlModelDetails, mlFeatures: undefined }}
        />
      );
    });

    const featureTabLabel = screen.getByText('label.feature-plural');
    const errorPlaceHolder = screen.getByText('ErrorPlaceHolder');

    expect(featureTabLabel).toBeInTheDocument();
    expect(errorPlaceHolder).toBeInTheDocument();
  });

  it('Should update url on click of tab', async () => {
    await act(async () => {
      render(<MlModelVersion {...mlModelVersionMockProps} />);
    });

    const customPropertyTabLabel = screen.getByText(
      'label.custom-property-plural'
    );

    expect(customPropertyTabLabel).toBeInTheDocument();

    await act(async () => {
      userEvent.click(customPropertyTabLabel);
    });

    expect(mockPush).toHaveBeenCalledWith(
      '/mlmodel/mlflow_svc.eta_predictions/versions/0.3/custom_properties'
    );
  });
});
