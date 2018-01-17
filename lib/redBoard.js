/**
 * Created by wuqingkai on 17/12/22.
 */
var binarySwitch = require('binary-switch');

var DEFAULT_MAX_VERSION = 10;
var MAX_VERSION = 'maxVersion';
var RED_DOT = 'redDot';

var STATUS_WAITING = 0;
var STATUS_ADDING = 1;

/**
 * 红点面板
 * @param boardId
 * @param boardRedis
 * @param boardInfo
 * @constructor
 */
var RedBoard = function(boardId, boardRedis, boardInfo) {
    this.id = boardId;
    this.boardRedis = boardRedis;
    this.dots = boardInfo[RED_DOT];
    var maxVersion = +boardInfo[MAX_VERSION].toString();
    this.maxVersion = !isNaN(maxVersion) ? maxVersion : DEFAULT_MAX_VERSION;
    this.status = STATUS_WAITING;
    this.dotsForAdd = [];
};

module.exports = RedBoard;

/**
 * 新增红点变更,若融于当前版本,则加入当前版本,否则新增以版本
 * @param {Array||string} dotIds    单个或者多个模块id
 */
RedBoard.prototype.addChange = function(dotIds) {
    if (!dotIds) {
        return;
    }
    var self = this;
    var bnrSwc = new binarySwitch();
    var idx = -1;
    var _addToBnr = function(dotId) {
        idx = self.dots.indexOf(dotId);
        if (idx != -1)
            bnrSwc.on(idx);
    };
    if (Array.isArray(dotIds)) {
        dotIds.forEach(dotId=>{
            _addToBnr(dotId)
        });
    } else {
        _addToBnr(dotIds);
    }
    var forAdd = bnrSwc.getBinary();
    if (forAdd == 0)
        return;
    // 将forAdd放入队列,按顺序一个一个更新
    self.dotsForAdd.push(forAdd);
    if (++self.status != STATUS_ADDING)
        return;
    _addChange(self);
};

var _addChange = function(self) {
    var end = function() {
        var forAdd = self.dotsForAdd.shift();
        if (!!forAdd)
            doRedis(forAdd);
        else
            self.status = STATUS_WAITING;
    };
    var doRedis = function(value) {
        self.boardRedis.addChange(self.id, self.maxVersion, value, (err)=>{
            if (!!err) console.error(err.stack);
            end();
        });
    };
    doRedis(self.dotsForAdd.shift());
};

/**
 * 客户端根据保存的版本号,获取变更
 * @param version   客户端版本号
 * @param cb
 */
RedBoard.prototype.getRedBinaryByVersion = function(version, cb) {
    var self = this;
    self.boardRedis.getRedDotVersions(self.id, (err, data)=>{
        if (!!err) {
            cb(err);
            return;
        } else if (!data || data.length < 1) {
            cb(null, 0);
            return;
        }
        var versions = data, length = versions.length;
        var versionIdx = 0;
        for (; versionIdx < length; versionIdx++) {
            if (versions[versionIdx] == -1)
                break;
        }
        var _getVersionsByStartVersion = function(start, versionIdx, versions) {
            var res = 0;
            var idx = start || 0, length = versions.length;
            // 累加start-currVersion的所有动态
            for (;idx < length; idx++) {
                res |= versions[idx];
                if (idx == versionIdx)
                    return res;
            }
            // 若从version到max不包含currVersion,则继续累加0-currVersion的所有动态
            for (idx = 0; idx < versionIdx; idx++)
                res |= versions[idx];
            return res;
        };
        var bnrValue = _getVersionsByStartVersion(version, versionIdx, versions);
        var currIdx = !!versionIdx ? versionIdx -1 : self.maxVersion -1;
        var result = {version:currIdx, value:bnrValue};
        cb(null, result);
    });
};