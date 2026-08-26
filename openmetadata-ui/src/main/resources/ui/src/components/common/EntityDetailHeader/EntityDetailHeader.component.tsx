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

import { Box, FeaturedIcon, Tabs } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { useMemo, useState } from 'react';
import type { Key } from 'react-aria-components';
import HeaderShell from '../HeaderShell/HeaderShell.component';
import { EntityDetailHeaderProps } from './EntityDetailHeader.interface';
import './EntityDetailHeader.less';

const EntityDetailHeader = ({
  breadcrumb,
  serviceLogoUrl,
  icon,
  leading,
  title,
  subtitle,
  badge,
  meta,
  primaryAction,
  secondaryActions,
  tabs,
  tabListType = 'underline',
  defaultActiveKey,
  activeKey,
  onTabChange,
  renderPanels = true,
  variant = 'gradient',
  className,
  'data-testid': dataTestId = 'entity-detail-header',
}: EntityDetailHeaderProps) => {
  const visibleTabs = useMemo(
    () => tabs.filter((tab) => !tab.isHidden),
    [tabs]
  );

  const [internalKey, setInternalKey] = useState(
    defaultActiveKey ?? visibleTabs[0]?.key
  );

  const isControlled = activeKey !== undefined;
  // Fall back to the first visible tab when the tracked key isn't present yet
  // (e.g. tabs loaded asynchronously after mount, or the selected tab became
  // hidden) so a valid tab is always selected.
  const resolvedInternalKey = visibleTabs.some((tab) => tab.key === internalKey)
    ? internalKey
    : visibleTabs[0]?.key;
  const selectedKey = isControlled ? activeKey : resolvedInternalKey;

  const handleSelectionChange = (key: Key) => {
    if (!isControlled) {
      setInternalKey(String(key));
    }
    onTabChange?.(String(key));
  };

  const resolvedLeading =
    leading ??
    (serviceLogoUrl ? (
      <Box
        align="center"
        className="tw:size-10 tw:shrink-0 tw:rounded-md tw:border tw:border-secondary tw:bg-primary tw:p-1.5"
        justify="center">
        <img
          alt=""
          className="tw:size-full tw:object-contain"
          src={serviceLogoUrl}
        />
      </Box>
    ) : icon ? (
      <FeaturedIcon
        color="brand"
        icon={icon}
        shape="square"
        size="md"
        theme="gradient"
      />
    ) : undefined);

  const actions =
    primaryAction || secondaryActions ? (
      <>
        {primaryAction}
        {secondaryActions}
      </>
    ) : undefined;

  const footer = (
    <Tabs
      className="tw:mt-1 entity-detail-header-tabs"
      selectedKey={selectedKey}
      onSelectionChange={handleSelectionChange}>
      <Tabs.List type={tabListType}>
        {visibleTabs.map((tab) => (
          <Tabs.Item
            badge={tab.count}
            id={tab.key}
            key={tab.key}
            label={tab.label}
          />
        ))}
      </Tabs.List>
      {renderPanels &&
        visibleTabs.map((tab) => (
          <Tabs.Panel id={tab.key} key={tab.key}>
            {tab.panel}
          </Tabs.Panel>
        ))}
    </Tabs>
  );

  return (
    <HeaderShell
      actions={actions}
      badge={badge}
      breadcrumb={breadcrumb}
      className={classNames('entity-detail-header', className)}
      data-testid={dataTestId}
      footer={footer}
      leading={resolvedLeading}
      meta={meta}
      subtitle={subtitle}
      title={title}
      variant={variant}
    />
  );
};

export default EntityDetailHeader;
