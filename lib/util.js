/*jslint node: true */
'use strict';

var Kue = require('kue');

module.exports = {

	getQueue: function(redis_config){
		if (process.env.REDIS_ENDPOINT){
			redis_config.redis = process.env.REDIS_ENDPOINT;
		}
		return Kue.createQueue(redis_config);
	},
	logError: function (err){
		if (err){
			console.log(err);
		}
	}
};
