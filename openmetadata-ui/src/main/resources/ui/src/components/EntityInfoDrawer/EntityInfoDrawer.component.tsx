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

import { CloseOutlined } from '@ant-design/icons';
import { Divider, Drawer } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDashboardByFqn } from 'rest/dashboardAPI';
import { getPipelineByFqn } from 'rest/pipelineAPI';
import { getServiceById } from 'rest/serviceAPI';
import { getTableDetailsByFQN } from 'rest/tableAPI';
import { EntityType } from '../../enums/entity.enum';
import { Dashboard } from '../../generated/entity/data/dashboard';
import { Pipeline } from '../../generated/entity/data/pipeline';
import { Table } from '../../generated/entity/data/table';
import { Topic } from '../../generated/entity/data/topic';
import { getHeaderLabel } from '../../utils/EntityLineageUtils';
import { getEntityOverview, getEntityTags } from '../../utils/EntityUtils';
import { getEncodedFqn } from '../../utils/StringsUtils';
import { getEntityIcon } from '../../utils/TableUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import RichTextEditorPreviewer from '../common/rich-text-editor/RichTextEditorPreviewer';
import { SelectedNode } from '../EntityLineage/EntityLineage.interface';
import Loader from '../Loader/Loader';
import TagsViewer from '../Tag/TagsViewer/tags-viewer';
import { LineageDrawerProps } from './EntityInfoDrawer.interface';
import './EntityInfoDrawer.style.less';

type EntityData = Table | Pipeline | Dashboard | Topic;

const EntityInfoDrawer = ({
  show,
  onCancel,
  selectedNode,
  isMainNode = false,
}: LineageDrawerProps) => {
  const [entityDetail, setEntityDetail] = useState<EntityData>(
    {} as EntityData
  );
  const [serviceType, setServiceType] = useState<string>('');

  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fetchEntityDetail = (selectedNode: SelectedNode) => {
    switch (selectedNode.type) {
      case EntityType.TABLE: {
        setIsLoading(true);
        getTableDetailsByFQN(getEncodedFqn(selectedNode.fqn), [
          'tags',
          'owner',
          'columns',
          'usageSummary',
          'profile',
        ])
          .then((res) => {
            setEntityDetail(res);
            setServiceType(res.serviceType ?? '');
          })
          .catch((err: AxiosError) => {
            showErrorToast(
              err,
              `Error while getting ${selectedNode.name} details`
            );
          })
          .finally(() => {
            setIsLoading(false);
          });

        break;
      }
      case EntityType.PIPELINE: {
        setIsLoading(true);
        getPipelineByFqn(getEncodedFqn(selectedNode.fqn), ['tags', 'owner'])
          .then((res) => {
            getServiceById('pipelineServices', res.service?.id)
              .then((serviceRes) => {
                setServiceType(serviceRes.serviceType ?? '');
              })
              .catch((err: AxiosError) => {
                showErrorToast(
                  err,
                  `Error while getting ${selectedNode.name} service`
                );
              });
            setEntityDetail(res);
            setIsLoading(false);
          })
          .catch((err: AxiosError) => {
            showErrorToast(
              err,
              `Error while getting ${selectedNode.name} details`
            );
          })
          .finally(() => {
            setIsLoading(false);
          });

        break;
      }
      case EntityType.DASHBOARD: {
        setIsLoading(true);
        getDashboardByFqn(getEncodedFqn(selectedNode.fqn), ['tags', 'owner'])
          .then((res) => {
            getServiceById('dashboardServices', res.service?.id)
              .then((serviceRes) => {
                setServiceType(serviceRes.serviceType ?? '');
              })
              .catch((err: AxiosError) => {
                showErrorToast(
                  err,
                  `Error while getting ${selectedNode.name} service`
                );
              });
            setEntityDetail(res);
            setIsLoading(false);
          })
          .catch((err: AxiosError) => {
            showErrorToast(
              err,
              `Error while getting ${selectedNode.name} details`
            );
          })
          .finally(() => {
            setIsLoading(false);
          });

        break;
      }

      default:
        break;
    }
  };

  const entityInfo = useMemo(
    () => getEntityOverview(selectedNode.type, entityDetail, serviceType),
    [selectedNode.type, entityDetail, serviceType]
  );

  useEffect(() => {
    fetchEntityDetail(selectedNode);
  }, [selectedNode]);

  return (
    <Drawer
      destroyOnClose
      bodyStyle={{ padding: 16 }}
      closable={false}
      extra={<CloseOutlined onClick={onCancel} />}
      getContainer={false}
      headerStyle={{ padding: 16 }}
      mask={false}
      style={{ position: 'absolute' }}
      title={
        <p className="tw-flex">
          <span className="tw-mr-2">{getEntityIcon(selectedNode.type)}</span>
          {getHeaderLabel(
            selectedNode.displayName ?? selectedNode.name,
            selectedNode.fqn,
            selectedNode.type,
            isMainNode
          )}
        </p>
      }
      visible={show}>
      {isLoading ? (
        <Loader />
      ) : (
        <>
          <section className="tw-mt-1">
            <div className="tw-flex tw-flex-col">
              {entityInfo.map((d) => {
                return (
                  <div className="tw-py-1.5 tw-flex" key={d.name}>
                    {d.name && <span>{d.name}:</span>}
                    <span
                      className={classNames(
                        { 'tw-ml-2': d.name },
                        {
                          'link-text': d.isLink,
                        }
                      )}>
                      {d.isLink ? (
                        <Link
                          target={d.isExternal ? '_blank' : '_self'}
                          to={{ pathname: d.url }}>
                          {d.value}
                        </Link>
                      ) : (
                        d.value
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
          {entityInfo.length > 0 && <Divider />}
          <section className="tw-mt-1">
            <span className="tw-text-grey-muted">Tags</span>
            <div className="tw-flex tw-flex-wrap tw-pt-1.5">
              {getEntityTags(selectedNode.type, entityDetail).length > 0 ? (
                <TagsViewer
                  sizeCap={-1}
                  tags={getEntityTags(selectedNode.type, entityDetail)}
                />
              ) : (
                <p className="tw-text-xs tw-text-grey-muted">No Tags added</p>
              )}
            </div>
          </section>
          <Divider />
          <section className="tw-mt-1">
            <span className="tw-text-grey-muted">Description</span>
            <div>
              {entityDetail.description?.trim() ? (
                <RichTextEditorPreviewer markdown={entityDetail.description} />
              ) : (
                <p className="tw-text-xs tw-text-grey-muted">No description</p>
              )}
            </div>
          </section>
        </>
      )}
    </Drawer>
  );
};

export default EntityInfoDrawer;
