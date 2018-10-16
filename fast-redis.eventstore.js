var Store = require('eventstore').Store,
    util = require('util'),
    _ = require('lodash');
const calculateSlot = require('cluster-key-slot');
const Redis = require('ioredis');

let durationMap = {};
let totalItems = 0;
let totalDuration = 0;

setInterval(() => {
    // _.each(Object.keys(durationMap), (key) => {
    //     console.log(`${key}. ${durationMap[key].totalDuration / durationMap[key].totalItems} ave. ${durationMap[key].max} max.`);
    // });

    durationMap = {};
}, 10000);

const addDuration = function (name, start, end) {
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
    var options = _.defaults(opts || {}, {
        prefix: '',
        maxSnapshotLength: 10000,
        maxEventLength: 10000,
        clusterSize: 3,
        pipelined: false
    });

    this._clients = [];
    this._clientsCounter = 0;
    this.options = options;
    this._undispatchedEvents = [];
    this._pipeline = {};
    this._pipelines = {};
    this._pipelineCounter = -1;
    this._pipelineCallbacks = [];
    this._pipelineNagleTimeout = null;
    this._pipelineCounters = 0;

    Store.call(this, options);
}

util.inherits(FastRedis, Store);

_.extend(FastRedis.prototype, {

    _waitForExec: function (key, callback) {
        const self = this;
        const pipeline = self.getPipeline(key);
        pipeline.callbacks.push(callback);

        const continueExec = function () {
            const callbacks = _.cloneDeep(pipeline.callbacks);
            pipeline.exec().then((err, data) => {
                for (let idx = 0; idx < callbacks.length; idx++) {
                    const cb = callbacks[idx];

                    let res = null;
                    if (data) {
                        if (data.length > idx) {
                            res = data[idx];
                        }
                    }
                    cb(res);
                }
            });

            //reset callbacks and pipeline
            self.resetPipeline(key);
        };

        if (pipeline.length >= 100) {
            continueExec();
        } else {
            if (!pipeline.nagleTimeout) {
                pipeline.nagleTimeout = setTimeout(() => {
                    // console.log(`timed out continueExec: pipelinelen: ${pipeline.length}`);
                    continueExec();
                }, 100);
            }
        }
    },
    get: function (key) {
        const self = this;
        self.getPipeline(key).get(key);

        const task = new Promise((resolve, reject) => {
            self._waitForExec(key, function (data) {
                resolve(data);
            });
        });

        return task;
    },
    zrange: function (key, min, max) {
        const self = this;
        self.getPipeline(key).zrange(key, min, max);

        const task = new Promise((resolve, reject) => {
            self._waitForExec(key, function (data) {
                resolve(data);
            });
        });

        return task;
    },

    zadd: function (key, score, value) {
        const self = this;
        self.getPipeline(key).zadd(key, score, value);

        const task = new Promise((resolve, reject) => {
            self._waitForExec(key, function (data) {
                resolve(data);
            });
        });

        return task;
    },

    _getLastRevision: function (query) {
        console.log('getlastrevision called');
        const options = this.options;
        this._getPrefix(query.aggregate, query.partitionKey);
        return this.getClient().get(`${prefix}aggregate:${query.aggregateId}:revision`);
    },

    _getPrefix: function (aggregate, partitionKey) {
        const options = this.options;
        let prefix = '';

        if (partitionKey) {
            prefix += `{${partitionKey}}` + ':'
        }
        if (options.prefix) {
            prefix += options.prefix + ':';
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
    connect: function (callback) {
        var self = this;

        var options = this.options;

        const clientCount = 1;
        let clientReady = 0;
        if (options.isCluster) {
            console.log(`connecting via redis cluster ${options.host}:${options.port}`);
            const client = new Redis.Cluster([{
                port: options.port,
                host: options.host
            }]);

            self.client = client;

            client.on('ready', () => {
                console.log('cluster ready');
                clientReady++;

                if (clientReady === clientCount) {
                    callback();
                }
            })
        } else {
            const client = new Redis(options.port, options.host);
            self.client = client;

            client.on('ready', () => {
                clientReady++;

                if (clientReady === clientCount) {
                    self._pipeline = client.pipeline();
                    self._pipeline.callbacks = [];
                    callback();
                }
            })
        }

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


    getClient: function () {
        // this._clientsCounter++;
        // const index = this._clientsCounter % this._clients.length;

        // const client = this._clients[index];
        // client.counter = client.counter || 0;
        // client.counter++;

        const options = this.options;

        if (options.pipelined) {
            return this;
        } else {
            return this.client;
        }
    },

    resetPipeline: function (key) {
        const self = this;

        if (this.options.isCluster) {
            const slot = calculateSlot(key);

            const pipeline = self._pipelines[slot];

            if (pipeline) {
                pipeline.callbacks = [];
                clearTimeout(pipeline.nagleTimeout);
                pipeline.nagleTimeout = null;

                delete self._pipelines[slot];
            }

            self.getPipeline(key); // to create again
        } else {
            clearTimeout(self._pipeline.nagleTimeout);
            self._pipeline.nagleTimeout = null;

            self._pipeline = self.client.pipeline();
            self._pipeline.callbacks = [];
        }

    },

    getPipeline: function (key) {
        const self = this;
        const options = this.options;
        if (options.isCluster) {
            const slot = calculateSlot(key);
            if (!self._pipelines[slot]) {
                const pipeline = self.getClient().pipeline();
                pipeline.callbacks = [];
                self._pipelines[slot] = pipeline;
            }

            return self._pipelines[slot];
        } else {
            return self._pipeline;
        }
    },

    /**
     * Terminate communication with the queue.
     * @param {Function} callback The function, that will be called when the this action is completed. [optional]
     * `function(err){}`
     */
    disconnect: function (callback) {
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
    getEvents: function (query, skip, limit, callback) {
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
    getEventsSince: function (commitStamp, skip, limit, callback) {
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
    getEventsByRevision: function (query, revMin, revMax, callback) {
        const options = this.options;
        const redis = this.getClient();
        const self = this;

        const prefix = this._getPrefix(query.aggregate, query.partitionKey);
        const start = new Date().getTime();
        redis.zrange(`${prefix}aggregate:${query.aggregateId}:events`, revMin, revMax)
            .then((data) => {
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
    getSnapshot: function (query, revMax, callback) {
        const self = this;
        const options = this.options;
        const prefix = this._getPrefix(query.aggregate, query.partitionKey);
        // query = { aggregateId: 'abc' }
        // revMax = -1 //
        const redis = this.getClient();
        const key = `${prefix}aggregate:${query.aggregateId}:snapshot`;
        const start = new Date().getTime();
        redis.get(key).then(((data) => {
            const end = new Date().getTime();
            if (end - start > 100) {
                // console.warn(`getSnapshot greater than 100ms. actual ${end - start}ms`);
            }
            addDuration('getSnapshot', start, end);
            const obj = JSON.parse(data)
            callback(null, obj);
        }));
    },

    /**
     * stores a new snapshot
     * @param {Object} snap the snapshot data
     * @param {Function} callback the function that will be called when this action has finished [optional]
     */
    addSnapshot: function (snap, callback) {
        // const options = this.options;
        // const prefix = this._getPrefix(snap.aggregate);
        // const key = `${prefix}aggregate:${snap.aggregateId}:snapshot`;

        // const redis = this.getClient();

        // const serializedSnapshot = JSON.stringify(snap);

        // if (serializedSnapshot.length > options.maxSnapshotLength) { // snapshots should be less than 40k in length
        //     console.warn(`WARNING: SAVING BIG SNAPSHOT WITH LENGTH: ${serializedSnapshot.length} AND THRESHOLD: ${options.maxSnapshotLength}. NEED TO REVIEW IMPLEMENTATION`)
        // }
        // const start = new Date().getTime();
        // return redis.set(key, serializedSnapshot)
        //     .then((data) => {
        //         const end = new Date().getTime();
        //         if (end - start > 100) {
        //             // console.warn(`addSnapshot greater than 100ms. actual ${end - start}ms`);
        //         }

        //         addDuration('addSnapshot', start, end);
        //         callback(null, data);
        //     })
        //     .catch((err) => {
        //         callback(err);
        //     });
    },

    /**
     * stores a new snapshot
     * @param {Object} query the query object
     * @param {Function} callback the function that will be called when this action has finished [optional]
     */
    cleanSnapshots: function (query, callback) {
        silentWarning(callback);
    },

    /**
     * stores the passed events
     * @param {Array} evts the events
     * @param {Function} callback the function that will be called when this action has finished [optional]
     */
    addEvents: function (evts, callback) {
        const options = this.options;
        const self = this;

        const maxEvents = 10;
        const redis = this.getClient();

        const key = 'ams:es:vehicle:{vehicleId1}';

        // _.each(evts, (item) => {
        //     const prefix = self._getPrefix(item.aggregate);
        //     const sItem = JSON.stringify(item);
        //     if (sItem.length > options.maxEventLength) {
        //         console.warn(`WARNING: SAVING BIG EVENT WITH LENGTH: ${sItem.length} AND THRESHOLD: ${options.maxEventLength}. NEED TO REVIEW IMPLEMENTATION`)
        //     }
        //     redis.zadd(`${prefix}aggregate:${item.aggregateId}:events`, item.streamRevision, sItem);
        //     // pipeline.set(`${options.prefix}:undispatched-events:${item.id}`, sItem);
        // });

        const item = evts[0];

        // set the last revision
        // if (evts.length > 0) {
        //     const lastEvent = _.last(evts);
        //     const prefix = self._getPrefix(lastEvent.aggregate);
        //     // pipeline.set(`${prefix}aggregate:${lastEvent.aggregateId}:revision`, lastEvent.streamRevision);
        // }

        const prefix = this._getPrefix(item.aggregate, item.partitionKey);
        const sItem = JSON.stringify(item);
        const start = new Date().getTime();
        redis.zadd(`${prefix}aggregate:${item.aggregateId}:events`, item.streamRevision, sItem).then((errors, data) => {
            const end = new Date().getTime();
            const duration = end - start;
            totalDuration += duration;
            totalItems++;
            if (duration > 100) {
                // console.warn(`addEvents greater than 100ms. actual ${end - start}ms.`);
            }

            addDuration('addEvents', start, end);
            callback();
            // const hasError = _.find(errors, (err) => {
            //     return err[0];
            // });

            // if (hasError) {
            //     // TODO: handler error
            //     console.error('hasError');
            //     console.error(hasError);
            // } else {
            //     callback();
            // }
        });
    },

    /**
     * loads the last event
     * @param {Object} query the query object [optional]
     * @param {Function} callback the function that will be called when this action has finished
     * `function(err, event){}`
     */
    getLastEvent: function (query, callback) {
        implementError(callback);
    },

    /**
     * loads all undispatched events
     * @param {Object} query the query object [optional]
     * @param {Function} callback the function that will be called when this action has finished
     * `function(err, events){}`
     */
    getUndispatchedEvents: function (query, callback) {

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
    setEventToDispatched: function (id, callback) {
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
    clear: function (callback) {
        implementError(callback);
    }
});

module.exports = FastRedis;