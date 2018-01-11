/**
 * Created by wuqingkai on 17/12/22.
 */
var binarySwitch = require('binary-switch');

var DEFAULT_MAX_VERSION = 10;
var MAX_VERSION = 'maxVersion';
var RED_DOT = 'redDot';

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
    this.points = boardInfo[RED_DOT];
    var maxVersion = +boardInfo[MAX_VERSION].toString();
    this.maxVersion = !isNaN(maxVersion) ? maxVersion : DEFAULT_MAX_VERSION;
};

module.exports = RedBoard;

/**
 * 每一次改动,将会更新一个版本
 * @param pointIdArr
 */
RedBoard.prototype.addChange = function(pointIdArr) {
    var self = this;
    var bnrSwc = new binarySwitch();
    var idx = -1;
    pointIdArr.forEach(pointId=>{
        idx = self.points.indexOf(pointId);
        if (idx != -1)
            bnrSwc.on(idx);
    });
    var value = bnrSwc.getBinary();
    if (value == 0)
        return;
    self.boardRedis.setNewVersion(self.id, self.maxVersion, value, err=>{
        if (!!err)
            throw new Error(`setNewVersion err:${err.stack}`);
    });
};

/**
 * 获得从某一版本开始到当前版本的所有动态
 * @param version
 * @param cb
 */
RedBoard.prototype.getRedBinaryByVersion = function(version, cb) {
    var self = this;
    self.boardRedis.getBoardVersions(self.id, (err, data)=>{
        if (!!err) {
            cb(err);
            return;
        } else if (!data || data.length < 1) {
            cb(null, 0);
            return;
        }
        var versions = data, length = data.length;
        var currVersion = 0;
        for (; currVersion < length; currVersion++) {
            if (data[currVersion] == -1)
                break;
        }
        cb(null, _getVersionsByStartVersion(version, currVersion, self.maxVersion, versions));
    });
};

var _getVersionsByStartVersion = function(start, currVersion, maxVersion, versions) {
    if (start == currVersion)
        return 0;
    var idx = start || 0;
    var res = 0;
    maxVersion = Math.max(maxVersion, versions.length);
    // 累加start-currVersion的所有动态
    for (;idx <= maxVersion; idx++) {
        res |= versions[idx];
        if (idx == currVersion)
            return res;
    }
    // 若从version到max不包含currVersion,则继续累加0-currVersion的所有动态
    for (idx = 0; idx <= currVersion; idx++)
        res |= versions[idx];
    return res;
};

RedBoard.prototype.getAllVersion = function(cb) {
    var self = this;
    self.boardRedis.getAllVersion(self.id, (err, versions)=>{
        if (!!err || !versions || versions.length < 1) {
            cb(null, 0);
            return;
        }
        var res = 0;
        versions.forEach(version=>{
            res |= version;
        });
        cb(null, res);
    });
};