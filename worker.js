/*jslint node: true */
'use strict';

var WebPageTest = require('webpagetest');
var Util = require('./lib/util');
var Settings = require('./lib/settings');
var util = require('util');

function proxy(fn, that){
	return function(err, data){
		fn.apply(that, [err, data]);
	};
}

function Worker(){
	this.closeOnFinish = true;
	this.queue = Util.getQueue(Settings.redis_config);
	this.resultObj = {};
	this.mapUrlToTest = {};
	this.resetValues();
	this.bindQueue();
}

Worker.prototype.bindQueue = function(){
	var that = this;
	if (this.closeOnFinish){
		this.queue.on('job complete', function(id, result){
			that.resetValues();
			that.queue.inactiveCount( function( err, total ) {
				if (total === 0){
					console.log('Worker Done');
					that.testThreshold();
				}
			});
		});
	}
};

Worker.prototype.resetValues = function(data){
	this.resultStatusCode = 101;
	clearInterval(this.interval);
};

Worker.prototype.metrify = function(err, data) {
	Util.logError(err);
	if (err === undefined){
		this.resultStatusCode = data.statusCode;
		console.log("Receiving status: " + data.statusCode);
		if (data.statusCode === 200) {
			this.compareMeasure(data.data.average, this.thresholdData, '');
			this.done();
		} else if (data.statusCode > 400) {
			this.done(new Error('Error processing with code ' + data.statusCode));
		}
	} else {
		this.done(new Error(err));
	}
};

Worker.prototype.compareMax = function(data, threshold){
	if (data > threshold) {
		return String(data) + ' is more than threshold ' + String(threshold);
	}
};

Worker.prototype.compareMin = function(data, threshold){
	if (data < threshold) {
		return String(data) + ' is less than threshold ' + String(threshold);
	}
};

Worker.prototype.compareMinAndMax = function(data, thresholds, path){
	var min = this.compareMin(data, thresholds.min);
	var max = this.compareMax(data, thresholds.max);

	if ((min !== undefined) && (max !== undefined)) {
		this.resultObj[this.url][path] = [min, max];
	} else if (min !== undefined) {
		this.resultObj[this.url][path] = min;
	} else if (max !== undefined) {
		this.resultObj[this.url][path] = max;
	}
};

Worker.prototype.compareMeasure = function(data, thresholdData, path){
	var localPath;
	for (var prop in thresholdData) {
		localPath = path;
		localPath += '.' + prop;
		if (typeof(data[prop]) === 'object'){
			this.compareMeasure(data[prop], thresholdData[prop], localPath);
		} else {
			if (typeof(thresholdData[prop]) === 'object'){
				this.compareMinAndMax(data[prop], thresholdData[prop], localPath);

			} else {
				var max = this.compareMax(data[prop], thresholdData[prop]);
				if (max !== undefined) {
					this.resultObj[this.url][path] = max;
				}
			}
		}
	}
};

Worker.prototype.testThreshold = function(){
	for (var url in this.resultObj) {
		console.log('Please see all results for url ' + url + ' at ' + this.wptUri + '/result/' + this.mapUrlToTest[url] + '/');
		if (Object.keys(this.resultObj[url]).length > 0){
			console.log(util.inspect(this.resultObj, false, null));
			process.exit(1);
		} else {
			process.exit(0);
		}
	}
};

Worker.prototype.getResults = function(err, data){
	Util.logError(err);
	if (data.statusCode !== 200){
		Util.logError(data.statusText);
		process.exit( 1 );
	}
	if (err === undefined){
		console.log("Test Id from WebPageTest: " + data.data.testId);
		this.mapUrlToTest[this.url] = data.data.testId
		var pMetrify = proxy(this.metrify , this);
		var that = this;

		this.interval = setInterval(function() {
			that.wpt.getTestResults(data.data.testId, pMetrify);
		}, 1000);
	}

};

Worker.prototype.run = function(options, done){
	this.done = done;
	this.url = options.url;
	this.wptUri = options.wptHost;
	this.wpt = new WebPageTest(this.wptUri);
	this.resultObj[options.url] = {};
	this.thresholdData = options.thresholdData;
	return this.wpt.runTest(options.url, options, proxy(this.getResults, this));
};

Worker.prototype.process = function(){
	var that = this;
	this.queue.process('measure performance', function(job, done){
	  that.run(job.data, done);
	});
};

var worker = new Worker();

process.once( 'SIGTERM', function ( sig ) {
	worker.queue.shutdown( Settings.shutdownTimeout, function(err) {
		Util.logError( 'Kue shutdown: ', err||'' );
		process.exit( 1 );
	});
});

worker.process();
