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
import { fireEvent, render, screen } from '@testing-library/react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../enums/entity.enum';
import EntityRightPanelVerticalNav from './EntityRightPanelVerticalNav';
import { EntityRightPanelTab } from './EntityRightPanelVerticalNav.interface';

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: jest.fn().mockReturnValue({
    t: (key: string) => key,
  }),
}));

// Mock antd Menu component
jest.mock('antd', () => ({
  Menu: jest.fn().mockImplementation(({ items, onClick, selectedKeys }) => (
    <ul
      className="ant-menu ant-menu-root ant-menu-vertical ant-menu-light vertical-nav-menu"
      role="menu">
      {items.map(
        (item: { key: string; icon: React.ReactNode; label: string }) => (
          <li
            className={`ant-menu-item ${
              selectedKeys.includes(item.key) ? 'ant-menu-item-selected' : ''
            }`}
            key={item.key}
            role="menuitem"
            onClick={() => onClick({ key: item.key })}>
            <span className="ant-menu-item-icon">{item.icon}</span>
            <span className="ant-menu-title-content">{item.label}</span>
          </li>
        )
      )}
    </ul>
  )),
}));

describe('EntityRightPanelVerticalNav', () => {
  const mockOnTabChange = jest.fn();

  const defaultProps = {
    activeTab: EntityRightPanelTab.OVERVIEW,
    entityType: EntityType.TABLE,
    onTabChange: mockOnTabChange,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('should render without crashing', () => {
      render(<EntityRightPanelVerticalNav {...defaultProps} />);

      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it('should render with correct CSS classes', () => {
      render(<EntityRightPanelVerticalNav {...defaultProps} />);

      expect(screen.getByRole('menu')).toHaveClass('vertical-nav-menu');
    });

    it('should show overview tab as selected when activeTab is OVERVIEW', () => {
      render(<EntityRightPanelVerticalNav {...defaultProps} />);

      const overviewTab = screen.getByText('label.overview').closest('li');

      expect(overviewTab).toHaveClass('ant-menu-item-selected');
    });

    it('should show schema tab as selected when activeTab is SCHEMA', () => {
      render(
        <EntityRightPanelVerticalNav
          {...defaultProps}
          activeTab={EntityRightPanelTab.SCHEMA}
        />
      );

      const schemaTab = screen.getByText('label.schema').closest('li');

      expect(schemaTab).toHaveClass('ant-menu-item-selected');
    });
  });

  describe('Tab Navigation', () => {
    it('should call onTabChange when a tab is clicked', () => {
      render(<EntityRightPanelVerticalNav {...defaultProps} />);

      const schemaTab = screen.getByText('label.schema');
      fireEvent.click(schemaTab);

      expect(mockOnTabChange).toHaveBeenCalledWith(EntityRightPanelTab.SCHEMA);
    });

    it('should call onTabChange with correct tab when lineage tab is clicked', () => {
      render(<EntityRightPanelVerticalNav {...defaultProps} />);

      const lineageTab = screen.getByText('label.lineage');
      fireEvent.click(lineageTab);

      expect(mockOnTabChange).toHaveBeenCalledWith(EntityRightPanelTab.LINEAGE);
    });

    it('should call onTabChange with correct tab when data quality tab is clicked', () => {
      render(<EntityRightPanelVerticalNav {...defaultProps} />);

      const dataQualityTab = screen.getByText('label.data-quality');
      fireEvent.click(dataQualityTab);

      expect(mockOnTabChange).toHaveBeenCalledWith(
        EntityRightPanelTab.DATA_QUALITY
      );
    });

    it('should call onTabChange with correct tab when custom properties tab is clicked', () => {
      render(<EntityRightPanelVerticalNav {...defaultProps} />);

      const customPropsTab = screen.getByText('label.custom-property');
      fireEvent.click(customPropsTab);

      expect(mockOnTabChange).toHaveBeenCalledWith(
        EntityRightPanelTab.CUSTOM_PROPERTIES
      );
    });
  });

  describe('Entity Type Specific Tabs', () => {
    describe('Schema Tab', () => {
      it('should show schema tab for TABLE entity', () => {
        render(<EntityRightPanelVerticalNav {...defaultProps} />);

        expect(screen.getByText('label.schema')).toBeInTheDocument();
      });

      it('should show schema tab for TOPIC entity', () => {
        render(
          <EntityRightPanelVerticalNav
            {...defaultProps}
            entityType={EntityType.TOPIC}
          />
        );

        expect(screen.getByText('label.schema')).toBeInTheDocument();
      });

      it('should show schema tab for DASHBOARD entity', () => {
        render(
          <EntityRightPanelVerticalNav
            {...defaultProps}
            entityType={EntityType.DASHBOARD}
          />
        );

        expect(screen.getByText('label.schema')).toBeInTheDocument();
      });

      it('should show schema tab for DATABASE_SCHEMA entity', () => {
        render(
          <EntityRightPanelVerticalNav
            {...defaultProps}
            entityType={EntityType.DATABASE_SCHEMA}
          />
        );

        expect(screen.getByText('label.schema')).toBeInTheDocument();
      });

      it('should show schema tab for DATABASE entity', () => {
        render(
          <EntityRightPanelVerticalNav
            {...defaultProps}
            entityType={EntityType.DATABASE}
          />
        );

        expect(screen.getByText('label.schema')).toBeInTheDocument();
      });

      it('should show schema tab for DASHBOARD_DATA_MODEL entity', () => {
        render(
          <EntityRightPanelVerticalNav
            {...defaultProps}
            entityType={EntityType.DASHBOARD_DATA_MODEL}
          />
        );

        expect(screen.getByText('label.schema')).toBeInTheDocument();
      });

      it('should show schema tab for API_ENDPOINT entity', () => {
        render(
          <EntityRightPanelVerticalNav
            {...defaultProps}
            entityType={EntityType.API_ENDPOINT}
          />
        );

        expect(screen.getByText('label.schema')).toBeInTheDocument();
      });

      it('should not show schema tab for CHART entity', () => {
        render(
          <EntityRightPanelVerticalNav
            {...defaultProps}
            entityType={EntityType.CHART}
          />
        );

        expect(screen.queryByText('label.schema')).not.toBeInTheDocument();
      });

      it('should show schema tab for PIPELINE entity', () => {
        render(
          <EntityRightPanelVerticalNav
            {...defaultProps}
            entityType={EntityType.PIPELINE}
          />
        );

        expect(screen.getByText('label.schema')).toBeInTheDocument();
      });
    });

    describe('Lineage Tab', () => {
      it('should show lineage tab for TABLE entity', () => {
        render(<EntityRightPanelVerticalNav {...defaultProps} />);

        expect(screen.getByText('label.lineage')).toBeInTheDocument();
      });

      it('should show lineage tab for TOPIC entity', () => {
        render(
          <EntityRightPanelVerticalNav
            {...defaultProps}
            entityType={EntityType.TOPIC}
          />
        );

        expect(screen.getByText('label.lineage')).toBeInTheDocument();
      });

      it('should show lineage tab for CONTAINER entity', () => {
        render(
          <EntityRightPanelVerticalNav
            {...defaultProps}
            entityType={EntityType.CONTAINER}
          />
        );

        expect(screen.getByText('label.lineage')).toBeInTheDocument();
      });

      it('should show lineage tab for DASHBOARD entity', () => {
        render(
          <EntityRightPanelVerticalNav
            {...defaultProps}
            entityType={EntityType.DASHBOARD}
          />
        );

        expect(screen.getByText('label.lineage')).toBeInTheDocument();
      });

      it('should show lineage tab for CHART entity', () => {
        render(
          <EntityRightPanelVerticalNav
            {...defaultProps}
            entityType={EntityType.CHART}
          />
        );

        expect(screen.getByText('label.lineage')).toBeInTheDocument();
      });

      it('should show lineage tab for PIPELINE entity', () => {
        render(
          <EntityRightPanelVerticalNav
            {...defaultProps}
            entityType={EntityType.PIPELINE}
          />
        );

        expect(screen.getByText('label.lineage')).toBeInTheDocument();
      });

      it('should show lineage tab for MLMODEL entity', () => {
        render(
          <EntityRightPanelVerticalNav
            {...defaultProps}
            entityType={EntityType.MLMODEL}
          />
        );

        expect(screen.getByText('label.lineage')).toBeInTheDocument();
      });

      it('should show lineage tab for DASHBOARD_DATA_MODEL entity', () => {
        render(
          <EntityRightPanelVerticalNav
            {...defaultProps}
            entityType={EntityType.DASHBOARD_DATA_MODEL}
          />
        );

        expect(screen.getByText('label.lineage')).toBeInTheDocument();
      });

      it('should show lineage tab for API_ENDPOINT entity', () => {
        render(
          <EntityRightPanelVerticalNav
            {...defaultProps}
            entityType={EntityType.API_ENDPOINT}
          />
        );

        expect(screen.getByText('label.lineage')).toBeInTheDocument();
      });

      it('should not show lineage tab for DATABASE entity', () => {
        render(
          <EntityRightPanelVerticalNav
            {...defaultProps}
            entityType={EntityType.DATABASE}
          />
        );

        expect(screen.queryByText('label.lineage')).not.toBeInTheDocument();
      });

      it('should not show lineage tab for DATABASE_SCHEMA entity', () => {
        render(
          <EntityRightPanelVerticalNav
            {...defaultProps}
            entityType={EntityType.DATABASE_SCHEMA}
          />
        );

        expect(screen.queryByText('label.lineage')).not.toBeInTheDocument();
      });
    });

    describe('Data Quality Tab', () => {
      it('should show data quality tab for TABLE entity', () => {
        render(<EntityRightPanelVerticalNav {...defaultProps} />);

        expect(screen.getByText('label.data-quality')).toBeInTheDocument();
      });

      it('should not show data quality tab for DASHBOARD entity', () => {
        render(
          <EntityRightPanelVerticalNav
            {...defaultProps}
            entityType={EntityType.DASHBOARD}
          />
        );

        expect(
          screen.queryByText('label.data-quality')
        ).not.toBeInTheDocument();
      });

      it('should not show data quality tab for TOPIC entity', () => {
        render(
          <EntityRightPanelVerticalNav
            {...defaultProps}
            entityType={EntityType.TOPIC}
          />
        );

        expect(
          screen.queryByText('label.data-quality')
        ).not.toBeInTheDocument();
      });

      it('should not show data quality tab for PIPELINE entity', () => {
        render(
          <EntityRightPanelVerticalNav
            {...defaultProps}
            entityType={EntityType.PIPELINE}
          />
        );

        expect(
          screen.queryByText('label.data-quality')
        ).not.toBeInTheDocument();
      });
    });

    describe('Custom Properties Tab', () => {
      it('should always show custom properties tab for TABLE entity', () => {
        render(<EntityRightPanelVerticalNav {...defaultProps} />);

        expect(screen.getByText('label.custom-property')).toBeInTheDocument();
      });

      it('should always show custom properties tab for DASHBOARD entity', () => {
        render(
          <EntityRightPanelVerticalNav
            {...defaultProps}
            entityType={EntityType.DASHBOARD}
          />
        );

        expect(screen.getByText('label.custom-property')).toBeInTheDocument();
      });

      it('should always show custom properties tab for any entity type', () => {
        const entityTypes = [
          EntityType.TOPIC,
          EntityType.CHART,
          EntityType.PIPELINE,
          EntityType.MLMODEL,
          EntityType.CONTAINER,
        ];

        entityTypes.forEach((entityType) => {
          const { unmount } = render(
            <EntityRightPanelVerticalNav
              {...defaultProps}
              entityType={entityType}
            />
          );

          expect(screen.getByText('label.custom-property')).toBeInTheDocument();

          unmount();
        });
      });
    });
  });

  describe('Tab Order', () => {
    it('should render tabs in correct order for TABLE entity', () => {
      render(<EntityRightPanelVerticalNav {...defaultProps} />);

      const menuItems = screen.getAllByRole('menuitem');
      const tabLabels = menuItems.map((item) => item.textContent);

      expect(tabLabels).toEqual([
        'label.overview',
        'label.schema',
        'label.lineage',
        'label.data-quality',
        'label.custom-property',
      ]);
    });

    it('should render tabs in correct order for DASHBOARD entity', () => {
      render(
        <EntityRightPanelVerticalNav
          {...defaultProps}
          entityType={EntityType.DASHBOARD}
        />
      );

      const menuItems = screen.getAllByRole('menuitem');
      const tabLabels = menuItems.map((item) => item.textContent);

      expect(tabLabels).toEqual([
        'label.overview',
        'label.schema',
        'label.lineage',
        'label.custom-property',
      ]);
    });

    it('should render tabs in correct order for CHART entity', () => {
      render(
        <EntityRightPanelVerticalNav
          {...defaultProps}
          entityType={EntityType.CHART}
        />
      );

      const menuItems = screen.getAllByRole('menuitem');
      const tabLabels = menuItems.map((item) => item.textContent);

      expect(tabLabels).toEqual([
        'label.overview',
        'label.lineage',
        'label.custom-property',
      ]);
    });
  });

  describe('Icon Rendering', () => {
    it('should render icons for all tabs', () => {
      const { container } = render(
        <EntityRightPanelVerticalNav {...defaultProps} />
      );

      const icons = container.querySelectorAll('.ant-menu-item-icon');

      expect(icons).toHaveLength(5); // overview, schema, lineage, data-quality, custom-property
    });

    it('should render correct number of icons for DASHBOARD entity', () => {
      const { container } = render(
        <EntityRightPanelVerticalNav
          {...defaultProps}
          entityType={EntityType.DASHBOARD}
        />
      );

      const icons = container.querySelectorAll('.ant-menu-item-icon');

      expect(icons).toHaveLength(4); // overview, schema, lineage, custom-property
    });
  });

  describe('Translation', () => {
    it('should use translation function for all labels', () => {
      const mockT = jest.fn((key: string) => key);
      (useTranslation as jest.Mock).mockReturnValue({ t: mockT });

      render(<EntityRightPanelVerticalNav {...defaultProps} />);

      expect(mockT).toHaveBeenCalledWith('label.overview');
      expect(mockT).toHaveBeenCalledWith('label.schema');
      expect(mockT).toHaveBeenCalledWith('label.lineage');
      expect(mockT).toHaveBeenCalledWith('label.data-quality');
      expect(mockT).toHaveBeenCalledWith('label.custom-property');
    });
  });

  describe('Edge Cases', () => {
    it('should handle unknown entity type gracefully', () => {
      render(
        <EntityRightPanelVerticalNav
          {...defaultProps}
          entityType={'UNKNOWN' as EntityType}
        />
      );

      // Should only show overview and custom properties tabs
      expect(screen.getByText('label.overview')).toBeInTheDocument();
      expect(screen.getByText('label.custom-property')).toBeInTheDocument();
      expect(screen.queryByText('label.schema')).not.toBeInTheDocument();
      expect(screen.queryByText('label.lineage')).not.toBeInTheDocument();
      expect(screen.queryByText('label.data-quality')).not.toBeInTheDocument();
    });

    it('should handle multiple rapid tab changes', () => {
      render(<EntityRightPanelVerticalNav {...defaultProps} />);

      const schemaTab = screen.getByText('label.schema');
      const lineageTab = screen.getByText('label.lineage');

      fireEvent.click(schemaTab);
      fireEvent.click(lineageTab);
      fireEvent.click(schemaTab);

      expect(mockOnTabChange).toHaveBeenCalledTimes(3);
      expect(mockOnTabChange).toHaveBeenNthCalledWith(
        1,
        EntityRightPanelTab.SCHEMA
      );
      expect(mockOnTabChange).toHaveBeenNthCalledWith(
        2,
        EntityRightPanelTab.LINEAGE
      );
      expect(mockOnTabChange).toHaveBeenNthCalledWith(
        3,
        EntityRightPanelTab.SCHEMA
      );
    });
  });
});
