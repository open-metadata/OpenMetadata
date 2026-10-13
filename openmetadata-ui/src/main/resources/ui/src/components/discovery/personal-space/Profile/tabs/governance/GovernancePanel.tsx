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

import { Button } from '@openmetadata/ui-core-components';
import {
  Building01,
  GlossaryTerm as GlossaryTermIcon,
  Policy as GovernanceIcon,
} from '@openmetadata/ui-core-components/icons';
import type { Key } from 'react';
import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsHash } from '../../../../../../hooks/useSettingsHash';
import type { ProfileHeaderOverride } from '../../profileNavConfig';
import type { GovernanceView } from './Governance.types';
import { hashSubPathToView, viewToSubPath } from './Governance.utils';
import GovernanceGlossaryFormPage from './GovernanceGlossaryFormPage';
import GovernanceGlossaryList from './GovernanceGlossaryList';
import GovernanceIntakeFormPage from './GovernanceIntakeFormPage';
import GovernanceIntakeList from './GovernanceIntakeList';
import GovernanceLanding from './GovernanceLanding';

const HASH_TAB = 'governance';
const VIEW_GLOSSARY_LIST = 'glossary-list' as const;
const VIEW_INTAKE_LIST = 'intake-list' as const;

interface GovernancePanelProps {
  onHeaderChange?: (override: ProfileHeaderOverride | null) => void;
}

const GovernancePanel: FC<GovernancePanelProps> = ({ onHeaderChange }) => {
  const { t } = useTranslation();
  const { state: hashState, setHash } = useSettingsHash();

  const view = useMemo<GovernanceView>(
    () => hashSubPathToView(hashState.subPath),
    [hashState.subPath]
  );

  const [intakeListHeaderActions, setIntakeListHeaderActions] =
    useState<React.ReactNode>(undefined);

  const onNavigate = useCallback(
    (nextView: GovernanceView) => {
      setHash(HASH_TAB, viewToSubPath(nextView));
    },
    [setHash]
  );

  // Clear intake-list header actions when navigating away from that view
  useEffect(() => {
    if (view.type !== VIEW_INTAKE_LIST) {
      setIntakeListHeaderActions(undefined);
    }
  }, [view.type]);

  useEffect(() => {
    if (!onHeaderChange) {
      return;
    }

    const govLabel = t('label.governance');
    const glossaryLabel = t('label.glossary-term-relation-plural');
    const intakeLabel = t('label.intake-form-plural');
    const addRelType = t('label.add-entity', {
      entity: t('label.relation-type'),
    });
    const addIntake = t('label.add-entity', { entity: t('label.intake-form') });

    const settingsItem = { id: 'settings', label: t('label.setting-plural') };
    const govItem = { id: HASH_TAB, label: govLabel };

    const onBreadcrumbAction = (id: Key) => {
      if (id === HASH_TAB) {
        onNavigate({ type: 'landing' });
      } else if (id === VIEW_GLOSSARY_LIST) {
        onNavigate({ type: VIEW_GLOSSARY_LIST });
      } else if (id === VIEW_INTAKE_LIST) {
        onNavigate({ type: VIEW_INTAKE_LIST });
      }
    };

    const breadcrumbsByView: Record<GovernanceView['type'], unknown[]> = {
      landing: [settingsItem, { id: 'current', label: govLabel }],
      [VIEW_GLOSSARY_LIST]: [
        settingsItem,
        govItem,
        { id: 'current', label: glossaryLabel },
      ],
      'glossary-add': [
        settingsItem,
        govItem,
        { id: VIEW_GLOSSARY_LIST, label: glossaryLabel },
        { id: 'current', label: addRelType },
      ],
      'glossary-edit': [
        settingsItem,
        govItem,
        { id: VIEW_GLOSSARY_LIST, label: glossaryLabel },
        { id: 'current', label: t('label.edit') },
      ],
      [VIEW_INTAKE_LIST]: [
        settingsItem,
        govItem,
        { id: 'current', label: intakeLabel },
      ],
      'intake-add': [
        settingsItem,
        govItem,
        { id: VIEW_INTAKE_LIST, label: intakeLabel },
        { id: 'current', label: addIntake },
      ],
      'intake-edit': [
        settingsItem,
        govItem,
        { id: VIEW_INTAKE_LIST, label: intakeLabel },
        { id: 'current', label: t('label.edit') },
      ],
    };

    const iconByView: Record<
      GovernanceView['type'],
      FC<{ className?: string }>
    > = {
      landing: GovernanceIcon,
      [VIEW_GLOSSARY_LIST]: GlossaryTermIcon,
      'glossary-add': GlossaryTermIcon,
      'glossary-edit': GlossaryTermIcon,
      [VIEW_INTAKE_LIST]: Building01,
      'intake-add': Building01,
      'intake-edit': Building01,
    };

    const titleByView: Record<GovernanceView['type'], string> = {
      landing: govLabel,
      [VIEW_GLOSSARY_LIST]: glossaryLabel,
      'glossary-add': addRelType,
      'glossary-edit': t('label.edit-entity', {
        entity: t('label.relation-type'),
      }),
      [VIEW_INTAKE_LIST]: intakeLabel,
      'intake-add': addIntake,
      'intake-edit': t('label.edit-entity', { entity: t('label.intake-form') }),
    };

    const descByView: Record<GovernanceView['type'], string> = {
      landing: t('message.governance-settings-description'),
      [VIEW_GLOSSARY_LIST]: t(
        'message.glossary-term-relation-settings-description'
      ),
      'glossary-add': t('message.glossary-term-relation-settings-description'),
      'glossary-edit': t('message.glossary-term-relation-settings-description'),
      [VIEW_INTAKE_LIST]: t('message.intake-form-plural-description'),
      'intake-add': t('message.intake-form-plural-description'),
      'intake-edit': t('message.intake-form-plural-description'),
    };

    const actionsForView = (() => {
      if (view.type === VIEW_GLOSSARY_LIST) {
        return (
          <Button
            color="primary"
            data-testid="add-relation-type"
            size="sm"
            onPress={() => onNavigate({ type: 'glossary-add' })}>
            {addRelType}
          </Button>
        );
      }

      if (view.type === VIEW_INTAKE_LIST) {
        return intakeListHeaderActions;
      }

      return undefined;
    })();

    onHeaderChange({
      breadcrumbs: breadcrumbsByView[
        view.type
      ] as ProfileHeaderOverride['breadcrumbs'],
      title: titleByView[view.type],
      description: descByView[view.type],
      icon: iconByView[view.type],
      onBreadcrumbAction,
      actions: actionsForView,
    });
  }, [view, onHeaderChange, onNavigate, t, intakeListHeaderActions]);

  const content = (() => {
    if (view.type === 'landing') {
      return <GovernanceLanding onNavigate={onNavigate} />;
    }

    if (view.type === VIEW_GLOSSARY_LIST) {
      return <GovernanceGlossaryList onNavigate={onNavigate} />;
    }

    if (view.type === 'glossary-add') {
      return <GovernanceGlossaryFormPage onNavigate={onNavigate} />;
    }

    if (view.type === 'glossary-edit') {
      return (
        <GovernanceGlossaryFormPage
          editName={view.name}
          onNavigate={onNavigate}
        />
      );
    }

    if (view.type === VIEW_INTAKE_LIST) {
      return (
        <GovernanceIntakeList
          onNavigate={onNavigate}
          onSetHeaderActions={setIntakeListHeaderActions}
        />
      );
    }

    if (view.type === 'intake-add') {
      return (
        <GovernanceIntakeFormPage
          entityType={view.entityType}
          key={view.entityType}
          onNavigate={onNavigate}
        />
      );
    }

    if (view.type === 'intake-edit') {
      return (
        <GovernanceIntakeFormPage
          editId={view.id}
          key={view.id}
          onNavigate={onNavigate}
        />
      );
    }

    return null;
  })();

  return <div className="tw:flex-1 tw:overflow-y-auto">{content}</div>;
};

export default GovernancePanel;
