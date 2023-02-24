---
title: Glossaries
slug: /openmetadata/glossaries
---

# Glossaries

A glossary is a controlled vocabulary to describe important concepts within your organization. A glossary helps to establish consistent meaning for terms and establish a common understanding and to build a knowledge base.

Glossary terms can also help to organize or discover data entities. OpenMetadata models a Glossary as a Thesauri, a Controlled Vocabulary that organizes terms with hierarchical, equivalent, and associative relationships.

Glossaries are a collection of hierarchy of Glossary Terms that belong to a domain.

- A glossary term is specified with a preferred term for a concept or a terminology, example — Customer.
- A glossary term must have a unique and clear definition to establish consistent usage and understanding of the term.
- A term can include **Synonyms**, other terms used for the same concept, example — **Client**, **Shopper**, **Purchaser**, etc.
- A term can have children terms that further specialize a term. Example, a glossary term **Customer**, can have children terms — **Loyal Customer**, **New Customer**, **Online Customer**, etc.
- A term can also have **Related Terms** to capture related concepts. For Customer, related terms could be **Customer LTV (LifeTime Value)**, **Customer Acquisition Cost**, etc.

A glossary term lists **Assets** through which you can discover all the data assets related to the term. Each term has a **life cycle status** (e.g., Draft, Active, Deprecated, and Deleted). A term also has a set of **Reviewers** who review and accept the changes to the Glossary for Governance.

The terms from the glossary can be used for labeling or tagging as additional metadata of data assets for describing and categorizing things. Glossaries are important for data discovery, retrieval, and exploration through conceptual terms and help in data governance.

<Image
src={"/images/openmetadata/glossaries/glossaries.gif"}
alt="Glossary page demo"
/>

## Glossary Bulk Upload

With glossary bulk upload, you can create/update multiple glossary terms simultaneously. Below are steps for the same.

- Create a glossary in which you want to upload glossary terms `csv Eg. Business Glossary`.
- Click on the 3 dots icon and click on the Export button. If you have glossary terms in your Glossary, the same will be exported as a CSV file. If there are no terms in the Glossary, then a blank CSV template will be downloaded.
- Once you have the template, you can fill in the following details:
  1. **parent**: If you leave this field blank, the Term will be created at the root level. If you want to create a hierarchy of Glossary Terms, the parent details must be entered as per hierarchy (from the glossary level) `csv Eg. Business Glossary.Department.Sales`
  2. **name\***: This contains the name of the glossary term, and is a required field.
  3. **displayName**: This contains the Display name of the glossary term.
  4. **description\***: This contains the description/details of the glossary term and is a required field.
  5. **synonyms**: Include words that have the same meaning as the glossary term. `csv Eg. "Cash in hand";Purchase;"one's"`
  6. **relatedTerms**: A term which has the same meaning as the glossary term, and is available in OpenMetadata. `csv Eg. "Cash in hand";Purchase;"one's"`
  7. **references**: Include an external resource for the glossary term. `csv Eg. Ref1;https:Ref1Link.com;Ref2;https:Ref2Link.com`
  8. **tags**: Add Tags from OpenMetadata `csv Eg. PersonalData.Personal;PII.Sensitive`
- Once the CSV file is ready, click on the 3 dots icon and select the Import button.
- Drag and drop the CSV file, or upload it by clicking on the Browse button.
- Once the file is successfully uploaded, you will get an option to Preview.
- After previewing the uploaded terms, the glossary terms will be scanned and a Success/Failure message will be provided.
- Once a part of the terms or all terms are created successfully, the Import button will be displayed. Click on Import to create the glossary terms from the CSV file in OpenMetadata.

#### Glossary Export

<Image
src={"/images/openmetadata/glossaries/export.gif"}
alt="Glossary export demo"
/>

#### Glossary Import

<Image
src={"/images/openmetadata/glossaries/import.gif"}
alt="Glossary import demo"
/>
