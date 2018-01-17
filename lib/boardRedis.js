/**
 * Created by wuqingkai on 17/12/22.
 */

var DEFAULT_RED_DOT_PREFIX = 'RED:DOT';
var BoardRedis = function(app, opts) {
    this.app = app;
    this.opts = opts || {};
    this.redDotPrefix = opts.redDotPrefix || DEFAULT_RED_DOT_PREFIX;
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

BoardRedis.prototype.addChange = function(redDotId, maxVersion, bnrSwc, cb) {
    var self = this;
    var redisKey = genKey(self, redDotId);
    self.redis.lrange(redisKey, 0, -1, (err, versions)=>{
        if (!!err) {
            cb(err);
            return;
        }
        // 没数据表示首次增加,直接增加版本和符号位
        if (!versions || versions.length < 1) {
            self.redis.rpush(redisKey, bnrSwc, -1, cb);
            return;
        }
        // 肯定有版本
        var versionIdx = 0, length = versions.length;
        for (; versionIdx < length; versionIdx++) {
            if (versions[versionIdx] == -1)
                break;
        }
        // 若符号位是首位,则当前位为尾位
        var currIdx = !!versionIdx ? versionIdx - 1 : maxVersion - 1;
        var currValue = JSON.parse(versions[currIdx]);
        // 若可融入当前版本,则将变更融入当前版本,更新版本内容.
        if (0 == (bnrSwc & currValue)) {
            bnrSwc |= currValue;
            self.redis.lset(redisKey, currIdx, bnrSwc, cb);
            return;
        }
        // 新版本,符号位为新版本位
        currIdx = versionIdx;
        var pipeArr = [];
        pipeArr.push(['lset', redisKey, currIdx, bnrSwc]);
        // 将新版本的下一个位置的值设置成符号位;
        var nextIdx = ++currIdx < maxVersion ? currIdx : 0;
        if (nextIdx == length) {
            pipeArr.push(['rpush', redisKey, -1]);
        } else {
            pipeArr.push(['lset', redisKey, nextIdx, -1]);
        }
        self.redis.multi(pipeArr).exec(cb);
    });
};

/**
 * 获得面板所有版本
 * @param redDotId
 * @param cb
 */
BoardRedis.prototype.getRedDotVersions = function(redDotId, cb) {
    this.redis.lrange(genKey(this, redDotId), 0, -1, cb);
};

/**
 * 获得所有面板值
 * @param cb
 */
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
                var currIdx = -1;
                versions.forEach((v, vIdx)=>{
                    if (v == -1) {
                        currIdx = vIdx;
                        return;
                    }
                    bnrSwc |= v;
                });
                var spl = keys[idx].split(":");
                res[spl[spl.length - 1]] = {version:currIdx, value:bnrSwc};
            });
            cb(null, res);
        });
    });
};

var genKey = function(self, id) {
    return self.redDotPrefix + ":" + id;
};

var genAllKey = function(self) {
    return self.redDotPrefix + ":*";
};
