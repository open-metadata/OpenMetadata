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

import { AxiosError } from 'axios';
import { compare } from 'fast-json-patch';
import { TFunction } from 'i18next';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { HTTP_STATUS_CODE } from '../../../constants/Auth.constants';
import { CreateTag } from '../../../generated/api/classification/createTag';
import { Classification } from '../../../generated/entity/classification/classification';
import { Tag } from '../../../generated/entity/classification/tag';
import { ClassificationTagIdentity } from '../../../interface/governance/classification/Classification.types';
import { createTag, patchTag } from '../../../rest/tagAPI';
import { isTagInClassification } from '../../../utils/ClassificationPureUtils';
import { showErrorToast } from '../../../utils/ToastUtils';

type TagDrawerIntent =
  | { mode: 'create'; parent?: ClassificationTagIdentity }
  | { mode: 'edit'; tag: Tag };

export type TagDrawerSession = TagDrawerIntent & {
  id: number;
  classification: ClassificationTagIdentity;
};

interface TagDrawerOptions {
  classification?: Classification;
  canCreate: boolean;
  isClassificationLoading: boolean;
  isRouteVisible: boolean;
  requestedFqn: string;
  resetForm: () => void;
  hasParentChanged: (parent: ClassificationTagIdentity) => boolean;
  onCommitted: (session: TagDrawerSession, tag: Tag, isActive: boolean) => void;
}

function getTagDrawerScope({
  classification,
  canCreate,
  isClassificationLoading,
  isRouteVisible,
  requestedFqn,
}: TagDrawerOptions) {
  const fqn = classification?.fullyQualifiedName;
  const isCurrent = !requestedFqn || requestedFqn === fqn;
  if (!classification || !fqn || !isCurrent) {
    return;
  }
  if (isClassificationLoading || !isRouteVisible) {
    return;
  }

  return {
    classification: { id: classification.id, fullyQualifiedName: fqn },
    canCreate: canCreate && !classification.disabled && !classification.deleted,
  };
}

function matchesScope(
  session: TagDrawerSession,
  classification?: ClassificationTagIdentity
) {
  return (
    session.classification.id === classification?.id &&
    session.classification.fullyQualifiedName ===
      classification.fullyQualifiedName
  );
}

function isCurrentSession(
  session: TagDrawerSession,
  activeSession: TagDrawerSession | undefined,
  classification?: ClassificationTagIdentity
) {
  return session === activeSession && matchesScope(session, classification);
}

function createDrawerError(message: string) {
  showErrorToast(message);

  return new Error(message);
}

function validateTagSave(
  session: TagDrawerSession,
  scope: ReturnType<typeof getTagDrawerScope>,
  hasParentChanged: TagDrawerOptions['hasParentChanged'],
  t: TFunction
) {
  const parent = session.mode === 'create' ? session.parent : undefined;
  const staleParent = parent && hasParentChanged(parent);
  if (staleParent || !matchesScope(session, scope?.classification)) {
    throw createDrawerError(t('message.tag-selection-changed'));
  }
  if (session.mode === 'create' && !scope?.canCreate) {
    throw createDrawerError(t('message.no-permission-for-action'));
  }
}

function writeTag(session: TagDrawerSession, formData: CreateTag) {
  if (session.mode === 'edit') {
    const { tag } = session;
    const patch = compare(tag, {
      ...tag,
      ...formData,
      parent: tag.parent,
      classification: tag.classification,
    });

    return patchTag(tag.id, patch);
  }

  const payload: CreateTag = {
    ...formData,
    classification: session.classification.fullyQualifiedName,
  };
  if (session.parent) {
    payload.parent = session.parent.fullyQualifiedName;
  } else {
    delete payload.parent;
  }

  return createTag(payload);
}

function reportTagWriteError(
  error: AxiosError,
  mode: TagDrawerIntent['mode'],
  name: string,
  t: TFunction
) {
  if (error.response?.status === HTTP_STATUS_CODE.CONFLICT) {
    showErrorToast(
      t('server.entity-already-exist', {
        entity: t('label.tag'),
        entityPlural: t('label.tag-lowercase-plural'),
        name,
      })
    );

    return;
  }
  const errorKey =
    mode === 'edit'
      ? 'server.entity-updating-error'
      : 'server.create-entity-error';

  showErrorToast(error, t(errorKey, { entity: t('label.tag-lowercase') }));
}

export const useTagDrawer = (options: TagDrawerOptions) => {
  const {
    hasParentChanged,
    isRouteVisible,
    onCommitted,
    requestedFqn,
    resetForm,
  } = options;
  const { t } = useTranslation();
  const scope = getTagDrawerScope(options);
  const liveScope = useRef<typeof scope>();
  const [session, setSession] = useState<TagDrawerSession>();
  const sessionRef = useRef<TagDrawerSession>();
  const nextSessionId = useRef(0);
  const savingSessionRef = useRef<number>();
  const [savingSessionId, setSavingSessionId] = useState<number>();

  useLayoutEffect(() => {
    liveScope.current = scope;

    return () => {
      liveScope.current = undefined;
    };
  }, [scope]);

  const close = useCallback(() => {
    sessionRef.current = undefined;
    setSession(undefined);
    resetForm();
  }, [resetForm]);

  useEffect(() => {
    if (sessionRef.current) {
      close();
    }
  }, [close, requestedFqn, isRouteVisible]);

  const openDrawer = useCallback(
    (intent: TagDrawerIntent) => {
      const current = liveScope.current;
      if (!current || (intent.mode === 'create' && !current.canCreate)) {
        return;
      }

      const opened: TagDrawerSession = {
        ...intent,
        id: ++nextSessionId.current,
        classification: current.classification,
      };
      resetForm();
      sessionRef.current = opened;
      setSession(opened);
    },
    [resetForm]
  );

  const openRoot = useCallback(() => {
    openDrawer({ mode: 'create' });
  }, [openDrawer]);

  const openChild = useCallback(
    (tag: Tag) => {
      const classification = liveScope.current?.classification;
      const fqn = tag.fullyQualifiedName;
      const belongsToClassification =
        !tag.classification || tag.classification.id === classification?.id;
      const canSelectParent =
        belongsToClassification &&
        isTagInClassification(tag, classification?.fullyQualifiedName);
      if (tag.deleted || !tag.id || !fqn || !canSelectParent) {
        return;
      }

      openDrawer({
        mode: 'create',
        parent: { id: tag.id, fullyQualifiedName: fqn },
      });
    },
    [openDrawer]
  );

  const openEdit = useCallback(
    (tag: Tag) => {
      openDrawer({ mode: 'edit', tag });
    },
    [openDrawer]
  );

  const submit = async (formData: CreateTag) => {
    if (
      !session ||
      sessionRef.current !== session ||
      savingSessionRef.current === session.id
    ) {
      return;
    }

    validateTagSave(session, liveScope.current, hasParentChanged, t);
    savingSessionRef.current = session.id;
    setSavingSessionId(session.id);

    const isActive = () =>
      isCurrentSession(
        session,
        sessionRef.current,
        liveScope.current?.classification
      );
    let tag: Tag;
    try {
      tag = await writeTag(session, formData);
    } catch (error) {
      if (isActive()) {
        reportTagWriteError(
          error as AxiosError,
          session.mode,
          formData.name,
          t
        );
      }

      throw error;
    } finally {
      if (savingSessionRef.current === session.id) {
        savingSessionRef.current = undefined;
        setSavingSessionId(undefined);
      }
    }

    const active = isActive();
    if (active) {
      close();
    }
    onCommitted(session, tag, active);
  };

  return {
    close,
    editTag: session?.mode === 'edit' ? session.tag : undefined,
    isSaving: savingSessionId !== undefined && session?.id === savingSessionId,
    openChild: scope?.canCreate ? openChild : undefined,
    openEdit,
    openRoot,
    parent: session?.mode === 'create' ? session.parent : undefined,
    sessionId: session?.id,
    submit,
  };
};
