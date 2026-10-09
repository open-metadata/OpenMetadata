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
    ButtonUtility,
    EmptyPlaceholder,
    FormFields,
    HookForm,
    Skeleton,
    Table,
    TableCard,
    Typography
} from '@openmetadata/ui-core-components';
import { Trash01 } from '@openmetadata/ui-core-components/icons';
import { AxiosError } from 'axios';
import { uniqBy } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { NO_PERMISSION_FOR_ACTION } from '../../../../../../constants/HelperTextUtil';
import { SearchIndex } from '../../../../../../enums/search.enum';
import { User } from '../../../../../../generated/entity/teams/user';
import { EntityReference } from '../../../../../../generated/entity/type';
import {
    getPersonaUserRefs,
    PersonaUserOption,
    usePersonaUsersField
} from '../../../../../../hooks/usePersonaUsersField';
import { searchQuery } from '../../../../../../rest/searchAPI';
import { getEntityName } from '../../../../../../utils/EntityNameUtils';
import { getTermQuery } from '../../../../../../utils/SearchPureUtils';
import { showErrorToast } from '../../../../../../utils/ToastUtils';

type UserColumnId = 'name' | 'teams' | 'roles' | 'actions';
type UserColumn = { id: UserColumnId; label: string; className?: string };

interface PersonaUsersTabProps {
  users: EntityReference[];
  canEdit: boolean;
  onUsersChange: (users: EntityReference[]) => void;
}

const renderRefList = (refs: EntityReference[] | undefined) => {
  if (!refs?.length) {
    return <span className="tw:text-sm tw:text-secondary">--</span>;
  }

  return (
    <Typography className="tw:truncate tw:block" size="text-sm">
      {refs.map((ref) => getEntityName(ref)).join(', ')}
    </Typography>
  );
};

const PersonaUsersTab = ({
  users,
  canEdit,
  onUsersChange,
}: PersonaUsersTabProps) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [userDetails, setUserDetails] = useState<User[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const usersField = usePersonaUsersField('add-persona-users-select');
  const addUsersForm = useForm<{ users: PersonaUserOption[] }>({
    defaultValues: { users: [] },
  });
  const selectedOptions = useWatch({
    control: addUsersForm.control,
    name: 'users',
  });
  const pendingUsers = useMemo(
    () => getPersonaUserRefs(selectedOptions),
    [selectedOptions]
  );

  const handleRemove = useCallback(
    (id: string) => onUsersChange(users.filter((u) => u.id !== id)),
    [onUsersChange, users]
  );

  const handleCancelAdd = useCallback(() => {
    setIsAdding(false);
    addUsersForm.reset();
  }, [addUsersForm]);

  const handleConfirmAdd = useCallback(() => {
    onUsersChange(uniqBy([...users, ...pendingUsers], 'id'));
    handleCancelAdd();
  }, [onUsersChange, users, pendingUsers, handleCancelAdd]);

  const columns = useMemo<UserColumn[]>(
    () => [
      { id: 'name', label: t('label.name'), className: 'tw:w-72' },
      { id: 'teams', label: t('label.team-plural') },
      { id: 'roles', label: t('label.role-plural') },
      { id: 'actions', label: t('label.action-plural'), className: 'tw:w-20' },
    ],
    [t]
  );

  useEffect(() => {
    let active = true;

    const fetchDetails = async () => {
      setIsLoading(true);
      try {
        // One search request for every user; their documents carry teams and roles.
        const response = users.length
          ? await searchQuery({
              pageNumber: 1,
              pageSize: users.length,
              query: '',
              queryFilter: getTermQuery(
                { _id: users.map((user) => user.id) },
                'should',
                1
              ),
              searchIndex: SearchIndex.USER,
            })
          : undefined;

        if (active) {
          setUserDetails(
            response?.hits.hits.map((hit) => hit._source as User) ?? []
          );
        }
      } catch (error) {
        if (active) {
          setUserDetails([]);
          showErrorToast(error as AxiosError);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void fetchDetails();

    return () => {
      active = false;
    };
  }, [users]);

  const renderCell = (user: User, colId: UserColumnId) => {
    switch (colId) {
      case 'name':
        return (
          <Typography
            className="tw:truncate tw:block"
            data-testid="persona-user-name"
            size="text-sm"
            tooltip={getEntityName(user)}
            weight="medium">
            {getEntityName(user)}
          </Typography>
        );
      case 'teams':
        return renderRefList(user.teams);
      case 'roles':
        return renderRefList(user.roles);
      case 'actions':
        return (
          <ButtonUtility
            color="tertiary"
            data-testid={`remove-user-${getEntityName(user)}`}
            icon={Trash01}
            isDisabled={!canEdit}
            size="xs"
            tooltip={
              canEdit
                ? t('label.remove-entity', { entity: t('label.user') })
                : t(NO_PERMISSION_FOR_ACTION)
            }
            tooltipPlacement="left"
            onPress={() => handleRemove(user.id)}
          />
        );
      default:
        return null;
    }
  };

  const items = isLoading ? [] : userDetails;

  const renderEmptyState = useCallback(
    () =>
      isLoading ? (
        <Box className="tw:p-3" direction="col" gap={2}>
          {Array.from({ length: Math.max(users.length, 1) }, (_, i) => (
            <Skeleton height={28} key={i} variant="rounded" />
          ))}
        </Box>
      ) : (
        <Box
          align="center"
          className="tw:min-h-32 tw:relative"
          justify="center">
          <EmptyPlaceholder
            title={t('label.no-entity-found', {
              entity: t('label.user-plural'),
            })}
          />
        </Box>
      ),
    [isLoading, users.length, t]
  );

  return (
    <Box data-testid="persona-users-tab" direction="col" gap={4}>
      {isAdding && (
        <Box
          className="tw:border tw:border-secondary tw:rounded-xl tw:p-4"
          direction="col"
          gap={4}>
          <Typography
            className="tw:text-primary"
            size="text-sm"
            weight="semibold">
            {t('label.add-entity', { entity: t('label.user-plural') })}
          </Typography>
          <HookForm form={addUsersForm}>
            <FormFields fields={[usersField]} />
          </HookForm>
          <Box direction="row" gap={3} justify="end">
            <Button color="tertiary" size="sm" onPress={handleCancelAdd}>
              {t('label.cancel')}
            </Button>
            <Button
              color="primary"
              data-testid="save-persona-users"
              isDisabled={pendingUsers.length === 0}
              size="sm"
              onPress={handleConfirmAdd}>
              {t('label.save')}
            </Button>
          </Box>
        </Box>
      )}
      {canEdit && !isAdding && (
        <Box justify="end">
          <Button
            color="primary"
            data-testid="add-persona-user"
            size="sm"
            onPress={() => setIsAdding(true)}>
            {t('label.add-entity', { entity: t('label.user') })}
          </Button>
        </Box>
      )}
      <TableCard.Root className="tw:flex tw:flex-col" size="compact">
        <div className="tw:overflow-y-auto">
          <Table
            aria-label={t('label.user-plural')}
            className="tw:table-fixed"
            data-testid="persona-users-table"
            size="compact">
            <Table.Header columns={columns}>
              {(col) => (
                <Table.Head
                  className={col.className}
                  id={col.id}
                  isRowHeader={col.id === 'name'}
                  key={col.id}
                  label={col.label}
                />
              )}
            </Table.Header>
            <Table.Body items={items} renderEmptyState={renderEmptyState}>
              {(user) => (
                <Table.Row
                  columns={columns}
                  id={user.id ?? user.name}
                  key={user.id ?? user.name}>
                  {(col) => (
                    <Table.Cell className={col.className} key={col.id}>
                      {renderCell(user, col.id as UserColumnId)}
                    </Table.Cell>
                  )}
                </Table.Row>
              )}
            </Table.Body>
          </Table>
        </div>
      </TableCard.Root>
    </Box>
  );
};

export default PersonaUsersTab;
