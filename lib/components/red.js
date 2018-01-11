/**
 * Created by wuqingkai on 17/12/25.
 */

var RedDot = require('../redDot');
module.exports = function(app, opts) {
    var redDot = new RedDot(app, opts);
    app.set('redDot', redDot, true);
    return redDot;
};
