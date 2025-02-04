---
title: Custom Data Insight Dashboards
slug: /how-to-guides/data-insights/custom-dashboard
collate: true
---

# Custom Data Insight Dashboards

The default Data Insight charts in OpenMetadata focus on description, ownership, and tiering. However, documentation needs often vary across organizations. To address this, OpenMetadata now supports the creation of custom Data Insight dashboards and charts. This documentation will guide you through the process of creating these custom dashboards and charts within your OpenMetadata instance, empowering you to tailor insights to your organization's unique documentation goals for enhanced data governance.


## Step 1: Create a Dashboard

Navigate to the `Insights` page from the side menu of application and click on `Create Dashboard` button from top left, provide the name, description and owner of the dashboard and finally click on `Create` button to save the dashboard.

{% image
    src="/images/v1.7/features/data-insight/custom-dashboard/navigate-to-insights.png"
    alt="Navigate to Insights"
    caption="Navigate to Insights"
 /%}


 {% image
    src="/images/v1.7/features/data-insight/custom-dashboard/add-dashboard.png"
    alt="Click on Add Dashboard"
    caption="Click on Add Dashboard"
 /%}

{% image
    src="/images/v1.7/features/data-insight/custom-dashboard/create-custom-dashboard-form.png"
    alt="Fill Create Custom Dashboard Form"
    caption="Fill Create Custom Dashboard Form"
 /%}


## Step 2: Create a Chart

Once you create a dashboard, you can click on `Create Chart` button to add a new chart to this dashboard

{% image
    src="/images/v1.7/features/data-insight/custom-dashboard/create-chart.png"
    alt="Create Chart"
    caption="Create Chart"
 /%}

Now you will see a create chart form with a preview of the chart based on the configuration provided in the form. This preview will be a plot of data from previous 7 days. By default it shows the number/count of records of data available to compute. This number or record represent the total number of `Table`, `Stored Procedure`, `Database Schema`, `Database`, `Chart`, `Dashboard`, `Dashboard Data Model`, `Pipeline`, `Topic`, `Container`, `Search Index`, `ML Model`, `Data Product`, `Glossary Term` & `Tag` available within your OpenMetadata Instance.

{% image
    src="/images/v1.7/features/data-insight/custom-dashboard/create-chart-form-1.png"
    alt="Create Chart Form Part 1"
    caption="Create Chart Form Part 1"
 /%}

 {% image
    src="/images/v1.7/features/data-insight/custom-dashboard/create-chart-form-2.png"
    alt="Create Chart Form Part 2"
    caption="Create Chart Form Part 2"
 /%}

You can customize the default settings to create the desired chart, to do that lets understand what are the available fields and how to customize it.


- **Name**: Provide a relevant name to the chart that we are about to create.
- **Chart Type**: You can create a `Line`, `Area`, `Bar` chart and a `Summary Card` which is a special chart/card to represent a single value.
- **Description**: Provide a details description to this chart so that it is easier to understand the output of the chart.
- **GroupBy**: Group by field is used to breakdown the results by a specific field, for example choose 
`entityType` to breakdown the results by entity type.
- **Y Axis Label**: Provide a custom label to y-axis.
- **Advanced Filters**: Filter down results by applying advanced filters, the experience of advanced filters is similar to the experience of explore page.
- **Method**: We support computation of chart based on 2 methods `Function` & `Formula`.


### Chart By Function:

- **Function**: In this method you can choose the function from the dropdown menu of functions, the supported functions are `Count`, `Sum`, `Avg`, `Max` & `Min`.
**Note**: The functions `Sum`, `Avg`, `Max` & `Min` are only supported with field of numerical type, if you attempt to apply this function on any non numerical field then you will not see any output.

- **Field**: Select the filed from the given dropdown of list on which you want to apply the function, for example if you select function as `Count` and field as `id` which is also the default selected option, then it will give you the count of records as described above. If you select function as `Avg` and field as `size` then it will give you avg size of all the containers ingested in OpenMetadata, because only container entities has `size` as a field.

### Chart By Formula:

- **Formula**: In case you want to write a custom logic to plot chart then chart by formula is the way to go. With formula you can write a complex mathematical expression including functions, fields and filters and the final result of this expression will get plotted on the chart.


{% image
    src="/images/v1.7/features/data-insight/custom-dashboard/formula-breakdown.png"
    alt="Formula Breakdown"
    caption="Formula Breakdown"
 /%}

A formula contains 3 element.

**Function**: The supported functions are `count`, `sum`, `avg`, `min` & `max`, and as explained above The functions `Sum`, `Avg`, `Max` & `Min` are only supported with field of numerical type, if you attempt to apply this function on any non numerical field then you will not see any output.

**Key/Field**: To define a key within a formula, use the format `k='<field-name>'`. The `k=` part indicates that you're specifying a key field, and the field name goes inside single quotes.

You can choose the field name from the fields dropdown from the chart by function method. For example, if you want to use the `Owner Name` field, you would write `k='owner.name'` in the formula. If you want to use `Owner DisplayName` you would write `k='owner.displayName'`.

Remember, spaces in field names are replaced with a period (.), and the key should be in lower camel case (meaning the first word is lowercase, and each subsequent word starts with an uppercase letter).

**Query**: The query is to filter down the result to plot, use the format `q='<filed-name>: <value>'`. The `q=` part signifies a query, adn the condition goes inside the single quotes.

The value can be a literal value or it can be `*` to signify that any value exists for the give field.

**Examples**:

```
// count of records
count()

// count of records where owner exists 
count(q='owner: *')

// count of records where owner exists and tier Tier1 is applied
count(q='owner: * AND tier: "Tier.Tier1"')

// count of records where owner is admin and tier Tier1 is applied
count(q='owner: "admin" AND tier: "Tier.Tier1"')

// count of records where owner is admin and tier Tier1 is applied
count(q='owner: "admin" AND tier: "Tier.Tier1"')

// count of tables where owner is admin and tier Tier1 is applied
count(q='owner: "admin" AND tier: "Tier.Tier1" AND entityType: "table"')

// count of tables where owner is admin and any tier except "NoTier" (which is used to signify that no tier is applied)
count(q='owner: "admin" AND NOT(tier: "NoTier") AND entityType: "table"')

// Percentage of tables having complete description, hasDescription is special field which is set to 1 when description is complete
(count(q='entityType: "table" and hasDescription: 1')/count())*100

// Avg size of containers
avg(k='size',q='entityType: "container"')

// Max size of containers
max(k='size',q='entityType: "container"')
```


## Step 3: Save the Chart and Layout

Once you have configured your chart correctly, click on the save button to save the chart and add it to dashboard.

{% image
    src="/images/v1.7/features/data-insight/custom-dashboard/create-chart-form-preview.png"
    alt="Create Chart Final Preview"
    caption="Create Chart Final Preview"
 /%}


You can add multiple charts to a dashboard and rearrange the layout within a dashboard.

{% image
    src="/images/v1.7/features/data-insight/custom-dashboard/save-and-rearrange-chart.png"
    alt="Save and Rearrange Chart"
    caption="Save and Rearrange Chart"
 /%}
