'use strict';

let async = require( 'async' );
let gen = require( 'node-uuid' );

module.exports = function( config ) {

  let CloudQueue = require( './CloudQueue' )( config );

  class RedisQ extends CloudQueue {

    constructor() {
      super();

      let defaults = {};
      this.options = Object.assign( {}, defaults, config.options );

      let redis = require( 'redis' );
      this.q = redis.createClient( config.connection );
      this.q.on( 'error', (err) => {
	// this prevents process from exiting and redis
        // will try to reconnect...
	this.log.warn( err );
      });

    }

    _enqueue( queue, message, cb ) {
      let uuid = gen.v4(); // create a key to store the message
      this.q.set( uuid, JSON.stringify( message ), (err) => {
	if ( err ) return cb( err );
	// now push the uuid on the queue
        this.q.lpush( queue, uuid, cb );
      });
    }

    _dequeue( queue, cb ) {
      let msg = null;
      async.until(
        () => { return msg != null; },
        ( cb ) => {
          this.q.rpop( queue, ( err, uuid ) => {
            if ( err ) return cb( err );
            if ( ! uuid ) {
              setTimeout( () => { cb(); }, 1000 );
            }
            else {
              this.q.get( uuid, ( err, _msg ) => {
                if ( err ) return cb( err );
                if ( ! _msg ) return cb( new Error( 'redis: could not find uuid: ' + uuid ) );
                this.q.del( uuid, ( err ) => {
                  if ( err ) return cb( err );
                  msg = _msg;
                  cb();
                });
              });
            }
          });
        },
        ( err ) => {
          if ( err ) return cb( err );
          cb( null, [{
            handle: null,
            msg: JSON.parse( msg )
          }]);
        });
    }

    _remove( queue, handle, cb ) {
      // there is no remove in redis
      process.nextTick( cb );
    }

    _release( queue, handle, cb ) {
      // there is no release in redis
      process.nextTick( cb );
    }
    
  }

  return new RedisQ();
}
