/*jslint node: true */
'use strict';

const Util = require('./lib/util');
const Settings = require('./lib/settings');
const fs = require('fs');


const options = require('yargs')
.demand([1, 't', 'c'])
.alias('t', 'threshold')
.string('t')
.describe('t', 'Threshold json file with threshold configuration')
.alias('c', 'config')
.string('c')
.describe('c', 'Configuration json file with WebPageTest configuration')
.usage('Usage: $0 <url1 url2 ...> -t [filePath] -c [filePath]')
.argv;

class Scheduler {
    constructor(options) {
        this.scheduler_options = options.scheduler_options;
        this.scheduler_options.thresholdData = options.thresholdData;
        this.urlList = options.urlList;
        this.queue = Util.getQueue(Settings.redis_config);
        this.urlCounter = 0;
        this.bindQueue();
    }

    bindQueue() {
        const that = this;
        this.queue.on('job enqueue', (id, type) => {
            that.urlCounter += 1;
            if (that.urlCounter === that.urlList.length){
                console.log('Scheduler Done');
                process.exit( 0 );
            }
        });
    }

    schedule(url) {
        this.scheduler_options.url = url;
        this.queue.create('measure performance', this.scheduler_options).removeOnComplete(true)
                                                                                                                                        .save(Util.logError);
    }

    scheduleAll() {
        for (const key in this.urlList){
            this.schedule(this.urlList[key]);
        }
    }
}

const loadFile = filePath => JSON.parse(fs.readFileSync(filePath, 'utf8'));

const scheduler = new Scheduler({
	scheduler_options: loadFile(options.c),
	urlList: options._,
	thresholdData: loadFile(options.t)
});

scheduler.scheduleAll();
