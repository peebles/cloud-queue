'use strict';

module.exports = function( config ) {

  let CloudQueue = require( './CloudQueue' )( config );

  class SQS extends CloudQueue {

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

      let AWS = require( 'aws-sdk' );
      AWS.config.update( config.connection );
      this.q = new AWS.SQS();
    }

    _enqueue( queue, message, cb ) {
      this.q.createQueue({ QueueName: queue }, ( err, data ) => {
	if ( err ) return cb( err );
	let url = data.QueueUrl;
	this.q.sendMessage({ QueueUrl: url, MessageBody: JSON.stringify( message ), DelaySeconds: 0 }, ( err ) => {
	  cb( err );
	});
      });
    }

    _dequeue( queue, cb ) {
      this.q.createQueue({ QueueName: queue }, ( err, data ) => {
	if ( err ) return cb( err );
	let url = data.QueueUrl;
	this.q.receiveMessage({
	  QueueUrl: url,
          AttributeNames: this.options.attributes,
          MaxNumberOfMessages: this.options.maxNumberOfMessages,
          VisibilityTimeout: this.options.visibilityTimeout,
          WaitTimeSeconds: this.options.waitTimeSeconds
	}, (err, data ) => {
	  if ( err ) return cb( err );
	  if ( ! ( data && data.Messages ) ) return cb( null, [] );
	  let msgs = [];
	  data.Messages.forEach( (message) => {
	    msgs.push({
	      handle: message.ReceiptHandle,
	      msg: JSON.parse( message.Body )
	    });
	  });
	  cb( null, msgs );
	});
      });
    }

    _remove( queue, handle, cb ) {
      this.q.createQueue({ QueueName: queue }, ( err, data ) => {
	if ( err ) return cb( err );
	let url = data.QueueUrl;
	this.q.deleteMessage({ QueueUrl: url, ReceiptHandle: handle}, (err) => {
	  cb( err );
	});
      });
    }

    _release( queue, handle, cb ) {
      this.q.createQueue({ QueueName: queue }, ( err, data ) => {
	if ( err ) return cb( err );
	let url = data.QueueUrl;
	this.q.changeMessageVisibility({ QueueUrl: url, ReceiptHandle: handle, VisibilityTimeout: 0 }, (err) => {
	  cb( err );
	});
      });
    }
    
  }

  return new SQS();
}
