/*
 *  Copyright 2021 Collate
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

const jsonData = {
  'api-error-messages': {
    'add-glossary-error': 'Error while adding glossary!',
    'add-glossary-term-error': 'Error while adding glossary term!',
    'add-lineage-error': 'Error while adding lineage!',
    'add-feed-error': 'Error while adding feed!',
    'add-table-test-error': 'Error while adding table test!',
    'add-column-test-error': 'Error while adding column test!',
    'add-ingestion-error': 'Error while adding ingestion workflow!',
    'add-service-error': 'Error while adding service!',

    'create-user-error': 'Error while creating user!',
    'create-conversation-error': 'Error while creating conversation!',
    'create-message-error': 'Error while creating message!',
    'create-role-error': 'Error While creating role!',
    'create-rule-error': 'Error while creating rule!',
    'create-tag-category-error': 'Error while creating tag category!',
    'create-tag-error': 'Error while creating tag!',
    'create-team-error': 'Error while creating team!',

    'delete-glossary-error': 'Error while deleting glossary!',
    'delete-glossary-term-error': 'Error while deleting glossary term!',
    'delete-ingestion-error': 'Error while deleting ingestion workflow',
    'delete-lineage-error': 'Error while deleting edge!',
    'delete-message-error': 'Error while deleting message!',
    'delete-rule-error': 'Error while deleting rule!',
    'delete-service-error': 'Error while deleting service!',
    'delete-team-error': 'Error while deleting team!',
    'delete-test-error': 'Error while deleting test!',
    'delete-user-error': 'Error while deleting user!',

    'unexpected-error': 'Oops! An unexpected error occurred.',

    'forbidden-error': 'You do not have permissions to perform this action!',

    'elastic-search-error': 'Error while fetching data from Elasticsearch!',

    'triggering-ingestion-error': 'Error while triggering ingestion workflow',

    'fetch-auth-config-error': 'Error occurred while fetching auth configs!',
    'fetch-chart-error': 'Error while fetching charts!',
    'fetch-dashboard-details-error': 'Error while fetching dashboard details!',
    'fetch-data-error': 'Error while fetching data!',
    'fetch-database-details-error': 'Error while fetching database details!',
    'fetch-database-tables-error': 'Error while fetching database tables!',
    'fetch-database-schemas-error': 'Error while fetching database schemas!',
    'fetch-databaseSchema-details-error':
      'Error while fetching database schema details!',
    'fetch-activity-feed-error': 'Error while fetching activity feeds!',
    'fetch-entity-feed-error': 'Error while fetching entity feeds!',
    'fetch-entity-feed-count-error': 'Error while fetching entity feed count!',
    'fetch-entity-count-error': 'Error while fetching entity count!',
    'fetch-feed-error': 'Error while fetching messages',
    'fetch-glossary-error': 'Error while fetching glossary!',
    'fetch-glossary-list-error': 'Error while fetching glossaries!',
    'fetch-glossary-term-error': 'Error while fetching glossary term!',
    'fetch-glossary-terms-error': 'Error while fetching glossary terms!',
    'fetch-ingestion-error': 'Error while fetching ingestion workflow!',
    'fetch-lineage-error': 'Error while fetching lineage data!',
    'fetch-lineage-node-error': 'Error while fetching lineage node!',
    'fetch-pipeline-details-error': 'Error while fetching pipeline details!',
    'fetch-policy-error': 'Error while fetching policy details!',
    'fetch-roles-error': 'Error while fetching roles!',
    'fetch-sample-data-error': 'Error while fetching sample data!',
    'fetch-table-details-error': 'Error while fetching table details!',
    'fetch-table-queries-error': 'Error while fetching table queries!',
    'fetch-tags-error': 'Error while fetching tags!',
    'fetch-tiers-error': 'Error while fetching tiers!',
    'fetch-tags-category-error': 'Error while fetching tags category!',
    'fetch-topic-details-error': 'Error while fetching topic details!',
    'fetch-thread-error': 'Error while fetching threads!',
    'fetch-updated-conversation-error':
      'Error while fetching updated conversation!',
    'fetch-user-details-error': 'Error while fetching user details!',
    'fetch-user-permission-error': 'Error while fetching user permissions!',
    'fetch-service-error': 'Error while fetching service details!',
    'fetch-services-error': 'Error while fetching services!',
    'fetch-suggestions-error': 'Error while fetching suggestions!',
    'fetch-teams-error': 'Error while fetching teams!',
    'fetch-version-error': 'Error while fetching version!',
    'fetch-webhook-error': 'Error while fetching webhooks!',
    'fetch-user-count-error': 'Error while getting users count!',

    'unexpected-server-response': 'Unexpected response from server!',

    'update-chart-error': 'Error while updating charts!',
    'update-description-error': 'Error while updating description!',
    'update-database-error': 'Error while updating database!',
    'update-databaseSchema-error': 'Error while updating database schema!',
    'update-entity-error': 'Error while updating entity!',
    'update-entity-follow-error': 'Error while following entity!',
    'update-entity-unfollow-error': 'Error while unfollowing entity!',
    'update-glossary-term-error': 'Error while updating glossary term!',
    'update-ingestion-error': 'Error while updating ingestion workflow',
    'update-owner-error': 'Error while updating owner',
    'update-role-error': 'Error while updating role!',
    'update-service-config-error': 'Error while updating ingestion workflow',
    'update-tags-error': 'Error while updating tags!',
    'update-tag-category-error': 'Error while updating tag category!',
    'update-task-error': 'Error while updating tasks!',
    'update-team-error': 'Error while updating team!',
    'update-user-error': 'Error while updating user!',
    'update-admin-profile-error':
      'Error while updating the admin user profile!',
    'update-service-error': 'Error while updating service!',
    'update-reviewer-error': 'Error while updating reviewer!',

    'feed-post-error': 'Error while posting the message!',
  },
  'api-success-messages': {
    'create-conversation': 'Conversation created successfully!',
    'delete-test': 'Test deleted successfully!',
    'delete-message': 'Message deleted successfully!',
  },
  'form-error-messages': {
    'empty-email': 'Email is required.',
    'invalid-email': 'Email is invalid.',
  },
  label: {
    // Add UI label texts here
  },
  message: {
    'no-services': 'No services',
  },
};

export default jsonData;
