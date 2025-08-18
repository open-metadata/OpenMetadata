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

import { Button, Modal, Skeleton, Space, Typography } from 'antd';
import { Switch } from 'antd';
import { ColumnsType, TableProps } from 'antd/lib/table';
import { ExpandableConfig } from 'antd/lib/table/interface';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { compare } from 'fast-json-patch';
import { isEmpty, isUndefined } from 'lodash';
import { FC, useCallback, useMemo, useState } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  DESCRIPTION_LENGTH,
  NO_DATA_PLACEHOLDER,
} from '../../../../constants/constants';
import { TABLE_CONSTANTS } from '../../../../constants/Teams.constants';
import { TabSpecificField } from '../../../../enums/entity.enum';
import { Team } from '../../../../generated/entity/teams/team';
import { Include } from '../../../../generated/type/include';
import { getTeamByName, patchTeamDetail } from '../../../../rest/teamsAPI';
import { Transi18next } from '../../../../utils/CommonUtils';
import {
  getEntityName,
  highlightSearchText,
} from '../../../../utils/EntityUtils';
import { getTeamsWithFqnPath } from '../../../../utils/RouterUtils';
import { stringToHTML } from '../../../../utils/StringsUtils';
import { getTableExpandableConfig } from '../../../../utils/TableUtils';
import { isDropRestricted } from '../../../../utils/TeamUtils';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import { DraggableBodyRowProps } from '../../../common/Draggable/DraggableBodyRowProps.interface';
import FilterTablePlaceHolder from '../../../common/ErrorWithPlaceholder/FilterTablePlaceHolder';
import RichTextEditorPreviewerNew from '../../../common/RichTextEditor/RichTextEditorPreviewNew';
import Table from '../../../common/Table/Table';
import { MovedTeamProps, TeamHierarchyProps } from './team.interface';
import './teams.less';

const TeamHierarchy: FC<TeamHierarchyProps> = ({
  currentTeam,
  data,
  onTeamExpand,
  isFetchingAllTeamAdvancedDetails,
  searchTerm,
  showDeletedTeam,
  onShowDeletedTeamChange,
  handleAddTeamButtonClick,
  createTeamPermission,
  isTeamDeleted,
  handleTeamSearch,
}) => {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isTableLoading, setIsTableLoading] = useState<boolean>(false);
  const [movedTeam, setMovedTeam] = useState<MovedTeamProps>();
  const [isTableHovered, setIsTableHovered] = useState(false);

  const searchProps = useMemo(
    () => ({
      placeholder: t('label.search-entity', {
        entity: t('label.team'),
      }),
      searchValue: searchTerm,
      typingInterval: 500,
      onSearch: handleTeamSearch,
    }),
    [searchTerm, handleTeamSearch]
  );

  const columns: ColumnsType<Team> = useMemo(() => {
    return [
      {
        title: t('label.team-plural'),
        dataIndex: 'teams',
        className: 'whitespace-nowrap',
        key: 'teams',
        render: (_, record) => (
          <Link
            className="link-hover"
            to={getTeamsWithFqnPath(record.fullyQualifiedName || record.name)}>
            {stringToHTML(
              highlightSearchText(getEntityName(record), searchTerm)
            )}
          </Link>
        ),
      },
      {
        title: t('label.type'),
        dataIndex: 'teamType',
        width: 120,
        key: 'teamType',
      },
      {
        title: t('label.sub-team-plural'),
        dataIndex: 'childrenCount',
        width: 100,
        key: 'subTeams',
        render: (childrenCount: number) =>
          isFetchingAllTeamAdvancedDetails ? (
            <Skeleton
              active={isFetchingAllTeamAdvancedDetails}
              paragraph={{ rows: 0 }}
            />
          ) : (
            childrenCount ?? 0
          ),
      },
      {
        title: t('label.user-plural'),
        dataIndex: 'userCount',
        width: 80,
        key: 'users',
        render: (userCount: number) =>
          isFetchingAllTeamAdvancedDetails ? (
            <Skeleton
              active={isFetchingAllTeamAdvancedDetails}
              paragraph={{ rows: 0 }}
            />
          ) : (
            userCount ?? 0
          ),
      },
      {
        title: t('label.entity-count', {
          entity: t('label.asset'),
        }),
        dataIndex: 'owns',
        width: 120,
        key: 'owns',
        render: (owns: Team['owns']) =>
          isFetchingAllTeamAdvancedDetails ? (
            <Skeleton
              active={isFetchingAllTeamAdvancedDetails}
              paragraph={{ rows: 0 }}
            />
          ) : (
            owns?.length ?? 0
          ),
      },
      {
        title: t('label.description'),
        dataIndex: 'description',
        width: 300,
        key: 'description',
        render: (description: string) =>
          isEmpty(description) ? (
            <Typography.Paragraph className="m-b-0">
              {NO_DATA_PLACEHOLDER}
            </Typography.Paragraph>
          ) : (
            <RichTextEditorPreviewerNew
              markdown={description}
              maxLength={DESCRIPTION_LENGTH}
              showReadMoreBtn={false}
            />
          ),
      },
    ];
  }, [data, isFetchingAllTeamAdvancedDetails, onTeamExpand]);

  const handleTableHover = useCallback(
    (value: boolean) => setIsTableHovered(value),
    []
  );

  const handleMoveRow = useCallback(
    async (dragRecord: Team, dropRecord?: Team) => {
      if (dragRecord.id === dropRecord?.id) {
        return;
      }

      if (
        !isUndefined(dropRecord) &&
        isDropRestricted(dragRecord.teamType, dropRecord?.teamType)
      ) {
        showErrorToast(
          t('message.error-team-transfer-message', {
            dragTeam: dragRecord.teamType,
            dropTeam: dropRecord.teamType,
          })
        );

        return;
      }
      setMovedTeam({
        from: dragRecord,
        to: dropRecord,
      });
      setIsModalOpen(true);
    },
    []
  );

  const handleChangeTeam = async () => {
    if (movedTeam) {
      setIsTableLoading(true);
      try {
        const dropTeam = movedTeam.to?.id;
        const data = await getTeamByName(movedTeam.from.name, {
          fields: [
            TabSpecificField.USERS,
            TabSpecificField.DEFAULT_ROLES,
            TabSpecificField.POLICIES,
            TabSpecificField.OWNERS,
            TabSpecificField.PARENTS,
            TabSpecificField.CHILDREN,
          ],
          include: Include.All,
        });
        const updatedData = {
          ...data,
          parents: dropTeam ? [{ id: dropTeam, type: 'team' }] : undefined,
        };
        const jsonPatch = compare(data, updatedData);
        await patchTeamDetail(data.id, jsonPatch);
        onTeamExpand(true, currentTeam?.name);
        showSuccessToast(t('message.team-moved-success'));
      } catch (error) {
        showErrorToast(error as AxiosError, t('server.team-moved-error'));
      } finally {
        setIsTableLoading(false);
        setIsModalOpen(false);
        setIsTableHovered(false);
      }
    }
  };

  const onTableRow = (record: Team, index?: number) =>
    ({
      index,
      handleMoveRow,
      handleTableHover,
      record,
    } as DraggableBodyRowProps<Team>);

  const onTableHeader: TableProps<Team>['onHeaderRow'] = () =>
    ({
      handleMoveRow,
      handleTableHover,
    } as DraggableBodyRowProps<Team>);

  const onDragConfirmationModalClose = useCallback(() => {
    setIsModalOpen(false);
    setIsTableHovered(false);
  }, []);

  const expandableConfig: ExpandableConfig<Team> = useMemo(
    () => ({
      ...getTableExpandableConfig<Team>(true),
      onExpand: (isOpen, record) => {
        if (isOpen && isEmpty(record.children)) {
          onTeamExpand(false, record.fullyQualifiedName, true);
        }
      },
    }),
    [onTeamExpand]
  );

  return (
    <div className="team-list-container">
      <DndProvider backend={HTML5Backend}>
        <Table
          className={classNames('teams-list-table drop-over-background', {
            'drop-over-table': isTableHovered,
          })}
          columns={columns}
          components={TABLE_CONSTANTS}
          data-testid="team-hierarchy-table"
          dataSource={data}
          expandable={expandableConfig}
          extraTableFilters={
            <Space align="center">
              <span>
                <Switch
                  checked={showDeletedTeam}
                  data-testid="show-deleted"
                  onClick={onShowDeletedTeamChange}
                />
                <Typography.Text className="m-l-xs">
                  {t('label.deleted')}
                </Typography.Text>
              </span>

              {createTeamPermission && !isTeamDeleted && (
                <Button
                  data-testid="add-team"
                  type="primary"
                  onClick={handleAddTeamButtonClick}>
                  {t('label.add-entity', { entity: t('label.team') })}
                </Button>
              )}
            </Space>
          }
          loading={isTableLoading}
          locale={{
            emptyText: <FilterTablePlaceHolder />,
          }}
          pagination={false}
          rowKey="name"
          searchProps={searchProps}
          size="small"
          onHeaderRow={onTableHeader}
          onRow={onTableRow}
        />
      </DndProvider>

      <Modal
        centered
        destroyOnClose
        closable={false}
        confirmLoading={isTableLoading}
        data-testid="confirmation-modal"
        maskClosable={false}
        okText={t('label.confirm')}
        open={isModalOpen}
        title={t('label.move-the-entity', { entity: t('label.team') })}
        onCancel={onDragConfirmationModalClose}
        onOk={handleChangeTeam}>
        <Transi18next
          i18nKey="message.entity-transfer-message"
          renderElement={<strong />}
          values={{
            from: movedTeam?.from.name,
            to: movedTeam?.to?.name ?? getEntityName(currentTeam),
            entity: t('label.team-lowercase'),
          }}
        />
      </Modal>
    </div>
  );
};

export default TeamHierarchy;
