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



xsuite('direct redis', function () {
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

xsuite('adrai eventstore with fast-redis backend and no pipelining', function () {
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

    const FastRedisEventStore = require('./fast-redis.eventstore');

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

      Promise.all(tasks).then(function () {
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

  bench('10,000 vehicles @9x', function (next) {
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
      .then((data) => {
        const stream = data.stream;
        stream.addEvent({
          name: 'vehicle_created',
          payload: payload
        });

        stream.commit(next);
      });
  });

  bench('10,000 vehicles @7x', function (next) {
    const vehicleKey = `vehicle${counter++}`;

    getFromSnapshot(vehicleKey, 'vehicle', 'auction', '')
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

  bench('10,000 vehicles @5x', function (next) {
    const vehicleKey = `vehicle${counter++}`;

    getFromSnapshot(vehicleKey, 'vehicle', 'auction', '')
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

  bench('10,000 vehicles @3x', function (next) {
    const vehicleKey = `vehicle${counter++}`;

    getFromSnapshot(vehicleKey, 'vehicle', 'auction', '')
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

  after(function (cb) {
    cleanData(cb);
  });
});

xsuite('adrai eventstore with fast-redis backend and with pipelining', function () {
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

    const FastRedisEventStore = require('./fast-redis.eventstore');

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

      Promise.all(tasks).then(function () {
        counter = 0;
        start();
      });
    });


  });


  xbench('10,000 vehicles @11x', function (next) {
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

  xbench('10,000 vehicles @9x', function (next) {
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
      .then((data) => {
        const stream = data.stream;
        stream.addEvent({
          name: 'vehicle_created',
          payload: payload
        });

        stream.commit(next);
      });
  });

  xbench('10,000 vehicles @7x', function (next) {
    const vehicleKey = `vehicle${counter++}`;

    getFromSnapshot(vehicleKey, 'vehicle', 'auction', '')
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

  xbench('10,000 vehicles @5x', function (next) {
    const vehicleKey = `vehicle${counter++}`;

    getFromSnapshot(vehicleKey, 'vehicle', 'auction', '')
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

  bench('10,000 vehicles @3x', function (next) {
    const vehicleKey = `vehicle${counter++}`;

    getFromSnapshot(vehicleKey, 'vehicle', 'auction', '')
      .then((data) => {
        const stream = data.stream;
        stream.addEvent({
          name: 'vehicle_created',
          payload: payload
        });

        console.log(stream.events);
        stream.commit(next);
      });
  });

  after(function (cb) {
    cleanData(cb);
  });
});

suite('adrai eventstore with fast-redis backend, with pipelining and batched executed @11x', function () {
  let es;
  let counter = 0;

  const batchSize = process.env.BATCH_SIZE || 500;
  const numVehicles = process.env.NUM_VEHICLES || 1500;
  const iterations = Math.ceil(numVehicles / batchSize);

  console.log({
    batchSize: batchSize,
    numVehicles: numVehicles,
    iterations: iterations
  });

  set('mintime', 0);
  set('iterations', iterations);
  set('concurrency', iterations);

  const getFromSnapshot = function (aggregateId, aggregate, context, partitionKey) {
    return new Promise((resolve, reject) => {
      es.getFromSnapshot({
        aggregateId: aggregateId,
        aggregate: aggregate, // optional
        context: context, // optional
        partitionKey: partitionKey
      }, function (err, snapshot, stream) {
        if (err) {
          console.error(err);
        }
        resolve({
          snapshot: snapshot,
          stream: stream,
          error: err
        });
      });
    });
  }

  let vehicleIds = [];
  before(function (start) {
    const FastRedisEventStore = require('./fast-redis.eventstore');

    const options = {
      type: FastRedisEventStore,
      host: process.env.CACHE_HOST,
      port: process.env.CACHE_PORT,
      isCluster: false,
      prefix: 'bench',
      pipelined: true
    };

    es = require('eventstore')(options);
    es.init(function () {
      const shortid = require('shortid');
      const Redis = require('ioredis');

      const redis = new Redis(process.env.CACHE_PORT, process.env.CACHE_HOST);

      redis.on('ready', () => {
        const pipeline = redis.pipeline();
        for (let index = 0; index < numVehicles; index++) {
          const id = shortid.generate();
          pipeline.set(`bench:salesChannelInstanceVehicle:aggregate:${id}:snapshot`, '{\"id\":\"ac1d9137-4afe-4f36-85a8-52ee0de5c591\",\"streamId\":\"EySmTVPiS\",\"aggregateId\":\"EySmTVPiS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"commitStamp\":\"2018-10-22T23:01:07.780Z\",\"revision\":9,\"version\":1,\"data\":{\"endedAt\":\"2018-10-23T19:05:00.000Z\",\"clearedAt\":\"2018-10-24T19:00:00.000Z\",\"salesChannelInstanceVehicleId\":\"EySmTVPiS\",\"salesChannelInstanceId\":\"VJg0Fh4vsS\",\"salesChannelId\":\"VJRF34viB\",\"vehicleId\":\"N1TukTVwiB\",\"vin\":\"WAUBFAFL5EN002168\",\"yearId\":2014,\"yearName\":\"2014\",\"makeId\":4,\"makeName\":\"Audi\",\"modelId\":4,\"modelName\":\"A4\",\"trimId\":312872,\"trimName\":\"Premium Sedan 4D\",\"engineId\":5433058,\"engineName\":\"4-Cyl, Turbo, 2.0 Liter\",\"transmissionId\":5433095,\"transmissionName\":\"Auto, 8-Spd Tiptronic\",\"driveTrainId\":5433139,\"driveTrainName\":\"FWD\",\"mileage\":1412,\"exteriorColorId\":6388662,\"exteriorColorName\":\"Black\",\"vehicleType\":\"Sedan\",\"stockNumber\":\"\",\"licenseNumber\":\"\",\"interiorColorId\":\"\",\"interiorColorName\":\"\",\"dealershipId\":\"AAUABAQC\",\"dealershipName\":\"Folsom Flooring\",\"dealerId\":\"GCwcABAY\",\"dealerName\":\"Ryan Goce\",\"dealerFirstName\":\"Ryan\",\"dealerLastName\":\"Goce\",\"dealerPhotoPath\":\"undefined\",\"askingPrice\":10000,\"reservePrice\":9000,\"isBuyNow\":false,\"startBid\":8600,\"categoryId\":1,\"createdAt\":1540246983578,\"updatedAt\":1540247044202,\"postedAt\":1540247044354,\"status\":null,\"kbb\":14625,\"kbbWithMiles\":17070,\"firstPhotoPath\":\"\"}}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1000, '{\"streamId\":\"VybeC6Ewor\",\"aggregateId\":\"VybeC6Ewor\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":10,\"commitId\":\"0661ba37-081a-43a1-934a-840f32b05fea\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:23:42.010Z\",\"payload\":{\"aggregateId\":\"VybeC6Ewor\",\"name\":\"sales_channel_instance_vehicle_added\",\"payload\":{\"startedAt\":\"2018-10-23T19:00:00.000Z\",\"endedAt\":\"2018-10-23T19:05:00.000Z\",\"clearedAt\":\"2018-10-24T19:00:00.000Z\",\"salesChannelInstanceVehicleId\":\"VybeC6Ewor\",\"salesChannelInstanceId\":\"VJg0Fh4vsS\",\"salesChannelId\":\"VJRF34viB\",\"vehicleId\":\"EyR5A2NvjH\",\"vin\":\"WAUBFAFL5EN002168\",\"yearId\":2014,\"yearName\":\"2014\",\"makeId\":4,\"makeName\":\"Audi\",\"modelId\":4,\"modelName\":\"A4\",\"trimId\":312872,\"trimName\":\"Premium Sedan 4D\",\"engineId\":5433058,\"engineName\":\"4-Cyl, Turbo, 2.0 Liter\",\"transmissionId\":5433095,\"transmissionName\":\"Auto, 8-Spd Tiptronic\",\"driveTrainId\":5433139,\"driveTrainName\":\"FWD\",\"mileage\":814,\"exteriorColorId\":6388662,\"exteriorColorName\":\"Black\",\"vehicleType\":\"Sedan\",\"stockNumber\":\"\",\"licenseNumber\":\"\",\"interiorColorId\":\"\",\"interiorColorName\":\"\",\"dealershipId\":\"AAUABAQC\",\"dealershipName\":\"Folsom Flooring\",\"dealerId\":\"GCwcABAY\",\"dealerName\":\"Ryan Goce\",\"dealerFirstName\":\"Ryan\",\"dealerLastName\":\"Goce\",\"dealerPhotoPath\":\"undefined\",\"askingPrice\":10000,\"reservePrice\":9000,\"isBuyNow\":false,\"startBid\":8600,\"categoryId\":1,\"createdAt\":1540246970128,\"updatedAt\":1540247021872,\"postedAt\":1540247022010,\"status\":null,\"kbb\":14625,\"kbbWithMiles\":17070,\"firstPhotoPath\":\"\"},\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"0661ba37-081a-43a1-934a-840f32b05fea0\",\"restInCommitStream\":0}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1001, '{\"streamId\":\"E1xAJ6NPsS\",\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":11,\"commitId\":\"de2f5521-572c-442d-b3c8-9803f8eae35c\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:31:18.724Z\",\"payload\":{\"name\":\"sales_channel_instance_vehicle_started\",\"payload\":{\"startAt\":\"2018-10-22T22:31:18.269Z\"},\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"de2f5521-572c-442d-b3c8-9803f8eae35c0\",\"restInCommitStream\":0}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1002, '{\"streamId\":\"E1xAJ6NPsS\",\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":12,\"commitId\":\"de2f5521-572c-442d-b3c8-9803f8eae35c\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:31:18.724Z\",\"payload\":{\"name\":\"sales_channel_instance_vehicle_started\",\"payload\":{\"startAt\":\"2018-10-22T22:31:18.269Z\"},\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"de2f5521-572c-442d-b3c8-9803f8eae35c0\",\"restInCommitStream\":0}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1003, '{\"streamId\":\"E1xAJ6NPsS\",\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":13,\"commitId\":\"de2f5521-572c-442d-b3c8-9803f8eae35c\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:31:18.724Z\",\"payload\":{\"name\":\"sales_channel_instance_vehicle_started\",\"payload\":{\"startAt\":\"2018-10-22T22:31:18.269Z\"},\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"de2f5521-572c-442d-b3c8-9803f8eae35c0\",\"restInCommitStream\":0}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1004, '{\"streamId\":\"E1xAJ6NPsS\",\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":14,\"commitId\":\"de2f5521-572c-442d-b3c8-9803f8eae35c\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:31:18.724Z\",\"payload\":{\"name\":\"sales_channel_instance_vehicle_started\",\"payload\":{\"startAt\":\"2018-10-22T22:31:18.269Z\"},\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"de2f5521-572c-442d-b3c8-9803f8eae35c0\",\"restInCommitStream\":0}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1005, '{\"streamId\":\"E1xAJ6NPsS\",\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":15,\"commitId\":\"de2f5521-572c-442d-b3c8-9803f8eae35c\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:31:18.724Z\",\"payload\":{\"name\":\"sales_channel_instance_vehicle_started\",\"payload\":{\"startAt\":\"2018-10-22T22:31:18.269Z\"},\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"de2f5521-572c-442d-b3c8-9803f8eae35c0\",\"restInCommitStream\":0}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1006, '{\"streamId\":\"E1xAJ6NPsS\",\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":16,\"commitId\":\"de2f5521-572c-442d-b3c8-9803f8eae35c\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:31:18.724Z\",\"payload\":{\"name\":\"sales_channel_instance_vehicle_started\",\"payload\":{\"startAt\":\"2018-10-22T22:31:18.269Z\"},\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"de2f5521-572c-442d-b3c8-9803f8eae35c0\",\"restInCommitStream\":0}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1007, '{\"streamId\":\"E1xAJ6NPsS\",\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":17,\"commitId\":\"de2f5521-572c-442d-b3c8-9803f8eae35c\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:31:18.724Z\",\"payload\":{\"name\":\"sales_channel_instance_vehicle_started\",\"payload\":{\"startAt\":\"2018-10-22T22:31:18.269Z\"},\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"de2f5521-572c-442d-b3c8-9803f8eae35c0\",\"restInCommitStream\":0}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1008, '{\"streamId\":\"E1xAJ6NPsS\",\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":18,\"commitId\":\"de2f5521-572c-442d-b3c8-9803f8eae35c\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:31:18.724Z\",\"payload\":{\"name\":\"sales_channel_instance_vehicle_started\",\"payload\":{\"startAt\":\"2018-10-22T22:31:18.269Z\"},\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"de2f5521-572c-442d-b3c8-9803f8eae35c0\",\"restInCommitStream\":0}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1009, '{\"streamId\":\"E1xAJ6NPsS\",\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":19,\"commitId\":\"de2f5521-572c-442d-b3c8-9803f8eae35c\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:31:18.724Z\",\"payload\":{\"name\":\"sales_channel_instance_vehicle_started\",\"payload\":{\"startAt\":\"2018-10-22T22:31:18.269Z\"},\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"de2f5521-572c-442d-b3c8-9803f8eae35c0\",\"restInCommitStream\":0}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1010, '{\"streamId\":\"E1xAJ6NPsS\",\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":20,\"commitId\":\"de2f5521-572c-442d-b3c8-9803f8eae35c\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:31:18.724Z\",\"payload\":{\"name\":\"sales_channel_instance_vehicle_started\",\"payload\":{\"startAt\":\"2018-10-22T22:31:18.269Z\"},\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"de2f5521-572c-442d-b3c8-9803f8eae35c0\",\"restInCommitStream\":0}');

          vehicleIds.push(id);
        }

        pipeline.exec(() => {
          setTimeout(() => {
            start();
          }, 3000);
        });
      });
    });
  });

  bench(`${numVehicles} vehicles @11x`, function (next, a, b, c) {
    const start = Date.now();
    let doneCounter = 0;
    const maybeNext = function () {
      if (++doneCounter === +batchSize) {
        const end = Date.now();
        console.log({
          start: start,
          end: end,
          duration: `${end - start}ms`
        });
        next();
      }
    }
    for (let i = 0; i < batchSize; i++) {
      const vehicleKey = vehicleIds[i];
      getFromSnapshot(vehicleKey, 'salesChannelInstanceVehicle', 'auction', '')
        .then(() => {
          return getFromSnapshot(vehicleKey, 'salesChannelInstanceVehicle', 'auction', '');
        })
        .then(() => {
          return getFromSnapshot(vehicleKey, 'salesChannelInstanceVehicle', 'auction', '');
        })
        .then(() => {
          return getFromSnapshot(vehicleKey, 'salesChannelInstanceVehicle', 'auction', '');
        })
        .then(() => {
          return getFromSnapshot(vehicleKey, 'salesChannelInstanceVehicle', 'auction', '');
        })
        .then((data) => {
          return {
            data: data,
            events: [{
              name: 'vehicle_created',
              payload: payload
            }]
          };
        }).then((res) => {
          return new Promise((resolve, reject) => {
            const data = res.data;
            const events = res.events;
            const stream = data.stream;
            stream.addEvents(events);
            stream.commit(resolve);
          });

        })
        .then(maybeNext);
    }
  });

  after(function (cb) {
    cleanData(cb);
  });
});

suite('adrai eventstore with fast-redis backend, with pipelining and batched executed @9x', function () {
  let es;
  let counter = 0;

  const batchSize = process.env.BATCH_SIZE || 500;
  const numVehicles = process.env.NUM_VEHICLES || 1500;
  const iterations = Math.ceil(numVehicles / batchSize);

  console.log({
    batchSize: batchSize,
    numVehicles: numVehicles,
    iterations: iterations
  });

  set('mintime', 0);
  set('iterations', iterations);
  set('concurrency', iterations);

  const getFromSnapshot = function (aggregateId, aggregate, context, partitionKey) {
    return new Promise((resolve, reject) => {
      es.getFromSnapshot({
        aggregateId: aggregateId,
        aggregate: aggregate, // optional
        context: context, // optional
        partitionKey: partitionKey
      }, function (err, snapshot, stream) {
        if (err) {
          console.error(err);
        }
        resolve({
          snapshot: snapshot,
          stream: stream,
          error: err
        });
      });
    });
  }

  let vehicleIds = [];
  before(function (start) {
    const FastRedisEventStore = require('./fast-redis.eventstore');

    const options = {
      type: FastRedisEventStore,
      host: process.env.CACHE_HOST,
      port: process.env.CACHE_PORT,
      isCluster: false,
      prefix: 'bench',
      pipelined: true
    };

    es = require('eventstore')(options);
    es.init(function () {
      const shortid = require('shortid');
      const Redis = require('ioredis');

      const redis = new Redis(process.env.CACHE_PORT, process.env.CACHE_HOST);

      redis.on('ready', () => {
        const pipeline = redis.pipeline();
        for (let index = 0; index < numVehicles; index++) {
          const id = shortid.generate();
          pipeline.set(`bench:salesChannelInstanceVehicle:aggregate:${id}:snapshot`, '{\"id\":\"ac1d9137-4afe-4f36-85a8-52ee0de5c591\",\"streamId\":\"EySmTVPiS\",\"aggregateId\":\"EySmTVPiS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"commitStamp\":\"2018-10-22T23:01:07.780Z\",\"revision\":9,\"version\":1,\"data\":{\"endedAt\":\"2018-10-23T19:05:00.000Z\",\"clearedAt\":\"2018-10-24T19:00:00.000Z\",\"salesChannelInstanceVehicleId\":\"EySmTVPiS\",\"salesChannelInstanceId\":\"VJg0Fh4vsS\",\"salesChannelId\":\"VJRF34viB\",\"vehicleId\":\"N1TukTVwiB\",\"vin\":\"WAUBFAFL5EN002168\",\"yearId\":2014,\"yearName\":\"2014\",\"makeId\":4,\"makeName\":\"Audi\",\"modelId\":4,\"modelName\":\"A4\",\"trimId\":312872,\"trimName\":\"Premium Sedan 4D\",\"engineId\":5433058,\"engineName\":\"4-Cyl, Turbo, 2.0 Liter\",\"transmissionId\":5433095,\"transmissionName\":\"Auto, 8-Spd Tiptronic\",\"driveTrainId\":5433139,\"driveTrainName\":\"FWD\",\"mileage\":1412,\"exteriorColorId\":6388662,\"exteriorColorName\":\"Black\",\"vehicleType\":\"Sedan\",\"stockNumber\":\"\",\"licenseNumber\":\"\",\"interiorColorId\":\"\",\"interiorColorName\":\"\",\"dealershipId\":\"AAUABAQC\",\"dealershipName\":\"Folsom Flooring\",\"dealerId\":\"GCwcABAY\",\"dealerName\":\"Ryan Goce\",\"dealerFirstName\":\"Ryan\",\"dealerLastName\":\"Goce\",\"dealerPhotoPath\":\"undefined\",\"askingPrice\":10000,\"reservePrice\":9000,\"isBuyNow\":false,\"startBid\":8600,\"categoryId\":1,\"createdAt\":1540246983578,\"updatedAt\":1540247044202,\"postedAt\":1540247044354,\"status\":null,\"kbb\":14625,\"kbbWithMiles\":17070,\"firstPhotoPath\":\"\"}}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1000, '{\"streamId\":\"VybeC6Ewor\",\"aggregateId\":\"VybeC6Ewor\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":10,\"commitId\":\"0661ba37-081a-43a1-934a-840f32b05fea\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:23:42.010Z\",\"payload\":{\"aggregateId\":\"VybeC6Ewor\",\"name\":\"sales_channel_instance_vehicle_added\",\"payload\":{\"startedAt\":\"2018-10-23T19:00:00.000Z\",\"endedAt\":\"2018-10-23T19:05:00.000Z\",\"clearedAt\":\"2018-10-24T19:00:00.000Z\",\"salesChannelInstanceVehicleId\":\"VybeC6Ewor\",\"salesChannelInstanceId\":\"VJg0Fh4vsS\",\"salesChannelId\":\"VJRF34viB\",\"vehicleId\":\"EyR5A2NvjH\",\"vin\":\"WAUBFAFL5EN002168\",\"yearId\":2014,\"yearName\":\"2014\",\"makeId\":4,\"makeName\":\"Audi\",\"modelId\":4,\"modelName\":\"A4\",\"trimId\":312872,\"trimName\":\"Premium Sedan 4D\",\"engineId\":5433058,\"engineName\":\"4-Cyl, Turbo, 2.0 Liter\",\"transmissionId\":5433095,\"transmissionName\":\"Auto, 8-Spd Tiptronic\",\"driveTrainId\":5433139,\"driveTrainName\":\"FWD\",\"mileage\":814,\"exteriorColorId\":6388662,\"exteriorColorName\":\"Black\",\"vehicleType\":\"Sedan\",\"stockNumber\":\"\",\"licenseNumber\":\"\",\"interiorColorId\":\"\",\"interiorColorName\":\"\",\"dealershipId\":\"AAUABAQC\",\"dealershipName\":\"Folsom Flooring\",\"dealerId\":\"GCwcABAY\",\"dealerName\":\"Ryan Goce\",\"dealerFirstName\":\"Ryan\",\"dealerLastName\":\"Goce\",\"dealerPhotoPath\":\"undefined\",\"askingPrice\":10000,\"reservePrice\":9000,\"isBuyNow\":false,\"startBid\":8600,\"categoryId\":1,\"createdAt\":1540246970128,\"updatedAt\":1540247021872,\"postedAt\":1540247022010,\"status\":null,\"kbb\":14625,\"kbbWithMiles\":17070,\"firstPhotoPath\":\"\"},\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"0661ba37-081a-43a1-934a-840f32b05fea0\",\"restInCommitStream\":0}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1001, '{\"streamId\":\"E1xAJ6NPsS\",\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":11,\"commitId\":\"de2f5521-572c-442d-b3c8-9803f8eae35c\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:31:18.724Z\",\"payload\":{\"name\":\"sales_channel_instance_vehicle_started\",\"payload\":{\"startAt\":\"2018-10-22T22:31:18.269Z\"},\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"de2f5521-572c-442d-b3c8-9803f8eae35c0\",\"restInCommitStream\":0}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1002, '{\"streamId\":\"E1xAJ6NPsS\",\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":12,\"commitId\":\"de2f5521-572c-442d-b3c8-9803f8eae35c\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:31:18.724Z\",\"payload\":{\"name\":\"sales_channel_instance_vehicle_started\",\"payload\":{\"startAt\":\"2018-10-22T22:31:18.269Z\"},\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"de2f5521-572c-442d-b3c8-9803f8eae35c0\",\"restInCommitStream\":0}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1003, '{\"streamId\":\"E1xAJ6NPsS\",\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":13,\"commitId\":\"de2f5521-572c-442d-b3c8-9803f8eae35c\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:31:18.724Z\",\"payload\":{\"name\":\"sales_channel_instance_vehicle_started\",\"payload\":{\"startAt\":\"2018-10-22T22:31:18.269Z\"},\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"de2f5521-572c-442d-b3c8-9803f8eae35c0\",\"restInCommitStream\":0}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1004, '{\"streamId\":\"E1xAJ6NPsS\",\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":14,\"commitId\":\"de2f5521-572c-442d-b3c8-9803f8eae35c\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:31:18.724Z\",\"payload\":{\"name\":\"sales_channel_instance_vehicle_started\",\"payload\":{\"startAt\":\"2018-10-22T22:31:18.269Z\"},\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"de2f5521-572c-442d-b3c8-9803f8eae35c0\",\"restInCommitStream\":0}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1005, '{\"streamId\":\"E1xAJ6NPsS\",\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":15,\"commitId\":\"de2f5521-572c-442d-b3c8-9803f8eae35c\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:31:18.724Z\",\"payload\":{\"name\":\"sales_channel_instance_vehicle_started\",\"payload\":{\"startAt\":\"2018-10-22T22:31:18.269Z\"},\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"de2f5521-572c-442d-b3c8-9803f8eae35c0\",\"restInCommitStream\":0}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1006, '{\"streamId\":\"E1xAJ6NPsS\",\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":16,\"commitId\":\"de2f5521-572c-442d-b3c8-9803f8eae35c\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:31:18.724Z\",\"payload\":{\"name\":\"sales_channel_instance_vehicle_started\",\"payload\":{\"startAt\":\"2018-10-22T22:31:18.269Z\"},\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"de2f5521-572c-442d-b3c8-9803f8eae35c0\",\"restInCommitStream\":0}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1007, '{\"streamId\":\"E1xAJ6NPsS\",\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":17,\"commitId\":\"de2f5521-572c-442d-b3c8-9803f8eae35c\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:31:18.724Z\",\"payload\":{\"name\":\"sales_channel_instance_vehicle_started\",\"payload\":{\"startAt\":\"2018-10-22T22:31:18.269Z\"},\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"de2f5521-572c-442d-b3c8-9803f8eae35c0\",\"restInCommitStream\":0}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1008, '{\"streamId\":\"E1xAJ6NPsS\",\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":18,\"commitId\":\"de2f5521-572c-442d-b3c8-9803f8eae35c\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:31:18.724Z\",\"payload\":{\"name\":\"sales_channel_instance_vehicle_started\",\"payload\":{\"startAt\":\"2018-10-22T22:31:18.269Z\"},\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"de2f5521-572c-442d-b3c8-9803f8eae35c0\",\"restInCommitStream\":0}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1009, '{\"streamId\":\"E1xAJ6NPsS\",\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":19,\"commitId\":\"de2f5521-572c-442d-b3c8-9803f8eae35c\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:31:18.724Z\",\"payload\":{\"name\":\"sales_channel_instance_vehicle_started\",\"payload\":{\"startAt\":\"2018-10-22T22:31:18.269Z\"},\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"de2f5521-572c-442d-b3c8-9803f8eae35c0\",\"restInCommitStream\":0}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1010, '{\"streamId\":\"E1xAJ6NPsS\",\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":20,\"commitId\":\"de2f5521-572c-442d-b3c8-9803f8eae35c\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:31:18.724Z\",\"payload\":{\"name\":\"sales_channel_instance_vehicle_started\",\"payload\":{\"startAt\":\"2018-10-22T22:31:18.269Z\"},\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"de2f5521-572c-442d-b3c8-9803f8eae35c0\",\"restInCommitStream\":0}');

          vehicleIds.push(id);
        }

        pipeline.exec(() => {
          setTimeout(() => {
            start();
          }, 3000);
        });
      });
    });
  });

  bench(`${numVehicles} vehicles @9x`, function (next, a, b, c) {
    const start = Date.now();
    let doneCounter = 0;
    const maybeNext = function () {
      if (++doneCounter === +batchSize) {
        const end = Date.now();
        console.log({
          start: start,
          end: end,
          duration: `${end - start}ms`
        });
        next();
      }
    }
    for (let i = 0; i < batchSize; i++) {
      const vehicleKey = vehicleIds[i];
      getFromSnapshot(vehicleKey, 'salesChannelInstanceVehicle', 'auction', '')
        .then(() => {
          return getFromSnapshot(vehicleKey, 'salesChannelInstanceVehicle', 'auction', '');
        })
        .then(() => {
          return getFromSnapshot(vehicleKey, 'salesChannelInstanceVehicle', 'auction', '');
        })
        .then(() => {
          return getFromSnapshot(vehicleKey, 'salesChannelInstanceVehicle', 'auction', '');
        })
        .then((data) => {

          return {
            data: data,
            events: [{
              name: 'vehicle_created',
              payload: payload
            }]
          };
        }).then((res) => {
          return new Promise((resolve, reject) => {
            const data = res.data;
            const events = res.events;
            const stream = data.stream;
            stream.addEvents(events);
            stream.commit(resolve);
          });

        })
        .then(maybeNext);
    }
  });

  after(function (cb) {
    cleanData(cb);
  });
});

suite('adrai eventstore with fast-redis backend, with pipelining and batched executed @7x', function () {
  let es;
  let counter = 0;

  const batchSize = process.env.BATCH_SIZE || 500;
  const numVehicles = process.env.NUM_VEHICLES || 1500;
  const iterations = Math.ceil(numVehicles / batchSize);

  console.log({
    batchSize: batchSize,
    numVehicles: numVehicles,
    iterations: iterations
  });

  set('mintime', 0);
  set('iterations', iterations);
  set('concurrency', iterations);

  const getFromSnapshot = function (aggregateId, aggregate, context, partitionKey) {
    return new Promise((resolve, reject) => {
      es.getFromSnapshot({
        aggregateId: aggregateId,
        aggregate: aggregate, // optional
        context: context, // optional
        partitionKey: partitionKey
      }, function (err, snapshot, stream) {
        if (err) {
          console.error(err);
        }
        resolve({
          snapshot: snapshot,
          stream: stream,
          error: err
        });
      });
    });
  }

  let vehicleIds = [];
  before(function (start) {
    const FastRedisEventStore = require('./fast-redis.eventstore');

    const options = {
      type: FastRedisEventStore,
      host: process.env.CACHE_HOST,
      port: process.env.CACHE_PORT,
      isCluster: false,
      prefix: 'bench',
      pipelined: true
    };

    es = require('eventstore')(options);
    es.init(function () {
      const shortid = require('shortid');
      const Redis = require('ioredis');

      const redis = new Redis(process.env.CACHE_PORT, process.env.CACHE_HOST);

      redis.on('ready', () => {
        const pipeline = redis.pipeline();
        for (let index = 0; index < numVehicles; index++) {
          const id = shortid.generate();
          pipeline.set(`bench:salesChannelInstanceVehicle:aggregate:${id}:snapshot`, '{\"id\":\"ac1d9137-4afe-4f36-85a8-52ee0de5c591\",\"streamId\":\"EySmTVPiS\",\"aggregateId\":\"EySmTVPiS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"commitStamp\":\"2018-10-22T23:01:07.780Z\",\"revision\":9,\"version\":1,\"data\":{\"endedAt\":\"2018-10-23T19:05:00.000Z\",\"clearedAt\":\"2018-10-24T19:00:00.000Z\",\"salesChannelInstanceVehicleId\":\"EySmTVPiS\",\"salesChannelInstanceId\":\"VJg0Fh4vsS\",\"salesChannelId\":\"VJRF34viB\",\"vehicleId\":\"N1TukTVwiB\",\"vin\":\"WAUBFAFL5EN002168\",\"yearId\":2014,\"yearName\":\"2014\",\"makeId\":4,\"makeName\":\"Audi\",\"modelId\":4,\"modelName\":\"A4\",\"trimId\":312872,\"trimName\":\"Premium Sedan 4D\",\"engineId\":5433058,\"engineName\":\"4-Cyl, Turbo, 2.0 Liter\",\"transmissionId\":5433095,\"transmissionName\":\"Auto, 8-Spd Tiptronic\",\"driveTrainId\":5433139,\"driveTrainName\":\"FWD\",\"mileage\":1412,\"exteriorColorId\":6388662,\"exteriorColorName\":\"Black\",\"vehicleType\":\"Sedan\",\"stockNumber\":\"\",\"licenseNumber\":\"\",\"interiorColorId\":\"\",\"interiorColorName\":\"\",\"dealershipId\":\"AAUABAQC\",\"dealershipName\":\"Folsom Flooring\",\"dealerId\":\"GCwcABAY\",\"dealerName\":\"Ryan Goce\",\"dealerFirstName\":\"Ryan\",\"dealerLastName\":\"Goce\",\"dealerPhotoPath\":\"undefined\",\"askingPrice\":10000,\"reservePrice\":9000,\"isBuyNow\":false,\"startBid\":8600,\"categoryId\":1,\"createdAt\":1540246983578,\"updatedAt\":1540247044202,\"postedAt\":1540247044354,\"status\":null,\"kbb\":14625,\"kbbWithMiles\":17070,\"firstPhotoPath\":\"\"}}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1000, '{\"streamId\":\"VybeC6Ewor\",\"aggregateId\":\"VybeC6Ewor\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":10,\"commitId\":\"0661ba37-081a-43a1-934a-840f32b05fea\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:23:42.010Z\",\"payload\":{\"aggregateId\":\"VybeC6Ewor\",\"name\":\"sales_channel_instance_vehicle_added\",\"payload\":{\"startedAt\":\"2018-10-23T19:00:00.000Z\",\"endedAt\":\"2018-10-23T19:05:00.000Z\",\"clearedAt\":\"2018-10-24T19:00:00.000Z\",\"salesChannelInstanceVehicleId\":\"VybeC6Ewor\",\"salesChannelInstanceId\":\"VJg0Fh4vsS\",\"salesChannelId\":\"VJRF34viB\",\"vehicleId\":\"EyR5A2NvjH\",\"vin\":\"WAUBFAFL5EN002168\",\"yearId\":2014,\"yearName\":\"2014\",\"makeId\":4,\"makeName\":\"Audi\",\"modelId\":4,\"modelName\":\"A4\",\"trimId\":312872,\"trimName\":\"Premium Sedan 4D\",\"engineId\":5433058,\"engineName\":\"4-Cyl, Turbo, 2.0 Liter\",\"transmissionId\":5433095,\"transmissionName\":\"Auto, 8-Spd Tiptronic\",\"driveTrainId\":5433139,\"driveTrainName\":\"FWD\",\"mileage\":814,\"exteriorColorId\":6388662,\"exteriorColorName\":\"Black\",\"vehicleType\":\"Sedan\",\"stockNumber\":\"\",\"licenseNumber\":\"\",\"interiorColorId\":\"\",\"interiorColorName\":\"\",\"dealershipId\":\"AAUABAQC\",\"dealershipName\":\"Folsom Flooring\",\"dealerId\":\"GCwcABAY\",\"dealerName\":\"Ryan Goce\",\"dealerFirstName\":\"Ryan\",\"dealerLastName\":\"Goce\",\"dealerPhotoPath\":\"undefined\",\"askingPrice\":10000,\"reservePrice\":9000,\"isBuyNow\":false,\"startBid\":8600,\"categoryId\":1,\"createdAt\":1540246970128,\"updatedAt\":1540247021872,\"postedAt\":1540247022010,\"status\":null,\"kbb\":14625,\"kbbWithMiles\":17070,\"firstPhotoPath\":\"\"},\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"0661ba37-081a-43a1-934a-840f32b05fea0\",\"restInCommitStream\":0}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1001, '{\"streamId\":\"E1xAJ6NPsS\",\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":11,\"commitId\":\"de2f5521-572c-442d-b3c8-9803f8eae35c\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:31:18.724Z\",\"payload\":{\"name\":\"sales_channel_instance_vehicle_started\",\"payload\":{\"startAt\":\"2018-10-22T22:31:18.269Z\"},\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"de2f5521-572c-442d-b3c8-9803f8eae35c0\",\"restInCommitStream\":0}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1002, '{\"streamId\":\"E1xAJ6NPsS\",\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":12,\"commitId\":\"de2f5521-572c-442d-b3c8-9803f8eae35c\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:31:18.724Z\",\"payload\":{\"name\":\"sales_channel_instance_vehicle_started\",\"payload\":{\"startAt\":\"2018-10-22T22:31:18.269Z\"},\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"de2f5521-572c-442d-b3c8-9803f8eae35c0\",\"restInCommitStream\":0}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1003, '{\"streamId\":\"E1xAJ6NPsS\",\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":13,\"commitId\":\"de2f5521-572c-442d-b3c8-9803f8eae35c\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:31:18.724Z\",\"payload\":{\"name\":\"sales_channel_instance_vehicle_started\",\"payload\":{\"startAt\":\"2018-10-22T22:31:18.269Z\"},\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"de2f5521-572c-442d-b3c8-9803f8eae35c0\",\"restInCommitStream\":0}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1004, '{\"streamId\":\"E1xAJ6NPsS\",\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":14,\"commitId\":\"de2f5521-572c-442d-b3c8-9803f8eae35c\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:31:18.724Z\",\"payload\":{\"name\":\"sales_channel_instance_vehicle_started\",\"payload\":{\"startAt\":\"2018-10-22T22:31:18.269Z\"},\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"de2f5521-572c-442d-b3c8-9803f8eae35c0\",\"restInCommitStream\":0}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1005, '{\"streamId\":\"E1xAJ6NPsS\",\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":15,\"commitId\":\"de2f5521-572c-442d-b3c8-9803f8eae35c\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:31:18.724Z\",\"payload\":{\"name\":\"sales_channel_instance_vehicle_started\",\"payload\":{\"startAt\":\"2018-10-22T22:31:18.269Z\"},\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"de2f5521-572c-442d-b3c8-9803f8eae35c0\",\"restInCommitStream\":0}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1006, '{\"streamId\":\"E1xAJ6NPsS\",\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":16,\"commitId\":\"de2f5521-572c-442d-b3c8-9803f8eae35c\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:31:18.724Z\",\"payload\":{\"name\":\"sales_channel_instance_vehicle_started\",\"payload\":{\"startAt\":\"2018-10-22T22:31:18.269Z\"},\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"de2f5521-572c-442d-b3c8-9803f8eae35c0\",\"restInCommitStream\":0}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1007, '{\"streamId\":\"E1xAJ6NPsS\",\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":17,\"commitId\":\"de2f5521-572c-442d-b3c8-9803f8eae35c\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:31:18.724Z\",\"payload\":{\"name\":\"sales_channel_instance_vehicle_started\",\"payload\":{\"startAt\":\"2018-10-22T22:31:18.269Z\"},\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"de2f5521-572c-442d-b3c8-9803f8eae35c0\",\"restInCommitStream\":0}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1008, '{\"streamId\":\"E1xAJ6NPsS\",\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":18,\"commitId\":\"de2f5521-572c-442d-b3c8-9803f8eae35c\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:31:18.724Z\",\"payload\":{\"name\":\"sales_channel_instance_vehicle_started\",\"payload\":{\"startAt\":\"2018-10-22T22:31:18.269Z\"},\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"de2f5521-572c-442d-b3c8-9803f8eae35c0\",\"restInCommitStream\":0}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1009, '{\"streamId\":\"E1xAJ6NPsS\",\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":19,\"commitId\":\"de2f5521-572c-442d-b3c8-9803f8eae35c\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:31:18.724Z\",\"payload\":{\"name\":\"sales_channel_instance_vehicle_started\",\"payload\":{\"startAt\":\"2018-10-22T22:31:18.269Z\"},\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"de2f5521-572c-442d-b3c8-9803f8eae35c0\",\"restInCommitStream\":0}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1010, '{\"streamId\":\"E1xAJ6NPsS\",\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":20,\"commitId\":\"de2f5521-572c-442d-b3c8-9803f8eae35c\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:31:18.724Z\",\"payload\":{\"name\":\"sales_channel_instance_vehicle_started\",\"payload\":{\"startAt\":\"2018-10-22T22:31:18.269Z\"},\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"de2f5521-572c-442d-b3c8-9803f8eae35c0\",\"restInCommitStream\":0}');

          vehicleIds.push(id);
        }

        pipeline.exec(() => {
          setTimeout(() => {
            start();
          }, 3000);
        });
      });
    });
  });

  bench(`${numVehicles} vehicles @7x`, function (next, a, b, c) {
    const start = Date.now();
    let doneCounter = 0;
    const maybeNext = function () {
      if (++doneCounter === +batchSize) {
        const end = Date.now();
        console.log({
          start: start,
          end: end,
          duration: `${end - start}ms`
        });
        next();
      }
    }
    for (let i = 0; i < batchSize; i++) {
      const vehicleKey = vehicleIds[i];
      getFromSnapshot(vehicleKey, 'salesChannelInstanceVehicle', 'auction', '')
        .then(() => {
          return getFromSnapshot(vehicleKey, 'salesChannelInstanceVehicle', 'auction', '');
        })
        .then(() => {
          return getFromSnapshot(vehicleKey, 'salesChannelInstanceVehicle', 'auction', '');
        })
        .then((data) => {

          return {
            data: data,
            events: [{
              name: 'vehicle_created',
              payload: payload
            }]
          };
        }).then((res) => {
          return new Promise((resolve, reject) => {
            const data = res.data;
            const events = res.events;
            const stream = data.stream;
            stream.addEvents(events);
            stream.commit(resolve);
          });

        })
        .then(maybeNext);
    }
  });

  after(function (cb) {
    cleanData(cb);
  });
});

suite('adrai eventstore with fast-redis backend, with pipelining and batched executed @5x', function () {
  let es;
  let counter = 0;

  const batchSize = process.env.BATCH_SIZE || 500;
  const numVehicles = process.env.NUM_VEHICLES || 1500;
  const iterations = Math.ceil(numVehicles / batchSize);

  console.log({
    batchSize: batchSize,
    numVehicles: numVehicles,
    iterations: iterations
  });

  set('mintime', 0);
  set('iterations', iterations);
  set('concurrency', iterations);

  const getFromSnapshot = function (aggregateId, aggregate, context, partitionKey) {
    return new Promise((resolve, reject) => {
      es.getFromSnapshot({
        aggregateId: aggregateId,
        aggregate: aggregate, // optional
        context: context, // optional
        partitionKey: partitionKey
      }, function (err, snapshot, stream) {
        if (err) {
          console.error(err);
        }
        resolve({
          snapshot: snapshot,
          stream: stream,
          error: err
        });
      });
    });
  }

  let vehicleIds = [];
  before(function (start) {
    const FastRedisEventStore = require('./fast-redis.eventstore');

    const options = {
      type: FastRedisEventStore,
      host: process.env.CACHE_HOST,
      port: process.env.CACHE_PORT,
      isCluster: false,
      prefix: 'bench',
      pipelined: true
    };

    es = require('eventstore')(options);
    es.init(function () {
      const shortid = require('shortid');
      const Redis = require('ioredis');

      const redis = new Redis(process.env.CACHE_PORT, process.env.CACHE_HOST);

      redis.on('ready', () => {
        const pipeline = redis.pipeline();
        for (let index = 0; index < numVehicles; index++) {
          const id = shortid.generate();
          pipeline.set(`bench:salesChannelInstanceVehicle:aggregate:${id}:snapshot`, '{\"id\":\"ac1d9137-4afe-4f36-85a8-52ee0de5c591\",\"streamId\":\"EySmTVPiS\",\"aggregateId\":\"EySmTVPiS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"commitStamp\":\"2018-10-22T23:01:07.780Z\",\"revision\":9,\"version\":1,\"data\":{\"endedAt\":\"2018-10-23T19:05:00.000Z\",\"clearedAt\":\"2018-10-24T19:00:00.000Z\",\"salesChannelInstanceVehicleId\":\"EySmTVPiS\",\"salesChannelInstanceId\":\"VJg0Fh4vsS\",\"salesChannelId\":\"VJRF34viB\",\"vehicleId\":\"N1TukTVwiB\",\"vin\":\"WAUBFAFL5EN002168\",\"yearId\":2014,\"yearName\":\"2014\",\"makeId\":4,\"makeName\":\"Audi\",\"modelId\":4,\"modelName\":\"A4\",\"trimId\":312872,\"trimName\":\"Premium Sedan 4D\",\"engineId\":5433058,\"engineName\":\"4-Cyl, Turbo, 2.0 Liter\",\"transmissionId\":5433095,\"transmissionName\":\"Auto, 8-Spd Tiptronic\",\"driveTrainId\":5433139,\"driveTrainName\":\"FWD\",\"mileage\":1412,\"exteriorColorId\":6388662,\"exteriorColorName\":\"Black\",\"vehicleType\":\"Sedan\",\"stockNumber\":\"\",\"licenseNumber\":\"\",\"interiorColorId\":\"\",\"interiorColorName\":\"\",\"dealershipId\":\"AAUABAQC\",\"dealershipName\":\"Folsom Flooring\",\"dealerId\":\"GCwcABAY\",\"dealerName\":\"Ryan Goce\",\"dealerFirstName\":\"Ryan\",\"dealerLastName\":\"Goce\",\"dealerPhotoPath\":\"undefined\",\"askingPrice\":10000,\"reservePrice\":9000,\"isBuyNow\":false,\"startBid\":8600,\"categoryId\":1,\"createdAt\":1540246983578,\"updatedAt\":1540247044202,\"postedAt\":1540247044354,\"status\":null,\"kbb\":14625,\"kbbWithMiles\":17070,\"firstPhotoPath\":\"\"}}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1000, '{\"streamId\":\"VybeC6Ewor\",\"aggregateId\":\"VybeC6Ewor\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":10,\"commitId\":\"0661ba37-081a-43a1-934a-840f32b05fea\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:23:42.010Z\",\"payload\":{\"aggregateId\":\"VybeC6Ewor\",\"name\":\"sales_channel_instance_vehicle_added\",\"payload\":{\"startedAt\":\"2018-10-23T19:00:00.000Z\",\"endedAt\":\"2018-10-23T19:05:00.000Z\",\"clearedAt\":\"2018-10-24T19:00:00.000Z\",\"salesChannelInstanceVehicleId\":\"VybeC6Ewor\",\"salesChannelInstanceId\":\"VJg0Fh4vsS\",\"salesChannelId\":\"VJRF34viB\",\"vehicleId\":\"EyR5A2NvjH\",\"vin\":\"WAUBFAFL5EN002168\",\"yearId\":2014,\"yearName\":\"2014\",\"makeId\":4,\"makeName\":\"Audi\",\"modelId\":4,\"modelName\":\"A4\",\"trimId\":312872,\"trimName\":\"Premium Sedan 4D\",\"engineId\":5433058,\"engineName\":\"4-Cyl, Turbo, 2.0 Liter\",\"transmissionId\":5433095,\"transmissionName\":\"Auto, 8-Spd Tiptronic\",\"driveTrainId\":5433139,\"driveTrainName\":\"FWD\",\"mileage\":814,\"exteriorColorId\":6388662,\"exteriorColorName\":\"Black\",\"vehicleType\":\"Sedan\",\"stockNumber\":\"\",\"licenseNumber\":\"\",\"interiorColorId\":\"\",\"interiorColorName\":\"\",\"dealershipId\":\"AAUABAQC\",\"dealershipName\":\"Folsom Flooring\",\"dealerId\":\"GCwcABAY\",\"dealerName\":\"Ryan Goce\",\"dealerFirstName\":\"Ryan\",\"dealerLastName\":\"Goce\",\"dealerPhotoPath\":\"undefined\",\"askingPrice\":10000,\"reservePrice\":9000,\"isBuyNow\":false,\"startBid\":8600,\"categoryId\":1,\"createdAt\":1540246970128,\"updatedAt\":1540247021872,\"postedAt\":1540247022010,\"status\":null,\"kbb\":14625,\"kbbWithMiles\":17070,\"firstPhotoPath\":\"\"},\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"0661ba37-081a-43a1-934a-840f32b05fea0\",\"restInCommitStream\":0}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1001, '{\"streamId\":\"E1xAJ6NPsS\",\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":11,\"commitId\":\"de2f5521-572c-442d-b3c8-9803f8eae35c\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:31:18.724Z\",\"payload\":{\"name\":\"sales_channel_instance_vehicle_started\",\"payload\":{\"startAt\":\"2018-10-22T22:31:18.269Z\"},\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"de2f5521-572c-442d-b3c8-9803f8eae35c0\",\"restInCommitStream\":0}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1002, '{\"streamId\":\"E1xAJ6NPsS\",\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":12,\"commitId\":\"de2f5521-572c-442d-b3c8-9803f8eae35c\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:31:18.724Z\",\"payload\":{\"name\":\"sales_channel_instance_vehicle_started\",\"payload\":{\"startAt\":\"2018-10-22T22:31:18.269Z\"},\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"de2f5521-572c-442d-b3c8-9803f8eae35c0\",\"restInCommitStream\":0}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1003, '{\"streamId\":\"E1xAJ6NPsS\",\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":13,\"commitId\":\"de2f5521-572c-442d-b3c8-9803f8eae35c\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:31:18.724Z\",\"payload\":{\"name\":\"sales_channel_instance_vehicle_started\",\"payload\":{\"startAt\":\"2018-10-22T22:31:18.269Z\"},\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"de2f5521-572c-442d-b3c8-9803f8eae35c0\",\"restInCommitStream\":0}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1004, '{\"streamId\":\"E1xAJ6NPsS\",\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":14,\"commitId\":\"de2f5521-572c-442d-b3c8-9803f8eae35c\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:31:18.724Z\",\"payload\":{\"name\":\"sales_channel_instance_vehicle_started\",\"payload\":{\"startAt\":\"2018-10-22T22:31:18.269Z\"},\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"de2f5521-572c-442d-b3c8-9803f8eae35c0\",\"restInCommitStream\":0}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1005, '{\"streamId\":\"E1xAJ6NPsS\",\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":15,\"commitId\":\"de2f5521-572c-442d-b3c8-9803f8eae35c\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:31:18.724Z\",\"payload\":{\"name\":\"sales_channel_instance_vehicle_started\",\"payload\":{\"startAt\":\"2018-10-22T22:31:18.269Z\"},\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"de2f5521-572c-442d-b3c8-9803f8eae35c0\",\"restInCommitStream\":0}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1006, '{\"streamId\":\"E1xAJ6NPsS\",\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":16,\"commitId\":\"de2f5521-572c-442d-b3c8-9803f8eae35c\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:31:18.724Z\",\"payload\":{\"name\":\"sales_channel_instance_vehicle_started\",\"payload\":{\"startAt\":\"2018-10-22T22:31:18.269Z\"},\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"de2f5521-572c-442d-b3c8-9803f8eae35c0\",\"restInCommitStream\":0}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1007, '{\"streamId\":\"E1xAJ6NPsS\",\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":17,\"commitId\":\"de2f5521-572c-442d-b3c8-9803f8eae35c\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:31:18.724Z\",\"payload\":{\"name\":\"sales_channel_instance_vehicle_started\",\"payload\":{\"startAt\":\"2018-10-22T22:31:18.269Z\"},\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"de2f5521-572c-442d-b3c8-9803f8eae35c0\",\"restInCommitStream\":0}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1008, '{\"streamId\":\"E1xAJ6NPsS\",\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":18,\"commitId\":\"de2f5521-572c-442d-b3c8-9803f8eae35c\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:31:18.724Z\",\"payload\":{\"name\":\"sales_channel_instance_vehicle_started\",\"payload\":{\"startAt\":\"2018-10-22T22:31:18.269Z\"},\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"de2f5521-572c-442d-b3c8-9803f8eae35c0\",\"restInCommitStream\":0}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1009, '{\"streamId\":\"E1xAJ6NPsS\",\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":19,\"commitId\":\"de2f5521-572c-442d-b3c8-9803f8eae35c\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:31:18.724Z\",\"payload\":{\"name\":\"sales_channel_instance_vehicle_started\",\"payload\":{\"startAt\":\"2018-10-22T22:31:18.269Z\"},\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"de2f5521-572c-442d-b3c8-9803f8eae35c0\",\"restInCommitStream\":0}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1010, '{\"streamId\":\"E1xAJ6NPsS\",\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":20,\"commitId\":\"de2f5521-572c-442d-b3c8-9803f8eae35c\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:31:18.724Z\",\"payload\":{\"name\":\"sales_channel_instance_vehicle_started\",\"payload\":{\"startAt\":\"2018-10-22T22:31:18.269Z\"},\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"de2f5521-572c-442d-b3c8-9803f8eae35c0\",\"restInCommitStream\":0}');

          vehicleIds.push(id);
        }

        pipeline.exec(() => {
          setTimeout(() => {
            start();
          }, 3000);
        });
      });
    });
  });

  bench(`${numVehicles} vehicles @5x`, function (next, a, b, c) {
    const start = Date.now();
    let doneCounter = 0;
    const maybeNext = function () {
      if (++doneCounter === +batchSize) {
        const end = Date.now();
        console.log({
          start: start,
          end: end,
          duration: `${end - start}ms`
        });
        next();
      }
    }
    for (let i = 0; i < batchSize; i++) {
      const vehicleKey = vehicleIds[i];
      getFromSnapshot(vehicleKey, 'salesChannelInstanceVehicle', 'auction', '')
        .then(() => {
          return getFromSnapshot(vehicleKey, 'salesChannelInstanceVehicle', 'auction', '');
        })
        .then((data) => {

          return {
            data: data,
            events: [{
              name: 'vehicle_created',
              payload: payload
            }]
          };
        }).then((res) => {
          return new Promise((resolve, reject) => {
            const data = res.data;
            const events = res.events;
            const stream = data.stream;
            stream.addEvents(events);
            stream.commit(resolve);
          });

        })
        .then(maybeNext);
    }
  });

  after(function (cb) {
    cleanData(cb);
  });
});

suite('adrai eventstore with fast-redis backend, with pipelining and batched executed @3x', function () {
  let es;
  let counter = 0;

  const batchSize = process.env.BATCH_SIZE || 500;
  const numVehicles = process.env.NUM_VEHICLES || 1500;
  const iterations = Math.ceil(numVehicles / batchSize);

  console.log({
    batchSize: batchSize,
    numVehicles: numVehicles,
    iterations: iterations
  });

  set('mintime', 0);
  set('iterations', iterations);
  set('concurrency', iterations);

  const getFromSnapshot = function (aggregateId, aggregate, context, partitionKey) {
    return new Promise((resolve, reject) => {
      es.getFromSnapshot({
        aggregateId: aggregateId,
        aggregate: aggregate, // optional
        context: context, // optional
        partitionKey: partitionKey
      }, function (err, snapshot, stream) {
        if (err) {
          console.error(err);
        }
        resolve({
          snapshot: snapshot,
          stream: stream,
          error: err
        });
      });
    });
  }

  let vehicleIds = [];
  before(function (start) {
    const FastRedisEventStore = require('./fast-redis.eventstore');

    const options = {
      type: FastRedisEventStore,
      host: process.env.CACHE_HOST,
      port: process.env.CACHE_PORT,
      isCluster: false,
      prefix: 'bench',
      pipelined: true
    };

    es = require('eventstore')(options);
    es.init(function () {
      const shortid = require('shortid');
      const Redis = require('ioredis');

      const redis = new Redis(process.env.CACHE_PORT, process.env.CACHE_HOST);

      redis.on('ready', () => {
        const pipeline = redis.pipeline();
        for (let index = 0; index < numVehicles; index++) {
          const id = shortid.generate();
          pipeline.set(`bench:salesChannelInstanceVehicle:aggregate:${id}:snapshot`, '{\"id\":\"ac1d9137-4afe-4f36-85a8-52ee0de5c591\",\"streamId\":\"EySmTVPiS\",\"aggregateId\":\"EySmTVPiS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"commitStamp\":\"2018-10-22T23:01:07.780Z\",\"revision\":9,\"version\":1,\"data\":{\"endedAt\":\"2018-10-23T19:05:00.000Z\",\"clearedAt\":\"2018-10-24T19:00:00.000Z\",\"salesChannelInstanceVehicleId\":\"EySmTVPiS\",\"salesChannelInstanceId\":\"VJg0Fh4vsS\",\"salesChannelId\":\"VJRF34viB\",\"vehicleId\":\"N1TukTVwiB\",\"vin\":\"WAUBFAFL5EN002168\",\"yearId\":2014,\"yearName\":\"2014\",\"makeId\":4,\"makeName\":\"Audi\",\"modelId\":4,\"modelName\":\"A4\",\"trimId\":312872,\"trimName\":\"Premium Sedan 4D\",\"engineId\":5433058,\"engineName\":\"4-Cyl, Turbo, 2.0 Liter\",\"transmissionId\":5433095,\"transmissionName\":\"Auto, 8-Spd Tiptronic\",\"driveTrainId\":5433139,\"driveTrainName\":\"FWD\",\"mileage\":1412,\"exteriorColorId\":6388662,\"exteriorColorName\":\"Black\",\"vehicleType\":\"Sedan\",\"stockNumber\":\"\",\"licenseNumber\":\"\",\"interiorColorId\":\"\",\"interiorColorName\":\"\",\"dealershipId\":\"AAUABAQC\",\"dealershipName\":\"Folsom Flooring\",\"dealerId\":\"GCwcABAY\",\"dealerName\":\"Ryan Goce\",\"dealerFirstName\":\"Ryan\",\"dealerLastName\":\"Goce\",\"dealerPhotoPath\":\"undefined\",\"askingPrice\":10000,\"reservePrice\":9000,\"isBuyNow\":false,\"startBid\":8600,\"categoryId\":1,\"createdAt\":1540246983578,\"updatedAt\":1540247044202,\"postedAt\":1540247044354,\"status\":null,\"kbb\":14625,\"kbbWithMiles\":17070,\"firstPhotoPath\":\"\"}}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1000, '{\"streamId\":\"VybeC6Ewor\",\"aggregateId\":\"VybeC6Ewor\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":10,\"commitId\":\"0661ba37-081a-43a1-934a-840f32b05fea\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:23:42.010Z\",\"payload\":{\"aggregateId\":\"VybeC6Ewor\",\"name\":\"sales_channel_instance_vehicle_added\",\"payload\":{\"startedAt\":\"2018-10-23T19:00:00.000Z\",\"endedAt\":\"2018-10-23T19:05:00.000Z\",\"clearedAt\":\"2018-10-24T19:00:00.000Z\",\"salesChannelInstanceVehicleId\":\"VybeC6Ewor\",\"salesChannelInstanceId\":\"VJg0Fh4vsS\",\"salesChannelId\":\"VJRF34viB\",\"vehicleId\":\"EyR5A2NvjH\",\"vin\":\"WAUBFAFL5EN002168\",\"yearId\":2014,\"yearName\":\"2014\",\"makeId\":4,\"makeName\":\"Audi\",\"modelId\":4,\"modelName\":\"A4\",\"trimId\":312872,\"trimName\":\"Premium Sedan 4D\",\"engineId\":5433058,\"engineName\":\"4-Cyl, Turbo, 2.0 Liter\",\"transmissionId\":5433095,\"transmissionName\":\"Auto, 8-Spd Tiptronic\",\"driveTrainId\":5433139,\"driveTrainName\":\"FWD\",\"mileage\":814,\"exteriorColorId\":6388662,\"exteriorColorName\":\"Black\",\"vehicleType\":\"Sedan\",\"stockNumber\":\"\",\"licenseNumber\":\"\",\"interiorColorId\":\"\",\"interiorColorName\":\"\",\"dealershipId\":\"AAUABAQC\",\"dealershipName\":\"Folsom Flooring\",\"dealerId\":\"GCwcABAY\",\"dealerName\":\"Ryan Goce\",\"dealerFirstName\":\"Ryan\",\"dealerLastName\":\"Goce\",\"dealerPhotoPath\":\"undefined\",\"askingPrice\":10000,\"reservePrice\":9000,\"isBuyNow\":false,\"startBid\":8600,\"categoryId\":1,\"createdAt\":1540246970128,\"updatedAt\":1540247021872,\"postedAt\":1540247022010,\"status\":null,\"kbb\":14625,\"kbbWithMiles\":17070,\"firstPhotoPath\":\"\"},\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"0661ba37-081a-43a1-934a-840f32b05fea0\",\"restInCommitStream\":0}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1001, '{\"streamId\":\"E1xAJ6NPsS\",\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":11,\"commitId\":\"de2f5521-572c-442d-b3c8-9803f8eae35c\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:31:18.724Z\",\"payload\":{\"name\":\"sales_channel_instance_vehicle_started\",\"payload\":{\"startAt\":\"2018-10-22T22:31:18.269Z\"},\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"de2f5521-572c-442d-b3c8-9803f8eae35c0\",\"restInCommitStream\":0}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1002, '{\"streamId\":\"E1xAJ6NPsS\",\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":12,\"commitId\":\"de2f5521-572c-442d-b3c8-9803f8eae35c\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:31:18.724Z\",\"payload\":{\"name\":\"sales_channel_instance_vehicle_started\",\"payload\":{\"startAt\":\"2018-10-22T22:31:18.269Z\"},\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"de2f5521-572c-442d-b3c8-9803f8eae35c0\",\"restInCommitStream\":0}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1003, '{\"streamId\":\"E1xAJ6NPsS\",\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":13,\"commitId\":\"de2f5521-572c-442d-b3c8-9803f8eae35c\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:31:18.724Z\",\"payload\":{\"name\":\"sales_channel_instance_vehicle_started\",\"payload\":{\"startAt\":\"2018-10-22T22:31:18.269Z\"},\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"de2f5521-572c-442d-b3c8-9803f8eae35c0\",\"restInCommitStream\":0}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1004, '{\"streamId\":\"E1xAJ6NPsS\",\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":14,\"commitId\":\"de2f5521-572c-442d-b3c8-9803f8eae35c\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:31:18.724Z\",\"payload\":{\"name\":\"sales_channel_instance_vehicle_started\",\"payload\":{\"startAt\":\"2018-10-22T22:31:18.269Z\"},\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"de2f5521-572c-442d-b3c8-9803f8eae35c0\",\"restInCommitStream\":0}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1005, '{\"streamId\":\"E1xAJ6NPsS\",\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":15,\"commitId\":\"de2f5521-572c-442d-b3c8-9803f8eae35c\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:31:18.724Z\",\"payload\":{\"name\":\"sales_channel_instance_vehicle_started\",\"payload\":{\"startAt\":\"2018-10-22T22:31:18.269Z\"},\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"de2f5521-572c-442d-b3c8-9803f8eae35c0\",\"restInCommitStream\":0}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1006, '{\"streamId\":\"E1xAJ6NPsS\",\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":16,\"commitId\":\"de2f5521-572c-442d-b3c8-9803f8eae35c\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:31:18.724Z\",\"payload\":{\"name\":\"sales_channel_instance_vehicle_started\",\"payload\":{\"startAt\":\"2018-10-22T22:31:18.269Z\"},\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"de2f5521-572c-442d-b3c8-9803f8eae35c0\",\"restInCommitStream\":0}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1007, '{\"streamId\":\"E1xAJ6NPsS\",\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":17,\"commitId\":\"de2f5521-572c-442d-b3c8-9803f8eae35c\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:31:18.724Z\",\"payload\":{\"name\":\"sales_channel_instance_vehicle_started\",\"payload\":{\"startAt\":\"2018-10-22T22:31:18.269Z\"},\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"de2f5521-572c-442d-b3c8-9803f8eae35c0\",\"restInCommitStream\":0}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1008, '{\"streamId\":\"E1xAJ6NPsS\",\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":18,\"commitId\":\"de2f5521-572c-442d-b3c8-9803f8eae35c\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:31:18.724Z\",\"payload\":{\"name\":\"sales_channel_instance_vehicle_started\",\"payload\":{\"startAt\":\"2018-10-22T22:31:18.269Z\"},\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"de2f5521-572c-442d-b3c8-9803f8eae35c0\",\"restInCommitStream\":0}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1009, '{\"streamId\":\"E1xAJ6NPsS\",\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":19,\"commitId\":\"de2f5521-572c-442d-b3c8-9803f8eae35c\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:31:18.724Z\",\"payload\":{\"name\":\"sales_channel_instance_vehicle_started\",\"payload\":{\"startAt\":\"2018-10-22T22:31:18.269Z\"},\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"de2f5521-572c-442d-b3c8-9803f8eae35c0\",\"restInCommitStream\":0}');
          pipeline.zadd(`bench:salesChannelInstanceVehicle:aggregate:${id}:events`, 1010, '{\"streamId\":\"E1xAJ6NPsS\",\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\",\"context\":\"auction\",\"streamRevision\":20,\"commitId\":\"de2f5521-572c-442d-b3c8-9803f8eae35c\",\"commitSequence\":0,\"commitStamp\":\"2018-10-22T22:31:18.724Z\",\"payload\":{\"name\":\"sales_channel_instance_vehicle_started\",\"payload\":{\"startAt\":\"2018-10-22T22:31:18.269Z\"},\"aggregateId\":\"E1xAJ6NPsS\",\"aggregate\":\"salesChannelInstanceVehicle\"},\"position\":null,\"id\":\"de2f5521-572c-442d-b3c8-9803f8eae35c0\",\"restInCommitStream\":0}');

          vehicleIds.push(id);
        }

        pipeline.exec(() => {
          setTimeout(() => {
            start();
          }, 3000);
        });
      });
    });
  });

  bench(`${numVehicles} vehicles @3x`, function (next, a, b, c) {
    const start = Date.now();
    let doneCounter = 0;
    const maybeNext = function () {
      if (++doneCounter === +batchSize) {
        const end = Date.now();
        console.log({
          start: start,
          end: end,
          duration: `${end - start}ms`
        });
        next();
      }
    }
    for (let i = 0; i < batchSize; i++) {
      const vehicleKey = vehicleIds[i];
      getFromSnapshot(vehicleKey, 'salesChannelInstanceVehicle', 'auction', '')
        .then((data) => {

          return {
            data: data,
            events: [{
              name: 'vehicle_created',
              payload: payload
            }]
          };
        }).then((res) => {
          return new Promise((resolve, reject) => {
            const data = res.data;
            const events = res.events;
            const stream = data.stream;
            stream.addEvents(events);
            stream.commit(resolve);
          });

        })
        .then(maybeNext);
    }
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