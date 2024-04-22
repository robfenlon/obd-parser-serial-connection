'use strict';

var chai = require('chai')
  , expect = chai.expect
  , Promise = require('bluebird')
  , util = require('util')
  , proxyquire = require('proxyquire')
  , EventEmitter = require('events').EventEmitter;

chai.use(require('chai-as-promised'));

describe('obd-serial-connection', function () {

  var con = null;

  function getDummyCon(err) {
    return proxyquire('index.js', {
      serialport: {
        SerialPort: (function () {
          function SerialPort() {
            EventEmitter.call(this);

            setTimeout((function () {
              if (err) {
                this.emit('error', new Error('fake error'));
              } else {
                this.emit('open');
              }
            }).bind(this));
          }
          util.inherits(SerialPort, EventEmitter);

          SerialPort.list = () => new Promise((resolve) => resolve(["COM_FOO", "COM_BAR"]));

          return SerialPort
        })()
      }
    });
  }

  beforeEach(function () {
    delete require.cache[require.resolve('./index.js')];
    con = require('index.js');
  });

  it('should export two functions', function () {
    expect(con.getConnector).to.be.a('function');
    expect(con.listConnectors).to.be.a('function');
  });

  it('getConnector should throw an assertion error (opts.serialPath missing)', function () {
    expect(() => {
      con.getConnector({})
    }).to.throw('opts.serialPath should be a string provided to obd-serial-connection');
  });

  it('getConnector should throw an assertion error (opts.serialOpts missing)', function () {
    expect(con.getConnector.bind(con.getConnector, {
      serialPath: 'dev/some-path',
    })).to.throw('opts.serialOpts should be an Object provided to obd-serial-connection');
  });

  it('getConnector should return a function', function () {
    expect(con.getConnector({
      serialPath: 'dev/some-path',
      serialOpts: {}
    })).to.be.a('function');
  });

  it('getConnector should return a promise and resolve successfully', function () {

    con = getDummyCon(false).getConnector;

    function configureFn() {
      return new Promise(function (resolve, reject) {
        setTimeout(resolve, 0);
      });
    }

    return con({
      serialPath: 'dev/some-path',
      serialOpts: {}
    })(configureFn)
      .then(function (conn) {
        expect(conn).to.be.an('object');
        expect(conn.ready).to.be.true;
        expect(conn).to.have.property('_events');
      });
  });

  it('getConnector should return a promise and reject with connection error', function () {

    con = getDummyCon(true).getConnector;

    function configureFn() {
      return new Promise(function (resolve, reject) {
        setTimeout(resolve, 0);
      });
    }

    var p = con({
      serialPath: 'dev/some-path',
      serialOpts: {}
    })(configureFn);

    return expect(p).to.be.eventually.rejectedWith(
      'failed to connect to ecu: fake error'
    );
  });

  it('listConnectors should hit callback when success', function (done) {

    con = getDummyCon(false).listConnectors;

    con(connections => {
      expect(connections).to.deep.equal(["COM_FOO", "COM_BAR"]);
      done();
    });
  });

});
