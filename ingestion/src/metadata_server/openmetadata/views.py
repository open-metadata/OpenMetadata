import json
import logging

from django.shortcuts import render

logger: logging.Logger = logging.getLogger(__name__)

with open("/tmp/datasets.json", "r") as d:
    data = json.load(d)
    datasets = []
    for dataset in data:
        if "table" in dataset:
            datasets.append(dataset["table"])
        elif "dashboard" in dataset:
            datasets.append(dataset["dashboard"])
        elif "topic" in dataset:
            datasets.append(dataset["topic"])
        else:
            logger.info("unrecognized element {}".format(dataset))


def list_page(request):
    template_name = "list.html"
    return render(request, template_name, {"datasets": datasets})


def detail_page(request, fqn):
    template_name = "dataset.html"
    dataset = list(filter(lambda data: data["fullyQualifiedName"] == fqn, datasets))
    if len(dataset) > 0:
        return render(request, template_name, {"dataset": dataset[0]})
    else:
        return render(request, template_name, {"error": "No Data Found"})


def page_not_found_view(request, exception):
    return render(request, "404.html", status=404)
