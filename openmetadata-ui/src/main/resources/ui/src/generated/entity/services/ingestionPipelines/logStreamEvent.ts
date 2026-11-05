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
/**
 * One event delivered on an ingestion pipeline log Server-Sent Events stream. Every event
 * carries the cursor a client needs to resume the stream where it left off.
 */
export interface LogStreamEvent {
    /**
     * Opaque cursor pointing just past `logs`. Pass it back as the `after` query parameter to
     * resume the stream without re-reading what was already delivered.
     */
    after?:    string;
    eventType: LogStreamEventType;
    /**
     * Log content appended since the previous event. Empty on `complete` and `error` events.
     */
    logs?: string;
    /**
     * Human readable detail. Set on `error` events and on `complete` events that ended early.
     */
    message?: string;
    reason?:  LogStreamEndReason;
    /**
     * True when this chunk was replayed from the server's buffer because the stream was already
     * running when this client connected, rather than read fresh from log storage.
     */
    replay?: boolean;
    /**
     * Run the streamed logs belong to. Absent when the pipeline has no recorded run to bind the
     * stream to and the log backend is serving its latest logs instead.
     */
    runId?: string;
    /**
     * True when the server could not replay the whole backlog. The client must fetch the
     * earlier history from the paginated log endpoint.
     */
    truncated?: boolean;
}

/**
 * Kind of event delivered on the stream.
 */
export enum LogStreamEventType {
    Complete = "complete",
    Error = "error",
    Logs = "logs",
}

/**
 * Why the server stopped streaming. Only set on a `complete` event. A stream that ends
 * without one of these was cut short — reconnect from the last cursor.
 */
export enum LogStreamEndReason {
    IdleTimeout = "idleTimeout",
    MaxBytes = "maxBytes",
    MaxDuration = "maxDuration",
    RunFinished = "runFinished",
}
