var async = require( 'async' );
var config = require( './config' );
var log = require( 'winston' );

var qType = process.argv[2];
var count = process.argv[3] || 100;
var qConfig = config[ qType ];
if ( ! qConfig ) {
  console.log( 'Usage: $0 qType [count]: No config found for', qType );
  process.exit(1);
}

qConfig.logger = log;
var q = require( './index' )( qConfig );

var iter  = 1;
var msg = {
  payload: 'This is a Test',
};

async.whilst( 
  function() { return ( iter <= count ); },
  function( cb ) {
    msg.seq = iter;
    console.log( 'enqueue:', JSON.stringify( msg ) );
    q.enqueue( 'peebtest', msg, function( err ) {
      if ( err ) return cb( err );
      iter += 1;
      cb();
    });
  },
  function( err ) {
    if ( err ) log.error( 'ERROR:', err.message );
    console.log( 'done enqueuing messages, waiting forever ...' );
    async.forever(
      function( cb ) {
	setTimeout( function() { cb(); }, 1000 );
      },
      function(err) {
	console.log( err );
	process.exit(1);
      });
  }
);

