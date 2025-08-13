---
title: Customizable Landing Page with Pluggable Panels
slug: /how-to-guides/admin-guide/persona-landing-page-customization/customizable-landing-page
---

# Customizable Landing Page with Pluggable Panels

OpenMetadata's customizable landing page allows admins to tailor the layout based on the user's persona, providing a more relevant and enriched experience. The landing page is built using **pluggable panels**, which can be added, removed, or rearranged to meet the unique needs of different personas, such as **data scientists**, **data engineers**, or **data stewards**.

## How to Customize a Landing Page:

1. **Set Up Personas**:  
   After defining personas, navigate to **Settings > Preferences > Customize Landing Page**.

{% image
src="/images/v1.10/how-to-guides/admin-guide/landing-1.png"
alt="Set Up Personas"
caption="Set Up Personas"
/%}

{% image
src="/images/v1.10/how-to-guides/admin-guide/landing-2.png"
alt="Customize Landing Page"
caption="Customize Landing Page"
/%}

2. **Select a Persona**:  
   Customize a landing page for a specific persona (e.g., data consumer) by adding, removing, or rearranging panels.

{% image
src="/images/v1.10/how-to-guides/admin-guide/landing-3.png"
alt="Select a Persona"
caption="Select a Persona"
/%}

3. **Pluggable Panels**:  
   Configure panels based on the needs of each persona by adding widgets as required. Panels can include:
   - Activity Feed
   - Key Performance Indicators (KPIs)
   - Recent Announcements
   - Tasks
   - Recently Viewed and more

{% image
src="/images/v1.10/how-to-guides/admin-guide/landing-4.png"
alt="Pluggable Panels"
caption="Pluggable Panels"
/%}

4. **Rearrange and Save**:  
   Adjust the layout based on user preferences and save the configuration.

{% image
src="/images/v1.10/how-to-guides/admin-guide/landing-5.png"
alt="Rearrange and Save"
caption="Rearrange and Save"
/%}

### Example Use Case:

For a **data scientist**, the KPI panel may be removed, while prioritizing recent announcements and recent views.  
A **data engineer** might add a Pipeline Status panel, while a **data steward** might include panels focused on data governance.

### Future Enhancements:
Additional panels, such as **Data Quality Status** or **Knowledge Articles**, can be added to further personalize and enhance the user experience. By leveraging pluggable panels, the customizable landing page can be tailored to enrich each user's experience, making the platform more relevant and effective for different personas.

## Switching Between Personas

Users can switch between different personas without logging out or reconfiguring the platform. Upon switching, the application’s landing page and configuration adjust automatically to reflect the new role.

### Setting a Default Persona:
Users can set a **default persona**, so the system displays the layout and settings relevant to that role every time they log in.

## Use Case Examples:

### 1. Data Engineer
- **Needs**: Data pipeline monitoring, data quality, and task management.
- **Customized Landing Page**: Includes panels for pipeline status, data quality metrics, and recent tasks related to pipeline execution. Announcements and Insights KPIs might be deprioritized.
- **Persona-Specific Panels**: Add a Pipeline Status panel for real-time updates on data workflows.

### 2. Data Steward
- **Needs**: Access to recent data views, performance indicators, and analysis tools.
- **Customized Landing Page**: Prioritizes recent data views and KPI dashboards, while removing unnecessary panels such as pipeline status.
- **Persona-Specific Panels**: Data stewards might add panels related to KPIs or recently viewed data assets.

## Future Customizations:

OpenMetadata plans to expand persona-based customization beyond landing pages to **entity pages** as well. For example:

### 1. Entity Pages Customization:
Users can add panels that display specific metadata, such as **product-related knowledge articles** or **glossary terms** associated with an entity.

### 2. Knowledge Panel Expansion:
Additional panels like **Product Knowledge Articles** or **Service Status** will allow deeper insights based on the user’s role.
