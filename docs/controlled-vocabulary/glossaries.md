# Glossaries

A glossary is a controlled vocabulary to describe important concepts within your organization. A glossary helps to establish consistent meaning for terms and establish a common understanding and to build a knowledge base.

Glossary terms can also help to organize or discover data entities. OpenMetadata models a Glossary as a Thesauri, a Controlled Vocabulary that organizes terms with hierarchical, equivalent, and associative relationships.

Glossaries are a collection of hierarchy of Glossary Terms that belong to a domain.

* A glossary term is specified with a preferred term for a concept or a terminology, example — **Customer**.
* A glossary term must have a unique and clear definition to establish consistent usage and understanding of the term.
* A term can include **Synonyms,** other terms used for the same concept, example — **Client**, **Shopper**, **Purchaser**, etc.
* A term can have children terms that further specialize a term. Example, a glossary term **Customer**, can have children terms — **Loyal Customer**, **New Customer**, **Online Customer**, etc.
* A term can also have **Related Terms** to capture related concepts. For **Customer**, related terms could be **Customer LTV (LifeTime Value)**, **Customer Acquisition Cost**, etc.

A glossary term lists **Assets** through which you can discover all the data assets related to the term. Each term has a **life cycle** **status** (e.g., Draft, Active, Deprecated, and Deleted). A term also has a set of **Reviewers** who review and accept the changes to the Glossary for Governance.

The terms from the glossary can be used for labeling or tagging as additional metadata of data assets for describing and categorizing things. Glossaries are important for data discovery, retrieval, and exploration through conceptual terms and help in data governance.

![](../.gitbook/assets/glossary.gif)
