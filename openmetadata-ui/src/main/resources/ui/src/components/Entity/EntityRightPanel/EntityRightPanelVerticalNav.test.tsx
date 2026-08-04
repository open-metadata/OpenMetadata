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

const MOCK_ANT_MENU_ITEM_SELECTED = 'ant-menu-item-selected';
const LABEL_OVERVIEW = 'label.overview';
const LABEL_SCHEMA = 'label.schema';
const LABEL_LINEAGE = 'label.lineage';
const LABEL_DATA_QUALITY = 'label.data-quality';
const LABEL_CUSTOM_PROPERTY = 'label.custom-property';

// Mock react-i18next
jest.mock('react-i18next', () => ({
  useTranslation: jest.fn().mockReturnValue({
    t: (key: string) => key,
  }),
}));

jest.mock('../../../utils/EntityPermissionUtils', () => {
  const LINEAGE_TABS_SET = new Set([
    'apiEndpoint',
    'chart',
    'container',
    'dashboard',
    'dashboardDataModel',
    'directory',
    'mlmodel',
    'pipeline',
    'searchIndex',
    'table',
    'topic',
  ]);
  const SCHEMA_TABS_SET = new Set([
    'apiCollection',
    'apiEndpoint',
    'container',
    'dashboard',
    'dashboardDataModel',
    'database',
    'databaseSchema',
    'pipeline',
    'searchIndex',
    'table',
    'topic',
  ]);
  const CUSTOM_PROPERTIES_TABS_SET = new Set([
    'apiCollection',
    'apiEndpoint',
    'chart',
    'container',
    'dashboard',
    'dashboardDataModel',
    'database',
    'databaseSchema',
    'dataProduct',
    'directory',
    'domain',
    'file',
    'glossaryTerm',
    'metric',
    'mlmodel',
    'pipeline',
    'searchIndex',
    'spreadsheet',
    'storedProcedure',
    'table',
    'topic',
    'worksheet',
  ]);

  return {
    hasLineageTab: jest.fn((entityType) => LINEAGE_TABS_SET.has(entityType)),
    hasSchemaTab: jest.fn((entityType) => SCHEMA_TABS_SET.has(entityType)),
    hasCustomPropertiesTab: jest.fn((entityType) =>
      CUSTOM_PROPERTIES_TABS_SET.has(entityType)
    ),
  };
});

// Mock antd Menu component and Typography
jest.mock('antd', () => {
  const actual = jest.requireActual('antd');

  return {
    ...actual,
    Menu: jest.fn().mockImplementation(({ items, onClick, selectedKeys }) => {
      // Mirrors antd's real ul/li menu DOM; the interactive menu roles on these
      // list elements are inherent to that markup (test relies on <li> + role).
      /* eslint-disable jsx-a11y/no-noninteractive-element-to-interactive-role */
      return (
        <ul
          className="ant-menu ant-menu-root ant-menu-vertical ant-menu-light vertical-nav-menu"
          role="menu">
          {items.map(
            (item: { key: string; icon: React.ReactNode; label: string }) => (
              <li
                className={`ant-menu-item ${
                  selectedKeys.includes(item.key)
                    ? MOCK_ANT_MENU_ITEM_SELECTED
                    : ''
                }`}
                key={item.key}
                role="menuitem"
                tabIndex={0}
                onClick={() => onClick({ key: item.key })}
                onKeyDown={() => onClick({ key: item.key })}>
                <span className="ant-menu-item-icon">{item.icon}</span>
                <span className="ant-menu-title-content">{item.label}</span>
              </li>
            )
          )}
        </ul>
      );
      /* eslint-enable jsx-a11y/no-noninteractive-element-to-interactive-role */
    }),
    Typography: actual.Typography
      ? {
          ...actual.Typography,
          Text: jest
            .fn()
            .mockImplementation(({ children, className, ...props }) => (
              <span
                className={className}
                data-testid="typography-text"
                {...props}>
                {children}
              </span>
            )),
        }
      : {
          Text: jest
            .fn()
            .mockImplementation(({ children, className, ...props }) => (
              <span
                className={className}
                data-testid="typography-text"
                {...props}>
                {children}
              </span>
            )),
        },
  };
});

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

      const overviewTab = screen.getByText(LABEL_OVERVIEW).closest('li');

      expect(overviewTab).toHaveClass(MOCK_ANT_MENU_ITEM_SELECTED);
    });

    it('should show schema tab as selected when activeTab is SCHEMA', () => {
      render(
        <EntityRightPanelVerticalNav
          {...defaultProps}
          activeTab={EntityRightPanelTab.SCHEMA}
        />
      );

      const schemaTab = screen.getByText(LABEL_SCHEMA).closest('li');

      expect(schemaTab).toHaveClass(MOCK_ANT_MENU_ITEM_SELECTED);
    });
  });

  describe('Tab Navigation', () => {
    it('should call onTabChange when a tab is clicked', () => {
      render(<EntityRightPanelVerticalNav {...defaultProps} />);

      const schemaTab = screen.getByText(LABEL_SCHEMA);
      fireEvent.click(schemaTab);

      expect(mockOnTabChange).toHaveBeenCalledWith(EntityRightPanelTab.SCHEMA);
    });

    it('should call onTabChange with correct tab when lineage tab is clicked', () => {
      render(<EntityRightPanelVerticalNav {...defaultProps} />);

      const lineageTab = screen.getByText(LABEL_LINEAGE);
      fireEvent.click(lineageTab);

      expect(mockOnTabChange).toHaveBeenCalledWith(EntityRightPanelTab.LINEAGE);
    });

    it('should call onTabChange with correct tab when data quality tab is clicked', () => {
      render(<EntityRightPanelVerticalNav {...defaultProps} />);

      const dataQualityTab = screen.getByText(LABEL_DATA_QUALITY);
      fireEvent.click(dataQualityTab);

      expect(mockOnTabChange).toHaveBeenCalledWith(
        EntityRightPanelTab.DATA_QUALITY
      );
    });

    it('should call onTabChange with correct tab when custom properties tab is clicked', () => {
      render(<EntityRightPanelVerticalNav {...defaultProps} />);

      const customPropsTab = screen.getByText(LABEL_CUSTOM_PROPERTY);
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

        expect(screen.getByText(LABEL_SCHEMA)).toBeInTheDocument();
      });

      it('should show schema tab for TOPIC entity', () => {
        render(
          <EntityRightPanelVerticalNav
            {...defaultProps}
            entityType={EntityType.TOPIC}
          />
        );

        expect(screen.getByText(LABEL_SCHEMA)).toBeInTheDocument();
      });

      it('should show schema tab for DASHBOARD entity', () => {
        render(
          <EntityRightPanelVerticalNav
            {...defaultProps}
            entityType={EntityType.DASHBOARD}
          />
        );

        expect(screen.getByText(LABEL_SCHEMA)).toBeInTheDocument();
      });

      it('should show schema tab for DATABASE_SCHEMA entity', () => {
        render(
          <EntityRightPanelVerticalNav
            {...defaultProps}
            entityType={EntityType.DATABASE_SCHEMA}
          />
        );

        expect(screen.getByText(LABEL_SCHEMA)).toBeInTheDocument();
      });

      it('should show schema tab for DATABASE entity', () => {
        render(
          <EntityRightPanelVerticalNav
            {...defaultProps}
            entityType={EntityType.DATABASE}
          />
        );

        expect(screen.getByText(LABEL_SCHEMA)).toBeInTheDocument();
      });

      it('should show schema tab for DASHBOARD_DATA_MODEL entity', () => {
        render(
          <EntityRightPanelVerticalNav
            {...defaultProps}
            entityType={EntityType.DASHBOARD_DATA_MODEL}
          />
        );

        expect(screen.getByText(LABEL_SCHEMA)).toBeInTheDocument();
      });

      it('should show schema tab for API_ENDPOINT entity', () => {
        render(
          <EntityRightPanelVerticalNav
            {...defaultProps}
            entityType={EntityType.API_ENDPOINT}
          />
        );

        expect(screen.getByText(LABEL_SCHEMA)).toBeInTheDocument();
      });

      it('should not show schema tab for CHART entity', () => {
        render(
          <EntityRightPanelVerticalNav
            {...defaultProps}
            entityType={EntityType.CHART}
          />
        );

        expect(screen.queryByText(LABEL_SCHEMA)).not.toBeInTheDocument();
      });

      it('should show schema tab for PIPELINE entity', () => {
        render(
          <EntityRightPanelVerticalNav
            {...defaultProps}
            entityType={EntityType.PIPELINE}
          />
        );

        expect(screen.getByText(LABEL_SCHEMA)).toBeInTheDocument();
      });
    });

    describe('Lineage Tab', () => {
      it('should show lineage tab for TABLE entity', () => {
        render(<EntityRightPanelVerticalNav {...defaultProps} />);

        expect(screen.getByText(LABEL_LINEAGE)).toBeInTheDocument();
      });

      it('should show lineage tab for TOPIC entity', () => {
        render(
          <EntityRightPanelVerticalNav
            {...defaultProps}
            entityType={EntityType.TOPIC}
          />
        );

        expect(screen.getByText(LABEL_LINEAGE)).toBeInTheDocument();
      });

      it('should show lineage tab for CONTAINER entity', () => {
        render(
          <EntityRightPanelVerticalNav
            {...defaultProps}
            entityType={EntityType.CONTAINER}
          />
        );

        expect(screen.getByText(LABEL_LINEAGE)).toBeInTheDocument();
      });

      it('should show lineage tab for DASHBOARD entity', () => {
        render(
          <EntityRightPanelVerticalNav
            {...defaultProps}
            entityType={EntityType.DASHBOARD}
          />
        );

        expect(screen.getByText(LABEL_LINEAGE)).toBeInTheDocument();
      });

      it('should show lineage tab for CHART entity', () => {
        render(
          <EntityRightPanelVerticalNav
            {...defaultProps}
            entityType={EntityType.CHART}
          />
        );

        expect(screen.getByText(LABEL_LINEAGE)).toBeInTheDocument();
      });

      it('should show lineage tab for PIPELINE entity', () => {
        render(
          <EntityRightPanelVerticalNav
            {...defaultProps}
            entityType={EntityType.PIPELINE}
          />
        );

        expect(screen.getByText(LABEL_LINEAGE)).toBeInTheDocument();
      });

      it('should show lineage tab for MLMODEL entity', () => {
        render(
          <EntityRightPanelVerticalNav
            {...defaultProps}
            entityType={EntityType.MLMODEL}
          />
        );

        expect(screen.getByText(LABEL_LINEAGE)).toBeInTheDocument();
      });

      it('should show lineage tab for DASHBOARD_DATA_MODEL entity', () => {
        render(
          <EntityRightPanelVerticalNav
            {...defaultProps}
            entityType={EntityType.DASHBOARD_DATA_MODEL}
          />
        );

        expect(screen.getByText(LABEL_LINEAGE)).toBeInTheDocument();
      });

      it('should show lineage tab for API_ENDPOINT entity', () => {
        render(
          <EntityRightPanelVerticalNav
            {...defaultProps}
            entityType={EntityType.API_ENDPOINT}
          />
        );

        expect(screen.getByText(LABEL_LINEAGE)).toBeInTheDocument();
      });

      it('should not show lineage tab for DATABASE entity', () => {
        render(
          <EntityRightPanelVerticalNav
            {...defaultProps}
            entityType={EntityType.DATABASE}
          />
        );

        expect(screen.queryByText(LABEL_LINEAGE)).not.toBeInTheDocument();
      });

      it('should not show lineage tab for DATABASE_SCHEMA entity', () => {
        render(
          <EntityRightPanelVerticalNav
            {...defaultProps}
            entityType={EntityType.DATABASE_SCHEMA}
          />
        );

        expect(screen.queryByText(LABEL_LINEAGE)).not.toBeInTheDocument();
      });
    });

    describe('Data Quality Tab', () => {
      it('should show data quality tab for TABLE entity', () => {
        render(<EntityRightPanelVerticalNav {...defaultProps} />);

        expect(screen.getByText(LABEL_DATA_QUALITY)).toBeInTheDocument();
      });

      it('should not show data quality tab for DASHBOARD entity', () => {
        render(
          <EntityRightPanelVerticalNav
            {...defaultProps}
            entityType={EntityType.DASHBOARD}
          />
        );

        expect(screen.queryByText(LABEL_DATA_QUALITY)).not.toBeInTheDocument();
      });

      it('should not show data quality tab for TOPIC entity', () => {
        render(
          <EntityRightPanelVerticalNav
            {...defaultProps}
            entityType={EntityType.TOPIC}
          />
        );

        expect(screen.queryByText(LABEL_DATA_QUALITY)).not.toBeInTheDocument();
      });

      it('should not show data quality tab for PIPELINE entity', () => {
        render(
          <EntityRightPanelVerticalNav
            {...defaultProps}
            entityType={EntityType.PIPELINE}
          />
        );

        expect(screen.queryByText(LABEL_DATA_QUALITY)).not.toBeInTheDocument();
      });
    });

    describe('Custom Properties Tab', () => {
      it('should always show custom properties tab for TABLE entity', () => {
        render(<EntityRightPanelVerticalNav {...defaultProps} />);

        expect(screen.getByText(LABEL_CUSTOM_PROPERTY)).toBeInTheDocument();
      });

      it('should always show custom properties tab for DASHBOARD entity', () => {
        render(
          <EntityRightPanelVerticalNav
            {...defaultProps}
            entityType={EntityType.DASHBOARD}
          />
        );

        expect(screen.getByText(LABEL_CUSTOM_PROPERTY)).toBeInTheDocument();
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

          expect(screen.getByText(LABEL_CUSTOM_PROPERTY)).toBeInTheDocument();

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
        LABEL_OVERVIEW,
        LABEL_SCHEMA,
        LABEL_LINEAGE,
        LABEL_DATA_QUALITY,
        LABEL_CUSTOM_PROPERTY,
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
        LABEL_OVERVIEW,
        LABEL_SCHEMA,
        LABEL_LINEAGE,
        LABEL_CUSTOM_PROPERTY,
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
        LABEL_OVERVIEW,
        LABEL_LINEAGE,
        LABEL_CUSTOM_PROPERTY,
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

      expect(mockT).toHaveBeenCalledWith(LABEL_OVERVIEW);
      expect(mockT).toHaveBeenCalledWith(LABEL_SCHEMA);
      expect(mockT).toHaveBeenCalledWith(LABEL_LINEAGE);
      expect(mockT).toHaveBeenCalledWith(LABEL_DATA_QUALITY);
      expect(mockT).toHaveBeenCalledWith(LABEL_CUSTOM_PROPERTY);
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

      // Should only show overview tab for unknown entity types
      expect(screen.getByText(LABEL_OVERVIEW)).toBeInTheDocument();
      expect(screen.queryByText(LABEL_CUSTOM_PROPERTY)).not.toBeInTheDocument();
      expect(screen.queryByText(LABEL_SCHEMA)).not.toBeInTheDocument();
      expect(screen.queryByText(LABEL_LINEAGE)).not.toBeInTheDocument();
      expect(screen.queryByText(LABEL_DATA_QUALITY)).not.toBeInTheDocument();
    });

    it('should handle multiple rapid tab changes', () => {
      render(<EntityRightPanelVerticalNav {...defaultProps} />);

      const schemaTab = screen.getByText(LABEL_SCHEMA);
      const lineageTab = screen.getByText(LABEL_LINEAGE);

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
