'use strict';

var childProcess = require('child_process');
var Redis = require('ioredis');

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



suite('SINGLE THREAD: GET AND ZRANGE: 10000 vehicles: 2000 size', function () {
  var setCounter = 0;
  var zaddCounter = 0;
  var getsetCounter = function () {
    return setCounter++;
  }
  
  var getzaddCounter = function () {
    return zaddCounter++;
  }

  set('mintime', 10000);
  set('concurrency', 700);

  before(function (start) {
    var redis = new Redis(process.env.CACHE_HOST, process.env.CACHE_PORT);
    var item = [];
    const pipeline = redis.pipeline();
    for (var i = 0; i < 10000; ++i) {
      pipeline.set('set:vehicle' + i, payload);
      pipeline.zadd('zadd:vehicle' + i, 0, payload);
    }
    pipeline.exec(function () {
      waitReady(start);
    });
  });

  bench('get and zrange', function (next) {
    redisBench.get('set:vehicle' + getsetCounter(), function() {
      redisBench.zrange('zadd:vehicle' + getzaddCounter(), 0, -1, next);
    });
  });

  after(quit);
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