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
import { ButtonUtility, Card, Tooltip } from '@openmetadata/ui-core-components';

import classNames from 'classnames';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReflexContainer, ReflexElement, ReflexSplitter } from 'react-reflex';
import { ReactComponent as SidebarCollapsedIcon } from '../../../assets/svg/ic-sidebar-collapsed.svg';
import DocumentTitle from '../DocumentTitle/DocumentTitle';
import './resizable-panels.less';
import { ResizablePanelsProps } from './ResizablePanels.interface';

const ResizablePanels: React.FC<ResizablePanelsProps> = ({
  className,
  orientation = 'vertical',
  firstPanel,
  secondPanel,
  pageTitle,
  hideSecondPanel = false,
}) => {
  const { t } = useTranslation();
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(false);
  const isFirstPanelWrapInCard = useMemo(() => {
    return firstPanel.wrapInCard ?? true;
  }, [firstPanel.wrapInCard]);

  const isSecondPanelWrapInCard = useMemo(() => {
    return secondPanel.wrapInCard ?? true;
  }, [secondPanel.wrapInCard]);

  const handleCollapse = () => {
    setIsRightPanelCollapsed((prev) => !prev);
  };

  return (
    <>
      {pageTitle && <DocumentTitle title={pageTitle} />}
      <ReflexContainer
        className={classNames(className, 'resizable-panels-layout bg-grey')}
        orientation={orientation}>
        <ReflexElement
          className={classNames(firstPanel.className, 'resizable-first-panel', {
            'full-width': hideSecondPanel || isRightPanelCollapsed,
            'h-full overflow-y-auto': firstPanel.allowScroll,
          })}
          data-testid={firstPanel.className}
          flex={firstPanel.flex}
          minSize={firstPanel.minWidth}
          onStopResize={(args) => {
            firstPanel.onStopResize?.(args.component.props.flex);
          }}>
          {isFirstPanelWrapInCard ? (
            <Card
              className={classNames(firstPanel.cardClassName, {
                // If allowScroll is true, the card will not have a scrollbar
                'h-full overflow-y-auto': !firstPanel.allowScroll,
              })}>
              <Card.Content style={firstPanel.cardBodyStyles}>
                {firstPanel.children}
              </Card.Content>
            </Card>
          ) : (
            firstPanel.children
          )}
        </ReflexElement>

        <ReflexSplitter
          className={classNames(
            'splitter right-panel-splitter',
            { hidden: hideSecondPanel },
            { collapsed: isRightPanelCollapsed }
          )}>
          {isRightPanelCollapsed && (
            <Card className="reflex-card">
              <Tooltip arrow placement="right" title={t('label.expand')}>
                <ButtonUtility
                  className="mr-2"
                  color="tertiary"
                  data-testid="sidebar-toggle"
                  icon={SidebarCollapsedIcon}
                  size="sm"
                  onClick={handleCollapse}
                />
              </Tooltip>
            </Card>
          )}
          {!isRightPanelCollapsed && (
            <div
              className={classNames({
                'panel-grabber-vertical': orientation === 'vertical',
                'panel-grabber-horizontal': orientation === 'horizontal',
              })}>
              <div
                className={classNames('handle-icon', {
                  'handle-icon-vertical ': orientation === 'vertical',
                  'handle-icon-horizontal': orientation === 'horizontal',
                })}
              />
            </div>
          )}
        </ReflexSplitter>

        <ReflexElement
          className={classNames(
            secondPanel.className,
            'resizable-second-panel',
            {
              hidden: hideSecondPanel,
              'right-panel-collapsed': isRightPanelCollapsed,
            }
          )}
          data-testid={secondPanel.className}
          flex={isRightPanelCollapsed ? 0 : secondPanel.flex}
          minSize={isRightPanelCollapsed ? 0 : secondPanel.minWidth}
          onStopResize={(args) => {
            secondPanel.onStopResize?.(args.component.props.flex);
          }}>
          {!hideSecondPanel &&
            (isSecondPanelWrapInCard ? (
              <Card className="reflex-card">
                <Card.Content className="tw:min-h-0 tw:flex-1 tw:overflow-auto">
                  {secondPanel.children}
                </Card.Content>
              </Card>
            ) : (
              secondPanel.children
            ))}
        </ReflexElement>
      </ReflexContainer>
    </>
  );
};

export default ResizablePanels;
