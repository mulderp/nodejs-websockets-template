var fs = require('fs');
var _ = require('underscore');

// serial port with Firmata
var firmata = require('firmata');

// reference to embedded device
var modem = '/dev/cu.usbmodem14231';

// setup web server
var port = 3474;
var Router = require('router');
var router = Router();
var http = require('http');
var finalhandler = require('finalhandler');
var morgan = require('morgan');
console.log('Starting server at port: ' + port);

// HTTP logging
router.use(morgan('default'));

// sockets to push bytes
var WebSocketServer = require('ws').Server;

// basic static files
router.get('/', function(req, res) {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end(fs.readFileSync('static/index.html'));
});
router.get('/js/:name', function(req,res) {
    res.writeHead(200, {'Content-Type': 'application/javascript'});
    res.end(fs.readFileSync('static/js/' + req.params.name));
});

// API to hardware
var api = Router();

api.get('/:pin/check', function(req, res) {
  board.digitalWrite(req.params.pin, 1);
  res.writeHead(200, {'Content-Type': 'application/json'});
  res.end(JSON.stringify({status: 'ok'}));
});
router.use('/api', api);

// board
var board = new firmata.Board(modem, function(err){
  if (!err) {
    console.log('connected: ' + modem);
  } else {
    console.log('problem with: ' + modem);
    console.log(err);
    process.exit()
  }

  // configure ports
  board.pinMode(5, board.MODES.INPUT);

  // prepare server
  var server = http.createServer(function (req, res) {
    router(req, res, finalhandler(req, res));
  }).listen(port);

  // add websockets
  var wss = new WebSocketServer({server: server});
  wss.on('connection', function connection(ws) {
    console.log('websocket connected');
    ws.on('message', function incoming(message) {
      console.log('received: %s', message);
    });

    board.digitalRead(5, function(val, err) {
      if (val == 1) {
        console.log(val);
        ws.send('{"digital": ' + val + '}');
      }
    });

    var sendWS = _.throttle(function(val) {
      ws.send('{"analog": ' + val + '}');
    }, 50);
    board.analogRead(3, sendWS);
  });
});
