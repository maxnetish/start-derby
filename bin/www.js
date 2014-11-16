#!/usr/bin/env node

/*
 var app = require('../app');
 var wsServer = require('../services/ws');

 app.set('port', process.env.PORT || 3000);

 // setup http server
 var server = app.listen(app.get('port'), function() {
 debug('Express server listening on port ' + server.address().port);
 });

 // setup web socket server
 var wsServerInstance = wsServer.createServer(server);
 */


var derby = require('derby');

var port = process.env.PORT || 3000;

var listenCallback = function (err) {
    console.log('%d listening. Go to: http://localhost:%d/', process.pid, port);
};

var createServer = function () {
    var mainApp = require('./../main-derby-app');
    var server = require('./../server');
    var http = require('http');
    var options = {};
    var httpServerInstance;

    console.log('setup server');

    server.setup(mainApp, options, function (err, expressApp, upgrade) {
        if (err) throw err;
        httpServerInstance = http.createServer(expressApp);
        httpServerInstance.on('upgrade', upgrade);
        httpServerInstance.listen(port, listenCallback);
    });
};

console.log('run derby now');

try {
    // derby.run(createServer);
    createServer();
}
catch (err){
    console.log(err);
    throw err;
}
