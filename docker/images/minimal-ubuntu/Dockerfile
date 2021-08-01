# Dockerfile - minimal-ubuntu
# usage: docker build -t minimal-ubuntu:0.1 .

FROM ubuntu:16.04

# environment variables
ENV DEBIAN_FRONTEND noninteractive

# update
RUN apt update -y && \
    # editor
    apt install -y vim nano && \
    # general
    apt install -y man sudo sshpass less jq ntp bc && \
    # network commands
    apt install -y net-tools iputils-ping dnsutils lsof curl wget telnet

# python
RUN apt install -y python-dev && \
    curl "https://bootstrap.pypa.io/get-pip.py" -o /tmp/get-pip.py && \
    python /tmp/get-pip.py

# java
RUN apt install -y openjdk-8-jdk
# maven
#RUN apt install -y maven=3.3.9-3

# supervisord
RUN pip install supervisor==3.3.3 && \
    mkdir -p /var/log/supervisord/

# converts the dash to bash terminal for easy scripting
RUN update-alternatives --install /bin/sh sh /bin/bash 100 && \
    update-alternatives --install /bin/sh sh /bin/dash 200 && \
    echo 1 | update-alternatives --config sh