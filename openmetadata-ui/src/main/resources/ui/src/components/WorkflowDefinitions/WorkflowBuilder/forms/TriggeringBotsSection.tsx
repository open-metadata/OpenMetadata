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
  Autocomplete,
  SelectItemType,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useWorkflowModeContext } from '../../../../contexts/WorkflowModeContext';
import { App } from '../../../../generated/entity/applications/app';
import { Bot, ProviderType } from '../../../../generated/entity/bot';
import { Paging } from '../../../../generated/type/paging';
import { useSyncedListData } from '../../../../hooks/useSyncedListData';
import { getApplicationList } from '../../../../rest/applicationAPI';
import { getMarketPlaceApplicationList } from '../../../../rest/applicationMarketPlaceAPI';
import { getBots } from '../../../../rest/botsAPI';
import { getEntityName } from '../../../../utils/EntityNameUtils';
import { showErrorToast } from '../../../../utils/ToastUtils';

interface TriggeringBotsSectionProps {
  triggeringBots?: string[];
  lockFields?: boolean;
  onTriggeringBotsChange: (triggeringBots: string[]) => void;
}

const PAGE_SIZE = 100;

const fetchAllPages = async <T,>(
  fetchPage: (after?: string) => Promise<{ data: T[]; paging: Paging }>
): Promise<T[]> => {
  const items: T[] = [];
  let after: string | undefined;
  do {
    const page = await fetchPage(after);
    items.push(...page.data);
    after = page.paging?.after;
  } while (after);

  return items;
};

interface ApplicationBots {
  ids: Set<string>;
  names: Set<string>;
}

// Every application names its bot "<application name>Bot"; a bot left behind by an uninstalled
// application keeps that name but no installed application links to it.
const toApplicationBotName = (applicationName: string) =>
  `${applicationName}Bot`;

const fetchNamesSafely = async (
  fetchPage: (
    after?: string
  ) => Promise<{ data: { name: string }[]; paging: Paging }>
): Promise<string[]> => {
  try {
    return (await fetchAllPages(fetchPage)).map((app) => app.name);
  } catch {
    return [];
  }
};

// The server refuses an application's bot anyway; a user who cannot list applications still
// gets the picker, without that filter.
const fetchInstalledApplications = async (): Promise<App[]> => {
  try {
    return await fetchAllPages<App>((after) =>
      getApplicationList({ fields: 'bot', limit: PAGE_SIZE, after })
    );
  } catch {
    return [];
  }
};

const fetchApplicationBots = async (): Promise<ApplicationBots> => {
  const [installed, marketplaceNames] = await Promise.all([
    fetchInstalledApplications(),
    fetchNamesSafely((after) =>
      getMarketPlaceApplicationList({ limit: PAGE_SIZE, after })
    ),
  ]);

  return {
    ids: new Set(installed.flatMap((app) => (app.bot?.id ? [app.bot.id] : []))),
    names: new Set(
      [...installed.map((app) => app.name), ...marketplaceNames].map(
        toApplicationBotName
      )
    ),
  };
};

/** System bots and applications' bots write in bulk on their own schedule, so they never start a workflow. */
const fetchAdminCreatedBots = async (): Promise<Bot[]> => {
  const [bots, applicationBots] = await Promise.all([
    fetchAllPages<Bot>((after) => getBots({ limit: PAGE_SIZE, after })),
    fetchApplicationBots(),
  ]);

  return bots.filter(
    (bot) =>
      bot.provider !== ProviderType.System &&
      !applicationBots.ids.has(bot.id) &&
      !applicationBots.names.has(bot.name)
  );
};

/** The bots an admin created whose changes start this workflow; any other bot's change never does. */
export const TriggeringBotsSection: React.FC<TriggeringBotsSectionProps> = ({
  triggeringBots = [],
  lockFields = false,
  onTriggeringBotsChange,
}) => {
  const { t } = useTranslation();
  const { isFormDisabled } = useWorkflowModeContext();
  const [botItems, setBotItems] = useState<SelectItemType[]>([]);

  useEffect(() => {
    fetchAdminCreatedBots()
      .then((bots) =>
        setBotItems(
          bots.map((bot) => ({ id: bot.name, label: getEntityName(bot) }))
        )
      )
      .catch((error) => showErrorToast(error as AxiosError));
  }, []);

  const labelsByName = useMemo(
    () => new Map(botItems.map((item) => [String(item.id), item.label])),
    [botItems]
  );
  const getBotLabel = useCallback(
    (name: string) => labelsByName.get(name) ?? name,
    [labelsByName]
  );
  const selectedBots = useSyncedListData(triggeringBots, getBotLabel);

  return (
    <div className="tw:mt-6" data-testid="triggering-bots-section">
      <Autocomplete
        data-testid="triggering-bots-select"
        isDisabled={isFormDisabled || lockFields}
        items={botItems}
        label={t('label.triggering-bot-plural')}
        placeholder={t('label.select-field', {
          field: t('label.bot-plural'),
        })}
        selectedItems={selectedBots}
        onItemCleared={(key) => {
          selectedBots.remove(key);
          onTriggeringBotsChange(
            triggeringBots.filter((name) => name !== String(key))
          );
        }}
        onItemInserted={(key) => {
          selectedBots.append({
            id: String(key),
            label: getBotLabel(String(key)),
          });
          onTriggeringBotsChange([...triggeringBots, String(key)]);
        }}>
        {(item) => (
          <Autocomplete.Item id={item.id} key={item.id} label={item.label} />
        )}
      </Autocomplete>
      <Typography as="p" className="tw:mt-2 tw:text-tertiary" size="text-sm">
        {t('message.triggering-bots-description')}
      </Typography>
    </div>
  );
};
