/**
 * Created by wuqingkai on 17/12/22.
 */

var DEFAULT_RED_POINT_PREFIX = 'RED:POINT';
var BoardRedis = function(app, opts) {
    this.app = app;
    this.opts = opts || {};
    this.redPoitPrefix = opts.redPoitPrefix || DEFAULT_RED_POINT_PREFIX;
    this.port = opts.port;
    this.host = opts.host;
    this.redis = null;
};

module.exports = BoardRedis;

BoardRedis.prototype.start = function(cb) {
    this.redis = require("redis").createClient(this.port, this.host, this.opts);
    if (!!this.opts.auth_pass) {
        this.redis.auth(this.opts.auth_pass);
    }
    this.redis.on("error", function (err) {
        console.error("[broad-redis]" + err.stack);
    });
    this.redis.once('ready', cb);
};

BoardRedis.prototype.stop = function(cb) {
    if (!!this.redis) {
        this.redis.end();
        this.redis = null;
    }
    cb();
};

/**
 * 设置新版本
 * @param redDotId    红点面板id
 * @param maxVersion    最大版本
 * @param bnrSwc        新版本value
 * @param cb
 */
BoardRedis.prototype.setNewVersion = function(redDotId, maxVersion, bnrSwc, cb) {
    var self = this;
    var redisKey = genKey(self, redDotId);
    self.redis.lrange(redisKey, 0, -1, (err, versions)=>{
        if (!!err) {
            cb(err);
            return;
        }
        var pipeArr = [];
        var currIdx = 0, length = !!versions ? versions.length : 0;
        if (length > 0) {
            // 值为-1的位置为新版本位置
            for (; currIdx < length; currIdx++) {
                if (versions[currIdx] == -1)
                    break;
            }
            pipeArr.push(['lset', redisKey, currIdx, bnrSwc]);
        } else {
            pipeArr.push(['rpush', redisKey, bnrSwc]);
            length++;
        }
        // 将新版本的下一个位置的值设置成-1;
        currIdx = ++currIdx < maxVersion ? currIdx : 0;
        if (currIdx == length) {
            pipeArr.push(['rpush', redisKey, -1]);
        } else {
            pipeArr.push(['lset', redisKey, currIdx, -1]);
        }
        self.redis.multi(pipeArr).exec(cb);
    });
};

BoardRedis.prototype.getBoardVersions = function(redDotId, cb) {
    this.redis.lrange(genKey(this, redDotId), 0, -1, cb);
};

BoardRedis.prototype.getAllBoardVersions = function(cb) {
    var self = this;
    self.redis.keys(genAllKey(self), (err, keys)=>{
        if (!!err || !keys || keys.length < 1) {
            cb();
            return;
        }
        var funcArr = [];
        keys.forEach(key=>{
            funcArr.push(['lrange', key, 0, -1]);
        });
        self.redis.multi(funcArr).exec((err, data)=>{
            var res = {};
            data.forEach((versions, idx)=>{
                var bnrSwc = 0;
                versions.forEach(v=>{
                    if (v == -1)
                        return;
                    bnrSwc |= v;
                });
                res[keys[idx]] = bnrSwc;
            });
            cb(null, res);
        });
    });
};

var genKey = function(self, id) {
    return self.redPoitPrefix + ":" + id;
};

var genAllKey = function(self) {
    return self.redPoitPrefix + ":*";
};
