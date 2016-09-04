# Cloud Queue

This library acts as a common abstraction on top of a number of popular cloud queue
implementations.  It provides a simple, common interface on top of SQS, IronMQ, RabbitMQ,
Azure and Redis.  This means you can write your application code once, and with only config
file changes use any one of the implementations supported by this library.

## The Cloud Queue Model

The cloud queue behavioral model as far as I understand it, is as follows:  When you dequeue a message,
that message is not removed from the queue; it is marked "invisible" so no other possible dequeuer can
dequeue the same message.  This invisibility marker only lasts a certain amout of time.  If that amount
of time runs out before the message is explicity removed from the queue, it becomes visible again for
others to dequeue.  So when you dequeue, at some point you must explicity remove the message you
dequeued from the queue.

The idea is that we want to deal with the problem that someone dequeues a message, but then dies or otherwise
gets into a bad state before the message is actually handled.  If this happens, the temporarily invisible message
will become visible after a short time, allowing someone else to attempt to process the message.

All of the queue implementations in this library follow this model except for RedisQ.  Redis does not have the
capability to emulate this behavior, at least not in any strait forward way.  So the RedisQ should not be used in
production, or at least in any mission critical situation.  Once a message is dequeued, its gone.  If the process
that is processing the message dies before handling the message, its gone forever.

## Queues and Fifos

There are queues and there are fifos.  SQS is a queue but it is not a fifo.  That is, the order in
which things are enqueued is not the order in which they are dequeued.  SQS is suitable as a work queue,
when you don't really care about the strict ordering of messages.  IronMQ and RabbitMQ are strict fifos.
Redis emulates a strict fifo.  I am not sure if Azure is a strict fifo, but I don't think it is.

## Usage

let q = require( 'cloud-queue' )( config );
q.enqueue( 'myQueueName', { my: "message" }, function( err ) {
   // ...
});

## Configuration

The object that you pass when creating a cloud queue looks like:

```javascript
{
  class: QUEUE-CLASS-TO-USE,
  logger: OPTIONAL-WINSTON-LIKE-LOGGER-TO-USE,
  retry_times: HOW-MANY-TIMES-TO-RETRY ( default: 6 ),
  connection: { CONNECTION-OPTIONS },
  options: { OTHER_QUEUE-SPECIFIC-OPTIONS }
}

The class names supported as of this writing are; `SQS`, `IronMQ`, `RabbitMQ`, `AzureQ` and `RedisQ`.
The `connection` object you pass depends on the class you choose.  See "config-example.json" for
how the configuration should look for each class.

## Methods

    enqueue( queueName, message, cb ) - enqueue a message, message should be a JSON object
    dequeue( queueName, cb )          - dequeue one or more messages
    remove( queueName, handle, cb )   - remove a message from the queue
    release( queueName, handle, cb )  - explicity make an invisible message visible again

## Dequeue Message Format

Dequeuing is a blocking operation.  That is, when the callback is called, you will be passed an
error object and an array of messages.  With some queue implementations, the array of messages
might be empty ( SQS, IronMQ ).  The array is an array of items that looks like:

```javascript
{
  "handle": OPAQUE-MESSAGE-HANDLE,
  "msg": THE-MESSAGE-ORIGINALLY-ENQUEUED
}
```

The `handle` is an opaque type.  It is different for different queue implementations and you
should never care about it.  Its the handle you pass when you call `remove()` or `release()`.

