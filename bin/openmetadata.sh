#!/usr/bin/env bash
#  Copyright 2021 Collate
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#  http://www.apache.org/licenses/LICENSE-2.0
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.

# Home Dir
base_dir=$(dirname $0)/..

CATALOG_HOME=$base_dirbase_dir=$(dirname $0)/..

CATALOG_HOME=$base_dir
PID_DIR=$base_dir/logs
LOG_DIR=$base_dir/logs
mkdir -p $LOG_DIR

[ -z $MAX_WAIT_TIME ] && MAX_WAIT_TIME=120

# OpenMetadata env script
. $CATALOG_HOME/conf/openmetadata-env.sh

function catalogStart {
   catalogStatus -q
   if [[ $? -eq 0 ]]; then
       rm -f ${PID_FILE}
       echo "Starting OpenMetadata"
       APP_CLASS="org.openmetadata.service.OpenMetadataApplication"
       cd ${CATALOG_HOME}
       nohup ${JAVA} ${CATALOG_HEAP_OPTS} ${CATALOG_JVM_PERF_OPTS} ${CATALOG_DEBUG_OPTS} ${CATALOG_GC_LOG_OPTS} ${CATALOG_JMX_OPTS} -cp ${CLASSPATH} "${APP_CLASS}" "server" "$@" 2>>"${ERR_FILE}" 1>>"${OUT_FILE}" &
       cd - &> /dev/null
       echo $! > ${PID_FILE}
       echo $(catalogStatus)
   else
       echo "OpenMetadata already running with PID: ${PID}"
   fi
}

function catalogStop {
   catalogStatus -q
   if [[ $? -eq 1 ]]; then
       echo "Stopping OpenMetadata [${PID}] "
       kill -s KILL ${PID} 1>>"${OUT_FILE}" 2>>"${ERR_FILE}"
   else
       echo "OpenMetadata not running"
   fi
}

function catalogStatus {
   local verbose=1
   while true; do
        case ${1} in
            -q) verbose=0; shift;;
            *) break;;
        esac
   done

   getPID
   if [[ $? -eq 1 ]] || [[ ${PID} -eq 0 ]]; then
     [[ "${verbose}" -eq 1 ]] && echo "OpenMetadata not running."
     return 0
   fi

   ps -p ${PID} > /dev/null
   if [[ $? -eq 0 ]]; then
     [[ "${verbose}" -eq 1 ]] && echo "OpenMetadata running with PID=${PID}."
     return 1
   else
     [[ "${verbose}" -eq 1 ]] && echo "OpenMetadata not running."
     return 0
   fi
}

# Removes the PID file if OpenMetadata is not running
function catalogClean {
   catalogStatus -q
   if [[ $? -eq 0 ]]; then
     rm -f ${PID_FILE} ${OUT_FILE} ${ERR_FILE}
     echo "Removed the ${PID_FILE}, ${OUT_FILE} and ${ERR_FILE} files."
   else
     echo "Can't clean files. OpenMetadata running with PID=${PID}."
   fi
}

# Returns 0 if the OpenMetadata is running and sets the $PID variable.
function getPID {
   if [ ! -d $PID_DIR ]; then
      printf "Can't find pid dir.\n"
      exit 1
   fi
   if [ ! -f $PID_FILE ]; then
     PID=0
     return 1
   fi

   PID="$(<$PID_FILE)"
   return 0
}

# Home Dir
base_dir=$(dirname $0)/..
cd $base_dir && base_dir=`pwd` && cd - &> /dev/null

# App name
APP_NAME=catalog

#if CATALOG_DIR is not set its a dev env.
if [ "x$CATALOG_DIR" != "x" ]; then
    CATALOG_HOME=$CATALOG_DIR/$APP_NAME
else
    CATALOG_HOME=$base_dir
    PID_DIR=$CATALOG_HOME/logs
    LOG_DIR=$CATALOG_HOME/logs
    mkdir -p $LOG_DIR
fi

# CATALOG env script
. ${CATALOG_HOME}/conf/openmetadata-env.sh

PID=0

[ -z $PID_DIR ] && PID_DIR="/var/run/$APP_NAME"
[ -z $LOG_DIR ] && LOG_DIR="/var/log/$APP_NAME"

# Name of PID, OUT and ERR files
PID_FILE="${PID_DIR}/${APP_NAME}.pid"
OUT_FILE="${LOG_DIR}/${APP_NAME}.log"
ERR_FILE="${LOG_DIR}/${APP_NAME}.err"

CLASSPATH=${CLASSPATH}:/etc/catalog/conf

# classpath addition for release
for file in ${CATALOG_HOME}/libs/*.jar;
do
    CLASSPATH=${CLASSPATH}:${file}
done

# Which java to use
if [[ -z "${JAVA_HOME}" ]]; then
  JAVA="java"
else
  JAVA="${JAVA_HOME}/bin/java"
fi

if [[ "x${CATALOG_HEAP_OPTS}" = "x" ]]; then
    export CATALOG_HEAP_OPTS="-Xmx2G -Xms2G"
fi

# JVM performance options
if [[ -z "${CATALOG_JVM_PERF_OPTS}" ]]; then
  CATALOG_JVM_PERF_OPTS="-server -XX:+UseG1GC -XX:MaxGCPauseMillis=20 -XX:InitiatingHeapOccupancyPercent=35 -XX:+ExplicitGCInvokesConcurrent -Djava.awt.headless=true"
fi


# JMX settings
if [ -z "$CATALOG_JMX_OPTS" ]; then
  CATALOG_JMX_OPTS="-Dcom.sun.management.jmxremote -Dcom.sun.management.jmxremote.authenticate=false  -Dcom.sun.management.jmxremote.ssl=false "
fi

# JMX port to use
if [  $JMX_PORT ]; then
  CATALOG_JMX_OPTS="$CATALOG_JMX_OPTS -Dcom.sun.management.jmxremote.port=$JMX_PORT "
fi

# GC options
GC_LOG_FILE_NAME='CATALOG-gc.log'
if [ -z "$CATALOG_GC_LOG_OPTS" ]; then
  JAVA_MAJOR_VERSION=$($JAVA -version 2>&1 | sed -E -n 's/.* version "([0-9]*).*$/\1/p')
  if [[ "$JAVA_MAJOR_VERSION" -ge "9" ]] ; then
    CATALOG_GC_LOG_OPTS="-Xlog:gc*:file=$LOG_DIR/$GC_LOG_FILE_NAME:time,tags:filecount=10,filesize=102400"
  else
    CATALOG_GC_LOG_OPTS="-Xloggc:$LOG_DIR/$GC_LOG_FILE_NAME -verbose:gc -XX:+PrintGCDetails -XX:+PrintGCDateStamps -XX:+PrintGCTimeStamps -XX:+UseGCLogFileRotation -XX:NumberOfGCLogFiles=10 -XX:GCLogFileSize=100M"
  fi
fi

option="$1"
shift
case "${option}" in
  start)
     conf="$CATALOG_HOME/conf/openmetadata.yaml"
     if [[ $# -eq 1 ]]; then conf="${1}"; fi
     catalogStart "${conf}"
     ;;
  stop)
     catalogStop
     ;;
  status)
     catalogStatus
     ;;
  clean)
     catalogClean
     ;;
  *)
     echo "Usage: $0 {start|stop|status|clean}"
     ;;
esac
