/*
 *  Copyright 2022 Collate
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

import { Modal, Table, Typography } from 'antd';
import { ColumnsType } from 'antd/lib/table';
import { AxiosError } from 'axios';
import { isArray, isEmpty } from 'lodash';
import React, { FC, useCallback, useMemo, useState } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { changeTeamParent, getTeamByName } from '../../axiosAPIs/teamsAPI';
import { Team } from '../../generated/entity/teams/team';
import { getEntityName } from '../../utils/CommonUtils';
import { getTeamsWithFqnPath } from '../../utils/RouterUtils';
import SVGIcons, { Icons } from '../../utils/SvgUtils';
import { getMovedTeamData } from '../../utils/TeamUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import DraggableBodyRow from './DraggableBodyRow';
import { MovedTeamProps, TeamHierarchyProps } from './team.interface';
import './teams.less';

const TeamHierarchy: FC<TeamHierarchyProps> = ({
  currentTeam,
  data,
  onTeamExpand,
}) => {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTableLoading, setIsTableLoading] = useState<boolean>(false);
  const [movedTeam, setMovedTeam] = useState<MovedTeamProps>();

  const columns: ColumnsType<Team> = useMemo(() => {
    return [
      {
        title: 'Teams',
        dataIndex: 'teams',
        key: 'teams',
        render: (_, record) => (
          <Link
            className="hover:tw-underline tw-cursor-pointer"
            to={getTeamsWithFqnPath(record.fullyQualifiedName || record.name)}>
            {getEntityName(record)}
          </Link>
        ),
      },
      {
        title: 'Type',
        dataIndex: 'teamType',
        key: 'teamType',
      },
      {
        title: 'Sub Teams',
        dataIndex: 'childrenCount',
        key: 'subTeams',
        render: (childrenCount: number) => childrenCount ?? '--',
      },
      {
        title: 'Users',
        dataIndex: 'userCount',
        key: 'users',
        render: (userCount: number) => userCount ?? '--',
      },
      {
        title: 'Asset Count',
        dataIndex: 'owns',
        key: 'owns',
        render: (owns) => owns.length,
      },
      {
        title: 'Description',
        dataIndex: 'description',
        key: 'description',
        render: (description: string) => description || '--',
      },
    ];
  }, [data, onTeamExpand]);

  const moveRow = useCallback(async (dragRecord: Team, dropRecord: Team) => {
    let dropTeam: Team = dropRecord;
    if (!isArray(dropTeam.children)) {
      const res = await getTeamByName(dropTeam.name, ['parents'], 'all');
      dropTeam = res.parents?.[0] as Team;
    }
    setMovedTeam({
      from: dragRecord,
      to: dropTeam,
    });
    setIsModalOpen(true);
  }, []);

  const handleOk = async () => {
    if (movedTeam) {
      setIsTableLoading(true);
      try {
        const data = await getTeamByName(
          movedTeam.from.name,
          ['users', 'defaultRoles', 'policies', 'owner', 'parents', 'children'],
          'all'
        );
        if (data) {
          const res = await changeTeamParent(
            getMovedTeamData(data, [movedTeam.to.id])
          );
          if (res) {
            onTeamExpand(true, currentTeam?.name);
            showSuccessToast(t('message.team-moved-success'));
          } else {
            throw t('message.team-moved-error');
          }
        } else {
          throw t('server.unexpected-response');
        }
      } catch (error) {
        showErrorToast(error as AxiosError, t('server.unexpected-response'));
      } finally {
        setIsTableLoading(false);
        setIsModalOpen(false);
      }
    }
  };

  const components = {
    body: {
      row: DraggableBodyRow,
    },
  };

  return (
    <>
      <DndProvider backend={HTML5Backend}>
        <Table
          bordered
          className="teams-list-table"
          columns={columns}
          components={components}
          dataSource={data}
          expandable={{
            expandIcon: ({ expanded, onExpand, expandable, record }) =>
              expandable ? (
                <div
                  className="expand-cell-icon-container"
                  onClick={(e) =>
                    onExpand(
                      record,
                      e as unknown as React.MouseEvent<HTMLElement, MouseEvent>
                    )
                  }>
                  <SVGIcons className="drag-icon" icon={Icons.DRAG} />
                  <SVGIcons
                    icon={
                      expanded
                        ? Icons.ARROW_DOWN_LIGHT
                        : Icons.ARROW_RIGHT_LIGHT
                    }
                  />
                </div>
              ) : (
                <div className="expand-cell-empty-icon-container">
                  <SVGIcons className="drag-icon" icon={Icons.DRAG} />
                </div>
              ),
          }}
          loading={isTableLoading}
          pagination={false}
          rowKey="name"
          size="small"
          onExpand={(isOpen, record) => {
            if (isOpen && isEmpty(record.children)) {
              onTeamExpand(false, record.fullyQualifiedName, true);
            }
          }}
          onRow={(record, index) => {
            const attr = {
              index,
              moveRow,
              record,
            };

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return attr as React.HTMLAttributes<any>;
          }}
        />
      </DndProvider>

      <Modal
        centered
        destroyOnClose
        closable={false}
        okText={t('label.confirm')}
        title={t('label.move-the-team')}
        visible={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        onOk={handleOk}>
        <Typography.Text>
          Click on Confirm if you’d like to move
          <strong> {movedTeam?.from?.name}</strong> team under{' '}
          <strong>{movedTeam?.to?.name}</strong> team.
        </Typography.Text>
      </Modal>
    </>
  );
};

export default TeamHierarchy;
