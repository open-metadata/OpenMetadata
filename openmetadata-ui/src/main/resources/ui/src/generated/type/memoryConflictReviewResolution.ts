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
 * What a reviewer compared when deciding a Memory Conflict Review, sent as the resolution
 * payload: the reviewed memory and every disputed memory, each with when its claim last
 * changed as the reviewer read it. The decision is refused when the disputes or any of
 * those claims changed since.
 */
export interface MemoryConflictReviewResolution {
    /**
     * The reviewed memory and every memory it disputes.
     */
    compared: ComparedMemory[];
}

/**
 * A memory the reviewer compared.
 */
export interface ComparedMemory {
    /**
     * When the memory's claim last changed, as the reviewer read it. Absent when the reviewer
     * could not read the memory.
     */
    contentUpdatedAt?: number;
    /**
     * The compared context memory.
     */
    id: string;
}
