const http = require('http');
const express = require('express');

// Create Express webapp
const app = express();

app.use(express.static('public'))

// Create an http server and run it
const server = http.createServer(app);
const port = process.env.PORT || 3000;
server.listen(port, function() {
  console.log('Express server running on *:' + port);
});
