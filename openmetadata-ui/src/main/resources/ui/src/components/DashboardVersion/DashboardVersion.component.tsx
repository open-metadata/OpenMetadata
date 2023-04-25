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

import { Space, Table } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import classNames from 'classnames';
import PageContainer from 'components/containers/PageContainer';
import { isUndefined } from 'lodash';
import { ExtraInfo } from 'Models';
import React, { FC, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getEntityName } from 'utils/EntityUtils';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import { EntityField } from '../../constants/Feeds.constants';
import { OwnerType } from '../../enums/user.enum';
import {
  ChangeDescription,
  Dashboard,
  EntityReference,
} from '../../generated/entity/data/dashboard';
import { TagLabel } from '../../generated/type/tagLabel';
import {
  getDescriptionDiff,
  getDiffByFieldName,
  getDiffValue,
  getTagsDiff,
} from '../../utils/EntityVersionUtils';
import { TagLabelWithStatus } from '../../utils/EntityVersionUtils.interface';
import SVGIcons from '../../utils/SvgUtils';
import Description from '../common/description/Description';
import EntityPageInfo from '../common/entityPageInfo/EntityPageInfo';
import RichTextEditorPreviewer from '../common/rich-text-editor/RichTextEditorPreviewer';
import TabsPane from '../common/TabsPane/TabsPane';
import EntityVersionTimeLine from '../EntityVersionTimeLine/EntityVersionTimeLine';
import Loader from '../Loader/Loader';
import { DashboardVersionProp } from './DashboardVersion.interface';

const DashboardVersion: FC<DashboardVersionProp> = ({
  version,
  currentVersionData,
  isVersionLoading,
  owner,
  tier,
  slashedDashboardName,
  versionList,
  deleted = false,
  backHandler,
  versionHandler,
}: DashboardVersionProp) => {
  const { t } = useTranslation();
  const [changeDescription, setChangeDescription] = useState<ChangeDescription>(
    currentVersionData.changeDescription as ChangeDescription
  );
  const tabs = [
    {
      name: t('label.detail-plural'),
      isProtected: false,
      position: 1,
    },
  ];

  const getDashboardDescription = () => {
    const descriptionDiff = getDiffByFieldName(
      EntityField.DESCRIPTION,
      changeDescription
    );
    const oldDescription =
      descriptionDiff?.added?.oldValue ??
      descriptionDiff?.deleted?.oldValue ??
      descriptionDiff?.updated?.oldValue;
    const newDescription =
      descriptionDiff?.added?.newValue ??
      descriptionDiff?.deleted?.newValue ??
      descriptionDiff?.updated?.newValue;

    return getDescriptionDiff(
      oldDescription,
      newDescription,
      currentVersionData.description
    );
  };

  const getExtraInfo = () => {
    const ownerDiff = getDiffByFieldName('owner', changeDescription);

    const oldOwner = JSON.parse(
      ownerDiff?.added?.oldValue ??
        ownerDiff?.deleted?.oldValue ??
        ownerDiff?.updated?.oldValue ??
        '{}'
    );
    const newOwner = JSON.parse(
      ownerDiff?.added?.newValue ??
        ownerDiff?.deleted?.newValue ??
        ownerDiff?.updated?.newValue ??
        '{}'
    );
    const ownerPlaceHolder = owner?.name ?? owner?.displayName ?? '';

    const tagsDiff = getDiffByFieldName('tags', changeDescription, true);
    const newTier = [
      ...JSON.parse(
        tagsDiff?.added?.newValue ??
          tagsDiff?.deleted?.newValue ??
          tagsDiff?.updated?.newValue ??
          '[]'
      ),
    ].find((t) => (t?.tagFQN as string).startsWith('Tier'));

    const oldTier = [
      ...JSON.parse(
        tagsDiff?.added?.oldValue ??
          tagsDiff?.deleted?.oldValue ??
          tagsDiff?.updated?.oldValue ??
          '[]'
      ),
    ].find((t) => (t?.tagFQN as string).startsWith('Tier'));

    const extraInfo: Array<ExtraInfo> = [
      {
        key: 'Owner',
        value:
          !isUndefined(ownerDiff?.added) ||
          !isUndefined(ownerDiff?.deleted) ||
          !isUndefined(ownerDiff?.updated)
            ? getDiffValue(
                oldOwner?.displayName || oldOwner?.name || '',
                newOwner?.displayName || newOwner?.name || ''
              )
            : ownerPlaceHolder
            ? getDiffValue(ownerPlaceHolder, ownerPlaceHolder)
            : '',
        profileName:
          newOwner?.type === OwnerType.USER ? newOwner?.name : undefined,
      },
      {
        key: 'Tier',
        value:
          !isUndefined(newTier) || !isUndefined(oldTier)
            ? getDiffValue(
                oldTier?.tagFQN?.split(FQN_SEPARATOR_CHAR)[1] || '',
                newTier?.tagFQN?.split(FQN_SEPARATOR_CHAR)[1] || ''
              )
            : tier?.tagFQN
            ? tier?.tagFQN.split(FQN_SEPARATOR_CHAR)[1]
            : '',
      },
      {
        key: `${currentVersionData.serviceType} Url`,
        value: (currentVersionData as Dashboard).dashboardUrl,
        placeholderText:
          currentVersionData.displayName ?? currentVersionData.name,
        isLink: true,
        openInNewTab: true,
      },
    ];

    return extraInfo;
  };

  const getTags = () => {
    const tagsDiff = getDiffByFieldName('tags', changeDescription, true);
    const oldTags: Array<TagLabel> = JSON.parse(
      tagsDiff?.added?.oldValue ??
        tagsDiff?.deleted?.oldValue ??
        tagsDiff?.updated?.oldValue ??
        '[]'
    );
    const newTags: Array<TagLabel> = JSON.parse(
      tagsDiff?.added?.newValue ??
        tagsDiff?.deleted?.newValue ??
        tagsDiff?.updated?.newValue ??
        '[]'
    );
    const flag: { [x: string]: boolean } = {};
    const uniqueTags: Array<TagLabelWithStatus> = [];

    [
      ...(getTagsDiff(oldTags, newTags) ?? []),
      ...(currentVersionData.tags ?? []),
    ].forEach((elem) => {
      if (!flag[elem.tagFQN as string]) {
        flag[elem.tagFQN as string] = true;
        uniqueTags.push(elem as TagLabelWithStatus);
      }
    });

    return [
      ...uniqueTags.map((t) =>
        t.tagFQN.startsWith('Tier')
          ? { ...t, tagFQN: t.tagFQN.split(FQN_SEPARATOR_CHAR)[1] }
          : t
      ),
    ];
  };

  useEffect(() => {
    setChangeDescription(
      currentVersionData.changeDescription as ChangeDescription
    );
  }, [currentVersionData]);

  const tableColumn: ColumnsType<EntityReference> = useMemo(
    () => [
      {
        title: t('label.chart-entity', {
          entity: t('label.name'),
        }),
        dataIndex: 'name',
        key: 'name',
        render: (text, record) => (
          <Link target="_blank" to={{ pathname: text }}>
            <Space>
              <span>{getEntityName(record)}</span>
              <SVGIcons
                alt="external-link"
                className="tw-align-middle"
                icon="external-link"
                width="16px"
              />
            </Space>
          </Link>
        ),
      },
      {
        title: t('label.chart-entity', {
          entity: t('label.type'),
        }),
        dataIndex: 'type',
        key: 'type',
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        key: 'description',
        render: (text) =>
          text ? (
            <RichTextEditorPreviewer markdown={text} />
          ) : (
            <span className="tw-no-description">
              {t('label.no-description')}
            </span>
          ),
      },
      {
        title: t('label.tag-plural'),
        dataIndex: 'tags',
        key: 'tags',
      },
    ],
    []
  );

  return (
    <PageContainer>
      <div
        className={classNames(
          'tw-px-6 tw-w-full tw-h-full tw-flex tw-flex-col tw-relative'
        )}
        data-testid="dashboard-version-container">
        {isVersionLoading ? (
          <Loader />
        ) : (
          <div
            className={classNames('version-data')}
            data-testid="version-data">
            <EntityPageInfo
              isVersionSelected
              deleted={deleted}
              entityName={
                currentVersionData.displayName ?? currentVersionData.name ?? ''
              }
              extraInfo={getExtraInfo()}
              followersList={[]}
              serviceType={currentVersionData.serviceType ?? ''}
              tags={getTags()}
              tier={{} as TagLabel}
              titleLinks={slashedDashboardName}
              version={Number(version)}
              versionHandler={backHandler}
            />
            <div className="tw-mt-1 tw-flex tw-flex-col tw-flex-grow ">
              <TabsPane activeTab={1} className="tw-flex-initial" tabs={tabs} />
              <div className="tw-bg-white tw-flex-grow tw--mx-6 tw-px-7 tw-py-4">
                <div className="tw-grid tw-grid-cols-4 tw-gap-4 tw-w-full">
                  <div className="tw-col-span-full">
                    <Description
                      isReadOnly
                      description={getDashboardDescription()}
                    />
                  </div>
                  <div className="m-y-md tw-col-span-full">
                    <Table
                      bordered
                      columns={tableColumn}
                      data-testid="schema-table"
                      dataSource={(currentVersionData as Dashboard)?.charts}
                      pagination={false}
                      rowKey="id"
                      size="small"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <EntityVersionTimeLine
          show
          currentVersion={version}
          versionHandler={versionHandler}
          versionList={versionList}
          onBack={backHandler}
        />
      </div>
    </PageContainer>
  );
};

export default DashboardVersion;
