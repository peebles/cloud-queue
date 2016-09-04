'use strict';

module.exports = function( config ) {

  let CloudQueue = require( './CloudQueue' )( config );

  class IronMQ extends CloudQueue {

    constructor() {
      super();

      let defaults = {
	readDelay: 1,
        visibilityTimeout: 30,
        waitTimeSeconds: 5,
        maxNumberOfMessages: 1,
        attributes: [ 'All' ],
      };

      this.options = Object.assign( {}, defaults, config.options );

      let iron_mq = require( 'iron_mq' );
      this.iron = new iron_mq.Client( config.connection );
    }

    _shouldStopTrying( err ) {
      return err.message.match( /Reservation has timed out/ );
    }

    _enqueue( queue, message, cb ) {
      let q = this.iron.queue( queue );
      q.post( JSON.stringify( message ), cb );
    }

    _dequeue( queue, cb ) {
      let q = this.iron.queue( queue );
      let opts = {
        n: this.options.maxNumberOfMessages,
        timeout: this.options.visibilityTimeout,
        wait: this.options.waitTimeSeconds,
      };
      q.reserve( opts, function( err, _message ) {
	if ( err ) return cb( err );
        if ( ! _message ) return cb( null, [] );
        var messages = _message;
        if ( opts.n == 1 ) messages = [ _message ];
        cb( null, messages.map( ( message ) => {
          return {
            handle: message,
            msg: JSON.parse( message.body ),
          };
        }));
      });
    }

    _remove( queue, handle, cb ) {
      let q = this.iron.queue( queue );
      let opts = {};
      if ( handle.reservation_id ) opts.reservation_id = handle.reservation_id;
      q.del( handle.id, opts, cb );
    }

    _release( queue, handle, cb ) {
      let q = this.iron.queue( queue );
      q.msg_release( handle.id, handle.reservation_id, { delay: 4600 }, cb );
    }
    
  }

  return new IronMQ();
}
