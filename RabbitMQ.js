'use strict';

let async = require( 'async' );

module.exports = function( config ) {

  let CloudQueue = require( './CloudQueue' )( config );

  class RabbitMQ extends CloudQueue {

    constructor() {
      super();

      let defaults = {
	visibilityTimeout: 30,
        waitTimeSeconds: 5,
        maxNumberOfMessages: 1,
      };
      this.options = Object.assign( {}, defaults, config.options );

      this.ch = null;
      require( 'amqplib/callback_api' ).connect( config.connection.url, ( err, conn ) => {
	if ( err ) throw( err );
	process.once('SIGINT', conn.close.bind(conn)); // close it if ctrlc

	conn.on( 'error', (err) => {
	  this.log.warn( 'RabbitMQ connection interrupted:', err );
	});

	conn.createChannel( (err, ch) => {
	  if ( err ) throw( err );
	  this.ch = ch;
	  ch.on( 'error', ( err ) => {
            this.log.error( 'RabbitMQ channel error:', err.message );
            this.ch = null;
          });
          ch.on( 'close', () => {
            this.log.warn( 'RabbitMQ channel closed, exiting.' );
            process.exit(1);
          });
          ch.on( 'blocked', ( reason ) => {
            this.log.warn( 'RabbitMQ channel blocked because:', reason );
          });

          ch.on( 'unblocked', () => {
            this.log.warn( 'RabbitMQ channel unblocked.' );
          });
	});
	
      });
    }

    ready( cb ) {
      async.whilst(
        () => { return this.ch == null; },
        ( cb ) => {
          this.log.warn( 'RabbitMQ waiting for connection...' );
          setTimeout( function() { cb(); }, 500 );
        }, cb );
    }

    _enqueue( queue, message, cb ) {
      this.ready( (err) => {
	if ( err ) return cb( err );
	try {
	  this.ch.assertQueue( queue, { durable: true } );
	  this.ch.sendToQueue( queue, new Buffer( JSON.stringify( message ) ), { persistent: true } );
	  cb();
	} catch( err ) {
	  cb( err );
	}
      });
    }

    _dequeue( queue, cb ) {
      this.ready( (err) => {
	if ( err ) return cb( err );
	try {
	  this.ch.assertQueue( queue, { durable: true } );
	  let msg = false;
	  async.until(
	    () => { return msg !== false; },
	    (cb) => {
	      this.ch.get( queue, { noAck: false }, ( err, _msg ) => {
		if ( err ) return cb( err );
		msg = _msg;
		if ( msg == false ) return setTimeout( () => { return cb(); }, this.options.waitTimeSeconds * 1000 );
		else return cb();
	      });
	    },
	    (err) => {
	      if ( err ) return cb( err );
	      cb( null, [{
		handle: msg,
		msg: JSON.parse( msg.content.toString( 'utf-8' ) )
	      }]);
	    });
	} catch( err ) {
	  cb( err );
	}
      });
    }

    _remove( queue, handle, cb ) {
      this.ready( (err) => {
	if ( err ) return cb( err );
	try {
	  this.ch.ack( handle );
	  cb();
	} catch( err ) {
	  cb( err );
	}
      });
    }

    _release( queue, handle, cb ) {
      this.ready( (err) => {
	if ( err ) return cb( err );
	try {
	  this.ch.ack( handle );
	  cb();
	} catch( err ) {
	  cb( err );
	}
      });
    }
    
  }

  return new RabbitMQ();
}
