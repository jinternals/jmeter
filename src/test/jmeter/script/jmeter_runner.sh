#!/usr/bin/env bash

JMETER_HOME="$1"

TEST_FILE="$2"
RESULT_FILE="$3"
EXPORT_DASHBOARD_HOME="$4"

THREAD_COUNT="$5"
LOOP_COUNT="$6"
RAMPUP_TIME="$7"
HOST="$8"

echo Environment Variables :
echo -------------------------------------------------------------------------------------------------------
echo JMETER_HOME            : $JMETER_HOME
echo TEST_FILE              : $TEST_FILE
echo RESULT_FILE            : $RESULT_FILE
echo EXPORT_DASHBOARD_HOME  : $EXPORT_DASHBOARD_HOME
echo THREAD_COUNT           : $THREAD_COUNT
echo LOOP_COUNT             : $LOOP_COUNT
echo RAMPUP_TIME            : $RAMPUP_TIME
echo HOST                   : $HOST
echo -------------------------------------------------------------------------------------------------------



rm $RESULT_FILE
rm -r $EXPORT_DASHBOARD_HOME
mkdir -p $EXPORT_DASHBOARD_HOME


$JMETER_HOME/bin/jmeter -n -t  $TEST_FILE -l $RESULT_FILE -e -o $EXPORT_DASHBOARD_HOME -JloopCount=$LOOP_COUNT  -JthreadCount=$THREAD_COUNT -JrampUpTime=$RAMPUP_TIME -Jhost=$HOST

