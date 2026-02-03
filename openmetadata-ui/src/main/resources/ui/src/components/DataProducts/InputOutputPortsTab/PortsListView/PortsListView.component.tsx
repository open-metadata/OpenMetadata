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

import { Button, Col, Dropdown, Row, Skeleton } from 'antd';
import { AxiosError } from 'axios';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as DeleteIcon } from '../../../../assets/svg/ic-delete.svg';
import { ReactComponent as IconDropdown } from '../../../../assets/svg/menu.svg';
import { PAGE_SIZE_BASE } from '../../../../constants/constants';
import { EntityReference } from '../../../../generated/type/entityReference';
import { usePaging } from '../../../../hooks/paging/usePaging';
import {
  getDataProductInputPorts,
  getDataProductOutputPorts,
  removeInputPortsFromDataProduct,
  removeOutputPortsFromDataProduct,
} from '../../../../rest/dataProductAPI';
import { getEntityName } from '../../../../utils/EntityUtils';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import { ManageButtonItemLabel } from '../../../common/ManageButtonContentItem/ManageButtonContentItem.component';
import NextPrevious from '../../../common/NextPrevious/NextPrevious';
import { PagingHandlerParams } from '../../../common/NextPrevious/NextPrevious.interface';
import ExploreSearchCard from '../../../ExploreV1/ExploreSearchCard/ExploreSearchCard';
import ConfirmationModal from '../../../Modals/ConfirmationModal/ConfirmationModal';
import { SourceType } from '../../../SearchedData/SearchedData.interface';
import { PortsListViewProps, PortsListViewRef } from './PortsListView.types';

const PORT_FIELDS = 'owners,tags,domains,extension';

const PortsListView = forwardRef<PortsListViewRef, PortsListViewProps>(
  ({ dataProductFqn, portType, permissions, onRemovePort }, ref) => {
    const { t } = useTranslation();
    const [isLoading, setIsLoading] = useState(true);
    const [ports, setPorts] = useState<SourceType[]>([]);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [portToDelete, setPortToDelete] = useState<SourceType>();
    const [isDeleting, setIsDeleting] = useState(false);

    const {
      currentPage,
      pageSize,
      paging,
      handlePageChange,
      handlePageSizeChange,
      handlePagingChange,
      showPagination,
    } = usePaging(PAGE_SIZE_BASE);

    const fetchPorts = useCallback(
      async (page = 1) => {
        setIsLoading(true);
        try {
          const offset = (page - 1) * pageSize;
          const fetchFn =
            portType === 'input'
              ? getDataProductInputPorts
              : getDataProductOutputPorts;

          const response = await fetchFn(dataProductFqn, {
            limit: pageSize,
            offset,
            fields: PORT_FIELDS,
          });

          const portsData = response.data.map((entity) => ({
            ...entity,
            entityType: entity.entityType as string,
          })) as SourceType[];

          setPorts(portsData);
          handlePagingChange({
            total: response.paging.total,
          });
        } catch (error) {
          showErrorToast(error as AxiosError);
        } finally {
          setIsLoading(false);
        }
      },
      [dataProductFqn, portType, pageSize, handlePagingChange]
    );

    const refreshPorts = useCallback(() => {
      fetchPorts(currentPage);
    }, [fetchPorts, currentPage]);

    useImperativeHandle(ref, () => ({
      refreshPorts,
    }));

    const handlePagingChange2 = useCallback(
      ({ currentPage }: PagingHandlerParams) => {
        handlePageChange(currentPage);
        fetchPorts(currentPage);
      },
      [handlePageChange, fetchPorts]
    );

    const handleDeleteClick = useCallback((port: SourceType) => {
      setPortToDelete(port);
      setShowDeleteModal(true);
    }, []);

    const handleDeleteConfirm = useCallback(async () => {
      if (!portToDelete) {
        return;
      }

      setIsDeleting(true);
      try {
        const removeFn =
          portType === 'input'
            ? removeInputPortsFromDataProduct
            : removeOutputPortsFromDataProduct;

        const portRef: EntityReference = {
          id: portToDelete.id ?? '',
          type: portToDelete.entityType ?? '',
        };

        await removeFn(dataProductFqn, [portRef]);

        showSuccessToast(
          t('server.entity-deleted-successfully', {
            entity: getEntityName(portToDelete),
          })
        );

        setShowDeleteModal(false);
        setPortToDelete(undefined);
        refreshPorts();
        onRemovePort();
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsDeleting(false);
      }
    }, [portToDelete, portType, dataProductFqn, refreshPorts, onRemovePort, t]);

    const handleDeleteCancel = useCallback(() => {
      setShowDeleteModal(false);
      setPortToDelete(undefined);
    }, []);

    useEffect(() => {
      fetchPorts(1);
    }, [dataProductFqn, portType]);

    if (isLoading) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minHeight: 0,
          }}>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <Row gutter={[16, 16]}>
              {[1, 2, 3].map((key) => (
                <Col key={key} span={24}>
                  <Skeleton active paragraph={{ rows: 2 }} />
                </Col>
              ))}
            </Row>
          </div>
        </div>
      );
    }

    return (
      <div
        className="ports-list-view"
        data-testid={`${portType}-ports-list`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
        }}>
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            minHeight: 0,
          }}>
          <Row gutter={[16, 16]}>
            {ports.map((port) => (
              <Col key={port.id} span={24}>
                <ExploreSearchCard
                  showEntityIcon
                  actionPopoverContent={
                    permissions.EditAll ? (
                      <Dropdown
                        menu={{
                          items: [
                            {
                              key: 'delete',
                              label: (
                                <ManageButtonItemLabel
                                  description={t('label.remove-entity', {
                                    entity: t('label.port'),
                                  })}
                                  icon={DeleteIcon}
                                  id="delete-port"
                                  name={t('label.remove')}
                                />
                              ),
                              onClick: () => handleDeleteClick(port),
                            },
                          ],
                        }}
                        overlayClassName="manage-dropdown-list-container"
                        overlayStyle={{ width: '350px' }}
                        placement="bottomRight"
                        trigger={['click']}>
                        <Button
                          className="flex-center"
                          data-testid={`port-actions-${port.id}`}
                          icon={<IconDropdown height={14} width={14} />}
                          size="small"
                          type="text"
                        />
                      </Dropdown>
                    ) : undefined
                  }
                  className="m-b-sm"
                  id={port.id ?? ''}
                  showTags={false}
                  source={port}
                />
              </Col>
            ))}
          </Row>
        </div>

        {showPagination && (
          <div style={{ flexShrink: 0, paddingTop: '12px' }}>
            <NextPrevious
              isNumberBased
              currentPage={currentPage}
              pageSize={pageSize}
              paging={paging}
              pagingHandler={handlePagingChange2}
              onShowSizeChange={handlePageSizeChange}
            />
          </div>
        )}

        <ConfirmationModal
          bodyText={t('message.are-you-sure-you-want-to-remove-entity', {
            entity: getEntityName(portToDelete),
          })}
          cancelText={t('label.cancel')}
          confirmText={t('label.remove')}
          header={t('label.remove-entity', {
            entity: t('label.port'),
          })}
          isLoading={isDeleting}
          visible={showDeleteModal}
          onCancel={handleDeleteCancel}
          onConfirm={handleDeleteConfirm}
        />
      </div>
    );
  }
);

PortsListView.displayName = 'PortsListView';

export default PortsListView;
