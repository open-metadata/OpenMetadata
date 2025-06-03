/*
 *  Copyright 2025 Collate.
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
 * This schema defines Email Verification Token Schema.
 */
export interface EmailVerificationToken {
    /**
     * Expiry Date-Time of the token
     */
    expiryDate: number;
    /**
     * Unique Refresh Token for user
     */
    token: string;
    /**
     * Refresh Count
     */
    tokenStatus: TokenStatus;
    /**
     * Token Type
     */
    tokenType: TokenType;
    /**
     * User this email Verification token is given to
     */
    userId: string;
}

/**
 * Refresh Count
 */
export enum TokenStatus {
    StatusConfirmed = "STATUS_CONFIRMED",
    StatusPending = "STATUS_PENDING",
}

/**
 * Token Type
 *
 * Different Type of User token
 */
export enum TokenType {
    EmailVerification = "EMAIL_VERIFICATION",
    PasswordReset = "PASSWORD_RESET",
    PersonalAccessToken = "PERSONAL_ACCESS_TOKEN",
    RefreshToken = "REFRESH_TOKEN",
    SupportToken = "SUPPORT_TOKEN",
}
