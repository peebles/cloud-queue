'use strict';

let async = require( 'async' );

module.exports = function( config ) {

  let CloudQueue = require( './CloudQueue' )( config );

  class RacQ extends CloudQueue {

    constructor() {
      super();

      let defaults = {
	visibilityTimeout: 30,
        waitTimeSeconds: 5,
        maxNumberOfMessages: 1,
      };

      this.options = Object.assign( {}, defaults, config.options );
      let Q = require('racq');
      this.q = new Q( config.connection );
      this.authenticated = false;
    }

    _ready( cb ) {
      if ( this.authenticated ) return cb();
      this.q.authenticate( (err) => {
	if ( err ) this.log.error( "RackQ: Failed to authenticate:", err );
	this.authenticated = true;
	cb( err );
      });
    }

    _ensureQueue( queue, cb ) {
      this._ready( (err) => {
	if ( err ) return cb( err );
	this.q.queueExists( queue, (err) => {
	  if ( ! err ) return cb( null, true );
	  this.q.createQueue( queue, cb );
	});
      });
    }
    
    _enqueue( queue, message, cb ) {
      this._ensureQueue( queue, (err) => {
	if ( err ) return cb( err );
	this.q.postMessages( queue, message, cb );
      });
    }

    _dequeue( queue, cb ) {
      this._ensureQueue( queue, (err) => {
	if ( err ) return cb( err );

	let messages = [];
	async.until(
	  () => { return messages.length; },
	  (cb) => {
	    let opts = {
	      limit: this.options.maxNumberOfMessages,
	      ttl: this.options.visibilityTimeout,
	      grace: this.options.grace || this.options.visibilityTimeout,
	    };
	    this.q.claimMessages( queue, opts, (err, _messages) => {
	      if ( err ) return cb( err );
	      messages = _messages;
	      if ( ! (messages && messages.length) ) {
		return setTimeout( () => {
		  cb();
		}, this.options.waitTimeSeconds * 1000 );
	      }
	      cb();
	    });
	  },
	  (err) => {
	    if ( err ) return cb( err );
	    cb( null, messages.map( (m) => {
	      return {
		handle: m,
		msg: m.body
	      };
	    }));
	  }
	);
      });
    }

    _remove( queue, handle, cb ) {
      this.q.deleteMessages( queue, handle.id, handle.claimId, cb );
    }

    _release( queue, handle, cb ) {
      this.q.releaseClaims( queue, handle.claimId, cb );
    }
    
  }

  return new SQS();
}
