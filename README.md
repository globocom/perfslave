# PerfSlave

The automated performance test for your web page.

High integrated with CI. It fails if your constraints don't match (exit 1) and pass if match (exit 0)


## Install and run

### Simple install

```bash

npm install

```

### Running...

This project runs a Scheduler and a Worker that shares information using [Kue](https://github.com/Automattic/kue) queue.

For external Redis connection you need to set this environment variable:

```bash

export REDIS_ENDPOINT=redis://example.com:1234

```

#### Scheduler

Scheduler schedule jobs for web page analysis using [Kue](https://github.com/Automattic/kue).

You can configure thresholds for [WebPageTest](https://www.webpagetest.org) metrics. WebPageTest describes [metrics](https://sites.google.com/a/webpagetest.org/docs/advanced-features/webpagetest-restful-apis) by XML, but we're using JSON at example folder. There you can see how thresholds are configurable.

Here a example of threshold file:

```bash

{ "firstView":
   { "firstPaint": 9000,
    "image_total": {"min": 0, "max": 2}
   },
  "repeatView":
   { "firstPaint": 6000,
     "SpeedIndex": 6000
   }
}

```

Use **min** and **max** threshold or max threshold alone without declaration.

You can schedule one or more jobs using these commands:

```bash

node schedule.js http://g1.globo.com http://gshow.globo.com -t YOUR_THRESHOLD_FILE -c YOUR_CONFIG_FILE

node schedule.js http://globoesporte.globo.com http://globo.com -t ANOTHER_THRESHOLD_FILE -c ANOTHER_CONFIG_FILE

```

Than, each job was scheduled with one threshold for one or more web pages.

Your config files should accept all options from [WebPageTest Npm Module](https://www.npmjs.com/package/webpagetest#test-works-for-runtest-method-only), like key (for API key), lagin and password for authenticated tests, etc. See example folder for more details.

#### Worker

Worker just takes jobs from Redis, runs WebPageTest and compare results with your thresholds.

You can run worker using this command:

```bash

nose worker.js

```

It will run all schedules and send you a result that test passed or failed.

If it fails, should return something like this for all web pages:

```bash

Please see all results for url http://google.com at http://webpagetest.org/result/161018_37_3N/

{ 'http://google.com':
   { '.firstView': '9191 is more than threshold 8676',
     '.repeatView': '6778 is more than threshold 6773'
   }
}

```

## Tricks

Configuring your config file, sometimes WebPageTest uses fields location for connection too, so:

```bash

"location": "ec2-sa-east-1:Chrome.Cable"

```

works and

```bash

"location": "ec2-sa-east-1"
"connection": "Chrome.Cable"

```

don't.
