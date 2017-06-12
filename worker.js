/*jslint node: true */
'use strict';

const WebPageTest = require('webpagetest');
const Util = require('./lib/util');
const Settings = require('./lib/settings');
const util = require('util');

function proxy(fn, that){
	return (err, data) => {
		fn.apply(that, [err, data]);
	};
}

class Worker {
    constructor() {
        this.closeOnFinish = true;
        this.queue = Util.getQueue(Settings.redis_config);
        this.resultObj = {};
        this.mapUrlToTest = {};
        this.resetValues();
        this.bindQueue();
    }

    bindQueue() {
        const that = this;
        if (this.closeOnFinish){
            this.queue.on('job complete', (id, result) => {
                that.resetValues();
                that.queue.inactiveCount( (err, total) => {
                    if (total === 0){
                        console.log('Worker Done');
                        that.testThreshold();
                    }
                });
            });
        }
    }

    resetValues(data) {
        this.resultStatusCode = 101;
        clearInterval(this.interval);
    }

    metrify(err, data) {
        Util.logError(err);
        if (err === undefined){
            this.resultStatusCode = data.statusCode;
            console.log(`Receiving status: ${data.statusCode}`);
            if (data.statusCode === 200) {
                this.compareMeasure(data.data.average, this.thresholdData, '');
                this.done();
            } else if (data.statusCode > 400) {
                this.done(new Error(`Error processing with code ${data.statusCode}`));
            }
        } else {
            this.done(new Error(err));
        }
    }

    compareMax(data, threshold) {
        if (data > threshold) {
            return `${String(data)} is more than threshold ${String(threshold)}`;
        }
    }

    compareMin(data, threshold) {
        if (data < threshold) {
            return `${String(data)} is less than threshold ${String(threshold)}`;
        }
    }

    compareMinAndMax(data, thresholds, path) {
        const min = this.compareMin(data, thresholds.min);
        const max = this.compareMax(data, thresholds.max);

        if ((min !== undefined) && (max !== undefined)) {
            this.resultObj[this.url][path] = [min, max];
        } else if (min !== undefined) {
            this.resultObj[this.url][path] = min;
        } else if (max !== undefined) {
            this.resultObj[this.url][path] = max;
        }
    }

    compareMeasure(data, thresholdData, path) {
        let localPath;
        for (const prop in thresholdData) {
            localPath = path;
            localPath += `.${prop}`;
            if (typeof(data[prop]) === 'object'){
                this.compareMeasure(data[prop], thresholdData[prop], localPath);
            } else {
                if (typeof(thresholdData[prop]) === 'object'){
                    this.compareMinAndMax(data[prop], thresholdData[prop], localPath);

                } else {
                    const max = this.compareMax(data[prop], thresholdData[prop]);
                    if (max !== undefined) {
                        this.resultObj[this.url][path] = max;
                    }
                }
            }
        }
    }

    testThreshold() {
        for (const url in this.resultObj) {
            console.log(`Please see all results for url ${url} at ${this.wptUri}/result/${this.mapUrlToTest[url]}/`);
            if (Object.keys(this.resultObj[url]).length > 0){
                console.log(util.inspect(this.resultObj, false, null));
                process.exit(1);
            } else {
                process.exit(0);
            }
        }
    }

    getResults(err, data) {
        Util.logError(err);
        if (data.statusCode !== 200){
            Util.logError(data.statusText);
            process.exit( 1 );
        }
        if (err === undefined){
            console.log(`Test Id from WebPageTest: ${data.data.testId}`);
            this.mapUrlToTest[this.url] = data.data.testId
            const pMetrify = proxy(this.metrify , this);
            const that = this;

            this.interval = setInterval(() => {
                that.wpt.getTestResults(data.data.testId, pMetrify);
            }, 1000);
        }

    }

    run(options, done) {
        this.done = done;
        this.url = options.url;
        this.wptUri = options.wptHost;
        this.wpt = new WebPageTest(this.wptUri);
        this.resultObj[options.url] = {};
        this.thresholdData = options.thresholdData;
        return this.wpt.runTest(options.url, options, proxy(this.getResults, this));
    }

    process() {
        const that = this;
        this.queue.process('measure performance', (job, done) => {
          that.run(job.data, done);
        });
    }
}

const worker = new Worker();

process.once( 'SIGTERM', sig => {
	worker.queue.shutdown( Settings.shutdownTimeout, err => {
		Util.logError( 'Kue shutdown: ', err||'' );
		process.exit( 1 );
	});
});

worker.process();
