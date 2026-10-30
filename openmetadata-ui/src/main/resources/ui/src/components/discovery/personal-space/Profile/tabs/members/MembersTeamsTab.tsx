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

import {
  Box,
  Button,
  ConfirmPopover,
  Toggle,
} from '@openmetadata/ui-core-components';
import { Users01 } from '@openmetadata/ui-core-components/icons';
import { FC, useRef } from 'react';
import { DropZone } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import { Transi18next } from '../../../../../../utils/i18next/LocalUtil';
import NoDataPlaceholder from '../../../../../common/EmptyPlaceholder/NoDataPlaceholder';
import Table from '../../../../../common/Table/TableV2';
import type { MembersTeamsTabProps } from './MembersTeamDetail.types';
import { TEAM_DRAG_TYPE } from './MembersTeamDetail.utils';

const MembersTeamsTab: FC<MembersTeamsTabProps> = ({
  team,
  childTeamColumns,
  childTeamExpandable,
  filteredChildTeams,
  dragAndDropHooks,
  draggedTeamRef,
  isTableHovered,
  isChildTeamsLoading,
  showDeletedTeam,
  searchTerm,
  canCreateTeam,
  movedTeam,
  onShowDeletedTeamChange,
  onSearchTermChange,
  onNavigate,
  onSetMovedTeam,
  onMoveConfirm,
}) => {
  const { t } = useTranslation();
  const tableRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <DropZone
        aria-label={t('label.move-entity-to-root', {
          entity: t('label.team'),
        })}
        className="tw:block"
        getDropOperation={(types) =>
          types.has(TEAM_DRAG_TYPE) ? 'move' : 'cancel'
        }
        ref={tableRef}
        onDrop={() => {
          if (draggedTeamRef.current) {
            onSetMovedTeam({
              from: draggedTeamRef.current,
              to: undefined,
            });
          }
        }}>
        <Table
          className={isTableHovered ? 'drop-over-table' : undefined}
          columns={childTeamColumns}
          containerClassName="tw:rounded-none tw:border-0"
          data-testid="sub-teams-table"
          dataSource={filteredChildTeams}
          dragAndDropHooks={dragAndDropHooks}
          expandable={childTeamExpandable}
          extraTableFilters={
            <Box align="center" direction="row" gap={3}>
              <Toggle
                data-testid="show-deleted-teams"
                isSelected={showDeletedTeam}
                label={t('label.deleted')}
                size="sm"
                onChange={onShowDeletedTeamChange}
              />
              {canCreateTeam && (
                <Button
                  color="primary"
                  data-testid="add-team"
                  size="xs"
                  onPress={() =>
                    onNavigate({
                      type: 'teams-add',
                      parentFqn: team.fullyQualifiedName,
                    })
                  }>
                  {t('label.add-entity', {
                    entity: t('label.team'),
                  })}
                </Button>
              )}
            </Box>
          }
          loading={isChildTeamsLoading}
          locale={{
            emptyText: (
              <Box
                align="center"
                className="tw:min-h-32 tw:relative"
                justify="center">
                <NoDataPlaceholder
                  icon={<Users01 />}
                  title={t('label.no-data-found')}
                />
              </Box>
            ),
          }}
          pagination={false}
          rowKey="fullyQualifiedName"
          searchProps={{
            containerClassName: 'tw:w-80!',
            placeholder: t('label.search-entity', {
              entity: t('label.team'),
            }),
            searchValue: searchTerm,
            onSearch: onSearchTermChange,
            typingInterval: 500,
          }}
          size="small"
          variant="muted"
        />
      </DropZone>

      <ConfirmPopover
        confirmText={t('label.confirm')}
        data-testid="move-team-popover"
        description={
          movedTeam &&
          (movedTeam.to ? (
            <Transi18next
              i18nKey="message.entity-transfer-message"
              renderElement={<strong />}
              values={{
                from: getEntityName(movedTeam.from),
                to: getEntityName(movedTeam.to),
                entity: t('label.team-lowercase'),
              }}
            />
          ) : (
            t('message.move-entity-to-root', {
              entity: getEntityName(movedTeam.from),
            })
          ))
        }
        isOpen={Boolean(movedTeam)}
        placement="top"
        title={t('label.move-the-entity', { entity: t('label.team') })}
        triggerRef={tableRef}
        variant="primary"
        onConfirm={onMoveConfirm}
        onOpenChange={(isOpen) => !isOpen && onSetMovedTeam(undefined)}
      />
    </>
  );
};

export default MembersTeamsTab;
