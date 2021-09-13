from great_expectations import DataContext

GREETING = r"""<cyan>
  ___              _     ___                  _        _   _
 / __|_ _ ___ __ _| |_  | __|_ ___ __  ___ __| |_ __ _| |_(_)___ _ _  ___
| (_ | '_/ -_) _` |  _| | _|\ \ / '_ \/ -_) _|  _/ _` |  _| / _ \ ' \(_-<
 \___|_| \___\__,_|\__| |___/_\_\ .__/\___\__|\__\__,_|\__|_\___/_||_/__/
                                |_|
             ~ Always know what to expect from your data ~
</cyan>"""

LETS_BEGIN_PROMPT = """Let's create a new Data Context to hold your project configuration.

Great Expectations will create a new directory with the following structure:

    great_expectations
    |-- great_expectations.yml
    |-- expectations
    |-- checkpoints
    |-- notebooks
    |-- plugins
    |-- .gitignore
    |-- uncommitted
        |-- config_variables.yml
        |-- data_docs
        |-- validations

OK to proceed?"""

PROJECT_IS_COMPLETE = "This looks like an existing project that <green>appears complete!</green> You are <green>ready to roll.</green>\n"

RUN_INIT_AGAIN = (
    "OK. You must run <green>great_expectations init</green> to fix the missing files!"
)

COMPLETE_ONBOARDING_PROMPT = """
It looks like you have a partially initialized Great Expectations project. Would you like to fix this automatically by adding the following missing files (existing files will not be modified)?

   great_expectations
    |-- notebooks
    |-- plugins
    |-- uncommitted
"""

ONBOARDING_COMPLETE = """
Great Expectations added some missing files required to run.
  - You may see new files in `<yellow>great_expectations/uncommitted</yellow>`.
  - You may need to add secrets to `<yellow>great_expectations/uncommitted/config_variables.yml</yellow>` to finish onboarding.
"""

READY_FOR_CUSTOMIZATION = """<cyan>Congratulations! You are now ready to customize your Great Expectations configuration.</cyan>"""

HOW_TO_CUSTOMIZE = f"""\n<cyan>You can customize your configuration in many ways. Here are some examples:</cyan>

  <cyan>Use the CLI to:</cyan>
    - Run `<green>great_expectations --v3-api datasource new</green>` to connect to your data.
    - Run `<green>great_expectations --v3-api checkpoint new <checkpoint_name></green>` to bundle data with Expectation Suite(s) in a Checkpoint for later re-validation.
    - Run `<green>great_expectations --v3-api suite --help</green>` to create, edit, list, profile Expectation Suites.
    - Run `<green>great_expectations --v3-api docs --help</green>` to build and manage Data Docs sites.

  <cyan>Edit your configuration in {DataContext.GE_YML} to:</cyan>
    - Move Stores to the cloud
    - Add Slack notifications, PagerDuty alerts, etc.
    - Customize your Data Docs

<cyan>Please see our documentation for more configuration options!</cyan>
"""

SECTION_SEPARATOR = "\n================================================================================\n"
