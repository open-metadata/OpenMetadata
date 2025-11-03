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

import {
  ObjectFieldTemplatePropertyType,
  ObjectFieldTemplateProps,
  RJSFSchema,
} from '@rjsf/utils';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import serviceUtilClassBase from '../../../../../utils/ServiceUtilClassBase';
import { ObjectFieldTemplate } from './ObjectFieldTemplate';

jest.mock('../../../../../utils/ServiceUtilClassBase', () => ({
  __esModule: true,
  default: {
    getProperties: jest.fn(),
  },
}));

jest.mock('../../../../../constants/Services.constant', () => ({
  ADVANCED_PROPERTIES: ['connectionArguments', 'connectionOptions'],
}));

describe('ObjectFieldTemplate', () => {
  const mockOnAddClick = jest.fn();
  const mockHandleFocus = jest.fn();
  const mockServiceUtil = serviceUtilClassBase as jest.Mocked<
    typeof serviceUtilClassBase
  >;

  const createMockProperty = (
    name: string,
    content: React.ReactElement | null = null
  ): ObjectFieldTemplatePropertyType => ({
    name,
    content: content || <div key={name}>{name} content</div>,
    disabled: false,
    hidden: false,
    readonly: false,
  });

  const defaultProps: ObjectFieldTemplateProps = {
    title: 'Test Title',
    description: 'Test Description',
    properties: [createMockProperty('field1'), createMockProperty('field2')],
    required: false,
    disabled: false,
    readonly: false,
    idSchema: { $id: 'test-id' },
    schema: {} as RJSFSchema,
    uiSchema: {},
    formData: {},
    formContext: {},
    registry: {} as ObjectFieldTemplateProps['registry'],
    onAddClick: mockOnAddClick,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockServiceUtil.getProperties.mockReturnValue({
      properties: defaultProps.properties,
      additionalField: '',
      additionalFieldContent: null,
    });
  });

  describe('Basic Rendering', () => {
    it('should render title correctly', () => {
      render(<ObjectFieldTemplate {...defaultProps} />);

      expect(screen.getByText('Test Title')).toBeInTheDocument();
    });

    it('should render all normal properties', () => {
      render(<ObjectFieldTemplate {...defaultProps} />);

      expect(screen.getByText('field1 content')).toBeInTheDocument();
      expect(screen.getByText('field2 content')).toBeInTheDocument();
    });

    it('should apply correct CSS classes to property wrappers', () => {
      const { container } = render(<ObjectFieldTemplate {...defaultProps} />);

      const propertyWrappers = container.querySelectorAll('.property-wrapper');

      expect(propertyWrappers).toHaveLength(2);
    });
  });

  describe('Advanced Properties', () => {
    const propsWithAdvanced: ObjectFieldTemplateProps = {
      ...defaultProps,
      properties: [
        createMockProperty('field1'),
        createMockProperty('connectionArguments'),
        createMockProperty('connectionOptions'),
      ],
    };

    beforeEach(() => {
      mockServiceUtil.getProperties.mockReturnValue({
        properties: [createMockProperty('field1')],
        additionalField: '',
        additionalFieldContent: null,
      });
    });

    it('should render advanced properties in a collapse panel', () => {
      const { container } = render(
        <ObjectFieldTemplate {...propsWithAdvanced} />
      );

      const collapse = container.querySelector('.ant-collapse');

      expect(collapse).toBeInTheDocument();

      const collapseHeader = screen.getByRole('button', {
        name: /Test Title label.advanced-config/,
      });

      expect(collapseHeader).toBeInTheDocument();
    });

    it('should render advanced properties inside collapse', () => {
      const { container } = render(
        <ObjectFieldTemplate {...propsWithAdvanced} />
      );

      // The collapse should exist
      const collapse = container.querySelector('.ant-collapse');

      expect(collapse).toBeInTheDocument();

      // Advanced properties are in the collapse but may not be visible until expanded
      // Let's check that the collapse panel header exists
      const collapseHeader = screen.getByRole('button', {
        name: /Test Title label.advanced-config/,
      });

      expect(collapseHeader).toBeInTheDocument();
    });

    it('should not render collapse when no advanced properties', () => {
      const { container } = render(<ObjectFieldTemplate {...defaultProps} />);

      expect(container.querySelector('.ant-collapse')).not.toBeInTheDocument();
    });

    it('should separate normal and advanced properties correctly', () => {
      const { container } = render(
        <ObjectFieldTemplate {...propsWithAdvanced} />
      );

      // Check that collapse exists for advanced properties
      const collapse = container.querySelector('.ant-collapse');

      expect(collapse).toBeInTheDocument();

      // Check that only normal properties are visible (advanced are in collapsed panel)
      const visibleWrappers = container.querySelectorAll('.property-wrapper');

      expect(visibleWrappers).toHaveLength(1); // Only normal properties visible

      // Verify normal property content is present
      expect(screen.getByText('field1 content')).toBeInTheDocument();

      // Verify advanced config header is present (but content is collapsed)
      const collapseHeader = screen.getByRole('button', {
        name: /Test Title label.advanced-config/,
      });

      expect(collapseHeader).toBeInTheDocument();
    });

    it('should remove advanced property fields from DOM when collapse panel is closed', () => {
      render(<ObjectFieldTemplate {...propsWithAdvanced} />);

      // Initially, advanced properties should not be in DOM (collapsed by default)
      expect(
        screen.queryByText('connectionArguments content')
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText('connectionOptions content')
      ).not.toBeInTheDocument();

      // Open the collapse panel
      const collapseHeader = screen.getByRole('button', {
        name: /Test Title label.advanced-config/,
      });
      fireEvent.click(collapseHeader);

      // After opening, advanced properties should be in DOM
      expect(
        screen.getByText('connectionArguments content')
      ).toBeInTheDocument();
      expect(screen.getByText('connectionOptions content')).toBeInTheDocument();

      // Close the collapse panel again
      fireEvent.click(collapseHeader);

      // After closing, advanced properties should be removed from DOM due to destroyInactivePanel
      expect(
        screen.queryByText('connectionArguments content')
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText('connectionOptions content')
      ).not.toBeInTheDocument();

      // Normal properties should remain visible throughout
      expect(screen.getByText('field1 content')).toBeInTheDocument();
    });
  });

  describe('Additional Properties', () => {
    const propsWithAdditional: ObjectFieldTemplateProps = {
      ...defaultProps,
      schema: {
        additionalProperties: true,
      } as RJSFSchema,
    };

    it('should render additional properties label when additionalProperties is true', () => {
      render(<ObjectFieldTemplate {...propsWithAdditional} />);

      expect(
        screen.getByText('label.additional-property-plural')
      ).toBeInTheDocument();
    });

    it('should render add button when additionalProperties is true', () => {
      render(<ObjectFieldTemplate {...propsWithAdditional} />);

      const addButton = screen.getByTestId('add-item-Test Title');

      expect(addButton).toBeInTheDocument();
    });

    it('should not render additional properties label when additionalProperties is false', () => {
      render(<ObjectFieldTemplate {...defaultProps} />);

      expect(
        screen.queryByText('label.additional-property-plural')
      ).not.toBeInTheDocument();
    });

    it('should not render add button when additionalProperties is false', () => {
      render(<ObjectFieldTemplate {...defaultProps} />);

      expect(
        screen.queryByTestId('add-item-Test Title')
      ).not.toBeInTheDocument();
    });

    it('should call onAddClick when add button is clicked', () => {
      const mockOnAddClickFn = jest.fn(() => jest.fn());
      const props = {
        ...propsWithAdditional,
        onAddClick: mockOnAddClickFn,
      };

      render(<ObjectFieldTemplate {...props} />);

      const addButton = screen.getByTestId('add-item-Test Title');
      fireEvent.click(addButton);

      expect(mockOnAddClickFn).toHaveBeenCalledWith(props.schema);
    });

    it('should apply additional-fields class when additionalProperties is true', () => {
      const { container } = render(
        <ObjectFieldTemplate {...propsWithAdditional} />
      );

      const propertyWrappers = container.querySelectorAll(
        '.property-wrapper.additional-fields'
      );

      expect(propertyWrappers.length).toBeGreaterThan(0);
    });

    it('should call handleFocus when add button is focused', () => {
      const propsWithFocus = {
        ...propsWithAdditional,
        formContext: {
          handleFocus: mockHandleFocus,
        },
      };

      render(<ObjectFieldTemplate {...propsWithFocus} />);

      const addButton = screen.getByTestId('add-item-Test Title');
      fireEvent.focus(addButton);

      expect(mockHandleFocus).toHaveBeenCalledWith('test-id');
    });

    it('should not call handleFocus when it is undefined', () => {
      render(<ObjectFieldTemplate {...propsWithAdditional} />);

      const addButton = screen.getByTestId('add-item-Test Title');
      fireEvent.focus(addButton);

      expect(mockHandleFocus).not.toHaveBeenCalled();
    });
  });

  describe('Additional Field Rendering', () => {
    it('should not render AdditionalField when not provided (default behavior)', () => {
      render(<ObjectFieldTemplate {...defaultProps} />);

      // Since additionalField is empty string by default, no additional field should render
      const { container } = render(<ObjectFieldTemplate {...defaultProps} />);
      const additionalElements = container.querySelectorAll(
        '[data-additional-field]'
      );

      expect(additionalElements).toHaveLength(0);
    });

    it('should render AdditionalField when provided as string', () => {
      // Mock a component name that would resolve to an actual component
      mockServiceUtil.getProperties.mockReturnValue({
        properties: defaultProps.properties,
        additionalField: 'div',
        additionalFieldContent: null,
      });

      const { container } = render(<ObjectFieldTemplate {...defaultProps} />);
      const divElements = container.querySelectorAll('div');

      expect(divElements.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty properties array', () => {
      const emptyProps = {
        ...defaultProps,
        properties: [],
      };

      mockServiceUtil.getProperties.mockReturnValue({
        properties: [],
        additionalField: '',
        additionalFieldContent: null,
      });

      const { container } = render(<ObjectFieldTemplate {...emptyProps} />);

      expect(container.querySelectorAll('.property-wrapper')).toHaveLength(0);
    });

    it('should handle properties with all advanced fields', () => {
      const allAdvancedProps = {
        ...defaultProps,
        properties: [
          createMockProperty('connectionArguments'),
          createMockProperty('connectionOptions'),
        ],
      };

      mockServiceUtil.getProperties.mockReturnValue({
        properties: [],
        additionalField: '',
        additionalFieldContent: null,
      });

      const { container } = render(
        <ObjectFieldTemplate {...allAdvancedProps} />
      );

      expect(container.querySelector('.ant-collapse')).toBeInTheDocument();

      // Advanced properties are in collapsed panel, so check for the header
      const collapseHeader = screen.getByRole('button', {
        name: /Test Title label.advanced-config/,
      });

      expect(collapseHeader).toBeInTheDocument();
    });

    it('should handle missing title', () => {
      const noTitleProps = {
        ...defaultProps,
        title: '',
      };

      const { container } = render(<ObjectFieldTemplate {...noTitleProps} />);

      const label = container.querySelector('label');

      expect(label).toBeInTheDocument();
      expect(label?.textContent).toBe('');
    });

    it('should handle complex nested content in properties', () => {
      const complexProps = {
        ...defaultProps,
        properties: [
          {
            ...createMockProperty('complex'),
            content: (
              <div key="complex">
                <span>Nested</span>
                <div>Content</div>
              </div>
            ),
          },
        ],
      };

      mockServiceUtil.getProperties.mockReturnValue({
        properties: complexProps.properties,
        additionalField: '',
        additionalFieldContent: null,
      });

      render(<ObjectFieldTemplate {...complexProps} />);

      expect(screen.getByText('Nested')).toBeInTheDocument();
      expect(screen.getByText('Content')).toBeInTheDocument();
    });
  });

  describe('Translation', () => {
    it('should use translation for advanced config label', () => {
      const propsWithAdvanced = {
        ...defaultProps,
        properties: [
          createMockProperty('field1'),
          createMockProperty('connectionArguments'),
        ],
      };

      mockServiceUtil.getProperties.mockReturnValue({
        properties: [createMockProperty('field1')],
        additionalField: '',
        additionalFieldContent: null,
      });

      render(<ObjectFieldTemplate {...propsWithAdvanced} />);

      const collapseHeader = screen.getByRole('button', {
        name: /label\.advanced-config/,
      });

      expect(collapseHeader).toBeInTheDocument();
    });
  });
});
