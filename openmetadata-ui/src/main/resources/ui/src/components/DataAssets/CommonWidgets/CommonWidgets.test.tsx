/*
 *  Copyright 2025 Collate.
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
import {
  DetailPageWidgetKeys,
  GlossaryTermDetailPageWidgetKeys,
} from '../../../enums/CustomizeDetailPage.enum';
import { EntityType } from '../../../enums/entity.enum';
import commonWidgetClassBase from '../../../utils/CommonWidget/CommonWidgetClassBase';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import { CommonWidgets } from './CommonWidgets';

// Mock the required dependencies
jest.mock('../../Customization/GenericProvider/GenericProvider');
jest.mock('../../common/EntityDescription/DescriptionV1', () => ({
  __esModule: true,
  default: () => <div data-testid="description-widget">Description Widget</div>,
}));
jest.mock(
  '../../DataProducts/DataProductsContainer/DataProductsContainer.component',
  () => ({
    __esModule: true,
    default: () => (
      <div data-testid="data-products-widget">Data Products Widget</div>
    ),
  })
);
jest.mock('../../Tag/TagsContainerV2/TagsContainerV2', () => ({
  __esModule: true,
  default: () => <div data-testid="tags-widget">Tags Widget</div>,
}));
jest.mock('../../common/CustomPropertyTable/CustomPropertyTable', () => ({
  CustomPropertyTable: () => (
    <div data-testid="custom-properties-widget">Custom Properties Widget</div>
  ),
}));
jest.mock('../OwnerLabelV2/OwnerLabelV2', () => ({
  OwnerLabelV2: () => (
    <div data-testid="owner-label-widget">Owner Label Widget</div>
  ),
}));
jest.mock('../ReviewerLabelV2/ReviewerLabelV2', () => ({
  ReviewerLabelV2: () => (
    <div data-testid="reviewer-label-widget">Reviewer Label Widget</div>
  ),
}));

jest.mock('../../../utils/CommonWidget/CommonWidgetClassBase', () => ({
  getCommonWidgetsFromConfig: jest.fn(),
}));

jest.mock('../../../utils/TableColumn.util', () => ({
  ownerTableObject: jest.fn().mockReturnValue({}),
}));

const mockGenericContext = {
  data: {
    name: 'test',
    fullyQualifiedName: 'test.fqn',
    tags: [],
    description: 'test description',
    owners: [],
  },
  type: EntityType.TABLE,
  permissions: {
    EditAll: true,
    ViewAll: true,
  },
  onUpdate: jest.fn(),
};

describe('CommonWidgets', () => {
  beforeEach(() => {
    (useGenericContext as jest.Mock).mockReturnValue(mockGenericContext);
  });

  it('should render description widget', () => {
    const widgetConfig = {
      i: DetailPageWidgetKeys.DESCRIPTION,
      x: 0,
      y: 0,
      w: 1,
      h: 1,
    };

    render(
      <CommonWidgets
        entityType={EntityType.TABLE}
        widgetConfig={widgetConfig}
      />
    );

    expect(screen.getByTestId('description-widget')).toBeInTheDocument();
  });

  it('should render data products widget', () => {
    const widgetConfig = {
      i: DetailPageWidgetKeys.DATA_PRODUCTS,
      x: 0,
      y: 0,
      w: 1,
      h: 1,
    };

    render(
      <CommonWidgets
        entityType={EntityType.TABLE}
        widgetConfig={widgetConfig}
      />
    );

    expect(screen.getByTestId('data-products-widget')).toBeInTheDocument();
  });

  it('should render tags widget', () => {
    const widgetConfig = {
      i: DetailPageWidgetKeys.TAGS,
      x: 0,
      y: 0,
      w: 1,
      h: 1,
    };

    render(
      <CommonWidgets
        entityType={EntityType.TABLE}
        widgetConfig={widgetConfig}
      />
    );

    expect(screen.getByTestId('tags-widget')).toBeInTheDocument();
  });

  it('should render glossary terms widget', () => {
    const widgetConfig = {
      i: DetailPageWidgetKeys.GLOSSARY_TERMS,
      x: 0,
      y: 0,
      w: 1,
      h: 1,
    };

    render(
      <CommonWidgets
        entityType={EntityType.TABLE}
        widgetConfig={widgetConfig}
      />
    );

    expect(screen.getByTestId('tags-widget')).toBeInTheDocument();
  });

  it('should render custom properties widget', () => {
    const widgetConfig = {
      i: DetailPageWidgetKeys.CUSTOM_PROPERTIES,
      x: 0,
      y: 0,
      w: 1,
      h: 1,
    };

    render(
      <CommonWidgets
        entityType={EntityType.TABLE}
        widgetConfig={widgetConfig}
      />
    );

    expect(screen.getByTestId('custom-properties-widget')).toBeInTheDocument();
  });

  it('should render owners widget', () => {
    const widgetConfig = {
      i: DetailPageWidgetKeys.OWNERS,
      x: 0,
      y: 0,
      w: 1,
      h: 1,
    };

    render(
      <CommonWidgets
        entityType={EntityType.TABLE}
        widgetConfig={widgetConfig}
      />
    );

    expect(screen.getByTestId('owner-label-widget')).toBeInTheDocument();
  });

  it('should render reviewer widget', () => {
    const widgetConfig = {
      i: GlossaryTermDetailPageWidgetKeys.REVIEWER,
      x: 0,
      y: 0,
      w: 1,
      h: 1,
    };

    render(
      <CommonWidgets
        entityType={EntityType.TABLE}
        widgetConfig={widgetConfig}
      />
    );

    expect(screen.getByTestId('reviewer-label-widget')).toBeInTheDocument();
  });

  it('should render experts widget', () => {
    const widgetConfig = {
      i: DetailPageWidgetKeys.EXPERTS,
      x: 0,
      y: 0,
      w: 1,
      h: 1,
    };

    render(
      <CommonWidgets
        entityType={EntityType.TABLE}
        widgetConfig={widgetConfig}
      />
    );

    expect(screen.getByTestId('owner-label-widget')).toBeInTheDocument();
  });

  it('should call commonWidgetClassBase.getCommonWidgetsFromConfig for unknown widget type', () => {
    const widgetConfig = {
      i: 'unknown-widget',
      x: 0,
      y: 0,
      w: 1,
      h: 1,
    };

    render(
      <CommonWidgets
        entityType={EntityType.TABLE}
        widgetConfig={widgetConfig}
      />
    );

    expect(
      commonWidgetClassBase.getCommonWidgetsFromConfig
    ).toHaveBeenCalledWith(widgetConfig);
  });
});
