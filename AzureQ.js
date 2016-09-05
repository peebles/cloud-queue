'use strict';

let async = require( 'async' );

module.exports = function( config ) {

  let CloudQueue = require( './CloudQueue' )( config );

  class AzureQ extends CloudQueue {

    constructor() {
      super();

      let defaults = {
	visibilityTimeout: 30,
        waitTimeSeconds: 5,
        maxNumberOfMessages: 1,
      };
      this.options = Object.assign( {}, defaults, config.options );

      try {
        this.q = require( 'azure-sb' ).createServiceBusService(
          config.connection.connectionString
        );
      } catch( err ) {
	throw( err );
      }
    }

    _showStopTrying( err ) {
      return err.message.match( /The lock supplied is invalid/ );
    }
    
    _enqueue( queue, message, cb ) {
      this.q.createQueueIfNotExists( queue, this.options, (err) => {
	if ( err ) return cb( err );
	this.q.sendQueueMessage( queue, { body: JSON.stringify( message ) }, ( err ) => {
	  if ( err ) return cb( err );
	  cb();
	});
      });
    }

    _dequeue( queue, cb ) {
      this.q.createQueueIfNotExists( queue, this.options, (err) => {
	if ( err ) return cb( err );
	let gotit = false;
	let msg = null;
	async.until( 
          () => { return gotit; },
	  (cb) => {
	    this.q.receiveQueueMessage( queue, { isPeekLock: true }, (err, _msg) => {
	      if ( err && err == 'No messages to receive' ) {
		return setTimeout( () => {
		  cb();
		}, this.options.waitTimeSeconds * 1000 );
	      }
              if ( err ) return cb( new Error( err ) );
              gotit = true;
	      msg = _msg;
	      cb();
	    });
	  },
	  (err) => {
	    if ( err ) return cb( err );
	    cb([{
	      handle: msg,
	      msg: JSON.parse( msg.body ),
	    }]);
	  });
      });
    }

    _remove( queue, handle, cb ) {
      this.q.deleteMessage( handle, cb );
    }

    _release( queue, handle, cb ) {
      this.q.unlockMessage( handle, cb );
    }
    
  }

  return new AzureQ();
}
