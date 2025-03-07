---
title: Governance Workflows - Dashboard Certification Workflow (Default)
slug: /how-to-guides/data-governance/workflows/default-workflows/dashboard-certification
collate: true
---

# Governance Workflows - Dashboard Certification Workflow (Default)

The **Dashboard Certification Workflow** is a periodic batch workflow designed to automatically manage the certification process for dashboards within Collate.
It is triggered periodically based on the configured scheduled, it fetches the assets based on the filters and it certifies dashboards based on their attributes.

{% image src="/images/v1.6/how-to-guides/governance/workflows-table-certification.png" alt="dashboard-certification" /%}

## Workflow Elements

- **Owners and Description are not Null nor Empty**
This task checks where the dashboard has an owner and a description

If either attribute is missing or empty, the workflow moves to **Don't set certification**.
Otherwise, the workflow moves to **Entity is Tier 1 or Tier 2**.

- **Entity is Tier 1 or Tier 2**
This task checks if the dashboard is categorized under *Tier 1* or *Tier 2*.

If the dashboard is either *Tier 1* or *Tier 2*, the workflow moves to **Entity is Tier 1**.
Otherwise, the workflow moves to **Set Bronze Certification**.

- **Entity is Tier 1**
This task checks if the dashboard is specifically *Tier 1*.

If the dashboard is *Tier 1*, the workflow moves to **Set Gold Certification**.
Otherwise, the workflow moves to **Set Silver Certification**.

- **Set No Certification**
Sets the dashboard certification to *None*.

- **Set Bronze Certification**
Sets the dashboard certification to *Bronze*.

- **Set Silver Certification**
Sets the dashboard certification to *Silver*.

- **Set Gold Certification**
Sets the dashboard certification to *Gold*.
