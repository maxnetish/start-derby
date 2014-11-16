//var coffeeify = require('coffeeify');

var derby = require('derby');
var express = require('express');
var redis = require('redis');
var connectRedis = require('connect-redis');
var highway = require('racer-highway');
var liveDbMongo = require('livedb-mongo');
var parseUrl = require('url').parse;
var racerBundle = require('racer-bundle');
var responseTime = require('response-time');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var compression = require('compression');
var path = require('path');
var cookieSecret = 'A12-dmcd=Asd365%bjldkloed(uhn';
var session = require('express-session');
var RedisStore = connectRedis(session);

derby.use(racerBundle);

var createUserIdMiddleware = function (req, res, next) {
    var model = req.getModel();
    var userId = req.session.userId;
    if (!userId) userId = req.session.userId = model.id();
    model.set('_session.userId', userId);
    next();
};

var errorApp = derby.createApp();
errorApp.loadViews(path.join(__dirname, 'views/error'));
errorApp.loadStyles(path.join(__dirname, 'styles/reset'));
errorApp.loadStyles(path.join(__dirname, 'styles/error'));
var errorMiddleware = function (err, req, res, next) {
    if (!err) return next();

    var message = err.message || err.toString();
    var status = parseInt(message);
    status = ((status >= 400) && (status < 600)) ? status : 500;

    if (status < 500) {
        console.log(err.message || err);
    } else {
        console.log(err.stack || err);
    }

    var page = errorApp.createPage(req, res, next);
    page.renderStatic(status, status.toString());
};

var setup = function (app, options, cb) {
    var redisClient;
    var mongoUrl = process.env.MONGO_URL || process.env.MONGOHQ_URL;
    var store;
    var publicDir = path.join(__dirname, 'public');
    var handlers;
    var expressApp = express();

    // setup redis client
    if (process.env.REDIS_HOST) {
        redisClient = redis.createClient(process.env.REDIS_PORT, process.env.REDIS_HOST);
        redisClient.auth(process.env.REDIS_PASSWORD);
    } else if (process.env.OPENREDIS_URL) {
        var redisUrl = parseUrl(process.env.OPENREDIS_URL);
        redisClient = redis.createClient(redisUrl.port, redisUrl.hostname);
        redisClient.auth(redisUrl.auth.split(':')[1]);
    } else {
        redisClient = redis.createClient();
    }

    // setup store with mongo & redis
    if (!mongoUrl) {
        mongoUrl = 'mongodb://' +
        (process.env.MONGO_HOST || 'localhost') + ':' +
        (process.env.MONGO_PORT || 27017) + '/' +
        (process.env.MONGO_DB || 'derby-' + (app.name || 'app'));
    }
    // The store creates models and syncs data
    store = derby.createStore({
        db: liveDbMongo(mongoUrl + '?auto_reconnect', {
            safe: true
        }),
        redis: redisClient
    });

    // Здесь приложение отдает свой "бандл"
    // (т.е. здесь обрабатываются запросы к /derby/...)
    //expressApp.use(app.scripts(store));

    // for coffe

     store.on('bundle', function (browserify) {
         // Add support for directly requiring coffeescript in browserify bundles
         //browserify.transform({global: true});

         // HACK: In order to use non-complied coffee node modules, we register it
         // as a global transform. However, the coffeeify transform needs to happen
         // before the include-globals transform that browserify hard adds as the
         // first trasform. This moves the first transform to the end as a total
         // hack to get around this
         //var pack = browserify.pack;
         //browserify.pack = function(opts) {
         //    var detectTransform = opts.globalTransform.shift();
         //    opts.globalTransform.push(detectTransform);
         //    return pack.apply(this, arguments);
         //};
     });


    // prepare racer-highway
    handlers = highway(store);

    // setup express
    // show current mode in console
    console.log('Express starting mode: ' + expressApp.get('env'));
    // to work behind nginx
    expressApp.set("trust proxy", true);
    // adds X-Response-Time header
    expressApp.use(responseTime({digits: 1}));
    // add req parsers
    expressApp.use(bodyParser.json());
    expressApp.use(bodyParser.urlencoded());
    expressApp.use(cookieParser(cookieSecret));
    // add compression
    expressApp.use(compression({
        threshold: 512
    }));
    // place for static
    expressApp.use(express.static(publicDir));
    // add derby stuff
    expressApp
        // Adds req.getModel method
        .use(store.modelMiddleware())
        .use(session({
            secret: process.env.SESSION_SECRET || 'D2352BD1D9A342C39478E5784F9997BC',
            store: new RedisStore({
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379
            }),
            resave: true,
            saveUninitialized: true
        }))
        .use(handlers.middleware)
        .use(createUserIdMiddleware);

    // add additional static dirs
    if (options && options.static) {
        if (Array.isArray(options.static)) {
            for (var i = 0; i < options.static.length; i++) {
                var o = options.static[i];
                expressApp.use(o.route, express.static(o.dir));
            }
        } else {
            expressApp.use(express.static(options.static));
        }
    }

    expressApp
        .use(app.router())
        //.use(expressApp.router)
        .use(errorMiddleware);


    expressApp.all('*', function (req, res, next) {
        next('404: ' + req.url);
    });



    app.writeScripts(store, publicDir, {extensions: ['.js', '.json']}, function (err) {
        cb(err, expressApp, handlers.upgrade);
    });
};

module.exports = {
    setup: setup
};