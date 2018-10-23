var Store = require('eventstore').Store,
    util = require('util'),
    _ = require('lodash');

const shortid = require('shortid');

const Redis = require('ioredis');

let durationMap = {};

setInterval(() => {
    // _.each(Object.keys(durationMap), (key) => {
    //     console.log(`${key}. ${durationMap[key].totalDuration / durationMap[key].totalItems} ave. ${durationMap[key].max} max. ${durationMap[key].totalDuration}/${durationMap[key].totalItems} total duration/items`);
    // });

    durationMap = {};
}, 10000);

const addDuration = function(name, start, end) {
    let duration = durationMap[name];

    if (!duration) {
        duration = {
            totalItems: 0,
            totalDuration: 0,
            max: 0
        }

        durationMap[name] = duration;
    }

    const newDuration = end - start;
    duration.totalItems++;
    duration.totalDuration += newDuration;
    if (newDuration > duration.max) {
        duration.max = newDuration;
    }
}

function FastRedis(opts) {
    console.log(opts);
    var options = _.defaults(opts || {}, {
        prefix: '',
        maxSnapshotLength: 10000,
        maxEventLength: 10000,
        pipelined: false
    });

    this._clients = [];
    this._clientsCounter = 0;
    this.options = options;
    this._undispatchedEvents = [];
    this._pipeline = {};
    this._pipelineCounter = -1;
    this._pipelineCallbacks = [];
    this._pipelineNagleTimeout = null;
    Store.call(this, options);
}

util.inherits(FastRedis, Store);

_.extend(FastRedis.prototype, {

    _waitForExec: function(callback) {
        const self = this;
        const nagleBatchLen = 100;
        const pipeline = self._pipeline;
        self._pipelineCallbacks.push(callback);

        const continueExec = function() {
            const callbacks = _.cloneDeep(self._pipelineCallbacks);
            const startExec = Date.now();

            const start = Date.now();
            self._pipeline.exec().then((data) => {
                if (data.length >= 100) {
                    // console.log(`executed batched redis commands: ${data.length}. start: ${start}; end: ${Date.now()}`);
                }

                addDuration('pipeline.exec', startExec, Date.now());

                for (let idx = 0; idx < callbacks.length; idx++) {
                    const cb = callbacks[idx];

                    let res = null;
                    let err = null;
                    if (data) {
                        if (data.length > idx) {
                            err = data[idx][0]
                            res = data[idx][1];
                        }
                    }
                    cb(null, res);
                }
            });

            //reset callbacks and pipeline
            self._pipelineCallbacks = [];
            self._pipeline = self.getClient().pipeline();
            clearTimeout(self._pipelineNagleTimeout);
            self._pipelineNagleTimeout = null;
        };

        if (pipeline.length >= nagleBatchLen) {
            // console.log(`reached batched nagle len: ${nagleBatchLen}. on: ${Date.now()}`);
            continueExec();
        } else {
            if (!self._pipelineNagleTimeout) {
                self._pipelineNagleTimeout = setTimeout(() => {
                    // console.log(`reached nagle timeout with len: ${self._pipeline.length}. on: ${Date.now()}`);
                    continueExec();
                }, 100);
            }
        }
    },
    get: function(key, cb) {
        const self = this;
        self._pipeline.get(key);
        self._waitForExec(cb);
    },
    set: function(key, value, cb) {
        const self = this;
        self._pipeline.set(key, value);
        self._waitForExec(cb);
    },
    zrangebyscore: function(key, min, max, cb) {
        const self = this;
        self._pipeline.zrangebyscore(key, min, max);
        self._waitForExec(cb);
    },
    zadd: function(key, score, value, cb) {
        const self = this;
        self._pipeline.zadd(key, score, value);
        self._waitForExec(cb);
    },

    _getLastRevision: function(query) {
        console.log('getlastrevision called');
        const options = this.options;
        const prefix = this._getPrefix(query.aggregate);
        return this.getClient().get(`${prefix}aggregate:${query.aggregateId}:revision`);
    },

    _getPrefix: function(aggregate) {
        const options = this.options;
        let prefix = '';
        if (options.prefix) {
            prefix = options.prefix + ':';
        }

        if (aggregate) {
            prefix += aggregate + ':';
        }
        return prefix;
    },

    /**
     * Initiate communication with the queue.
     * @param {Function} callback The function, that will be called when the this action is completed. [optional]
     * `function(err, queue){}`
     */
    connect: function(callback) {
        var self = this;

        var options = this.options;

        const clientCount = 1;
        let clientReady = 0;
        const client = new Redis(options.port, options.host);
        self.client = client;

        client.on('ready', () => {
            clientReady++;

            if (clientReady === clientCount) {
                self._pipeline = client.pipeline();
                callback();
            }
        })

        setInterval(() => {
            // const clientsCounter = _.map(self._clients, (client) => {
            //     return client.counter;
            // });
            // console.log(clientsCounter);
        }, 10000);
        // this.client.on('ready', () => {
        //     console.log('redis client ready');
        //     callback();
        // });
    },


    getClient: function() {
        return this.client;
    },

    /**
     * Terminate communication with the queue.
     * @param {Function} callback The function, that will be called when the this action is completed. [optional]
     * `function(err){}`
     */
    disconnect: function(callback) {
        this.getClient().disconnect();
        callback();
    },

    /**
     * loads the events
     * @param {Object} query the query object
     * @param {Number} skip how many events should be skipped?
     * @param {Number} limit how many events do you want in the result?
     * @param {Function} callback the function that will be called when this action has finished
     * `function(err, events){}`
     */
    getEvents: function(query, skip, limit, callback) {
        implementError(callback);
    },

    /**
     * loads all the events since passed commitStamp
     * @param {Date} commitStamp the date object
     * @param {Number} skip how many events should be skipped? [optional]
     * @param {Number} limit how many events do you want in the result? [optional]
     * @param {Function} callback the function that will be called when this action has finished
     * `function(err, events){}`
     */
    getEventsSince: function(commitStamp, skip, limit, callback) {
        implementError(callback);
    },

    /**
     * loads the events
     * @param {Object} query the query object
     * @param {Number} revMin revision start point
     * @param {Number} revMax revision end point (hint: -1 = to end)
     * @param {Function} callback the function that will be called when this action has finished
     * `function(err, events){}`
     */
    getEventsByRevision: function(query, revMin, revMax, callback) {
        const options = this.options;

        let redisCommandHandler = this.getClient();
        if (options.pipelined) {
            redisCommandHandler = this;
        }

        const self = this;
        const prefix = this._getPrefix(query.aggregate);
        const start = new Date().getTime();
        redisCommandHandler.zrangebyscore(`${prefix}aggregate:${query.aggregateId}:events`, revMin, revMax === -1 ? '+inf' : revMax, (err, data) => {
            const end = new Date().getTime();
            if (end - start > 100) {
                // console.warn(`getEventsByRevision greater than 100ms. actual ${end - start}ms. len: ${JSON.stringify(data).length}`);
            }

            addDuration('getEventsByRevision', start, end);
            const events = _.map(data, (item) => JSON.parse(item));
            callback(null, events);
        });
    },

    /**
     * loads the next snapshot back from given max revision
     * @param {Object} query the query object
     * @param {Number} revMax revision end point (hint: -1 = to end)
     * @param {Function} callback the function that will be called when this action has finished
     * `function(err, snapshot){}`
     */
    getSnapshot: function(query, revMax, callback) {
        const self = this;
        const options = this.options;

        let redisCommandHandler = this.getClient();
        if (options.pipelined) {
            redisCommandHandler = this;
        }

        const prefix = this._getPrefix(query.aggregate);
        // query = { aggregateId: 'abc' }
        // revMax = -1 //
        const redis = this.getClient();
        const key = `${prefix}aggregate:${query.aggregateId}:snapshot`;
        const start = new Date().getTime();
        redisCommandHandler.get(key, (err, data) => {
            const end = new Date().getTime();
            if (end - start > 100) {
                // console.warn(`getSnapshot greater than 100ms. actual ${end - start}ms`);
            }
            addDuration('getSnapshot', start, end);
            const obj = JSON.parse(data)
            callback(null, obj);
        });
    },

    /**
     * stores a new snapshot
     * @param {Object} snap the snapshot data
     * @param {Function} callback the function that will be called when this action has finished [optional]
     */
    addSnapshot: function(snap, callback) {
        const self = this;
        const options = this.options;

        let redisCommandHandler = this.getClient();
        if (options.pipelined) {
            redisCommandHandler = this;
        }
        
        const prefix = this._getPrefix(snap.aggregate);
        const key = `${prefix}aggregate:${snap.aggregateId}:snapshot`;

        const redis = this.getClient();

        const serializedSnapshot = JSON.stringify(snap);

        if (serializedSnapshot.length > options.maxSnapshotLength) { // snapshots should be less than 40k in length
            console.warn(`WARNING: SAVING BIG SNAPSHOT WITH LENGTH: ${serializedSnapshot.length} AND THRESHOLD: ${options.maxSnapshotLength}. NEED TO REVIEW IMPLEMENTATION`)
        }
        const start = new Date().getTime();
        return redisCommandHandler.set(key, serializedSnapshot, (err, data) => {
            const end = new Date().getTime();
            if (end - start > 100) {
                // console.warn(`addSnapshot greater than 100ms. actual ${end - start}ms`);
            }

            addDuration('addSnapshot', start, end);

            if (err) {
                console.error(err);
                callback(err);
            } else {
                callback(null, data);
            }

        });
    },

    /**
     * stores a new snapshot
     * @param {Object} query the query object
     * @param {Function} callback the function that will be called when this action has finished [optional]
     */
    cleanSnapshots: function(query, callback) {
        silentWarning(callback);
    },

    /**
     * stores the passed events
     * @param {Array} evts the events
     * @param {Function} callback the function that will be called when this action has finished [optional]
     */
    addEvents: function(evts, callback) {
        const options = this.options;
        const self = this;

        let redisCommandHandler = this.getClient();
        if (options.pipelined) {
            redisCommandHandler = this;
        }

        const maxEvents = 10;
        const redis = this.getClient();



        const tasks = [];
        _.each(evts, (item) => {
            const prefix = self._getPrefix(item.aggregate);
            const sItem = JSON.stringify(item);
            if (sItem.length > options.maxEventLength) {
                console.warn(`WARNING: SAVING BIG EVENT WITH LENGTH: ${sItem.length} AND THRESHOLD: ${options.maxEventLength}. NEED TO REVIEW IMPLEMENTATION`)
            }

            tasks.push(new Promise((resolve, reject) => {
                redisCommandHandler.zadd(`${prefix}aggregate:${item.aggregateId}:events`, +item.streamRevision, sItem, (err, data) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(data);
                    }
                });
            }));

            // pipeline.set(`${options.prefix}:undispatched-events:${item.id}`, sItem);
        });

        const start = Date.now();
        Promise.all(tasks).then(() => {
            const end = new Date().getTime();

            addDuration('addEvents', start, end);

            callback();

            // if (err) {
            //     // TODO: handler error
            //     console.error('hasError');
            //     console.error(err);
            //     callback(err);
            // } else {
            //     callback();
            // }
        });

        // set the last revision
        // if (evts.length > 0) {
        //     const lastEvent = _.last(evts);
        //     const prefix = self._getPrefix(lastEvent.aggregate);
        //     // pipeline.set(`${prefix}aggregate:${lastEvent.aggregateId}:revision`, lastEvent.streamRevision);
        // }

    },

    /**
     * loads the last event
     * @param {Object} query the query object [optional]
     * @param {Function} callback the function that will be called when this action has finished
     * `function(err, event){}`
     */
    getLastEvent: function(query, callback) {
        implementError(callback);
    },

    /**
     * loads all undispatched events
     * @param {Object} query the query object [optional]
     * @param {Function} callback the function that will be called when this action has finished
     * `function(err, events){}`
     */
    getUndispatchedEvents: function(query, callback) {

        callback(null, []);

        // NOTE: disabling for now because bounded aggregates dont send to message bus
        // setTimeout(() => {
        //     const redis = this.client;
        // const options = this.options;

        // redis.defineCommand('getUndispatchedEvents', {
        //     numberOfKeys: 0,
        //     lua: `
        //         local keys=redis.call('keys', '${options.prefix}:undispatched-events:*')
        //         local retv={}
        //         for _,key in ipairs(keys) do    
        //             retv[_] = redis.call('get', key);
        //         end

        //         return retv;
        //     `
        //   });

        // redis.getUndispatchedEvents([])
        // .then((data) => {
        //     const parsedData = _.map(data, (item) => {
        //         return JSON.parse(item);
        //     });

        //     callback(null, parsedData);
        // })
        // .catch((err) => {
        //     callback(err);
        // });
        // }, 10000);

    },

    /**
     * Sets the given event to dispatched.
     * @param {String} id the event id
     * @param {Function} callback the function that will be called when this action has finished [optional]
     */
    setEventToDispatched: function(id, callback) {
        callback();
        // const options = this.options;
        // const redis = this.getClient();

        // const start = new Date().getTime();
        // redis.del(`${options.prefix}:undispatched-events:${id}`)
        //     .then(() => {
        //         const end = new Date().getTime();
        //         if (end - start > 100) {
        //             // console.warn(`setEventToDispatched greater than 100ms. actual ${end - start}ms`);
        //         }
        //         addDuration('setEventToDispatched', start, end);
        //         callback();
        //     })
        //     .catch((err) => {
        //         callback(err);
        //     });
    },

    /**
     * NEVER USE THIS FUNCTION!!! ONLY FOR TESTS!
     * clears the complete store...
     * @param {Function} callback the function that will be called when this action has finished [optional]
     */
    clear: function(callback) {
        implementError(callback);
    }
});

module.exports = FastRedis;