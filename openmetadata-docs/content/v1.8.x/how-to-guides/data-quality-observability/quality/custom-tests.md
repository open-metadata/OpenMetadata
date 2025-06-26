---
title: Custom Tests | OpenMetadata Quality Testing Guide
slug: /how-to-guides/data-quality-observability/quality/custom-tests
---

# Adding Custom Tests
While OpenMetadata provides out of the box tests, you may want to write your test results from your own custom quality test suite or define your own data quality tests to be ran inside OpenMetadata.  This is very easy to do using the API and our Python SDK.

### Step 1: Creating a `TestDefinition`
First, you'll need to create a Test Definition for your test. You can use the following endpoint `/api/v1/dataQuality/testDefinition` using a POST protocol to create your Test Definition. You will need to pass the following data in the body your request at minimum.

```json
{
    "description": "<you test definition description>",
    "entityType": "<TABLE or COLUMN>",
    "name": "<your_test_name>",
    "testPlatforms": ["<any of OpenMetadata,GreatExpectations, dbt, Deequ, Soda, Other>"],
    "parameterDefinition": [
      {
        "name": "<name>"
      },
      {
        "name": "<name>"
      }
    ]
}
```

Here is a complete CURL request

```bash
curl --request POST 'http://localhost:8585/api/v1/dataQuality/testDefinitions' \
--header 'Content-Type: application/json' \
--data-raw '{
    "description": "A demo custom test",
    "entityType": "TABLE",
    "name": "demo_test_definition",
    "testPlatforms": ["Soda", "dbt"],
    "parameterDefinition": [{
        "name": "ColumnOne"
    }]
}'
```

Make sure to keep the `UUID` from the response as you will need it to create the Test Case.

**Important:** If you want to have the test definition available through OpenMetadata UI, `testPlatforms` need to include `OpenMetadata`. It will also require extra work that we'll cover below in Step 5. If you are just looking to create new test definition executable through OpenMetadata UI, you can skip ahead to Step 5.

### Step 2: Creating a `TestSuite`
You'll also need to create a Test Suite for your Test Case -- note that you can also use an existing one if you want to. You can use the following endpoint `/api/v1/dataQuality/testSuites/executable` using a POST protocol to create your Test Definition. You will need to pass the following data in the body your request at minimum.

```json
{
  "name": "<test_suite_name>",
  "description": "<test suite description>",
  "executableEntityReference": "<entityFQN>"
}
```

Here is a complete CURL request

```bash
curl --request POST 'http://localhost:8585/api/v1/dataQuality/testSuites/executable' \
--header 'Content-Type: application/json' \
--data-raw '{
  "name": "<test_suite_name>",
  "description": "<test suite description>",
  "executableEntityReference": "<entityFQN>"
}'
```

Make sure to keep the `UUID` from the response as you will need it to create the Test Case.


### Step 3: Creating a `TestCase`
Once you have your Test Definition created you can create a Test Case -- which is a specification of your Test Definition. You can use the following endpoint `/api/v1/dataQuality/testCases` using a POST protocol to create your Test Case. You will need to pass the following data in the body your request at minimum.

```json
{
    "entityLink": "<#E::table::fqn> or <#E::table::fqn::columns::column name>",
    "name": "<test_case_name>",
    "testDefinition": {
        "FQN": "<test definition FQN>",
        "type": "testDefinition"
    },
    "testSuite": {
        "FQN": "<test suite FQN>",
        "type": "testSuite"
    }
}
```
**Important:** for `entityLink` make sure to include the starting and ending `<>`

Here is a complete CURL request

```bash
curl --request POST 'http://localhost:8585/api/v1/dataQuality/testCases' \
--header 'Content-Type: application/json' \
--data-raw '{
    "entityLink": "<#E::table::local_redshift.dev.dbt_jaffle.customers>",
    "name": "custom_test_Case",
    "testDefinition": {
        "id": "1f3ce6f5-67be-45db-8314-2ee42d73239f",
        "type": "testDefinition"
    },
    "testSuite": {
        "id": "3192ed9b-5907-475d-a623-1b3a1ef4a2f6",
        "type": "testSuite"
    },
    "parameterValues": [
        {
            "name": "colName",
            "value": 10
        }
    ]
}'
```

Make sure to keep the `UUID` from the response as you will need it to create the Test Case.


### Step 4: Writing `TestCaseResults` (Optional - if not executing test case through OpenMetadata UI)
Once you have your Test Case created you can write your results to it. You can use the following endpoint `/api/v1/dataQuality/testCases/{test FQN}/testCaseResult` using a PUT protocol to add Test Case Results. You will need to pass the following data in the body your request at minimum.

```json
{
    "result": "<result message>",
    "testCaseStatus": "<Success or Failed or Aborted>",
    "timestamp": <Unix timestamp in milliseconds>,
    "testResultValue": [
      {
        "value": "<value>"
      }
    ]
}
```

Here is a complete CURL request

```bash
curl --location --request PUT 'http://localhost:8585/api/v1/dataQuality/testCases/local_redshift.dev.dbt_jaffle.customers.custom_test_Case/testCaseResult' \
--header 'Content-Type: application/json' \
--data-raw '{
    "result": "found 1 values expected n",
    "testCaseStatus": "Success",
    "timestamp": 1662129151000,
    "testResultValue": [{
        "value": "10"
    }]
}'
```

You will now be able to see your test in the Test Suite or the table entity.

### Step 5: Making Custom Test Case Available Through OpenMetadata UI (Optional)
OpenMetadata offers the flexibility to user to create custom test cases that will be executable through the user interface. To accomplish our goal, we'll be leveraging OpenMetadata namespace `data_quality` submodule .

#### A. Create Your Namespace Package
The first in creating your own  executable test case is to create a package where you'll be writing   the logic to process the tests. Your package should have a minimum the below structure

```
metadata/
setup.py
```

To add table and column level test cases to SQLAlchemy sources you will place your test respectively in:
- `metadata/data_quality/validations/table/sqlalchemy/<yourTest>.py`
- `metadata/data_quality/validations/column/sqlalchemy/<yourTest>.py`

`<yourTest>` should match the name of your test definition in Step 1.

**Important:** You will need to add an `__init__.py` file in every folder and these `__init__.py` should have the below line

```python
__path__ = __import__('pkgutil').extend_path(__path__, __name__)
```

#### B. Create your Test Class
Once you have created the different, you can add the logic in your `<yourTest>.py` file. You will need to create a class named `<YourTest>Validator` that will inherit from `BaseTestValidator`. If you need to, you can also inherit from `SQAValidatorMixin` -- this will give you access to additional methods out of the box. Once completed, you will simply need to implement the `run_validation` class. This method should return a `TestCaseResult` object. You can find a full implementation [here](https://github.com/open-metadata/openmetadata-demo/tree/main/custom-om-test) where we create an entropy test.


```python
class ColumnEntropyToBeBetweenValidator(BaseTestValidator):
    """Implements custom test validator for OpenMetadata.

    Args:
        BaseTestValidator (_type_): inherits from BaseTestValidator
    """

    def run_validation(self) -> TestCaseResult:
      """Run test validation"""
```

#### C. `pip` Install Your Package
Once you have completed A) and B) you should only need to `pip install` your package in the environment where openmetadata python SDK is install.

{% image
  src="/images/v1.8/features/ingestion/workflows/data-quality/custom-test-definition.png"
  alt="Create test case"
  caption="Create test case"
 /%}

 {% image
  src="/images/v1.8/features/ingestion/workflows/data-quality/custom-test-result.png"
  alt="Create test case"
  caption="Create test case"
 /%}