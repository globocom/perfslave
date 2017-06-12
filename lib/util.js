/*jslint node: true */
'use strict';

const Kue = require('kue');

module.exports = {

	getQueue(redis_config) {
		if (process.env.REDIS_ENDPOINT){
			redis_config.redis = process.env.REDIS_ENDPOINT;
		}
		return Kue.createQueue(redis_config);
	},
	logError(err) {
		if (err){
			console.log(err);
		}
	}
};
