FROM jenkins


MAINTAINER Mradul Pandey <mradul.pandey@ingenta.com>

COPY plugins.txt /usr/share/jenkins/plugins.txt
COPY executors.groovy /usr/share/jenkins/ref/init.groovy.d/executors.groovy


USER root
RUN mkdir /var/log/jenkins
RUN chown -R jenkins:jenkins /var/log/jenkins
USER jenkins

ENV JAVA_OPTS="-Xmx8192m"
ENV JENKINS_OPTS="--logfile=/var/log/jenkins/jenkins.log"

RUN /usr/local/bin/plugins.sh /usr/share/jenkins/plugins.txt

USER root
# env
ENV JMETER_VERSION 3.0
ENV JMETER_PATH /var/jmeter
ENV JMETER_HOME /var/jmeter/apache-jmeter-$JMETER_VERSION/

# Install unzip
RUN apt-get install -y --force-yes unzip

RUN mkdir -p $JMETER_PATH
WORKDIR $JMETER_PATH
RUN wget http://www.eu.apache.org/dist//jmeter/binaries/apache-jmeter-$JMETER_VERSION.tgz
RUN tar -zxf apache-jmeter-$JMETER_VERSION.tgz
RUN rm apache-jmeter-$JMETER_VERSION.tgz

RUN rm -rf /var/lib/apt/lists/*

COPY user.properties /var/jmeter/apache-jmeter-$JMETER_VERSION/bin/
