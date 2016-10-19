/*jslint node: true */
'use strict';

module.exports = {
	shutdownTimeout: process.env.SHUTDOWN_TIMEOUT || 1000,
	redis_config: {
	  prefix: 'q',
	},
};
