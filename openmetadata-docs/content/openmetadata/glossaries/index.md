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

## Glossary Bulk upload

With glossary bulk upload you can create/update multiple glossary terms simultaneously. Below are steps for the same.

- Create glossary in which you want to upload glossary terms `csvEg. Business Glossary`.
- Click on 3 dots and click on export button (if you have terms already you will get CSV file containing all the terms, if you don't have any terms you will get blank CSV template).
- Once you have template, you can fill below term details.
  1. **parent**: If you leave this field blank, Term will be create at root level, If you want to create hierarchy of Glossary Terms, parent details must be needed as per hierarchy (from glossary level) `csvEg. Business Glossary.Department.Sales`
  2. **name\***: It contains name of the glossary term and it is required field.
  3. **displayName**: It contains Display name of the glossary term.
  4. **description\***: It contains description/details of the glossary term and it is required field.
  5. **synonyms**: A word or phrase that has the same meaning as glossary term. `csvEg. "Cash in hand";Purchase;"one's"`
  6. **relatedTerms**: A term which has same meaning as glossary term, and available in Open Metadata. `csvEg. "Cash in hand";Purchase;"one's"`
  7. **references**: External resource for the glossary term. `csvEg. Ref1;https:Ref1Link.com;Ref2;https:Ref2Link.com`
  8. **tags**: Add Tags from Open Metadata `csvEg. PersonalData.Personal;PII.Sensitive`
- Once csv is ready, click on 3 dots and Import button.
- Drag and drop the CSV file or upload by clicking on browse button.
- Once it is successfully uploaded, you will get preview option. click on preview
- You will get preview of uploaded terms, all the glossary term will be scan and success/failure will be provided.
- If all or partial terms are able to create successfully, Import button will be visible, click on the same it will create glossary terms from CSV file in Open Metadata.

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
