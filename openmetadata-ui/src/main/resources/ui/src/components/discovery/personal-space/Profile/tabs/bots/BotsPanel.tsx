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

import type { BreadcrumbItemType } from '@openmetadata/ui-core-components';
import { Button } from '@openmetadata/ui-core-components';
import type { Key } from 'react';
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as BotIcon } from '../../../../../../assets/svg/entity/bot.svg';
import LimitWrapper from '../../../../../../hoc/LimitWrapper';
import { useSettingsHash } from '../../../../../../hooks/useSettingsHash';
import type { ProfileHeaderOverride } from '../../profileNavConfig';
import BotAddForm from './BotAddForm';
import BotDetailPanel from './BotDetailPanel';
import BotsListPanel from './BotsListPanel';
import type { BotsView } from './BotsPanel.types';

interface BotsPanelProps {
  onHeaderChange?: (override: ProfileHeaderOverride | null) => void;
}

const BotsPanel: FC<BotsPanelProps> = ({ onHeaderChange }) => {
  const { t } = useTranslation();
  const { state: hashState, setHash } = useSettingsHash();
  const [view, setView] = useState<BotsView>({ type: 'list' });
  const [listRefreshKey, setListRefreshKey] = useState(0);

  const [detailHeaderActions, setDetailHeaderActions] =
    useState<React.ReactNode>(undefined);
  const [detailHeaderTitleInput, setDetailHeaderTitleInput] =
    useState<React.ReactNode>(undefined);
  const [detailHeaderTitleSuffix, setDetailHeaderTitleSuffix] =
    useState<React.ReactNode>(undefined);

  useEffect(() => {
    setDetailHeaderActions(undefined);
    setDetailHeaderTitleInput(undefined);
    setDetailHeaderTitleSuffix(undefined);
  }, [view.type]);

  // Sync hash → view on mount and hash changes
  useEffect(() => {
    if (hashState.tab !== 'bots') {
      return;
    }

    if (hashState.subPath === 'add') {
      setView((prev) => (prev.type === 'add' ? prev : { type: 'add' }));
    } else if (hashState.subPath) {
      setView((prev) => {
        if (prev.type === 'detail' && prev.fqn === hashState.subPath) {
          return prev;
        }

        return {
          type: 'detail',
          fqn: hashState.subPath,
          name: hashState.subPath,
        };
      });
    } else {
      setView((prev) => (prev.type === 'list' ? prev : { type: 'list' }));
    }
  }, [hashState.tab, hashState.subPath]);

  const onNavigate = useCallback(
    (nextView: BotsView) => {
      setView(nextView);

      if (nextView.type === 'detail') {
        setHash('bots', nextView.fqn);
      } else if (nextView.type === 'add') {
        setHash('bots', 'add');
      } else {
        setHash('bots');
        setListRefreshKey((k) => k + 1);
      }
    },
    [setHash]
  );

  useEffect(() => {
    if (!onHeaderChange) {
      return;
    }

    const settingsLabel = t('label.setting-plural');
    const botsLabel = t('label.bot-plural');
    const addBotLabel = t('label.add-entity', { entity: t('label.bot') });

    let botName = '';
    let isDetailView = false;

    if (view.type === 'detail') {
      botName = view.name;
      isDetailView = true;
    }

    const settingsItem: BreadcrumbItemType = {
      id: 'settings',
      label: settingsLabel,
    };
    const botsItem: BreadcrumbItemType = { id: 'bots', label: botsLabel };
    const base = [settingsItem, botsItem];

    const crumbsByType: Record<BotsView['type'], BreadcrumbItemType[]> = {
      list: [settingsItem, { id: 'current', label: botsLabel }],
      add: [...base, { id: 'current', label: addBotLabel }],
      detail: [...base, { id: 'current', label: botName }],
    };

    const titleByType: Record<BotsView['type'], string> = {
      list: botsLabel,
      add: addBotLabel,
      detail: botName,
    };

    const descByType: Record<BotsView['type'], string> = {
      list: t('message.page-sub-header-for-bots'),
      add: t('message.page-sub-header-for-bots'),
      detail: t('message.page-sub-header-for-bots'),
    };

    const onBreadcrumbAction = (id: Key) => {
      if (id === 'bots' || id === 'settings') {
        onNavigate({ type: 'list' });
      }
    };

    const actionsForView: React.ReactNode = (() => {
      if (view.type === 'list') {
        return (
          <LimitWrapper resource="bot">
            <Button
              color="primary"
              data-testid="add-bot"
              size="sm"
              onPress={() => onNavigate({ type: 'add' })}>
              {addBotLabel}
            </Button>
          </LimitWrapper>
        );
      }

      if (isDetailView) {
        return detailHeaderActions;
      }

      return undefined;
    })();

    const titleInputForView = isDetailView ? detailHeaderTitleInput : undefined;
    const titleSuffixForView = isDetailView
      ? detailHeaderTitleSuffix
      : undefined;

    onHeaderChange({
      breadcrumbs: crumbsByType[view.type],
      description: descByType[view.type],
      icon: BotIcon as FC<{ className?: string }>,
      title: titleByType[view.type],
      titleInput: titleInputForView,
      titleSuffix: titleSuffixForView,
      actions: actionsForView,
      onBreadcrumbAction,
    });
  }, [
    view,
    onHeaderChange,
    t,
    onNavigate,
    detailHeaderActions,
    detailHeaderTitleInput,
    detailHeaderTitleSuffix,
  ]);

  const content = useMemo(() => {
    if (view.type === 'list') {
      return (
        <BotsListPanel refreshKey={listRefreshKey} onNavigate={onNavigate} />
      );
    }

    if (view.type === 'add') {
      return <BotAddForm onNavigate={onNavigate} />;
    }

    if (view.type === 'detail') {
      return (
        <BotDetailPanel
          fqn={view.fqn}
          onNavigate={onNavigate}
          onRename={(newName) =>
            setView((prev) =>
              prev.type === 'detail' ? { ...prev, name: newName } : prev
            )
          }
          onSetHeaderActions={setDetailHeaderActions}
          onSetHeaderTitleInput={setDetailHeaderTitleInput}
          onSetHeaderTitleSuffix={setDetailHeaderTitleSuffix}
        />
      );
    }

    return null;
  }, [view, onNavigate, listRefreshKey]);

  return (
    <div className="tw:flex tw:flex-1 tw:flex-col tw:min-h-0">{content}</div>
  );
};

export default BotsPanel;
