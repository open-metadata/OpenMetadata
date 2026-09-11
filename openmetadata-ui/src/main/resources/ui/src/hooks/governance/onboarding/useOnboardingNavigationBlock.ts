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
import { useContext, useEffect, useRef, useState } from 'react';
import { useHref, useLocation, useNavigate } from 'react-router-dom';
import { NavigationGuardContext } from '../../../context/navigation/NavigationGuardContext';
import { isRecord } from '../../../utils/governance/onboarding/Onboarding.utils';

const historyIndex = (value: unknown) =>
  isRecord(value) && typeof value.idx === 'number' ? value.idx : undefined;
const clickedLink = (event: MouseEvent) => {
  if (
    event.button !== 0 ||
    [event.metaKey, event.ctrlKey, event.altKey, event.shiftKey].some(Boolean)
  ) {
    return undefined;
  }
  const anchor =
    event.target instanceof Element ? event.target.closest('a') : null;

  if (!anchor?.href || anchor.hasAttribute('download')) {
    return undefined;
  }
  if (anchor.target && anchor.target !== '_self') {
    return undefined;
  }

  return anchor;
};
const internalDestination = (event: MouseEvent, basename: string) => {
  const anchor = clickedLink(event);
  if (!anchor) {
    return undefined;
  }
  const destination = new URL(anchor.href, window.location.href);
  if (
    destination.origin !== window.location.origin ||
    destination.href === window.location.href
  ) {
    return undefined;
  }
  if (basename && !destination.pathname.startsWith(basename + '/')) {
    return undefined;
  }

  return (
    destination.pathname.slice(basename.length) +
    destination.search +
    destination.hash
  );
};

export const useOnboardingNavigationBlock = (dirty: boolean) => {
  const register = useContext(NavigationGuardContext);
  const navigate = useNavigate();
  const location = useLocation();
  const basename = useHref('/').replace(/\/$/, '');
  const [pending, setPending] = useState<{ run: () => void }>();
  const bypass = useRef(false);
  const restoring = useRef(false);
  const afterRestore = useRef<() => void>();

  useEffect(() => {
    if (!dirty) {
      return;
    }
    const index = historyIndex(window.history.state);
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const click = (event: MouseEvent) => {
      const destination = internalDestination(event, basename);
      if (!destination) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setPending({ run: () => navigate(destination) });
    };
    const pop = (event: PopStateEvent) => {
      if (bypass.current) {
        bypass.current = false;

        return;
      }
      if (restoring.current) {
        event.stopImmediatePropagation();
        restoring.current = false;
        const resume = afterRestore.current;
        afterRestore.current = undefined;
        resume?.();

        return;
      }
      const nextIndex = historyIndex(event.state);
      if (
        index === undefined ||
        nextIndex === undefined ||
        index === nextIndex
      ) {
        return;
      }
      event.stopImmediatePropagation();
      const delta = nextIndex - index;
      restoring.current = true;
      navigate(-delta);
      setPending({
        run: () => {
          bypass.current = true;
          navigate(delta);
        },
      });
    };
    window.addEventListener('beforeunload', unload);
    const unregister = register?.(pop);
    document.addEventListener('click', click, true);

    return () => {
      window.removeEventListener('beforeunload', unload);
      unregister?.();
      document.removeEventListener('click', click, true);
    };
  }, [dirty, location, navigate, register, basename]);

  const discard = () => {
    setPending(undefined);
    if (restoring.current) {
      afterRestore.current = pending?.run;
    } else {
      pending?.run();
    }
  };

  return {
    isOpen: Boolean(pending),
    discard,
    stay: () => setPending(undefined),
  };
};
