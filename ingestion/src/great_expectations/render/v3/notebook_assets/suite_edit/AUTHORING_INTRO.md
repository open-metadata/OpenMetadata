## Create & Edit Expectations

{% if batch_request %}
Add expectations by calling specific expectation methods on the `validator` object. They all begin with `.expect_` which makes autocompleting easy using tab.

Because you selected interactive mode, you are now creating or editing an Expectation Suite with validator feedback from the sample batch of data that you specified (see `batch_request`).

Note that if you select manual mode you may still create or edit an Expectation Suite directly, without feedback from the `validator`. See our documentation for more info and examples: [How to create a new Expectation Suite without a sample batch](https://docs.greatexpectations.io/en/latest/guides/how_to_guides/creating_and_editing_expectations/how_to_create_a_new_expectation_suite_without_a_sample_batch.html).

{% else %}
You are adding Expectation configurations to the suite. Since you selected manual mode, there is no sample batch of data and no validation happens during this process. See our documentation for more info and examples: **[How to create a new Expectation Suite without a sample batch](https://docs.greatexpectations.io/en/latest/guides/how_to_guides/creating_and_editing_expectations/how_to_create_a_new_expectation_suite_without_a_sample_batch.html)**.

Note that if you do use interactive mode you may specify a sample batch of data to use when creating your Expectation Suite. You can then use a `validator` to get immediate feedback on your Expectations against your specified sample batch.
{% endif %}

You can see all the available expectations in the **[expectation glossary](https://docs.greatexpectations.io/en/latest/reference/glossary_of_expectations.html?utm_source=notebook&utm_medium=create_expectations)**.
