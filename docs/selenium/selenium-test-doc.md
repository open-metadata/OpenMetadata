# Selenium Test Cases Coverage

**This document describes about the area covered in OpenMetadata via Selenium Tests**

## Pages Tests:

### [MyData Page](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/test/java/org/openmetadata/catalog/selenium/pages/myData/MyDataPageTest.java):
* **checkWhatsNew** - Checks the What's New Modal.
* **checkTabs** - Checks the 'My Data' and 'Following' tabs are clickable.
* **checkOverView** - Checks all the entity references.
* **checkSearchBar** - Performs the search action.
* **checkHeaders** - Checks all the options available on the top bar.
* **checkMyDataTab** - Assigns the ownership to a table and checks if the table-link is displayed/available 
under 'My Data' tab.
* **checkFollowingTab** - Follows a table and checks if the table-link is displayed/available under 'Following' tab.
* **checkRecentlyViewed** - Click on the table and checks if that table reflects under the recently viewed.
* **checkRecentlySearched** - Performs a search operation and looks for the searched term under recent search terms
* **checkLogout** - Checks the logout functionality.

### [Teams Page](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/test/java/org/openmetadata/catalog/selenium/pages/teams/TeamsPageTest.java):
* **openTeamsPage** - Helps to navigate to Teams page to other tests.
* **createTeam** - Creates the new team.
* **addUser** - Adds the user to above create team.
* **editDescription** - Adds/edits the description of the created team.
* **addAsset** - Adds the asset i.e. gives ownership of table to the created team and verifies under asset tab.

### [Tags Page](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/test/java/org/openmetadata/catalog/selenium/pages/tags/TagsPageTest.java):
* **openTagsPage** - Helps to navigate to Tags page to other tests.
* **addTagCategory** - Adds/Creates a Tag Category.
* **editTagCategoryDescription** - Adds/edits the description of the created tag category.
* **addTag** - Adds tag to the created tag category.
* **changeTagDescription** - Adds/edits the description of the created tag in created tag category.
* **addAssociatedTag** - Adds an associated tag to the created tag.
* **removeAssociatedTag** - Removes an associated tag to the created tag.
* **addTagToTableColumn** - Assigns the created tag to the table column(s).

### [Table Details Page](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/test/java/org/openmetadata/catalog/selenium/pages/tableDetails/TableDetailsPageTest.java):
* **openExplorePage** - Helps to navigate to Explore page to other tests.
* **checkTabs** - Checks all the entity tabs available on the explore page.
* **editDescription** - Edits the description of the table.
* **searchColumnAndEditDescription** - Searches the table and edits the description.
* **addTagsToColumn** - Adds tags to the table columns.
* **removeTagsFromColumn** - Removes tags from the table columns.
* **checkProfiler** - Checks the profiler tab in details page.
* **checkManage** - Checks the manage tab in details page. Assigns the Ownership and tire to the table.
* **checkLineage** - Checks lineage tab in details page.
* **checkBreadCrumb** - Checks bread crumb i.e. checks the database and datasource reference links.
* **checkVersion** - Makes the changes in the table details and verifies the change in versioning.
* **checkFrequentlyJoinedTables** - Checks frequently joined tables.
* **checkFrequentlyJoinedColumns** - Checks frequently joined columns.

### [Dashboard Details Page](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/test/java/org/openmetadata/catalog/selenium/pages/dashboardDetails/DashboardDetailsPageTest.java):
* **openExplorePage** - Helps to navigate to Explore page to other tests.
* **editDescription** - Edits the description of the dashboard.
* **addTags** - Adds tags to dashboard.
* **removeTags** - Removes tags from the dashboard.
* **editChartDescription** - Edits description of the charts
* **addChartTags** - Adds tags to charts
* **removeChartTag** - Removes the tags from charts
* **checkManage** - Checks the manage tab in details page. Assigns the Ownership and tire to the table.
* **checkBreadCrumb** - Checks bread crumb i.e. checks the dashboards and service reference links.

### [Pipeline Details Page](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/test/java/org/openmetadata/catalog/selenium/pages/pipelineDetails/PipelineDetailsPageTest.java):
* **openExplorePage** - Helps to navigate to Explore page to other tests.
* **editDescription** - Edits the description of the pipeline.
* **addTags** - Adds tags to pipeline.
* **removeTags** - Removes tags from the pipeline.
* **editTaskDescription** - Edits description of the tasks.
* **checkLineage** - Checks lineage tab in details page.
* **checkManage** - Checks the manage tab in details page. Assigns the Ownership and tire to the pipeline.
* **checkBreadCrumb** - Checks bread crumb i.e. checks the pipeline and service reference links.

### [Topic Details Page](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/test/java/org/openmetadata/catalog/selenium/pages/topicDetails/TopicDetailsPageTest.java):
* **openExplorePage** - Helps to navigate to Explore page to other tests.
* **checkTabs** - Checks the tabs available in topic details page.
* **checkFollow** - Clicks on follow button and checks the follow count.
* **addTags** - Adds tags to topic.
* **removeTags** - Removes tags from the topic.
* **editDescription** - Edits the description of the topic.
* **checkManage** - Checks the manage tab in details page. Assigns the Ownership and tire to the topic.
* **checkBreadCrumb** - Checks bread crumb i.e. checks the topic and service reference links.

### [Database Service Page](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/test/java/org/openmetadata/catalog/selenium/pages/databaseService/DatabaseServicePageTest.java):
* **openDatabaseServicePage** - Helps to navigate to Database Service page to other tests.
* **addDatabaseService** - Adds a database service.
* **editDatabaseService** - Edits the config in the created database service.
* **checkDatabaseServiceDetails** - Checks the database service and updates the description.
* **searchDatabaseService** - Performs a search action for database service.
* **deleteDatabaseService** - Deletes the database service.

### [Dashboard Service Page](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/test/java/org/openmetadata/catalog/selenium/pages/dashboardService/DashboardServiceTestPage.java):
* **openDashboardServicePage** - Helps to navigate to Dashboard Service page to other tests.
* **addDashboardService** - Adds a dashboard service.
* **editDashboardService** - Edits the config in the created dashboard service.
* **checkDashboardServiceDetails** - Checks the dashboard service and updates the description.
* **searchDashboardService** - Performs a search action for dashboard service.
* **deleteDashboardService** - Deletes the dashboard service.

### [Pipeline Service Page](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/test/java/org/openmetadata/catalog/selenium/pages/pipelineService/PipelineServiceTestPage.java):
* **openPipelineServicePage** - Helps to navigate to Pipeline Service page to other tests.
* **addPipelineService** - Adds a pipeline service.
* **editPipelineService** - Edits the config in the created pipeline service.
* **checkPipelineServiceDetails** - Checks the pipeline service and updates the description.
* **searchPipelineService** - Performs a search action for pipeline service.
* **deletePipelineService** - Deletes the pipeline service.

### [Messaging Service Page](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/test/java/org/openmetadata/catalog/selenium/pages/messagingService/MessagingServicePageTest.java):
* **openMessagingServicePage** - Helps to navigate to Messaging Service page to other tests.
* **addMessagingService** - Adds a messaging service.
* **editMessagingService** - Edits the config in the created messaging service.
* **checkMessagingServiceDetails** - Checks the messaging service and updates the description.
* **searchMessagingService** - Performs a search action for messaging service.
* **deleteMessagingService** - Deletes the messaging service.

### [Ingestion Page](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/test/java/org/openmetadata/catalog/selenium/pages/ingestion/IngestionPageTest.java):
* **openIngestionPage** - Helps to navigate to Ingestion page to other tests.
* **addIngestionService** - Creates/Adds Ingestion service.
* **runIngestionService** - Runs the created ingestion service.
* **editIngestionService** - Edits the config of the created ingestion service.
* **deleteIngestionService** - Deletes the created ingestion service.

### [Dbt Model Details Page](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/test/java/org/openmetadata/catalog/selenium/pages/dbtModelDetails/DbtModelDetailsPageTest.java):
* **openDbtModelPage** - Helps to navigate to Dtb Model page to other tests.
* **editDescription** - Edits description of the model.
* **editColumnDescription** - Edits description of the columns.
* **addColumnTag** - Adds tags to column.
* **removeColumnTag** - Removes tags from column.
* **checkManage** - Checks the manage tab in details page. Assigns the Ownership and tire to the model.

### [Common](https://github.com/open-metadata/OpenMetadata/blob/main/openmetadata-ui/src/test/java/org/openmetadata/catalog/selenium/pages/common/PaginationAndFilterTest.java):
* **checkFlikerInFilter** - Checks for message 'No matching data assets found' while applying filter.
* **noDataPresentWithFilter** - Applies the filter with data and checks if the data is visible
* **dataPresentWithFilter** - Applies the filter with no data and checks for 'No matching data assets found'.