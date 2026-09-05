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

import { Button, Modal, Skeleton, Space, Switch, Typography } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { compare } from 'fast-json-patch';
import { isEmpty, isUndefined } from 'lodash';
import { FC, useCallback, useMemo, useRef, useState } from 'react';
import { DropZone, useDragAndDrop } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { TabSpecificField } from '../../../../enums/entity.enum';
import { Team } from '../../../../generated/entity/teams/team';
import { Include } from '../../../../generated/type/include';
import { getTeamByName, patchTeamDetail } from '../../../../rest/teamsAPI';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { Transi18next } from '../../../../utils/i18next/LocalUtil';
import { descriptionTableObject } from '../../../../utils/TableColumn.util';
import { getTableExpandableConfig } from '../../../../utils/TableUtils';
import { isDropRestricted } from '../../../../utils/TeamUtils';
import { showErrorToast, showSuccessToast } from '../../../../utils/ToastUtils';
import FilterTablePlaceHolder from '../../../common/ErrorWithPlaceholder/FilterTablePlaceHolder';
import {
  ColumnsType,
  ExpandableConfig,
} from '../../../common/Table/Table.interface';
import Table from '../../../common/Table/TableV2';
import { MovedTeamProps, TeamHierarchyProps } from './team.interface';
import './teams.less';
import { TeamHierarchyNameCell } from './TeamsHeaderSection/TeamHierarchyNameCell';

const TEAM_DRAG_TYPE = 'team-hierarchy-row';

const TeamHierarchy: FC<TeamHierarchyProps> = ({
  currentTeam,
  data,
  onTeamExpand,
  isFetchingAllTeamAdvancedDetails,
  isSearchLoading,
  searchTerm,
  showDeletedTeam,
  onShowDeletedTeamChange,
  handleAddTeamButtonClick,
  createTeamPermission,
  isTeamDeleted,
  handleTeamSearch,
  isTeamBasicDataLoading,
  teamAssetCounts,
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
        className: 'teams-hierarchy-name-column',
        key: 'teams',
        width: '32%',
        render: (_, record) => (
          <TeamHierarchyNameCell record={record} searchTerm={searchTerm} />
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
        dataIndex: 'fullyQualifiedName',
        width: 120,
        key: 'owns',
        render: (fullyQualifiedName: string) =>
          isFetchingAllTeamAdvancedDetails ? (
            <Skeleton
              active={isFetchingAllTeamAdvancedDetails}
              paragraph={{ rows: 0 }}
            />
          ) : (
            <Typography.Text data-testid="team-asset-count">
              {teamAssetCounts?.[fullyQualifiedName] ?? 0}
            </Typography.Text>
          ),
      },
      ...descriptionTableObject<Team>({ width: 300 }),
    ];
  }, [isFetchingAllTeamAdvancedDetails, searchTerm, t, teamAssetCounts]);

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

  /**
   * Row drag through React Aria rather than the react-dnd `components` +
   * `onHeaderRow` pair the AntD table needed — TableV2 does not render custom
   * row components by design. Dropping on a row reparents under it; dropping
   * on the table's own background moves the team to the root, which is what
   * dropping on the header used to mean.
   */
  const teamByName = useMemo(() => {
    const byName = new Map<string, Team>();
    const walk = (teams: Team[]) => {
      teams.forEach((team) => {
        byName.set(team.name, team);
        if (team.children?.length) {
          walk(team.children as unknown as Team[]);
        }
      });
    };
    walk(data);

    return byName;
  }, [data]);

  const draggedTeamRef = useRef<Team>();

  const handleRootDrop = useCallback(() => {
    const dragRecord = draggedTeamRef.current;
    draggedTeamRef.current = undefined;
    if (dragRecord) {
      handleMoveRow(dragRecord, undefined);
    }
  }, [handleMoveRow]);

  const { dragAndDropHooks } = useDragAndDrop({
    getItems: (keys) => {
      const record = teamByName.get(String(Array.from(keys)[0]));

      return record ? [{ [TEAM_DRAG_TYPE]: record.name }] : [];
    },
    acceptedDragTypes: [TEAM_DRAG_TYPE],
    onDragStart: (event) => {
      draggedTeamRef.current = teamByName.get(
        String(Array.from(event.keys)[0])
      );
      handleTableHover(true);
    },
    onDragEnd: () => {
      draggedTeamRef.current = undefined;
      handleTableHover(false);
    },
    getDropOperation: (target, types) =>
      types.has(TEAM_DRAG_TYPE) &&
      (target.type === 'root' ||
        (target.type === 'item' && target.dropPosition === 'on'))
        ? 'move'
        : 'cancel',
    onItemDrop: (event) => {
      const dragRecord = draggedTeamRef.current;
      const targetRecord = teamByName.get(String(event.target.key));
      draggedTeamRef.current = undefined;
      if (dragRecord && targetRecord) {
        handleMoveRow(dragRecord, targetRecord);
      }
    },
    onRootDrop: () => handleRootDrop(),
  });

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
      {/* The react-aria root drop target is the grid body only; the old AntD
          flow also accepted a drop on the header/search area to move a team
          to the root. The DropZone restores that surface. */}
      <DropZone
        aria-label={t('label.move-entity-to-root', {
          entity: t('label.team'),
        })}
        className="tw:block"
        getDropOperation={(types) =>
          types.has(TEAM_DRAG_TYPE) ? 'move' : 'cancel'
        }
        onDrop={handleRootDrop}>
        <Table
          className={classNames('teams-list-table drop-over-background', {
            'drop-over-table': isTableHovered,
          })}
          columns={columns}
          data-testid="team-hierarchy-table"
          dataSource={data}
          dragAndDropHooks={dragAndDropHooks}
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
          loading={isTableLoading || isTeamBasicDataLoading || isSearchLoading}
          locale={{
            emptyText: <FilterTablePlaceHolder />,
          }}
          pagination={false}
          rowKey="name"
          searchProps={searchProps}
          size="small"
        />
      </DropZone>

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
