/**
 * Created by wuqingkai on 17/12/21.
 */
var path = require('path');
var binarySwitch = require('binary-switch');
var RedBoard = require('./redBoard');
var BoardRedis = require('./boardRedis');

var DEFAULT_RED_BOARD_PATH = '/app/data/json/redBoard.json';

/**
 * 红点变更
 * @param {Array || string}    dotIds
 * @private
 */
var _onChange = function(dotIds) {
    if (!dotIds) {
        console.warn(`redBoard ${this.id} received an none redDot`);
        return;
    }
    this.addChange(dotIds);
};

var RedDotMgr = function(app, opts) {
    this.app = app;
    this.event = app.event;
    this.opts = opts || {};
    this.redBoardPath = opts.redBoardPath || DEFAULT_RED_BOARD_PATH;
    this.boardRedis = new BoardRedis(app, opts);
    this.redDots = {};
};

RedDotMgr.prototype.start = function(cb) {
    var self = this;
    self.boardRedis.start(()=>{
        var redDotInfo = require(path.join(self.app.getBase(), self.redBoardPath));
        for (let redId in redDotInfo) {
            if (!redDotInfo.hasOwnProperty(redId) || typeof redDotInfo[redId] == 'function')
                continue;
            var redBoard = new RedBoard(redId, self.boardRedis, redDotInfo[redId]);
            self.redDots[redId] = redBoard;
            self.event.on(redId, _onChange.bind(redBoard));
        }
        cb();
    });
};

RedDotMgr.prototype.stop = function(cb) {
    this.boardRedis.stop(cb);
};

RedDotMgr.prototype.getRedBinary = function(boardId, version, cb) {
    var redBoard = this.redDots[boardId];
    if (!redBoard) {
        cb(`no this redBoard`);
    } else {
        redBoard.getRedBinaryByVersion(version, cb);
    }
};

RedDotMgr.prototype.getAllRedDot = function(cb) {
    this.boardRedis.getAllBoardVersions((err, data)=>{
        cb(null, {data:data});
    });
};

module.exports = RedDotMgr;