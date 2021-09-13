import re
import sys

from termcolor import colored


def cli_message(string):
    print(cli_colorize_string(string))


def cli_colorize_string(string):
    # the DOTALL flag means that `.` includes newlines for multiline comments inside these tags
    flags = re.DOTALL
    mod_string = re.sub(
        "<blue>(.*?)</blue>", colored(r"\g<1>", "blue"), string, flags=flags
    )
    mod_string = re.sub(
        "<cyan>(.*?)</cyan>", colored(r"\g<1>", "cyan"), mod_string, flags=flags
    )
    mod_string = re.sub(
        "<green>(.*?)</green>", colored(r"\g<1>", "green"), mod_string, flags=flags
    )
    mod_string = re.sub(
        "<yellow>(.*?)</yellow>", colored(r"\g<1>", "yellow"), mod_string, flags=flags
    )
    mod_string = re.sub(
        "<red>(.*?)</red>", colored(r"\g<1>", "red"), mod_string, flags=flags
    )

    return colored(mod_string)


def display_not_implemented_message_and_exit():
    cli_message(
        "<red>This command is not yet implemented for the v3 (Batch Request) API</red>"
    )
    sys.exit(1)


def cli_message_list(string_list, list_intro_string=None):
    """Simple util function for displaying simple lists in cli"""
    if list_intro_string:
        cli_message(list_intro_string)
    for string in string_list:
        cli_message(string)


def action_list_to_string(action_list):
    """Util function for turning an action list into pretty string"""
    action_list_string = ""
    for idx, action in enumerate(action_list):
        action_list_string += "{} ({})".format(
            action["name"], action["action"]["class_name"]
        )
        if idx == len(action_list) - 1:
            continue
        action_list_string += " => "
    return action_list_string


def cli_message_dict(
    dict_, indent=3, bullet_char="-", message_list=None, recursion_flag=False
):
    """Util function for displaying nested dicts representing ge objects in cli"""
    if message_list is None:
        message_list = []
    if dict_.get("name"):
        name = dict_.pop("name")
        message = "{}<cyan>name:</cyan> {}".format(" " * indent, name)
        message_list.append(message)
    if dict_.get("module_name"):
        module_name = dict_.pop("module_name")
        message = "{}<cyan>module_name:</cyan> {}".format(" " * indent, module_name)
        message_list.append(message)
    if dict_.get("class_name"):
        class_name = dict_.pop("class_name")
        message = "{}<cyan>class_name:</cyan> {}".format(" " * indent, class_name)
        message_list.append(message)
    if dict_.get("action_list"):
        action_list = dict_.pop("action_list")
        action_list_string = action_list_to_string(action_list)
        message = "{}<cyan>action_list:</cyan> {}".format(
            " " * indent, action_list_string
        )
        message_list.append(message)
    sorted_keys = sorted(dict_.keys())
    for key in sorted_keys:
        if key == "password":
            message = "{}<cyan>password:</cyan> ******".format(" " * indent)
            message_list.append(message)
            continue
        if isinstance(dict_[key], dict):
            message = "{}<cyan>{}:</cyan>".format(" " * indent, key)
            message_list.append(message)
            cli_message_dict(
                dict_[key],
                indent=indent + 2,
                message_list=message_list,
                recursion_flag=True,
            )
        else:
            message = "{}<cyan>{}:</cyan> {}".format(" " * indent, key, str(dict_[key]))
            message_list.append(message)
    if not recursion_flag:
        if bullet_char and indent > 1:
            first = message_list[0]
            new_first = first[:1] + bullet_char + first[2:]
            message_list[0] = new_first
        cli_message_list(message_list)
