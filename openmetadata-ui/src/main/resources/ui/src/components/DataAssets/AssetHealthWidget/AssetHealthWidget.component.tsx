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
import { Tooltip } from 'antd';
import classNames from 'classnames';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ReactComponent as ChevronRight } from '../../../assets/svg/arrow-right.svg';
import { ReactComponent as ShieldIcon } from '../../../assets/svg/policies.svg';
import { EntityType } from '../../../enums/entity.enum';
import { EntityReference } from '../../../generated/entity/type';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import './asset-health-widget.less';
import { HealthRow, HealthTone } from './AssetHealthWidget.interface';
import { useAssetHealth } from './useAssetHealth';

interface AssetHealthEntity extends Omit<EntityReference, 'type'> {
  testSuite?: { id?: string };
  pipelineStatus?: { executionStatus?: string };
}

const TONE_CLASS: Record<HealthTone, string> = {
  success: 'asset-health-widget__tone-success',
  warning: 'asset-health-widget__tone-warning',
  error: 'asset-health-widget__tone-error',
  info: 'asset-health-widget__tone-info',
  muted: 'asset-health-widget__tone-muted',
};

const AssetHealthWidget = () => {
  const { t } = useTranslation();
  const { data, type } = useGenericContext<AssetHealthEntity>();

  const { rows, header, loading } = useAssetHealth({
    entityId: data.id,
    entityFqn: data.fullyQualifiedName,
    entityType: type as EntityType,
    testSuiteId: data.testSuite?.id,
    pipelineLatestStatus: data.pipelineStatus?.executionStatus,
  });

  const headerClass = useMemo(
    () => `asset-health-widget__pill--${header.tone}`,
    [header.tone]
  );

  const renderRow = (row: HealthRow) => {
    const iconBgClass = `asset-health-widget__icon-bg--${row.iconTone ?? row.tone}`;
    const statusTextClass = `asset-health-widget__status-text--${row.tone}`;
    const isLink = Boolean(row.href);
    const tooltipTitle = row.tooltip ?? '';

    const content = (
      <>
        <div className="asset-health-widget__row-left">
          <span
            className={classNames(
              'asset-health-widget__row-icon',
              iconBgClass
            )}>
            {row.icon}
          </span>
          <div className="asset-health-widget__row-text">
            <div
              className={classNames('asset-health-widget__row-label', {
                'asset-health-widget__row-label--muted': row.tone === 'muted',
              })}>
              {row.label}
            </div>
            {row.sub && (
              <div className="asset-health-widget__row-sub">{row.sub}</div>
            )}
          </div>
        </div>
        {row.cta ? (
          <span className="asset-health-widget__row-cta">
            {row.cta}
            <span aria-hidden>→</span>
          </span>
        ) : (
          <span className="asset-health-widget__row-status">
            <span
              className={classNames(
                'asset-health-widget__status-text',
                statusTextClass
              )}>
              <span className="asset-health-widget__pill-dot" />
              {row.status}
            </span>
            {isLink && (
              <span className="asset-health-widget__arrow">
                <ChevronRight />
              </span>
            )}
          </span>
        )}
      </>
    );

    let rowEl: JSX.Element;
    if (row.href && !row.external) {
      rowEl = (
        <Link
          className="asset-health-widget__row"
          data-testid={`asset-health-row-${row.key}`}
          to={row.href}>
          {content}
        </Link>
      );
    } else if (row.href && row.external) {
      rowEl = (
        <a
          className="asset-health-widget__row"
          data-testid={`asset-health-row-${row.key}`}
          href={row.href}
          rel="noopener noreferrer"
          target="_blank">
          {content}
        </a>
      );
    } else {
      rowEl = (
        <div
          className="asset-health-widget__row asset-health-widget__row--inert"
          data-testid={`asset-health-row-${row.key}`}>
          {content}
        </div>
      );
    }

    if (tooltipTitle) {
      return (
        <Tooltip key={row.key} placement="top" title={tooltipTitle}>
          {rowEl}
        </Tooltip>
      );
    }

    return <span key={row.key}>{rowEl}</span>;
  };

  if (!loading && rows.length === 0) {
    return null;
  }

  return (
    <div
      className={classNames('asset-health-widget', TONE_CLASS[header.tone])}
      data-testid="asset-health-widget">
      <div className="asset-health-widget__header">
        <div className="asset-health-widget__title">
          <span className="asset-health-widget__title-icon">
            <ShieldIcon height={13} width={13} />
          </span>
          <span>{t('label.asset-health')}</span>
        </div>
        <span
          className={classNames('asset-health-widget__pill', headerClass)}
          data-testid="asset-health-header-pill">
          <span className="asset-health-widget__pill-dot" />
          {header.label}
        </span>
      </div>
      <div className="asset-health-widget__body">{rows.map(renderRow)}</div>
    </div>
  );
};

export default AssetHealthWidget;
