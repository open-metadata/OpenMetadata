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

import type {
  AuthCoordinatorEvent,
  EventPayloadMap,
  Unsubscribe,
} from './types';

type Handler<E extends AuthCoordinatorEvent> = (
  payload: EventPayloadMap[E]
) => void;

export class TypedEventBus {
  private readonly handlers = new Map<
    AuthCoordinatorEvent,
    Set<Handler<AuthCoordinatorEvent>>
  >();

  on<E extends AuthCoordinatorEvent>(
    event: E,
    handler: Handler<E>
  ): Unsubscribe {
    const set = this.handlers.get(event) ?? new Set();
    set.add(handler as Handler<AuthCoordinatorEvent>);
    this.handlers.set(event, set);

    return () => set.delete(handler as Handler<AuthCoordinatorEvent>);
  }

  emit<E extends AuthCoordinatorEvent>(
    event: E,
    payload: EventPayloadMap[E]
  ): void {
    const set = this.handlers.get(event);
    if (!set) {
      return;
    }
    for (const handler of set) {
      (handler as Handler<E>)(payload);
    }
  }
}
