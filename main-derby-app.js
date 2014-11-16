var derby = require('derby');
var path = require('path');

var app = derby.createApp('main-app', __filename);

app.loadViews(path.join(__dirname, 'views/main-app'));
app.loadStyles(path.join(__dirname, 'styles/reset'));
app.get('/', function (page, model, params, next) {
    model.subscribe('hello.message', function() {
        page.render();
    });
});

module.exports = app;