
var express = require('express'),
  logger = require('morgan'),
  bodyParser = require('body-parser'),
  cookieParser = require('cookie-parser'),
  session = require('express-session'),
  favicon = require('serve-favicon')

var consolidate = require('consolidate'),
  hogan = require('hogan.js'),
  extend = require('extend'),
  Grant = require('../index').express()

var config = {
  server: require('./config/server.json'),
  credentials: require('./config/credentials.json'),
  options: require('./config/options.json')
}

function transform (config) {
  var result = {server: config.server}
  for (var key in config.credentials) {
    var provider = {}
    extend(true, provider, config.credentials[key], config.options[key])
    result[key] = provider
  }
  return result
}


var grant = new Grant(transform(config))


var app = express()
  .use(favicon(__dirname+'/favicon.ico'))
  .use(cookieParser())
  .use(session({
    name: 'grant', secret: 'very secret',
    saveUninitialized: true, resave: true
  }))

  .use(function (req, res, next) {
    if (/^\/connect\/(\w+)$/.test(req.url)) {
      var name = req.url.replace(/^\/connect\/(\w+)$/,'$1')
      var provider = grant.config[name]

      if (provider.protocol == 'https') {
        if (/^http:/.test(req.headers.referer)) {
          var url = provider.protocol+'://'+provider.host+'/connect/'+provider.name
          return res.redirect(url)
        }
      }
      else {
        if (/^https:/.test(req.headers.referer)) {
          var url = provider.protocol+'://'+provider.host+'/connect/'+provider.name
          return res.redirect(url)
        }
      }
    }

    next()
  })

  .use(grant)
  .set('port', process.env.PORT||3000)

  .set('views', __dirname)
  .set('view engine', 'html')
  .set('view cache', true)
  .engine('html', consolidate.hogan)

  .use(logger('dev'))
  .use(bodyParser.json())
  .use(bodyParser.urlencoded({extended: true}))


app.get('/', function (req, res) {
  var session = req.session.grant||{}

  // feedly sandbox redirect_uri
  if (session.provider == 'feedly' && req.query.code) {
    var q = require('querystring')
    res.redirect('/connect/feedly/callback?'+q.stringify(req.query))
    return
  }

  console.log(req.query)

  var providers = Object.keys(grant.config)
  var params = []

  providers.forEach(function (provider) {
    var obj = {url:'/connect/'+provider, name:provider}
    if (session.provider == provider) {
      obj.credentials = req.query
      var key = req.query.error ? 'error' : 'raw'
      obj.credentials[key] = JSON.stringify(req.query[key], null, 4)
    }
    params.push(obj)
  })
  res.render('template', {
    providers:params,
    count:providers.length-1//linkedin2
  })
})

app.listen(app.get('port'), function() {
  console.log('Express server listening on port ' + app.get('port'))
})
