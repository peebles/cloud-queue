'use strict';

let retry = require( 'retry-unless' );

module.exports = function( config ) {

  class CloudQueue {

    constructor() {
      if ( config.logger ) {
	this.log = config.logger;
      }
      else {
	this.log = require( 'winston' );
      }
    }

    // subclasses can override
    _shouldStopTrying( err ) {
      return false;
    }

    enqueue( queue, message, cb ) {
      retry({ times: config.retry_times || 6,
	      interval: (retryCount) => {
		return 50 * Math.pow( 2, retryCount );
	      }
      }, (cb) => {
	this._enqueue( queue, message, cb );
      }, (err) => {
	// return true if we should stop, false if we should continue
	return this._shouldStopTrying( err );
      }, cb );
    }

    dequeue( queue, cb ) {
      retry({ times: config.retry_times || 6,
	      interval: (retryCount) => {
		return 50 * Math.pow( 2, retryCount );
	      }
      }, (cb) => {
	this._dequeue( queue, cb );
      }, (err) => {
	// return true if we should stop, false if we should continue
	return this._shouldStopTrying( err );
      }, cb );
    }

    // Remove the message handle from the queueu
    remove( queue, handle, cb ) {
      retry({ times: config.retry_times || 6,
	      interval: (retryCount) => {
		return 50 * Math.pow( 2, retryCount );
	      }
      }, (cb) => {
	this._remove( queue, handle, cb );
      }, (err) => {
	// return true if we should stop, false if we should continue
	return this._shouldStopTrying( err );
      }, cb );
    }

    // Release the message (handle) back into the queue for
    // someone else to handle.
    release( queue, handle, cb ) {
      retry({ times: config.retry_times || 6,
	      interval: (retryCount) => {
		return 50 * Math.pow( 2, retryCount );
	      }
      }, (cb) => {
	this._release( queue, handle, cb );
      }, (err) => {
	// return true if we should stop, false if we should continue
	return this._shouldStopTrying( err );
      }, cb );
    }

    _enqueue( queue, message, cb ) {
      throw( new Error( 'subclass must override' ) );
    }

    _dequeue( queue, cb ) {
      throw( new Error( 'subclass must override' ) );
    }

    _remove( queue, handle, cb ) {
      throw( new Error( 'subclass must override' ) );
    }

    _release( queue, handle, cb ) {
      throw( new Error( 'subclass must override' ) );
    }

  }

  return CloudQueue;
}
