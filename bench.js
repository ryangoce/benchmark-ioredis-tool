'use strict';

var childProcess = require('child_process');
var Redis = require('ioredis');
const _ = require('lodash');

console.log('==========================');
console.log('redis: ' + require('./package.json').version);
var os = require('os');
console.log('CPU: ' + os.cpus().length);
console.log('OS: ' + os.platform() + ' ' + os.arch());
console.log('node version: ' + process.version);
console.log('==========================');

const payloadSize = process.env.LOAD_SIZE || 2000;
let payload = '';

for (let index = 0; index < payloadSize; index++) {
  payload += 'a';
}

var redisBench;

var waitReady = function (next) {
  redisBench = new Redis(process.env.CACHE_HOST, process.env.CACHE_PORT);
  next();
};

var quit = function () {
  redisBench.quit();
};

var cleanData = function (cb) {
  var redis = new Redis(process.env.CACHE_HOST, process.env.CACHE_PORT);

  redis.on('ready', function () {
    const pipeline = redis.pipeline();
    redis.keys('bench*').then((data) => {
      _.each(data, (item) => {
        pipeline.del(item);
      });

      pipeline.exec(cb);
    });
  });
}



suite('direct redis', function () {
  var setCounter = 0;
  var zaddCounter = 0;
  var getsetCounter = function () {
    return setCounter++;
  }

  var getzaddCounter = function () {
    return zaddCounter++;
  }

  set('mintime', 5000);
  set('iterations', 10000);
  set('concurrency', 500);

  before(function (start) {
    var redis = new Redis(process.env.CACHE_HOST, process.env.CACHE_PORT);
    var item = [];
    const pipeline = redis.pipeline();
    for (var i = 0; i < 10000; ++i) {
      pipeline.set('bench:set:vehicle' + i, payload);
      pipeline.zadd('bench:zadd:vehicle' + i, 0, payload);
      375
    }
    pipeline.exec(function () {
      waitReady(start);
    });
  });

  bench('10,000 vehicles @11x', function (next) {

    const counter = getsetCounter();
    const getFromSnapshot = function () {
      return new Promise((resolve, reject) => {
        redisBench.get('bench:set:vehicle' + counter, function () {
          redisBench.zrange('bench:zadd:vehicle' + counter, 0, -1, resolve);
        });
      });
    };

    getFromSnapshot().then(getFromSnapshot).then(getFromSnapshot).then(getFromSnapshot).then(getFromSnapshot).then(function () {
      redisBench.zadd('bench:zadd:vehicle' + counter, 0, payload, next);
    });
  });

  after(function (cb) {
    cleanData(cb);
  });
});

suite('adrai eventstore with fast-redis backend and no pipelining', function () {
  let es;
  let counter = 0;

  set('mintime', 5000);
  set('iterations', 10000);
  set('concurrency', 500);

  const getFromSnapshot = function (aggregateId, aggregate, context, partitionKey) {
    return new Promise((resolve, reject) => {
      es.getFromSnapshot({
        aggregateId: aggregateId,
        aggregate: aggregate, // optional
        context: context, // optional
        partitionKey: partitionKey
      }, function (err, snapshot, stream) {
        resolve({
          snapshot: snapshot,
          stream: stream,
          error: err
        });
      });
    });
  }

  before(function (start) {

    const FastRedisEventStore = require('./fast-redis.evenstore');

    const options = {
      type: FastRedisEventStore,
      host: process.env.CACHE_HOST,
      port: process.env.CACHE_PORT,
      isCluster: false,
      prefix: 'bench'
    };

    es = require('eventstore')(options);
    es.init(function () {
      const tasks = [];
      for (let index = 0; index < 10000; index++) {
        // add 10k vehicles
        const vehicleKey = `vehicle${counter++}`;
        tasks.push(getFromSnapshot(vehicleKey, 'vehicle', 'auction', '').then((data) => {
          return new Promise((resolve, reject) => {
            const stream = data.stream;
            stream.addEvent({
              name: 'vehicle_created',
              payload: payload
            });

            stream.commit(resolve);
          });
        }).catch(console.error));
      }

      Promise.all(tasks).then(function() {
        counter = 0;
        start();
      });
    });


  });


  bench('10,000 vehicles @11x', function (next) {
    const vehicleKey = `vehicle${counter++}`;

    getFromSnapshot(vehicleKey, 'vehicle', 'auction', '')
      .then(() => {
        return getFromSnapshot(vehicleKey, 'vehicle', 'auction', '');
      })
      .then(() => {
        return getFromSnapshot(vehicleKey, 'vehicle', 'auction', '');
      })
      .then(() => {
        return getFromSnapshot(vehicleKey, 'vehicle', 'auction', '');
      })
      .then(() => {
        return getFromSnapshot(vehicleKey, 'vehicle', 'auction', '');
      })
      .then((data) => {
        const stream = data.stream;
        stream.addEvent({
          name: 'vehicle_created',
          payload: payload
        });

        stream.commit(next);
      });
  });

  after(function (cb) {
    cleanData(cb);
  });
});

suite('adrai eventstore with fast-redis backend and with pipelining', function () {
  let es;
  let counter = 0;

  set('mintime', 5000);
  set('iterations', 10000);
  set('concurrency', 500);

  const getFromSnapshot = function (aggregateId, aggregate, context, partitionKey) {
    return new Promise((resolve, reject) => {
      es.getFromSnapshot({
        aggregateId: aggregateId,
        aggregate: aggregate, // optional
        context: context, // optional
        partitionKey: partitionKey
      }, function (err, snapshot, stream) {
        resolve({
          snapshot: snapshot,
          stream: stream,
          error: err
        });
      });
    });
  }

  before(function (start) {

    const FastRedisEventStore = require('./fast-redis.evenstore');

    const options = {
      type: FastRedisEventStore,
      host: process.env.CACHE_HOST,
      port: process.env.CACHE_PORT,
      isCluster: false,
      pipelined: true,
      prefix: 'bench'
    };

    es = require('eventstore')(options);
    es.init(function () {
      const tasks = [];
      for (let index = 0; index < 10000; index++) {
        // add 10k vehicles
        const vehicleKey = `vehicle${counter++}`;
        tasks.push(getFromSnapshot(vehicleKey, 'vehicle', 'auction', '').then((data) => {
          return new Promise((resolve, reject) => {
            const stream = data.stream;
            stream.addEvent({
              name: 'vehicle_created',
              payload: payload
            });

            stream.commit(resolve);
          });
        }).catch(console.error));
      }

      Promise.all(tasks).then(function() {
        counter = 0;
        start();
      });
    });


  });


  bench('10,000 vehicles @11x', function (next) {
    const vehicleKey = `vehicle${counter++}`;

    getFromSnapshot(vehicleKey, 'vehicle', 'auction', '')
      .then(() => {
        return getFromSnapshot(vehicleKey, 'vehicle', 'auction', '');
      })
      .then(() => {
        return getFromSnapshot(vehicleKey, 'vehicle', 'auction', '');
      })
      .then(() => {
        return getFromSnapshot(vehicleKey, 'vehicle', 'auction', '');
      })
      .then(() => {
        return getFromSnapshot(vehicleKey, 'vehicle', 'auction', '');
      })
      .then((data) => {
        const stream = data.stream;
        stream.addEvent({
          name: 'vehicle_created',
          payload: payload
        });

        stream.commit(next);
      });
  });

  after(function (cb) {
    cleanData(cb);
  });
});
// suite('SET foo bar', function () {
//   set('mintime', 5000);
//   set('concurrency', 1);
//   before(function (start) {
//     waitReady(start);
//   });

//   bench('javascript parser + dropBufferSupport: true', function (next) {
//     redisJD.set('foo', 'bar', next);
//   });

//   bench('javascript parser', function (next) {
//     redisJ.set('foo', 'bar', next);
//   });

//   after(quit);
// });

// suite('LRANGE foo 0 99', function () {
//   set('mintime', 5000);
//   set('concurrency', 300);
//   before(function (start) {
//     var redis = new Redis(process.env.CACHE_HOST, process.env.CACHE_PORT);
//     var item = [];
//     for (var i = 0; i < 100; ++i) {
//       item.push((Math.random() * 100000 | 0) + 'str');
//     }
//     redis.del('foo');
//     redis.lpush('foo', item, function () {
//       waitReady(start);
//     });
//   });

//   bench('javascript parser + dropBufferSupport: true', function (next) {
//     redisJD.lrange('foo', 0, 99, next);
//   });

//   bench('javascript parser', function (next) {
//     redisJ.lrange('foo', 0, 99, next);
//   });

//   after(quit);
// });